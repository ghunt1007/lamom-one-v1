/**
 * LAMOM ONE — Social channels (Facebook Page / Instagram / Meta Ads / LINE OA inbox)
 * ใช้ภายใน workers/daily-report.js (route /social/*) — worker นั้น deploy อัตโนมัติทุกครั้งที่ merge
 *
 * หลักความปลอดภัย:
 *  - token ทุกตัวเก็บเป็น secret ฝั่ง Cloudflare เท่านั้น ไม่ส่งกลับไปหน้าเว็บเลย (ตัด access_token ทิ้งทุกจุด)
 *  - ทุก endpoint ต้องเป็นพนักงานที่อนุมัติแล้ว (daily-report.js ตรวจ Firebase token + role ก่อนเรียกไฟล์นี้)
 *  - เปลี่ยนสถานะ/งบโฆษณา: เฉพาะ owner/admin/manager
 *
 * Secrets ที่ต้องตั้งบน worker lamom-daily-report (wrangler secret put ... หรือ Cloudflare Dashboard):
 *   META_SYSTEM_USER_TOKEN  token ของ System User ใน Meta Business Suite ที่ได้สิทธิ์เพจ/IG/บัญชีโฆษณา
 *                           (สิทธิ์: pages_show_list, pages_read_engagement, pages_manage_posts,
 *                            pages_messaging, instagram_basic, instagram_content_publish,
 *                            instagram_manage_messages, ads_read, ads_management)
 *   META_AD_ACCOUNT_IDS     (ไม่บังคับ) เลขบัญชีโฆษณา คั่นด้วย , เช่น act_123,act_456 — ไม่ตั้ง = ดึงทุกบัญชีที่ token เห็น
 *   LINE_CHANNEL_ACCESS_TOKEN / LINE_CHANNEL_SECRET  (มีอยู่แล้ว — ใช้กับกล่องแชต LINE OA)
 */

export const GRAPH = 'https://graph.facebook.com/v21.0'
export const MANAGER_ROLES = ['owner', 'admin', 'manager']
const MAX_TEXT = 2000
const MAX_POST = 5000

// ── helpers ──────────────────────────────────────────────────────
const isId = v => /^[0-9]{3,30}$/.test(String(v || ''))
const isActId = v => /^act_[0-9]{3,30}$/.test(String(v || ''))
const clip = (s, n) => String(s || '').slice(0, n)

async function graph(path, { token, method = 'GET', params = {} } = {}) {
  const url = new URL(path.startsWith('http') ? path : `${GRAPH}/${path.replace(/^\//, '')}`)
  const init = { method }
  if (method === 'GET') {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
    url.searchParams.set('access_token', token)
  } else {
    init.headers = { 'Content-Type': 'application/json' }
    init.body = JSON.stringify({ ...params, access_token: token })
  }
  const res = await fetch(url.toString(), init)
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.error) {
    const e = data.error || {}
    throw new Error(metaErrorTh(e, res.status))
  }
  return data
}

// แปลข้อผิดพลาด Meta ที่พบบ่อยเป็นภาษาไทยที่เข้าใจได้ — export ไว้เทส
export function metaErrorTh(e = {}, status = 0) {
  const code = Number(e.code)
  if (code === 190) return 'Token ของ Meta หมดอายุหรือถูกยกเลิก — สร้าง token ใหม่ใน Meta Business Suite แล้วตั้งค่าใหม่'
  if (code === 10 || code === 200 || code === 3) return `Meta ไม่อนุญาต (สิทธิ์ไม่พอ: ${e.message || 'permission'}) — ตรวจว่า System User ได้สิทธิ์เพจ/บัญชีนี้ครบ`
  if (code === 4 || code === 17 || code === 32 || code === 613) return 'เรียก Meta ถี่เกินไป รอสักครู่แล้วลองใหม่'
  if (code === 551 || e.error_subcode === 2018278) return 'ส่งไม่ได้: เกิน 24 ชม.หลังลูกค้าทักล่าสุด (กฎของ Meta) — ให้โทรหรือรอลูกค้าทักใหม่'
  return e.message ? `Meta: ${e.message}` : `Meta error ${status}`
}

