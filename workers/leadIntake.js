// (v1.0.1129) รับลีดจากทุกช่องทางเข้าแอปเอง
//
// 1) ช่องรับลีดกลาง  POST /lead/webhook?key=<LEAD_WEBHOOK_KEY>&source=tiktok&account=<รหัสบัญชีในหน้าบัญชี>
//    ใช้กับ: ฟอร์มลีด TikTok (ผ่าน Zapier/Make หรือ TikTok Leads → Webhook), ฟอร์มหน้าเว็บ, Google Form (Apps Script),
//    อีเมลที่ส่งต่อผ่าน Zapier/Make, LINE ส่วนตัว/เพจส่วนตัว (ผ่านเครื่องมือที่ส่งต่อได้) — รับ JSON แบบไหนก็ได้ที่มีชื่อ/เบอร์
//    key ผิด = 401 · ไม่มีชื่อ/เบอร์/อีเมล/ไลน์เลย = 400 · เบอร์ซ้ำกับลูกค้าเดิม = ไม่สร้างซ้ำ (บันทึกโน้ตให้ลูกค้าเดิมแทน)
//
// 2) Facebook เพจ / Instagram  GET+POST /meta/webhook  (Meta App → Webhooks → Page: messages, leadgen · Instagram: messages)
//    - แชต Messenger/IG ที่ลูกค้าทักมา → เก็บใน social_threads/social_messages (ให้ AI มีประวัติแชต) + สร้างลีด + AI ตอบ (ถ้าเปิด)
//    - ฟอร์มโฆษณา (Lead Ads) → ดึงข้อมูลฟอร์มด้วยโทเค็นเพจแล้วสร้างลูกค้าทันที
//    ต้องมี secret: META_APP_SECRET (ตรวจลายเซ็น) + META_VERIFY_TOKEN (ข้อความลับที่พิมพ์ตอนตั้ง webhook) + META_SYSTEM_USER_TOKEN
import { metaPages } from './social.js'
import { readInboxAuto, aiAutoReply } from './inboxAuto.js'

const GRAPH = 'https://graph.facebook.com/v21.0'
const fsBase = env => `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`
const clip = (s, n) => String(s ?? '').slice(0, n)
async function call(fetchImpl, url, init) { try { return await fetchImpl(url, init) } catch { return null } }

export const SOURCES = ['facebook', 'line', 'tiktok', 'instagram', 'walk-in', 'referral', 'google', 'website', 'phone', 'email', 'event', 'other']
export function normSource(v) {
  const s = String(v || '').trim().toLowerCase()
  if (/tik ?tok|^tt$/.test(s)) return 'tiktok'
  if (/face ?book|^fb$|messenger/.test(s)) return 'facebook'
  if (/insta|^ig$/.test(s)) return 'instagram'
  if (/line/.test(s)) return 'line'
  if (/mail/.test(s)) return 'email'
  if (/google|gform/.test(s)) return 'google'
  if (/web|site|landing/.test(s)) return 'website'
  return SOURCES.includes(s) ? s : 'other'
}

// เบอร์ไทย → 0XXXXXXXXX (รับ +66, 66, มีขีด/ช่องว่าง)
export function normPhone(v) {
  let d = String(v || '').replace(/[^\d+]/g, '')
  if (d.startsWith('+66')) d = '0' + d.slice(3)
  else if (/^66\d{8,9}$/.test(d)) d = '0' + d.slice(2)
  d = d.replace(/\D/g, '')
  return /^0\d{8,9}$/.test(d) ? d : ''
}
const normEmail = v => (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || '').trim()) ? String(v).trim().toLowerCase().slice(0, 120) : '')

