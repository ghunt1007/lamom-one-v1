// (v1.0.1128) ตอบลูกค้าอัตโนมัติด้วย AI + สร้างลีดเองจากแชต — เปิด/ปิดได้จากหน้า "เชื่อมช่องทาง" แท็บ 🤖 ตอบอัตโนมัติ
// ไม่ต้องแก้โค้ด/ตั้งตัวแปรใน Cloudflare อีก (เดิม AUTO_LEAD_FROM_LINE ต้องแก้ไฟล์ toml)
//
// ค่าตั้งเก็บที่ Firestore: system_integrations/inbox_auto (เจ้าของโปรแกรมแก้ได้คนเดียวตามกฎฐานข้อมูล)
// AI ใช้ Gemini ผ่าน secret GEMINI_API_KEY ของ worker นี้ (ใส่ครั้งเดียวใน Cloudflare — ค่าเดียวกับของ lamom-ai-proxy)
//
// กันพลาด:
// - พนักงานตอบเองในแชตนั้นภายใน 30 นาที → AI เงียบ (คนรับช่วงแล้ว)
// - แชตที่กด "⏸ หยุด AI" (social_threads.aiPaused) → AI เงียบตลอด
// - ตอบได้ไม่เกิน 6 ครั้งต่อแชตต่อชั่วโมง
// - ลูกค้าขอคุยกับคน / เรื่องที่ AI ไม่รู้ → AI บอกว่าจะให้พนักงานติดต่อกลับ และติดธง needsHuman ให้ทีมเห็น
// - ห้าม AI แต่งราคา/โปรที่ไม่มีในข้อมูล (บอกในคำสั่ง) และไม่ใส่ข้อมูลภายใน (มาร์จิ้น ค่าคอม)

import { normalizeProgram, isActiveOn, CUSTOMER_TYPES } from '../src/utils/salesPrograms.js'

export const INBOX_AUTO_DOC = 'system_integrations/inbox_auto'
export const AI_MODEL = 'gemini-2.5-flash'
export const HUMAN_HOLD_MS = 30 * 60 * 1000
export const AI_MAX_PER_HOUR = 6
export const HANDOFF_TAG = '[ส่งต่อพนักงาน]'

export const INBOX_DEFAULTS = {
  autoLead: false, // ลูกค้าใหม่ที่ทักมา → สร้างเป็นลูกค้า (ที่มา LINE/Facebook) ให้อัตโนมัติ
  autoAssign: false, // แจกลีดใหม่ให้เซลส์ที่ลงทะเบียน LINE แบบวนคิว
  aiReply: false, // AI ตอบลูกค้าอัตโนมัติ
  aiMode: 'always', // always = ตอบทุกเวลา · offhours = ตอบเฉพาะนอกเวลาทำการ
  aiStart: '08:30',
  aiEnd: '18:00',
  aiChannels: 'all', // all หรือรายชื่อช่องทางคั่นด้วย , เช่น main,team,fb
  aiName: 'น้องลามิ',
  aiInfo: '', // ข้อมูลโชว์รูมที่ให้ AI ใช้ตอบ เช่น ที่อยู่ เวลาเปิด เบอร์โทร รุ่นที่ขาย
  publicForm: false, // (v1.0.1140) เปิดฟอร์มรับลีดสาธารณะ /lead.html
}

const bool = (v, d) => (v === true || v === false ? v : d)
const str = (v, d, max = 2000) => (typeof v === 'string' ? v.slice(0, max) : d)
const hhmm = (v, d) => (/^([01]\d|2[0-3]):[0-5]\d$/.test(String(v || '')) ? v : d)