// ── Meta: เพจที่ token เห็น (เก็บ page token ไว้ในหน่วยความจำ ไม่ส่งออก) ───────────────
let pageCache = { at: 0, key: '', pages: [] }
export function __resetSocialCache() { pageCache = { at: 0, key: '', pages: [] } }

export async function metaPages(env, { fresh = false } = {}) {
  const token = env.META_SYSTEM_USER_TOKEN
  if (!token) return []
  if (!fresh && pageCache.key === token && Date.now() - pageCache.at < 5 * 60_000) return pageCache.pages
  const data = await graph('me/accounts', { token, params: { fields: 'id,name,access_token,fan_count,followers_count,link,picture{url},instagram_business_account{id,username,followers_count}', limit: '100' } })
  const pages = (data.data || []).map(p => ({
    id: p.id, name: p.name, token: p.access_token, fans: p.fan_count ?? null, followers: p.followers_count ?? null, link: p.link || '',
    picture: p.picture?.data?.url || '',
    ig: p.instagram_business_account ? { id: p.instagram_business_account.id, username: p.instagram_business_account.username || '', followers: p.instagram_business_account.followers_count ?? null } : null,
  }))
  pageCache = { at: Date.now(), key: token, pages }
  return pages
}
export const publicPage = p => ({ id: p.id, name: p.name, fans: p.fans, followers: p.followers, link: p.link, picture: p.picture, ig: p.ig })

async function pageById(env, pageId) {
  if (!isId(pageId)) throw new Error('เลขเพจไม่ถูกต้อง')
  const p = (await metaPages(env)).find(x => x.id === String(pageId))
  if (!p) throw new Error('token นี้ยังไม่มีสิทธิ์เพจนี้ — เพิ่มเพจให้ System User ใน Meta Business Suite ก่อน')
  return p
}

// ── สถานะการเชื่อมต่อทุกช่องทาง (ไม่มีค่า secret ในคำตอบ มีแค่ true/false + ชื่อเพจ) ─────
export async function socialStatus(env) {
  const out = {
    line: { configured: !!env.LINE_CHANNEL_ACCESS_TOKEN, webhook: !!env.LINE_CHANNEL_SECRET },
    meta: { configured: !!env.META_SYSTEM_USER_TOKEN, pages: [], error: '' },
    metaAds: { configured: !!env.META_SYSTEM_USER_TOKEN },
    google: { configured: false },
    tiktok: { configured: false },
  }
  if (out.meta.configured) {
    try { out.meta.pages = (await metaPages(env, { fresh: true })).map(publicPage) } catch (e) { out.meta.error = e.message }
  }
  return out
}

// ── แชต Messenger / Instagram (อ่านสดจาก Meta ไม่เก็บซ้ำ) ───────────────────
export function shapeConversations(data, pageId) {
  return (data?.data || []).map(c => {
    const other = (c.participants?.data || []).find(p => p.id !== pageId) || {}
    const msgs = (c.messages?.data || []).map(m => ({ id: m.id, text: m.message || '', at: m.created_time, mine: m.from?.id === pageId, from: m.from?.name || m.from?.username || '' })).reverse()
    return { id: c.id, at: c.updated_time, unread: c.unread_count || 0, withId: other.id || '', withName: other.name || other.username || 'ลูกค้า', messages: msgs }
  })
}
export async function metaInbox(env, { pageId, platform = 'messenger' } = {}) {
  if (!env.META_SYSTEM_USER_TOKEN) return { configured: false, conversations: [] }
  const p = await pageById(env, pageId)
  const plat = platform === 'instagram' ? 'instagram' : 'messenger'
  if (plat === 'instagram' && !p.ig) return { configured: true, conversations: [], note: 'เพจนี้ยังไม่ได้ผูกบัญชี Instagram Business' }
  const data = await graph(`${p.id}/conversations`, { token: p.token, params: { platform: plat, fields: 'id,updated_time,unread_count,participants,messages.limit(15){message,from,created_time}', limit: '25' } })
  const selfId = plat === 'instagram' ? p.ig.id : p.id
  return { configured: true, conversations: shapeConversations(data, selfId) }
}
export async function metaReply(env, { pageId, recipientId, text } = {}) {
  if (!env.META_SYSTEM_USER_TOKEN) return { configured: false }
  const msg = clip(text, MAX_TEXT).trim()
  if (!msg) throw new Error('พิมพ์ข้อความก่อนส่ง')
  if (!isId(recipientId)) throw new Error('ไม่พบผู้รับ')
  const p = await pageById(env, pageId)
  const r = await graph('me/messages', { token: p.token, method: 'POST', params: { recipient: { id: String(recipientId) }, message: { text: msg }, messaging_type: 'RESPONSE' } })
  return { configured: true, sent: true, id: r.message_id || '' }
}