// แปลงข้อมูลฟอร์มหลายแบบให้เป็นรูปเดียว: {first,last,phone,email,lineId,model,note,source,account}
export function parseLeadPayload(body = {}, query = {}) {
  const flat = {}
  const put = (k, v) => { const key = String(k || '').trim().toLowerCase().replace(/[\s-]+/g, '_'); if (key && v != null && v !== '' && flat[key] == null) flat[key] = Array.isArray(v) ? v.join(', ') : typeof v === 'object' ? '' : String(v) }
  const walk = o => {
    if (!o || typeof o !== 'object') return
    if (Array.isArray(o)) { o.forEach(walk); return }
    // รูปแบบ Facebook/TikTok: [{name:'phone_number', values:['…']}] หรือ [{field_name, field_value}]
    if (o.name && Array.isArray(o.values)) { put(o.name, o.values[0]); return }
    if ((o.field_name || o.key || o.label) && (o.field_value ?? o.value) != null && Object.keys(o).length <= 4) { put(o.field_name || o.key || o.label, o.field_value ?? o.value); return }
    for (const [k, v] of Object.entries(o)) { if (v && typeof v === 'object') walk(v); else put(k, v) }
  }
  walk(body)
  const pick = (...keys) => { for (const k of keys) if (flat[k]) return clip(flat[k], 200).trim(); return '' }
  let first = pick('first_name', 'firstname', 'ชื่อ')
  let last = pick('last_name', 'lastname', 'surname', 'นามสกุล')
  const full = pick('full_name', 'fullname', 'name', 'customer_name', 'ชื่อ_นามสกุล', 'ชื่อ-นามสกุล', 'nickname', 'display_name')
  if (!first && full) { const parts = full.split(/\s+/); first = parts[0]; last = last || parts.slice(1).join(' ') }
  const phone = normPhone(pick('phone_number', 'phone', 'mobile', 'tel', 'telephone', 'เบอร์', 'เบอร์โทร', 'เบอร์โทรศัพท์', 'contact_number'))
  const email = normEmail(pick('email', 'e_mail', 'email_address', 'อีเมล', 'from'))
  const lineId = pick('line_id', 'lineid', 'line', 'ไลน์')
  const model = pick('model', 'car', 'car_model', 'interested_model', 'รุ่น', 'รุ่นที่สนใจ', 'product')
  const note = pick('message', 'note', 'notes', 'comment', 'subject', 'question', 'ข้อความ', 'body', 'text')
  const source = normSource(query.source || pick('source', 'platform', 'utm_source', 'channel') || 'other')
  const account = clip(query.account || pick('account', 'account_id', 'page'), 60).replace(/[^A-Za-z0-9_-]/g, '')
  return { first: clip(first, 60), last: clip(last, 80), phone, email, lineId: clip(lineId, 60), model: clip(model, 80), note: clip(note, 500), source, account }
}

export function buildLeadFields(lead, { now, tags = [], companyId = null, extra = {} } = {}) {
  const str = v => ({ stringValue: String(v ?? '') })
  const src = { facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok', line: 'LINE', website: 'เว็บไซต์', email: 'อีเมล', google: 'Google' }[lead.source] || 'ช่องทางออนไลน์'
  const notes = [`ลีดเข้ามาเองจาก ${src}`, lead.model ? `สนใจ ${lead.model}` : '', lead.note ? `"${clip(lead.note, 300)}"` : ''].filter(Boolean).join(' · ')
  const f = {
    firstName: str(lead.first || `ลูกค้า ${src}`), lastName: str(lead.last), phone: str(lead.phone), email: str(lead.email),
    lineId: str(lead.lineId), interestedModel: str(lead.model), source: str(lead.source), temperature: { nullValue: null }, assignedTo: str(lead.assignedTo || ''),
    vip: { booleanValue: false }, notes: str(notes), budget: { integerValue: '0' }, occupation: str(''), monthlyIncome: { integerValue: '0' },
    stage: str(lead.phone || lead.lineId ? 'pp' : 'lead'), isLost: { booleanValue: false }, lostReason: str(''), lostAt: { nullValue: null }, bookingId: { nullValue: null },
    tags: { arrayValue: { values: [...new Set([src, 'ลีดอัตโนมัติ', ...tags])].map(str) } }, companyId: companyId ? str(companyId) : { nullValue: null },
    stageChangedAt: str(now), createdAt: { timestampValue: now }, updatedAt: { timestampValue: now }, autoLead: { booleanValue: true },
  }
  if (lead.account) f.sourceAccountId = str(lead.account)
  for (const [k, v] of Object.entries(extra)) f[k] = str(v)
  return f
}

async function findByField(env, token, field, value, fetchImpl) {
  if (!value) return null
  const r = await call(fetchImpl, `${fsBase(env)}:runQuery`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'customers' }], where: { fieldFilter: { field: { fieldPath: field }, op: 'EQUAL', value: { stringValue: value } } }, limit: 1 } }),
  })
  if (!r?.ok) return null
  const rows = await r.json().catch(() => [])
  const d = (Array.isArray(rows) ? rows : []).find(x => x.document)?.document
  return d ? String(d.name).split('/').pop() : null
}