export function normalizeInboxAuto(raw = {}, env = {}) {
  const r = raw || {}
  return {
    autoLead: bool(r.autoLead, env.AUTO_LEAD_FROM_LINE === '1'),
    autoAssign: bool(r.autoAssign, env.AUTO_ASSIGN_LINE_LEADS === '1'),
    aiReply: bool(r.aiReply, false),
    aiMode: r.aiMode === 'offhours' ? 'offhours' : 'always',
    aiStart: hhmm(r.aiStart, INBOX_DEFAULTS.aiStart),
    aiEnd: hhmm(r.aiEnd, INBOX_DEFAULTS.aiEnd),
    aiChannels: str(r.aiChannels, 'all', 300).trim() || 'all',
    aiName: str(r.aiName, INBOX_DEFAULTS.aiName, 40).trim() || INBOX_DEFAULTS.aiName,
    aiInfo: str(r.aiInfo, '', 3000),
    publicForm: bool(r.publicForm, false),
  }
}

// เวลาไทย HH:MM (ไม่มีเวลาออมแสง)
export function bangkokHHMM(now = new Date()) {
  const d = new Date(now.getTime() + 7 * 3600 * 1000)
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}
export function inWorkingHours(s, now = new Date()) {
  const t = bangkokHHMM(now)
  return s.aiStart <= s.aiEnd ? t >= s.aiStart && t < s.aiEnd : t >= s.aiStart || t < s.aiEnd
}
export function channelAllowed(s, channel = 'main') {
  if (!s.aiChannels || s.aiChannels === 'all') return true
  return s.aiChannels.split(',').map(x => x.trim().toLowerCase()).filter(Boolean).includes(String(channel || 'main').toLowerCase())
}

const msOf = v => (v ? new Date(v).getTime() || 0 : 0)

// ตัดสินว่า AI ควรตอบข้อความนี้ไหม — คืน { ok, why }
export function shouldAiReply(s, { channel = 'main', thread = {}, now = new Date(), hasKey = true, isText = true } = {}) {
  if (!s.aiReply) return { ok: false, why: 'off' }
  if (!hasKey) return { ok: false, why: 'no-key' }
  if (!isText) return { ok: false, why: 'not-text' }
  if (!channelAllowed(s, channel)) return { ok: false, why: 'channel' }
  if (s.aiMode === 'offhours' && inWorkingHours(s, now)) return { ok: false, why: 'hours' }
  if (thread.aiPaused === true) return { ok: false, why: 'paused' }
  const lastHuman = msOf(thread.lastHumanAt)
  if (lastHuman && now.getTime() - lastHuman < HUMAN_HOLD_MS) return { ok: false, why: 'human' }
  const winStart = msOf(thread.aiWindowAt)
  const count = Number(thread.aiCount || 0)
  if (winStart && now.getTime() - winStart < 3600 * 1000 && count >= AI_MAX_PER_HOUR) return { ok: false, why: 'rate' }
  return { ok: true, why: '' }
}
export function nextAiCounter(thread = {}, now = new Date()) {
  const winStart = msOf(thread.aiWindowAt)
  if (winStart && now.getTime() - winStart < 3600 * 1000) return { aiWindowAt: new Date(winStart), aiCount: Number(thread.aiCount || 0) + 1 }
  return { aiWindowAt: now, aiCount: 1 }
}

// ข้อความโปรที่ลูกค้าเห็นได้ (ไม่มีมาร์จิ้น/ค่าคอม/โบนัส/เงินสนับสนุน)
export function promoLines(programs = [], today = '') {
  return programs
    .map(raw => (raw && !raw.deleted ? { ...normalizeProgram(raw), deleted: false } : null))
    .filter(p => p && CUSTOMER_TYPES.includes(p.type) && isActiveOn(p, today))
    .slice(0, 12)
    .map(p => {
      const bits = [p.title]
      if (p.models.length) bits.push(`รุ่น ${p.models.join(', ')}`)
      if (p.type === 'finance' && p.rates?.length) bits.push(`${p.financeCo ? p.financeCo + ' ' : ''}` + p.rates.slice(0, 4).map(r => `ดาวน์ ${r.down}% ${r.months} งวด ดอกเบี้ย ${r.rate}%`).join(' / '))
      if (p.gift) bits.push(`ของแถม ${p.gift}`)
      if (p.conditions) bits.push(`เงื่อนไข ${p.conditions.slice(0, 160)}`)
      if (p.dateTo) bits.push(`ถึง ${p.dateTo.slice(8, 10)}/${p.dateTo.slice(5, 7)}/${Number(p.dateTo.slice(0, 4)) + 543}`)
      return '- ' + bits.filter(Boolean).join(' · ').slice(0, 400)
    })
}

