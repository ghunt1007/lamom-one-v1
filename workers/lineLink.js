// (v1.0.1230) ผูก LINE ลูกค้าเข้ากับแฟ้มในแอป + PDPA เลิกรับ/รับข้อความ + แจ้งสถานะรถอัตโนมัติทาง LINE
//
// ทำไม: แอปส่ง LINE หาลูกค้าได้เฉพาะคนที่มี lineUserId ซึ่งเดิมได้มาเฉพาะลูกค้าที่ทัก OA เอง
// ลูกค้าจาก Sheet ส่วนใหญ่มีแต่เบอร์ → แจ้งสถานะ/ขอรีวิว/ปลุกลีด ส่งไม่ถึงใคร
//
// วิธีผูก: เซลส์กด "🔗 ผูก LINE" ในแฟ้มลูกค้าหรือใบจอง → แอปสร้างรหัส 6 ตัว เก็บที่ lineLinkCode ของเอกสารนั้น
// แล้วโชว์ QR ที่เปิดแชต LINE OA พร้อมข้อความ "ผูก ABC123" ลูกค้าแค่กดส่ง → webhook จับรหัส → ใส่ lineUserId ให้
// การกดส่งเองคือความยินยอม (บันทึก lineConsentAt) · พิมพ์ "เลิกรับ" เมื่อไหร่ก็หยุดทุกข้อความอัตโนมัติ (lineOptOut)
//
// ทุกฟังก์ชันรับ fetchImpl เพื่อเทสได้โดยไม่ยิงจริง
import { customerStatusMessage } from '../src/utils/bookingNotify.js'

const fsBase = env => `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`
async function call(fetchImpl, url, init) { try { return await fetchImpl(url, init) } catch { return null } }

export const LINK_CODE_DAYS = 30
export const STATUS_JOB_MAX = 30 // ส่งไม่เกินรอบละ 30 คน (cron ทุก 10 นาที) กันโควตา LINE หมดในทีเดียว

// รหัสผูก: ตัวอักษร/ตัวเลข 6 ตัว ไม่มีตัวที่สับสนกัน (0/O, 1/I)
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export function newLinkCode(rand = Math.random) {
  let s = ''
  for (let i = 0; i < 6; i++) s += CODE_CHARS[Math.floor(rand() * CODE_CHARS.length) % CODE_CHARS.length]
  return s
}

// "ผูก ABC123" / "ผูก:abc123" / "LINK ABC123" → 'ABC123' · อย่างอื่น → ''
export function parseLinkCode(text) {
  const m = String(text || '').trim().match(/^(?:ผูก(?:\s*LINE)?|link)\s*[:#-]?\s*([A-Za-z0-9]{6})$/i)
  return m ? m[1].toUpperCase() : ''
}

// ลูกค้าขอหยุด/ขอรับข้อความอีกครั้ง — ต้องพิมพ์ทั้งข้อความ (กันจับผิดจากประโยคยาวที่บังเอิญมีคำนี้)
export function parseOptCommand(text) {
  const t = String(text || '').trim().replace(/\s+/g, '').toLowerCase()
  if (['เลิกรับ', 'เลิกรับข่าว', 'เลิกรับข่าวสาร', 'เลิกรับข้อความ', 'หยุดส่ง', 'หยุดรับ', 'stop', 'unsubscribe'].includes(t)) return 'out'
  if (['รับข่าว', 'รับข่าวสาร', 'รับข้อความ', 'สมัครรับ', 'start', 'subscribe'].includes(t)) return 'in'
  return ''
}

const str = v => ({ stringValue: String(v ?? '') })
const val = f => (f == null ? undefined : f.stringValue ?? f.timestampValue ?? f.booleanValue ?? f.integerValue ?? f.doubleValue ?? (f.nullValue === null ? null : undefined))
function docOf(d) {
  const o = { id: String(d.name || '').split('/').pop() }
  for (const [k, v] of Object.entries(d.fields || {})) o[k] = val(v)
  return o
}

async function findBy(env, token, coll, field, value, fetchImpl, limit = 20) {
  const r = await call(fetchImpl, `${fsBase(env)}:runQuery`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId: coll }], where: { fieldFilter: { field: { fieldPath: field }, op: 'EQUAL', value: { stringValue: value } } }, limit } }),
  })
  if (!r?.ok) return []
  const rows = await r.json().catch(() => [])
  return (Array.isArray(rows) ? rows : []).filter(x => x.document).map(x => docOf(x.document))
}