async function addNote(env, token, customerId, text, fetchImpl) {
  return call(fetchImpl, `${fsBase(env)}/customer_notes`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { customerId: { stringValue: customerId }, type: { stringValue: 'internal' }, text: { stringValue: clip(text, 1000) }, staff: { stringValue: 'ระบบรับลีดอัตโนมัติ' }, time: { stringValue: new Date().toISOString() }, pinned: { booleanValue: false }, createdAt: { timestampValue: new Date().toISOString() } } }),
  })
}

/**
 * สร้างลูกค้าจากลีด — คืน { created, duplicate, id }
 * docId ตายตัว (เช่น fblead_<id>) กันสร้างซ้ำเมื่อช่องทางส่งซ้ำ · เบอร์/อีเมลซ้ำ = ไม่สร้าง แต่เพิ่มโน้ตให้ลูกค้าเดิม
 */
export async function createLead(env, token, lead, { docId = '', tags = [], extra = {}, fetchImpl = fetch, now = new Date().toISOString() } = {}) {
  if (!token) return { created: false, error: 'no-token' }
  const dupId = (await findByField(env, token, 'phone', lead.phone, fetchImpl)) || (await findByField(env, token, 'email', lead.email, fetchImpl))
  if (dupId) {
    await addNote(env, token, dupId, `ทักเข้ามาอีกครั้งทาง ${lead.source}${lead.model ? ` (สนใจ ${lead.model})` : ''}${lead.note ? `: ${lead.note}` : ''}`, fetchImpl)
    return { created: false, duplicate: true, id: dupId }
  }
  const fields = buildLeadFields(lead, { now, tags, companyId: lead.companyId || env.LINE_LEAD_COMPANY_ID || null, extra })
  const url = `${fsBase(env)}/customers${docId ? `?documentId=${encodeURIComponent(docId)}` : ''}`
  const r = await call(fetchImpl, url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ fields }) })
  if (r?.status === 409) return { created: false, duplicate: true, id: docId }
  if (!r?.ok) return { created: false, error: `firestore ${r?.status || 'network'}` }
  const d = await r.json().catch(() => ({}))
  return { created: true, id: String(d.name || docId).split('/').pop() }
}

function safeEqual(a, b) {
  a = String(a || ''); b = String(b || '')
  if (!a || a.length !== b.length) return false
  let x = 0
  for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return x === 0
}

// ── 1) ช่องรับลีดกลาง ──
// (v1.0.1144) บอกตัวแจ้งเตือน (workers/leadAlert.js ผ่าน deps.onLead) ว่ามีลีดเข้า — พังก็ไม่กระทบการรับลีด
async function tell(deps, lead, r) {
  if (!deps?.onLead || !r || r.error) return
  try { await deps.onLead(lead, r) } catch { /* ข้าม */ }
}

export async function handleLeadWebhook(request, env, getToken, deps = {}) {
  const url = new URL(request.url)
  const key = url.searchParams.get('key') || request.headers.get('X-Lead-Key') || ''
  if (!env.LEAD_WEBHOOK_KEY) return { status: 503, body: { error: 'ยังไม่ได้ตั้ง LEAD_WEBHOOK_KEY' } }
  if (!safeEqual(key, env.LEAD_WEBHOOK_KEY)) return { status: 401, body: { error: 'key ไม่ถูกต้อง' } }
  const raw = await request.text()
  if (raw.length > 50_000) return { status: 413, body: { error: 'ข้อมูลใหญ่เกินไป' } }
  let body = {}
  const ct = request.headers.get('Content-Type') || ''
  if (/json/.test(ct) || /^\s*[[{]/.test(raw)) { try { body = JSON.parse(raw) } catch { return { status: 400, body: { error: 'JSON ไม่ถูกต้อง' } } } }
  else body = Object.fromEntries(new URLSearchParams(raw))
  const lead = parseLeadPayload(body, { source: url.searchParams.get('source'), account: url.searchParams.get('account') })
  if (!lead.phone && !lead.email && !lead.lineId && !lead.first) return { status: 400, body: { error: 'ไม่มีชื่อ เบอร์ อีเมล หรือไลน์ของลูกค้า' } }
  const token = await getToken()
  const r = await createLead(env, token, lead, { fetchImpl: deps.fetch || fetch })
  if (r.error) return { status: 500, body: { ok: false, error: r.error } }
  await tell(deps, lead, r)
  return { status: 200, body: { ok: true, created: r.created, duplicate: !!r.duplicate, id: r.id } }
}

// ── 2) Meta webhook ──
export async function verifyMetaSig(rawBody, header, secret) {
  if (!secret || !header?.startsWith('sha256=')) return false
  try {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody)))
    const hex = [...sig].map(b => b.toString(16).padStart(2, '0')).join('')
    return safeEqual(hex, header.slice(7))
  } catch { return false }
}