// ── โพสต์ลงเพจ (และ IG ถ้ามีรูป) ───────────────────────────────────
export function validatePost({ pageIds, message, imageUrl, toInstagram } = {}) {
  const ids = Array.isArray(pageIds) ? pageIds.map(String).filter(isId) : []
  if (!ids.length) return 'เลือกเพจอย่างน้อย 1 เพจ'
  if (ids.length > 20) return 'เลือกได้สูงสุด 20 เพจต่อครั้ง'
  if (!String(message || '').trim() && !imageUrl) return 'พิมพ์ข้อความหรือใส่รูปก่อน'
  if (String(message || '').length > MAX_POST) return `ข้อความยาวเกิน ${MAX_POST} ตัวอักษร`
  if (imageUrl && !/^https:\/\/\S+$/.test(String(imageUrl))) return 'ลิงก์รูปต้องขึ้นต้นด้วย https://'
  if (toInstagram && !imageUrl) return 'Instagram ต้องมีรูปทุกโพสต์ — ใส่ลิงก์รูปก่อน'
  return ''
}
export async function metaPost(env, body = {}) {
  if (!env.META_SYSTEM_USER_TOKEN) return { configured: false }
  const err = validatePost(body)
  if (err) throw new Error(err)
  const message = String(body.message || '')
  const results = []
  for (const id of [...new Set(body.pageIds.map(String))]) {
    const row = { pageId: id, facebook: null, instagram: null }
    try {
      const p = await pageById(env, id)
      row.name = p.name
      const r = body.imageUrl
        ? await graph(`${p.id}/photos`, { token: p.token, method: 'POST', params: { url: body.imageUrl, caption: message } })
        : await graph(`${p.id}/feed`, { token: p.token, method: 'POST', params: { message, ...(body.link ? { link: String(body.link) } : {}) } })
      row.facebook = { ok: true, id: r.post_id || r.id || '' }
      if (body.toInstagram) {
        if (!p.ig) row.instagram = { ok: false, error: 'เพจนี้ยังไม่ผูก IG Business' }
        else {
          try {
            const c = await graph(`${p.ig.id}/media`, { token: p.token, method: 'POST', params: { image_url: body.imageUrl, caption: message } })
            const pub = await graph(`${p.ig.id}/media_publish`, { token: p.token, method: 'POST', params: { creation_id: c.id } })
            row.instagram = { ok: true, id: pub.id || '' }
          } catch (e) { row.instagram = { ok: false, error: e.message } }
        }
      }
    } catch (e) { row.facebook = { ok: false, error: e.message } }
    results.push(row)
  }
  return { configured: true, results }
}