export function buildAiReplyPrompt({ settings, history = [], promos = [], customerName = '', platform = 'LINE' }) {
  const sys = [
    `คุณคือ "${settings.aiName}" ผู้ช่วยตอบแชตลูกค้าของโชว์รูมรถยนต์ ตอบภาษาไทย สุภาพ เป็นกันเอง สั้น 1–4 บรรทัด ใช้ "ค่ะ"`,
    'เป้าหมาย: ตอบคำถามเบื้องต้น แล้วชวนลูกค้าให้ชื่อและเบอร์โทร หรือนัดเข้าโชว์รูม/ทดลองขับ ให้เซลส์ติดต่อกลับ',
    'ห้ามแต่งราคา ส่วนลด ดอกเบี้ย ของแถม หรือสต็อกที่ไม่มีในข้อมูลด้านล่าง ถ้าไม่รู้ให้บอกว่าจะให้เซลส์แจ้งรายละเอียดให้',
    'ห้ามบอกข้อมูลภายใน (ต้นทุน มาร์จิ้น ค่าคอม) ห้ามขอเลขบัตรประชาชนหรือข้อมูลการเงิน',
    `ถ้าลูกค้าขอคุยกับพนักงาน ไม่พอใจ ร้องเรียน หรือถามเรื่องที่ต้องให้คนตัดสินใจ ให้ตอบว่าจะให้พนักงานติดต่อกลับโดยเร็ว แล้วพิมพ์ ${HANDOFF_TAG} ไว้ท้ายข้อความ`,
    'เวลาให้ใช้รูปแบบ 24 ชั่วโมง (เช่น 09:00, 18:30) และวันที่แบบ วว/ดด/ปปปป',
    settings.aiInfo ? `ข้อมูลโชว์รูม:\n${settings.aiInfo}` : '',
    promos.length ? `โปรโมชันที่ใช้ได้ตอนนี้:\n${promos.join('\n')}` : 'ตอนนี้ไม่มีข้อมูลโปรโมชันในระบบ — ถ้าลูกค้าถามโปร ให้บอกว่าเซลส์จะแจ้งโปรล่าสุดให้',
    customerName ? `ชื่อลูกค้าในแชต: ${customerName} (ช่องทาง ${platform})` : `ช่องทาง ${platform}`,
  ].filter(Boolean).join('\n\n')
  const contents = history.slice(-10).map(m => ({ role: m.direction === 'out' ? 'model' : 'user', parts: [{ text: String(m.text || '').slice(0, 1000) }] }))
  // Gemini ต้องเริ่มด้วย user และจบด้วย user
  while (contents.length && contents[0].role !== 'user') contents.shift()
  return { systemInstruction: { parts: [{ text: sys }] }, contents }
}

export function cleanAiReply(text = '') {
  let t = String(text || '').trim()
  const handoff = t.includes(HANDOFF_TAG)
  t = t.split(HANDOFF_TAG).join('').replace(/\*\*/g, '').trim()
  if (t.length > 900) t = t.slice(0, 900).replace(/\s+\S*$/, '') + '…'
  return { text: t, handoff }
}