async function patch(env, token, coll, id, fields, fetchImpl) {
  const mask = Object.keys(fields).map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&')
  const r = await call(fetchImpl, `${fsBase(env)}/${coll}/${encodeURIComponent(id)}?${mask}&currentDocument.exists=true`, {
    method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ fields }),
  })
  return !!r?.ok
}

export function codeFresh(doc, nowMs = Date.now()) {
  const at = Date.parse(doc?.lineLinkCodeAt || '')
  return Number.isFinite(at) && nowMs - at <= LINK_CODE_DAYS * 864e5
}

export function linkedReply({ name = '', statusText = '' } = {}) {
  const first = String(name || '').trim().split(/\s+/)[0]
  return [
    `✅ ผูก LINE เรียบร้อยแล้วครับ${first ? ` คุณ${first}` : ''} 🙏`,
    'ต่อจากนี้เราจะแจ้งความคืบหน้ารถ นัดหมาย และเรื่องสำคัญให้ทาง LINE นี้',
    statusText ? `\n📌 สถานะตอนนี้\n${statusText}` : '',
    '\nไม่อยากรับข้อความอัตโนมัติ พิมพ์ "เลิกรับ" ได้ทุกเมื่อ (พิมพ์ "รับข่าว" เพื่อกลับมารับ)',
  ].filter(Boolean).join('\n')
}

/**
 * ลูกค้าส่ง "ผูก XXXXXX" → หาเอกสาร (ลูกค้า + ใบจอง) ที่มีรหัสนี้ แล้วใส่ lineUserId
 * คืน { linked, reply } · reply = ข้อความตอบลูกค้า (ฟรี ผ่าน reply token)
 */
export async function linkByCode(env, token, { code, userId, nowMs = Date.now() }, fetchImpl = fetch) {
  if (!code || !userId || !token) return { linked: false, reply: '' }
  const [cs, bs] = await Promise.all([
    findBy(env, token, 'customers', 'lineLinkCode', code, fetchImpl, 5),
    findBy(env, token, 'bookings', 'lineLinkCode', code, fetchImpl, 5),
  ])
  const custs = cs.filter(d => !d.deleted && codeFresh(d, nowMs))
  const books = bs.filter(d => !d.deleted && codeFresh(d, nowMs))
  if (!custs.length && !books.length) {
    return { linked: false, reply: '⚠️ รหัสนี้ใช้ไม่ได้หรือหมดอายุแล้วครับ รบกวนขอ QR ใหม่จากเซลส์ผู้ดูแลนะครับ' }
  }
  const nowIso = new Date(nowMs).toISOString()
  const base = { lineUserId: str(userId), lineLinkedAt: str(nowIso), lineConsentAt: str(nowIso), lineLinkCode: str(''), lineOptOut: { booleanValue: false } }
  for (const c of custs) await patch(env, token, 'customers', c.id, base, fetchImpl)
  // ใบจองของลูกค้าคนนี้ (ที่ผูกจากหน้าลูกค้า) ก็ได้ lineUserId ด้วย · ตั้งจุดเริ่มสถานะ = สถานะตอนนี้ (บอกในข้อความตอบแล้ว ไม่ส่งซ้ำ)
  const more = []
  for (const c of custs) {
    const byCust = await findBy(env, token, 'bookings', 'customerId', c.id, fetchImpl, 10)
    for (const b of byCust) if (!b.deleted && !books.some(x => x.id === b.id) && !more.some(x => x.id === b.id)) more.push(b)
    if (c.bookingId && !books.some(x => x.id === c.bookingId) && !more.some(x => x.id === c.bookingId)) {
      const r = await call(fetchImpl, `${fsBase(env)}/bookings/${encodeURIComponent(c.bookingId)}`, { headers: { Authorization: `Bearer ${token}` } })
      if (r?.ok) { const d = await r.json().catch(() => null); if (d?.fields && !d.fields.deleted?.booleanValue) more.push(docOf(d)) }
    }
  }
  const allBooks = [...books, ...more]
  for (const b of allBooks) await patch(env, token, 'bookings', b.id, { ...base, statusLineSent: str(b.status || '') }, fetchImpl)
  // ลูกค้าที่เชื่อมกับใบจองที่ผูกจากหน้าใบจอง
  for (const b of books) if (b.customerId && !custs.some(c => c.id === b.customerId)) await patch(env, token, 'customers', b.customerId, base, fetchImpl)
  const live = allBooks.filter(b => b.status && b.status !== 'ถอนจอง').sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))[0]
  const name = custs[0] ? [custs[0].firstName, custs[0].lastName].filter(Boolean).join(' ') : (books[0]?.custName || '')
  return { linked: true, reply: linkedReply({ name, statusText: live ? customerStatusMessage(live, live.status).replace(/^สวัสดีครับ(คุณ\S+)?\s*/, '') : '' }), customerIds: custs.map(c => c.id), bookingIds: allBooks.map(b => b.id) }
}