export function metaVerifyChallenge(url, env) {
  const mode = url.searchParams.get('hub.mode')
  const tok = url.searchParams.get('hub.verify_token')
  if (mode === 'subscribe' && env.META_VERIFY_TOKEN && safeEqual(tok, env.META_VERIFY_TOKEN)) return url.searchParams.get('hub.challenge') || ''
  return null
}

export const metaThreadId = (platform, pageId, userId) => `${platform === 'instagram' ? 'ig' : 'fb'}_${String(pageId).replace(/\D/g, '')}__${String(userId).replace(/\D/g, '')}`

// แยกเหตุการณ์จาก body ของ Meta → [{kind:'message'|'echo'|'leadgen', ...}]
export function metaEvents(body = {}) {
  const out = []
  const platform = body.object === 'instagram' ? 'instagram' : 'messenger'
  for (const entry of body.entry || []) {
    for (const m of entry.messaging || []) {
      const msg = m.message
      if (!msg) continue
      const text = msg.text ? clip(msg.text, 2000) : msg.attachments?.length ? `[${msg.attachments[0].type === 'image' ? 'รูปภาพ' : 'ไฟล์แนบ'}]` : '[ข้อความ]'
      if (msg.is_echo) out.push({ kind: 'echo', platform, pageId: String(m.sender?.id || entry.id), userId: String(m.recipient?.id || ''), text, at: m.timestamp, mid: msg.mid })
      else out.push({ kind: 'message', platform, pageId: String(m.recipient?.id || entry.id), userId: String(m.sender?.id || ''), text, isText: !!msg.text, at: m.timestamp, mid: msg.mid })
    }
    for (const c of entry.changes || []) {
      if (c.field === 'leadgen' && c.value?.leadgen_id) out.push({ kind: 'leadgen', leadgenId: String(c.value.leadgen_id), pageId: String(c.value.page_id || entry.id), formId: String(c.value.form_id || ''), adId: String(c.value.ad_id || '') })
    }
  }
  return out
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
  return call(fetchImpl, `${fsBase(env)}/social_threads/${encodeURIComponent(id)}?${mask}`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ fields }) })
}
async function addMsg(env, token, data, fetchImpl) {
  return call(fetchImpl, `${fsBase(env)}/social_messages`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: fsFields(data) }) })
}
async function readThread(env, token, id, fetchImpl) {
  const r = await call(fetchImpl, `${fsBase(env)}/social_threads/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${token}` } })
  if (!r?.ok) return null
  const d = await r.json().catch(() => ({}))
  return { lastText: d.fields?.lastText?.stringValue || '', lastByAi: d.fields?.lastByAi?.booleanValue === true, name: d.fields?.name?.stringValue || '' }
}

async function graphGet(path, token, params, fetchImpl) {
  const u = new URL(`${GRAPH}/${path}`)
  Object.entries(params || {}).forEach(([k, v]) => u.searchParams.set(k, v))
  u.searchParams.set('access_token', token)
  const r = await call(fetchImpl, u.toString())
  if (!r?.ok) return null
  return r.json().catch(() => null)
}

export function metaSender(page, recipientId, fetchImpl = fetch) {
  return async text => {
    if (!page?.token) return false
    const r = await call(fetchImpl, `${GRAPH}/me/messages`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient: { id: recipientId }, message: { text }, messaging_type: 'RESPONSE', access_token: page.token }),
    })
    return !!r?.ok
  }
}