// ── โฆษณา Meta: ดูแคมเปญ + ยอดใช้จ่ายเดือนนี้ / หยุด-เปิด / ตั้งงบรายวัน ───────────
export function shapeCampaign(c) {
  const ins = c.insights?.data?.[0] || {}
  const leads = (ins.actions || []).filter(a => /lead|messaging_conversation_started/.test(a.action_type)).reduce((s, a) => s + Number(a.value || 0), 0)
  const spend = Number(ins.spend || 0)
  return {
    id: c.id, name: c.name, status: c.status, effective: c.effective_status, objective: c.objective || '',
    dailyBudget: c.daily_budget != null ? Number(c.daily_budget) / 100 : null,
    lifetimeBudget: c.lifetime_budget != null ? Number(c.lifetime_budget) / 100 : null,
    spend, impressions: Number(ins.impressions || 0), clicks: Number(ins.clicks || 0), leads,
    costPerLead: leads ? Math.round(spend / leads) : null,
  }
}
export async function metaAds(env) {
  const token = env.META_SYSTEM_USER_TOKEN
  if (!token) return { configured: false, accounts: [] }
  let ids = String(env.META_AD_ACCOUNT_IDS || '').split(',').map(s => s.trim()).filter(isActId)
  let accounts = []
  if (!ids.length) {
    const d = await graph('me/adaccounts', { token, params: { fields: 'id,name,currency,account_status', limit: '25' } })
    accounts = (d.data || []).map(a => ({ id: a.id, name: a.name, currency: a.currency, active: a.account_status === 1 }))
  } else {
    accounts = await Promise.all(ids.map(id => graph(id, { token, params: { fields: 'id,name,currency,account_status' } })
      .then(a => ({ id: a.id, name: a.name, currency: a.currency, active: a.account_status === 1 }))
      .catch(e => ({ id, name: id, error: e.message }))))
  }
  for (const a of accounts) {
    if (a.error) continue
    try {
      const d = await graph(`${a.id}/campaigns`, { token, params: { fields: 'id,name,status,effective_status,objective,daily_budget,lifetime_budget,insights.date_preset(this_month){spend,impressions,clicks,actions}', limit: '50' } })
      a.campaigns = (d.data || []).map(shapeCampaign)
      a.spend = a.campaigns.reduce((s, c) => s + c.spend, 0)
    } catch (e) { a.error = e.message; a.campaigns = [] }
  }
  return { configured: true, accounts }
}
export function validateAdUpdate({ campaignId, status, dailyBudget } = {}) {
  if (!isId(campaignId)) return 'ไม่พบแคมเปญ'
  if (status == null && dailyBudget == null) return 'ไม่มีอะไรให้เปลี่ยน'
  if (status != null && !['ACTIVE', 'PAUSED'].includes(status)) return 'สถานะต้องเป็น เปิด หรือ หยุด'
  if (dailyBudget != null && !(Number(dailyBudget) >= 50 && Number(dailyBudget) <= 200000)) return 'งบรายวันต้องอยู่ระหว่าง 50 – 200,000 บาท'
  return ''
}
export async function metaAdsUpdate(env, body = {}, role = '') {
  if (!MANAGER_ROLES.includes(role)) throw new Error('เฉพาะผู้จัดการ/เจ้าของเท่านั้นที่เปลี่ยนโฆษณาได้')
  if (!env.META_SYSTEM_USER_TOKEN) return { configured: false }
  const err = validateAdUpdate(body)
  if (err) throw new Error(err)
  const params = {}
  if (body.status) params.status = body.status
  if (body.dailyBudget != null) params.daily_budget = String(Math.round(Number(body.dailyBudget) * 100))
  await graph(String(body.campaignId), { token: env.META_SYSTEM_USER_TOKEN, method: 'POST', params })
  return { configured: true, ok: true }
}

// ── LINE OA: เก็บข้อความลูกค้าที่ทักเข้ามาเป็นกล่องแชต + ตอบกลับจากแอป ────────────────
const fsBase = env => `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`
export const lineThreadId = userId => `line_${String(userId).replace(/[^A-Za-z0-9_-]/g, '')}`

export function lineMessageText(message = {}) {
  if (message.type === 'text') return clip(message.text, MAX_TEXT)
  const label = { image: '[รูปภาพ]', video: '[วิดีโอ]', audio: '[ข้อความเสียง]', file: '[ไฟล์]', location: '[ตำแหน่ง]', sticker: '[สติกเกอร์]' }[message.type]
  if (message.type === 'location') return `[ตำแหน่ง] ${clip(message.title || message.address || '', 200)}`.trim()
  return label || '[ข้อความ]'
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

async function upsertThread(env, accessToken, id, data) {
  const fields = fsFields(data)
  const mask = Object.keys(fields).map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&')
  return fetch(`${fsBase(env)}/social_threads/${encodeURIComponent(id)}?${mask}`, {
    method: 'PATCH', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ fields }),
  }).catch(() => null)
}
async function addMessage(env, accessToken, data) {
  return fetch(`${fsBase(env)}/social_messages`, {
    method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: fsFields(data) }),
  }).catch(() => null)
}