/** ลูกค้าพิมพ์ "เลิกรับ"/"รับข่าว" → ตั้ง lineOptOut ให้ทุกเอกสารที่ผูก LINE นี้ · คืนข้อความตอบ ('' = ไม่ใช่ลูกค้าที่ผูกไว้) */
export async function setOptOut(env, token, { userId, out, nowMs = Date.now() }, fetchImpl = fetch) {
  if (!userId || !token) return ''
  const [cs, bs] = await Promise.all([
    findBy(env, token, 'customers', 'lineUserId', userId, fetchImpl, 10),
    findBy(env, token, 'bookings', 'lineUserId', userId, fetchImpl, 10),
  ])
  if (!cs.length && !bs.length) return ''
  const nowIso = new Date(nowMs).toISOString()
  const f = { lineOptOut: { booleanValue: !!out }, lineOptOutAt: out ? str(nowIso) : { nullValue: null } }
  for (const c of cs) await patch(env, token, 'customers', c.id, f, fetchImpl)
  for (const b of bs) await patch(env, token, 'bookings', b.id, f, fetchImpl)
  return out
    ? '✅ หยุดส่งข้อความอัตโนมัติให้แล้วครับ (แจ้งสถานะรถ ข่าวสาร โปรโมชัน)\nถ้ามีอะไรสอบถาม ทักมาได้ตามปกติ · พิมพ์ "รับข่าว" เพื่อกลับมารับ'
    : '✅ กลับมารับข้อความแจ้งสถานะรถและข่าวสารแล้วครับ · พิมพ์ "เลิกรับ" เพื่อหยุดได้ทุกเมื่อ'
}

/** ลูกค้าบล็อก OA (unfollow) → จดไว้ ไม่ส่งอะไรหาอีก จนกว่าจะเพิ่มเพื่อนกลับ (follow) */
export async function markFollow(env, token, { userId, follow, nowMs = Date.now() }, fetchImpl = fetch) {
  if (!userId || !token) return 0
  const [cs, bs] = await Promise.all([
    findBy(env, token, 'customers', 'lineUserId', userId, fetchImpl, 10),
    findBy(env, token, 'bookings', 'lineUserId', userId, fetchImpl, 10),
  ])
  const f = { lineBlockedAt: follow ? { nullValue: null } : str(new Date(nowMs).toISOString()) }
  let n = 0
  for (const c of cs) n += (await patch(env, token, 'customers', c.id, f, fetchImpl)) ? 1 : 0
  for (const b of bs) n += (await patch(env, token, 'bookings', b.id, f, fetchImpl)) ? 1 : 0
  return n
}