export async function handleMetaWebhook(request, env, getToken, deps = {}) {
  const fetchImpl = deps.fetch || fetch
  const raw = await request.text()
  if (!(await verifyMetaSig(raw, request.headers.get('X-Hub-Signature-256') || '', env.META_APP_SECRET))) return { status: 401, body: { error: 'Invalid signature' } }
  let body = {}
  try { body = JSON.parse(raw) } catch { body = {} }
  const events = metaEvents(body)
  if (!events.length) return { status: 200, body: { ok: true, events: 0 } }
  const token = await getToken()
  if (!token) return { status: 200, body: { ok: false, error: 'no-token' } }
  const pages = await (deps.pages ? deps.pages() : metaPages(env).catch(() => []))
  const pageOf = id => pages.find(p => p.id === id || p.ig?.id === id) || null
  const inbox = await readInboxAuto(env, token, fetchImpl)
  let saved = 0, leads = 0
  for (const ev of events) {
    try {
      const page = pageOf(ev.pageId)
      if (ev.kind === 'leadgen') {
        if (!page) continue
        const d = await graphGet(ev.leadgenId, page.token, { fields: 'field_data,created_time,ad_name,campaign_name,form_id' }, fetchImpl)
        if (!d) continue
        const lead = parseLeadPayload({ fields: d.field_data || [] }, { source: 'facebook' })
        if (!lead.first && !lead.phone && !lead.email) continue
        lead.note = [lead.note, d.ad_name ? `โฆษณา: ${d.ad_name}` : '', d.campaign_name ? `แคมเปญ: ${d.campaign_name}` : ''].filter(Boolean).join(' · ')
        const r = await createLead(env, token, lead, { docId: `fblead_${ev.leadgenId}`, tags: ['Facebook Lead Ads', page.name], extra: { fbLeadId: ev.leadgenId, fbPageId: page.id }, fetchImpl })
        if (r.created) { leads++; await tell(deps, lead, r) }
        continue
      }
      if (!ev.userId) continue
      const threadId = metaThreadId(ev.platform, page?.id || ev.pageId, ev.userId)
      const at = new Date(Number(ev.at) || Date.now())
      const chanName = page ? (ev.platform === 'instagram' ? `IG @${page.ig?.username || page.name}` : page.name) : (ev.platform === 'instagram' ? 'Instagram' : 'Facebook')
      if (ev.kind === 'echo') {
        // ข้อความที่เพจตอบ (จาก Meta Business Suite หรือ AI ของเรา) — ถ้าข้อความตรงกับที่ AI เพิ่งตอบ ไม่นับว่าเป็นคนตอบ
        const t = await readThread(env, token, threadId, fetchImpl)
        if (t?.lastByAi && t.lastText && ev.text.startsWith(t.lastText.slice(0, 100))) continue
        await addMsg(env, token, { threadId, platform: ev.platform, direction: 'out', text: ev.text, at, by: 'ทีม (Meta Business Suite)' }, fetchImpl)
        await patchThread(env, token, threadId, { lastText: clip(ev.text, 200), lastAt: at, lastDirection: 'out', lastByAi: false, lastHumanAt: at, needsHuman: false, unread: false, updatedAt: at }, fetchImpl)
        continue
      }
      let name = ''
      if (page) {
        const prof = await graphGet(ev.userId, page.token, { fields: ev.platform === 'instagram' ? 'name,username' : 'first_name,last_name,name' }, fetchImpl)
        name = prof?.name || prof?.username || [prof?.first_name, prof?.last_name].filter(Boolean).join(' ') || ''
      }
      await addMsg(env, token, { threadId, platform: ev.platform, direction: 'in', text: ev.text, at, by: name }, fetchImpl)
      await patchThread(env, token, threadId, { platform: ev.platform, userId: ev.userId, pageId: page?.id || ev.pageId, channel: ev.platform === 'instagram' ? 'ig' : 'fb', channelName: chanName, name: name || (ev.platform === 'instagram' ? 'ลูกค้า IG' : 'ลูกค้า Facebook'), lastText: clip(ev.text, 200), lastAt: at, lastDirection: 'in', lastByAi: false, unread: true, updatedAt: new Date() }, fetchImpl)
      saved++
      if (inbox.autoLead) {
        const parts = name.split(/\s+/).filter(Boolean)
        const existing = await findByField(env, token, ev.platform === 'instagram' ? 'igUserId' : 'fbPsid', ev.userId, fetchImpl)
        if (!existing) {
          const chatLead = { first: parts[0] || '', last: parts.slice(1).join(' '), phone: '', email: '', lineId: '', model: '', note: ev.text, source: ev.platform === 'instagram' ? 'instagram' : 'facebook', account: '' }
          const r = await createLead(env, token, chatLead,
            { docId: `${ev.platform === 'instagram' ? 'ig' : 'fb'}_${ev.userId}`, tags: [chanName], extra: ev.platform === 'instagram' ? { igUserId: ev.userId, fbPageId: page?.id || '' } : { fbPsid: ev.userId, fbPageId: page?.id || '' }, fetchImpl })
          if (r.created) { leads++; await tell(deps, chatLead, r) }
        }
      }
      if (ev.isText) await fillPhoneFromChat(env, token, { field: ev.platform === 'instagram' ? 'igUserId' : 'fbPsid', value: ev.userId, text: ev.text, channelLabel: `แชต ${chanName}` }, fetchImpl).catch(() => null)
      if (page) await aiAutoReply(env, token, { threadId, channel: ev.platform === 'instagram' ? 'ig' : 'fb', platform: ev.platform, isText: ev.isText, customerName: name, send: metaSender(page, ev.userId, fetchImpl) }, { fetch: fetchImpl })
    } catch { /* เหตุการณ์เดียวพลาด ไม่ให้ทั้งชุดล้ม (Meta จะส่งซ้ำถ้าไม่ได้ 200) */ }
  }
  return { status: 200, body: { ok: true, saved, leads } }
}