// เรียกจาก LINE webhook เมื่อเป็นข้อความลูกค้า (ไม่ใช่เจ้าของ/เซลส์ที่ลงทะเบียน) — ห้ามทำให้ webhook ล้ม
export async function recordLineInbound(env, accessToken, ev) {
  try {
    const userId = ev?.source?.userId
    // เฉพาะแชต 1:1 กับ OA — ข้อความในกลุ่ม LINE ไม่ใช่ลูกค้าทักมา
    if (!userId || ev.type !== 'message' || !accessToken || (ev.source.type && ev.source.type !== 'user')) return false
    let name = ''
    try {
      const p = await fetch(`https://api.line.me/v2/bot/profile/${encodeURIComponent(userId)}`, { headers: { Authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}` } })
      if (p.ok) name = (await p.json()).displayName || ''
    } catch { /* ไม่มีชื่อก็เก็บได้ */ }
    const text = lineMessageText(ev.message)
    const at = new Date(ev.timestamp || Date.now())
    const id = lineThreadId(userId)
    await addMessage(env, accessToken, { threadId: id, platform: 'line', direction: 'in', text, at, by: name })
    await upsertThread(env, accessToken, id, { platform: 'line', userId, name: name || 'ลูกค้า LINE', lastText: clip(text, 200), lastAt: at, lastDirection: 'in', unread: true, updatedAt: new Date() })
    return true
  } catch { return false }
}

export async function lineReply(env, accessToken, { threadId, text } = {}, staffName = '') {
  if (!env.LINE_CHANNEL_ACCESS_TOKEN) return { configured: false }
  const msg = clip(text, MAX_TEXT).trim()
  if (!msg) throw new Error('พิมพ์ข้อความก่อนส่ง')
  if (!/^line_[A-Za-z0-9_-]{10,60}$/.test(String(threadId || ''))) throw new Error('ไม่พบห้องแชต')
  const userId = String(threadId).slice(5)
  const res = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST', headers: { Authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: userId, messages: [{ type: 'text', text: msg }] }),
  }).catch(() => null)
  if (!res?.ok) {
    const d = res ? await res.json().catch(() => ({})) : {}
    const quota = /limit|quota/i.test(d.message || '')
    throw new Error(quota ? 'โควตาข้อความ LINE OA เดือนนี้หมดแล้ว — อัปแพ็กเกจใน LINE OA Manager หรือตอบในแอป LINE OA แทน' : `LINE: ${d.message || res?.status || 'network error'}`)
  }
  const at = new Date()
  if (accessToken) {
    await addMessage(env, accessToken, { threadId, platform: 'line', direction: 'out', text: msg, at, by: clip(staffName, 80) })
    await upsertThread(env, accessToken, threadId, { lastText: clip(msg, 200), lastAt: at, lastDirection: 'out', unread: false, updatedAt: at })
  }
  return { configured: true, sent: true }
}

// ── router ──────────────────────────────────────────────────────
const writeLog = new Map()
export function __resetSocialRate() { writeLog.clear() }
function allowWrite(uid) {
  const now = Date.now()
  const hits = (writeLog.get(uid) || []).filter(t => now - t < 60_000)
  if (hits.length >= 20) return false
  hits.push(now); writeLog.set(uid, hits); return true
}

export async function handleSocial(path, body, env, ctx) {
  const { uid = '', role = '', name = '', getAccessToken } = ctx || {}
  const writes = ['/social/meta/reply', '/social/meta/post', '/social/meta/ads/update', '/social/line/reply']
  if (writes.includes(path) && !allowWrite(uid)) throw Object.assign(new Error('ส่งถี่เกินไป รอสักครู่แล้วลองใหม่'), { status: 429 })
  switch (path) {
    case '/social/status': return socialStatus(env)
    case '/social/meta/inbox': return metaInbox(env, body)
    case '/social/meta/reply': return metaReply(env, body)
    case '/social/meta/post': return metaPost(env, body)
    case '/social/meta/ads': return metaAds(env)
    case '/social/meta/ads/update': return metaAdsUpdate(env, body, role)
    case '/social/line/reply': return lineReply(env, getAccessToken ? await getAccessToken() : null, body, name)
    default: return null
  }
}