/**
 * เลือกใบจองที่ต้องแจ้งสถานะ (ฟังก์ชันล้วน — เทสได้)
 * - ต้องรู้ lineUserId (ของใบจองเอง หรือของลูกค้าที่เชื่อม) และไม่เลิกรับ/ไม่บล็อก
 * - สถานะต้องมีข้อความ (customerStatusMessage) และต่างจากที่แจ้งไปล่าสุด (statusLineSent)
 * - ยังไม่เคยแจ้งเลย (ไม่มี statusLineSent): ใบจองที่สร้างหลังลูกค้าผูก LINE = แจ้ง · ใบจองเก่ากว่านั้น = ตั้งจุดเริ่มเฉยๆ (กันส่งย้อนหลังทั้งหมด)
 * คืน { send: [{ booking, to, text }], baseline: [booking] }
 */
export function pickStatusSends(bookings, customers, { max = STATUS_JOB_MAX } = {}) {
  const byId = new Map(), byBooking = new Map()
  for (const c of customers || []) {
    if (!c || c.deleted) continue
    byId.set(c.id, c)
    if (c.bookingId) byBooking.set(c.bookingId, c)
  }
  const send = [], baseline = []
  for (const b of bookings || []) {
    if (!b || b.deleted || !b.status) continue
    const c = byId.get(b.customerId) || byBooking.get(b.id) || null
    const to = b.lineUserId || c?.lineUserId || ''
    if (!/^U[0-9a-f]{10,40}$/i.test(to)) continue
    if (b.lineOptOut === true || c?.lineOptOut === true || b.lineBlockedAt || c?.lineBlockedAt) continue
    if (b.statusLineSent === b.status) continue
    const text = customerStatusMessage(b, b.status)
    if (b.statusLineSent == null || b.statusLineSent === '') {
      const linkedAt = Date.parse(b.lineLinkedAt || c?.lineLinkedAt || '')
      const created = Date.parse(b.createdAt || '')
      if (!(Number.isFinite(linkedAt) && Number.isFinite(created) && created > linkedAt) || !text) { baseline.push(b); continue }
    }
    if (!text) { baseline.push(b); continue }
    if (send.length < max) send.push({ booking: b, to, text })
  }
  return { send, baseline }
}

export const STATUS_BOOKING_FIELDS = ['status', 'customerId', 'custName', 'brand', 'model', 'salesName', 'deliveryDate', 'lineUserId', 'lineLinkedAt', 'lineOptOut', 'lineBlockedAt', 'statusLineSent', 'createdAt', 'deleted']
export const STATUS_CUSTOMER_FIELDS = ['lineUserId', 'lineLinkedAt', 'lineOptOut', 'lineBlockedAt', 'bookingId', 'deleted']

/**
 * cron ทุก 10 นาที: เปิดสวิตช์ "แจ้งสถานะรถทาง LINE อัตโนมัติ" (inbox_auto.statusLine) แล้วเท่านั้น
 * deps: { enabled, listBookings, listCustomers, pushLine(to,text)→bool, mark(id, fields)→bool, now }
 */
export async function runStatusLine(deps) {
  if (!deps?.enabled || !deps.pushLine) return { sent: 0, baseline: 0, skipped: 'off' }
  const [bookings, customers] = await Promise.all([deps.listBookings(), deps.listCustomers()])
  const { send, baseline } = pickStatusSends(bookings, customers)
  const nowIso = new Date(deps.now || Date.now()).toISOString()
  for (const b of baseline) await deps.mark(b.id, { statusLineSent: str(b.status) })
  let sent = 0, failed = 0
  for (const s of send) {
    // จดก่อนส่ง: ถ้าจดไม่ได้ ไม่ส่ง (กันส่งซ้ำทุก 10 นาที)
    if (!(await deps.mark(s.booking.id, { statusLineSent: str(s.booking.status), statusLineSentAt: str(nowIso) }))) continue
    if (await deps.pushLine(s.to, s.text)) sent++
    else failed++
  }
  return { sent, failed, baseline: baseline.length }
}