// ── (v1.0.1139) ลูกค้าพิมพ์เบอร์มือถือในแชต → ใส่เบอร์ให้ลูกค้าที่ผูกแชตนี้ไว้ (เฉพาะคนที่ยังไม่มีเบอร์) ──
// มือถือไทย 10 หลัก 06/08/09 (รับ +66/66 นำหน้า เว้นวรรคหรือขีดได้)
export function phoneFromText(text) {
  for (const run of String(text || '').match(/\+?\d[\d\s-]{8,16}\d/g) || []) {
    const p = normPhone(run.trim())
    if (/^0[689]\d{8}$/.test(p)) return p
  }
  // หลายเบอร์ติดกัน เช่น "0812345678 0898765432" → เอาเบอร์แรก
  const one = String(text || '').split(/[^\d+-]+/).map(t => normPhone(t)).find(p => /^0[689]\d{8}$/.test(p))
  return one || ''
}

export async function fillPhoneFromChat(env, token, { field, value, text, channelLabel = 'แชต' }, fetchImpl = fetch) {
  const phone = phoneFromText(text)
  if (!phone || !token || !field || !value) return null
  const r = await call(fetchImpl, `${fsBase(env)}:runQuery`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'customers' }], where: { fieldFilter: { field: { fieldPath: field }, op: 'EQUAL', value: { stringValue: value } } }, limit: 1 } }),
  })
  if (!r?.ok) return null
  const rows = await r.json().catch(() => [])
  const d = (Array.isArray(rows) ? rows : []).find(x => x.document)?.document
  if (!d || d.fields?.deleted?.booleanValue) return null
  if (normPhone(d.fields?.phone?.stringValue || '')) return { id: String(d.name).split('/').pop(), skipped: 'hasPhone' }
  const id = String(d.name).split('/').pop()
  const now = new Date().toISOString()
  const p = await call(fetchImpl, `${fsBase(env)}/customers/${encodeURIComponent(id)}?updateMask.fieldPaths=phone&updateMask.fieldPaths=updatedAt&currentDocument.exists=true`, {
    method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { phone: { stringValue: phone }, updatedAt: { timestampValue: now } } }),
  })
  if (!p?.ok) return null
  await addNote(env, token, id, `📞 ได้เบอร์ ${phone} จากที่ลูกค้าพิมพ์ใน${channelLabel} — ระบบใส่ให้อัตโนมัติ`, fetchImpl)
  return { id, phone, filled: true }
}

// ── (v1.0.1140) ฟอร์มรับลีดสาธารณะ — ลูกค้ากรอกชื่อ-เบอร์เองจากลิงก์/QR (ใส่ในไบโอ TikTok/เพจส่วนตัว/บูธ) ──
// ไม่มีรหัส จึงกันสแปมด้วย: ต้องเปิดสวิตช์ในแท็บตอบอัตโนมัติ · ช่องล่อบอต · เบอร์มือถือไทยที่ถูกต้อง · จำกัดจำนวนต่อ IP · เบอร์ซ้ำไม่สร้างคนใหม่
const formHits = new Map()
export function __resetFormHits() { formHits.clear() }
export function formRateOk(ip, now = Date.now(), { max = 5, windowMs = 10 * 60_000 } = {}) {
  const k = String(ip || 'x')
  const hits = (formHits.get(k) || []).filter(t => now - t < windowMs)
  if (hits.length >= max) { formHits.set(k, hits); return false }
  hits.push(now); formHits.set(k, hits)
  if (formHits.size > 5000) formHits.clear()
  return true
}