export async function geminiReply(env, prompt, fetchImpl = fetch) {
  if (!env.GEMINI_API_KEY || !prompt.contents.length) return ''
  const res = await call(fetchImpl, `https://generativelanguage.googleapis.com/v1beta/models/${AI_MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
    body: JSON.stringify({ ...prompt, generationConfig: { temperature: 0.4, maxOutputTokens: 500, thinkingConfig: { thinkingBudget: 0 } } }),
  })
  if (!res?.ok) return ''
  const d = await res.json().catch(() => ({}))
  return (d.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('').trim()
}

// ── Firestore REST helpers (ไม่พึ่ง daily-report.js กัน import วน) ──
// fetch ที่ไม่โยน error (คืน null แทน) — รวมกรณีโยนแบบ sync
async function call(fetchImpl, url, init) { try { return await fetchImpl(url, init) } catch { return null } }
const fsBase = env => `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`
function decode(v = {}) {
  if (v.stringValue !== undefined) return v.stringValue
  if (v.integerValue !== undefined) return Number(v.integerValue)
  if (v.doubleValue !== undefined) return v.doubleValue
  if (v.booleanValue !== undefined) return v.booleanValue
  if (v.timestampValue !== undefined) return v.timestampValue
  if (v.nullValue !== undefined) return null
  if (v.mapValue !== undefined) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, decode(x)]))
  if (v.arrayValue !== undefined) return (v.arrayValue.values || []).map(decode)
  return null
}
const docObj = d => ({ id: String(d?.name || '').split('/').pop(), ...Object.fromEntries(Object.entries(d?.fields || {}).map(([k, v]) => [k, decode(v)])) })

let cache = { at: 0, raw: null }
export function __resetInboxCache() { cache = { at: 0, raw: null } }
export async function readInboxAuto(env, token, fetchImpl = fetch) {
  if (!cache.raw || Date.now() - cache.at >= 60_000) {
    let raw = {}
    if (token) {
      const r = await call(fetchImpl, `${fsBase(env)}/${INBOX_AUTO_DOC}`, { headers: { Authorization: `Bearer ${token}` } })
      if (r?.ok) raw = docObj(await r.json().catch(() => ({})))
    }
    cache = { at: Date.now(), raw }
  }
  return normalizeInboxAuto(cache.raw, env)
}

async function getThread(env, token, id, fetchImpl) {
  const r = await call(fetchImpl, `${fsBase(env)}/social_threads/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${token}` } })
  return r?.ok ? docObj(await r.json()) : {}
}
async function threadHistory(env, token, threadId, fetchImpl) {
  const r = await call(fetchImpl, `${fsBase(env)}:runQuery`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'social_messages' }], where: { fieldFilter: { field: { fieldPath: 'threadId' }, op: 'EQUAL', value: { stringValue: threadId } } }, limit: 200 } }),
  })
  if (!r?.ok) return []
  const rows = await r.json().catch(() => [])
  return (Array.isArray(rows) ? rows : []).filter(x => x.document).map(x => docObj(x.document)).sort((a, b) => msOf(a.at) - msOf(b.at))
}
async function activePrograms(env, token, fetchImpl) {
  const r = await call(fetchImpl, `${fsBase(env)}/sales_programs?pageSize=200`, { headers: { Authorization: `Bearer ${token}` } })
  if (!r?.ok) return []
  const d = await r.json().catch(() => ({}))
  return (d.documents || []).map(docObj)
}
function fsFields(obj) {
  const v = x => {
    if (x === null || x === undefined) return { nullValue: null }
    if (typeof x === 'boolean') return { booleanValue: x }
    if (typeof x === 'number') return Number.isInteger(x) ? { integerValue: String(x) } : { doubleValue: x }
    if (x instanceof Date) return { timestampValue: x.toISOString() }
    return { stringValue: String(x) }
  }
  return Object.fromEntries(Object.entries(obj).map(([k, x]) => [k, v(x)]))
}
async function patchThread(env, token, id, data, fetchImpl) {
  const fields = fsFields(data)
  const mask = Object.keys(fields).map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&')
  return call(fetchImpl, `${fsBase(env)}/social_threads/${encodeURIComponent(id)}?${mask}`, {
    method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ fields }),
  })
}
async function addMsg(env, token, data, fetchImpl) {
  return call(fetchImpl, `${fsBase(env)}/social_messages`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: fsFields(data) }),
  })
}

export const todayBkk = (now = new Date()) => new Date(now.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10)

/**
 * ให้ AI ตอบแชตนี้ (เรียกหลังบันทึกข้อความลูกค้าแล้ว) — ห้ามทำให้ webhook ล้ม
 * send(text) = ฟังก์ชันส่งข้อความจริงของช่องทางนั้น (LINE reply token / Messenger send API) คืน true เมื่อสำเร็จ
 */
export async function aiAutoReply(env, token, { threadId, channel = 'main', platform = 'line', isText = true, customerName = '', send }, deps = {}) {
  const fetchImpl = deps.fetch || fetch
  const now = deps.now || new Date()
  try {
    if (!token || !threadId || typeof send !== 'function') return { replied: false, why: 'args' }
    const s = await readInboxAuto(env, token, fetchImpl)
    const pre = shouldAiReply(s, { channel, now, hasKey: !!env.GEMINI_API_KEY, isText, thread: {} })
    if (!pre.ok) return { replied: false, why: pre.why }
    const thread = await getThread(env, token, threadId, fetchImpl)
    const gate = shouldAiReply(s, { channel, now, hasKey: true, isText, thread })
    if (!gate.ok) return { replied: false, why: gate.why }
    const [history, programs] = await Promise.all([threadHistory(env, token, threadId, fetchImpl), activePrograms(env, token, fetchImpl)])
    const prompt = buildAiReplyPrompt({ settings: s, history, promos: promoLines(programs, todayBkk(now)), customerName: customerName || thread.name || '', platform: platform === 'line' ? 'LINE' : platform === 'instagram' ? 'Instagram' : 'Facebook Messenger' })
    const raw = await geminiReply(env, prompt, fetchImpl)
    const { text, handoff } = cleanAiReply(raw)
    if (!text) return { replied: false, why: 'empty' }
    const ok = await send(text)
    if (!ok) return { replied: false, why: 'send' }
    const at = new Date(now.getTime() + 1)
    await addMsg(env, token, { threadId, platform, direction: 'out', text, at, by: `🤖 ${s.aiName}`, ai: true }, fetchImpl)
    await patchThread(env, token, threadId, { lastText: text.slice(0, 200), lastAt: at, lastDirection: 'out', lastByAi: true, aiRepliedAt: at, ...(handoff ? { needsHuman: true } : {}), ...nextAiCounter(thread, now), updatedAt: at }, fetchImpl)
    return { replied: true, handoff }
  } catch { return { replied: false, why: 'error' } }
}

// ส่งด้วย reply token ของ LINE (ฟรี ไม่กินโควตา) — ใช้ได้ครั้งเดียวภายในไม่กี่นาทีหลังลูกค้าทัก
export function lineReplySender(token, replyToken, fetchImpl = fetch) {
  return async text => {
    if (!token || !replyToken) return false
    const r = await call(fetchImpl, 'https://api.line.me/v2/bot/message/reply', {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ replyToken, messages: [{ type: 'text', text }] }),
    })
    return !!r?.ok
  }
}

// (v1.0.1135) ลองถาม AI จากหน้าตั้งค่า — ใช้ข้อมูลโชว์รูม/โปรจริง แต่ไม่ส่งถึงลูกค้าและไม่บันทึกแชต
export async function aiReplyTest(env, token, body = {}, deps = {}) {
  const fetchImpl = deps.fetch || fetch
  const question = String(body.text || '').trim().slice(0, 500)
  if (!question) throw Object.assign(new Error('พิมพ์คำถามที่อยากลองก่อน'), { status: 400 })
  if (!env.GEMINI_API_KEY) return { ok: false, reason: 'nokey' }
  const raw = token ? await readInboxAuto(env, token, fetchImpl) : null
  // ใช้ค่าที่ยังไม่ได้กดบันทึกจากหน้าจอ (ถ้าส่งมา) ทับค่าที่บันทึกไว้
  const settings = normalizeInboxAuto({ ...(raw || {}), ...(body.draft && typeof body.draft === 'object' ? body.draft : {}) }, env)
  const programs = token ? await activePrograms(env, token, fetchImpl).catch(() => []) : []
  const prompt = buildAiReplyPrompt({ settings, history: [{ direction: 'in', text: question }], promos: promoLines(programs, todayBkk()), customerName: 'ลูกค้าทดสอบ', platform: 'LINE' })
  const out = cleanAiReply(await geminiReply(env, prompt, fetchImpl))
  if (!out.text) return { ok: false, reason: 'empty' }
  return { ok: true, text: out.text, handoff: out.handoff }
}