// บัญชีโซเชียลที่บันทึกไว้ในแอป (social_channels) → ที่มา + ผู้ดูแล (บัญชีระดับเซลส์ = มอบลีดให้เจ้าของบัญชี)
export function accountLeadInfo(doc) {
  const f = doc?.fields
  if (!f || f.deleted?.booleanValue) return null
  const g = k => String(f[k]?.stringValue || '').trim()
  const level = g('level') || 'team'
  return { id: String(doc.name || '').split('/').pop(), source: normSource(g('platform')), name: clip(g('name') || g('handle'), 80), level, assignedTo: level === 'sales' ? clip(g('owner'), 80) : '', companyId: g('companyId') }
}

export async function handleLeadForm(request, env, getToken, deps = {}) {
  const fetchImpl = deps.fetch || fetch
  const raw = await request.text()
  if (raw.length > 5000) return { status: 413, body: { ok: false, error: 'ข้อมูลยาวเกินไป' } }
  let b = {}
  try { b = JSON.parse(raw) } catch { return { status: 400, body: { ok: false, error: 'ส่งข้อมูลไม่ถูกต้อง' } } }
  if (!b || typeof b !== 'object' || Array.isArray(b)) return { status: 400, body: { ok: false, error: 'ส่งข้อมูลไม่ถูกต้อง' } }
  // ช่องล่อบอต: คนจริงมองไม่เห็นช่องนี้ — ถ้ามีค่า ตอบสำเร็จหลอกแต่ไม่บันทึก
  if (String(b.website || '').trim()) return { status: 200, body: { ok: true } }
  const name = clip(String(b.name || '').replace(/[<>\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim(), 100)
  const phone = normPhone(b.phone)
  if (name.length < 2) return { status: 400, body: { ok: false, error: 'กรุณาใส่ชื่อ' } }
  if (!/^0[689]\d{8}$/.test(phone)) return { status: 400, body: { ok: false, error: 'กรุณาใส่เบอร์มือถือ 10 หลัก' } }
  const ip = request.headers.get('CF-Connecting-IP') || ''
  if (!formRateOk(ip, deps.now || Date.now())) return { status: 429, body: { ok: false, error: 'ส่งถี่เกินไป กรุณาลองใหม่ภายหลัง' } }
  const token = await getToken()
  if (!token) return { status: 503, body: { ok: false, error: 'ระบบยังไม่พร้อม กรุณาลองใหม่' } }
  const inbox = await readInboxAuto(env, token, fetchImpl)
  if (!inbox.publicForm) return { status: 403, body: { ok: false, error: 'ฟอร์มนี้ปิดรับอยู่' } }
  const accId = clip(String(b.a || ''), 60).replace(/[^A-Za-z0-9_-]/g, '')
  let acc = null
  if (accId) {
    const r = await call(fetchImpl, `${fsBase(env)}/social_channels/${encodeURIComponent(accId)}`, { headers: { Authorization: `Bearer ${token}` } })
    if (r?.ok) acc = accountLeadInfo(await r.json().catch(() => null))
  }
  const parts = name.split(' ')
  const clean = (v, n) => clip(String(v || '').replace(/[<>\u0000-\u001f]/g, ' ').trim(), n)
  const lead = { first: parts[0], last: parts.slice(1).join(' '), phone, email: '', lineId: clean(b.line, 60), model: clean(b.model, 80), note: clean(b.note, 300),
    source: acc?.source || 'website', account: acc?.id || '', assignedTo: acc?.assignedTo || '', companyId: acc?.companyId || '' }
  const r = await createLead(env, token, lead, { tags: ['ฟอร์มรับลีด', ...(acc?.name ? [acc.name] : [])], extra: acc ? { sourceAccountName: acc.name, sourceAccountLevel: acc.level } : {}, fetchImpl })
  if (r.error) return { status: 500, body: { ok: false, error: 'บันทึกไม่สำเร็จ กรุณาลองใหม่' } }
  await tell(deps, lead, r)
  // ไม่บอกคนกรอกว่าเบอร์นี้เคยมีในระบบหรือไม่ (กันเดาข้อมูลลูกค้า)
  return { status: 200, body: { ok: true } }
}
