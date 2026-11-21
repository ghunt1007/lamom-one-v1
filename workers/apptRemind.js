// (v1.0.1244) เตือนนัดล่วงหน้า 1 วันทาง LINE — นัดรับรถ (ใบจอง deliveryDate) · นัดทดลองขับ · นัดเข้าโชว์รูม
// ส่งเฉพาะลูกค้าที่ผูก LINE แล้ว (lineUserId) ไม่เลิกรับ/ไม่บล็อก · เปิดสวิตช์ inbox_auto.apptLine ก่อน (ปิดไว้เป็นค่าเริ่มต้น)
// ทำงานช่วง 17:00–17:59 น. (cron ทุก 10 นาที) · จด lineRemindFor = วันนัด ก่อนส่ง → ไม่ส่งซ้ำ
import { carLabel } from '../src/utils/carLabel.js'

export const APPT_REMIND_HOUR = 17
export const APPT_REMIND_MAX = 40
const UID = /^U[0-9a-f]{10,40}$/i
const DONE_BOOKING = ['ส่งมอบแล้ว', 'ถอนจอง', 'ยกเลิก']
const DONE_TD = ['done', 'cancelled', 'no_show', 'completed']
const DONE_APPT = ['cancelled', 'no_show', 'arrived', 'done', 'completed']
const digits = s => String(s || '').replace(/\D/g, '').replace(/^66/, '0')
const day = v => String(v || '').slice(0, 10)
const hhmm = v => /^\d{1,2}:\d{2}/.test(String(v || '')) ? String(v).slice(0, 5) : ''
const dmy = d => d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${Number(d.slice(0, 4)) + 543}` : ''
const first = n => { const w = String(n || '').trim().replace(/^คุณ/, '').split(/\s+/)[0]; return w && !/^ลูกค้า/.test(w) ? w : '' }

export const REMIND_BOOKING_FIELDS = ['status', 'customerId', 'custName', 'brand', 'model', 'deliveryDate', 'deliveryTime', 'lineUserId', 'lineOptOut', 'lineBlockedAt', 'lineRemindFor', 'deleted']
export const REMIND_TD_FIELDS = ['date', 'time', 'status', 'customerId', 'customerName', 'phone', 'model', 'lineRemindFor', 'deleted']
export const REMIND_APPT_FIELDS = ['date', 'time', 'status', 'custName', 'phone', 'purpose', 'interestedIn', 'lineRemindFor', 'deleted']
export const REMIND_CUSTOMER_FIELDS = ['firstName', 'phone', 'bookingId', 'lineUserId', 'lineOptOut', 'lineBlockedAt', 'deleted']

export function remindText(kind, { name = '', date = '', time = '', what = '' } = {}) {
  const hi = name ? `สวัสดีครับคุณ${name}` : 'สวัสดีครับ'
  const when = `พรุ่งนี้ ${dmy(date)}${time ? ` เวลา ${time} น.` : ''}`
  const body = kind === 'delivery' ? `ขอเตือนนัดรับรถ${what ? ` ${what}` : ''} ${when} ที่โชว์รูมครับ 🚗`
    : kind === 'testdrive' ? `ขอเตือนนัดทดลองขับ${what ? ` ${what}` : ''} ${when} ครับ`
      : `ขอเตือนนัดเข้าโชว์รูม ${when}${what ? ` (${what})` : ''} ครับ`
  return `${hi} ${body}\nถ้าต้องการเลื่อนนัด ตอบกลับข้อความนี้ได้เลยครับ`
}

/**
 * เลือกนัดที่ต้องเตือน (ฟังก์ชันล้วน) — tomorrow = YYYY-MM-DD ตามเวลาไทย
 * คืน [{ col, id, to, text }] ไม่เกิน max · ลูกค้าคนเดียวมีหลายนัดวันเดียวกัน ส่งข้อความเดียว (นัดแรกที่เจอ) แต่จดทุกนัด
 */
export function pickApptReminders({ bookings = [], testDrives = [], appointments = [], customers = [], tomorrow, max = APPT_REMIND_MAX } = {}) {
  const byId = new Map(), byPhone = new Map(), byBooking = new Map()
  for (const c of customers) {
    if (!c || c.deleted) continue
    byId.set(c.id, c)
    const p = digits(c.phone)
    if (p.length >= 9 && !byPhone.has(p)) byPhone.set(p, c)
    if (c.bookingId) byBooking.set(c.bookingId, c)
  }
  const ok = (to, ...docs) => UID.test(to || '') && !docs.some(d => d && (d.lineOptOut === true || d.lineBlockedAt))
  const out = [], seen = new Set(), also = []
  const push = (col, doc, to, text) => {
    if (seen.has(to)) { also.push({ col, id: doc.id }); return }
    if (out.length >= max) return
    seen.add(to)
    out.push({ col, id: doc.id, to, text })
  }
  for (const b of bookings) {
    if (!b || b.deleted || !b.id || DONE_BOOKING.includes(b.status) || day(b.deliveryDate) !== tomorrow || b.lineRemindFor === tomorrow) continue
    const c = byId.get(b.customerId) || byBooking.get(b.id) || null
    const to = b.lineUserId || c?.lineUserId
    if (!ok(to, b, c)) continue
    push('bookings', b, to, remindText('delivery', { name: first(c?.firstName || b.custName), date: tomorrow, time: hhmm(b.deliveryTime), what: carLabel(b.brand, b.model) }))
  }
  for (const t of testDrives) {
    if (!t || t.deleted || !t.id || DONE_TD.includes(t.status) || day(t.date) !== tomorrow || t.lineRemindFor === tomorrow) continue
    const c = byId.get(t.customerId) || byPhone.get(digits(t.phone)) || null
    if (!c || !ok(c.lineUserId, c)) continue
    push('test_drives', t, c.lineUserId, remindText('testdrive', { name: first(c.firstName || t.customerName), date: tomorrow, time: hhmm(t.time), what: String(t.model || '').trim() }))
  }
  for (const a of appointments) {
    if (!a || a.deleted || !a.id || DONE_APPT.includes(a.status) || day(a.date) !== tomorrow || a.lineRemindFor === tomorrow) continue
    const c = byPhone.get(digits(a.phone)) || null
    if (!c || !ok(c.lineUserId, c)) continue
    push('appointments', a, c.lineUserId, remindText('showroom', { name: first(c.firstName || a.custName), date: tomorrow, time: hhmm(a.time), what: String(a.purpose || a.interestedIn || '').trim() }))
  }
  return { send: out, also }
}

/**
 * deps: { enabled, hour, tomorrow, list(col, fields)→rows, pushLine(to,text)→bool, mark(col,id,fields)→bool }
 */
export async function runApptRemind(deps) {
  if (!deps?.enabled || !deps.pushLine) return { sent: 0, skipped: 'off' }
  if (deps.hour !== APPT_REMIND_HOUR) return { sent: 0, skipped: 'hour' }
  const [bookings, testDrives, appointments, customers] = await Promise.all([
    deps.list('bookings', REMIND_BOOKING_FIELDS), deps.list('test_drives', REMIND_TD_FIELDS),
    deps.list('appointments', REMIND_APPT_FIELDS), deps.list('customers', REMIND_CUSTOMER_FIELDS),
  ])
  const { send, also } = pickApptReminders({ bookings, testDrives, appointments, customers, tomorrow: deps.tomorrow })
  const f = { lineRemindFor: { stringValue: deps.tomorrow } }
  for (const a of also) await deps.mark(a.col, a.id, f)
  let sent = 0, failed = 0
  for (const s of send) {
    if (!(await deps.mark(s.col, s.id, f))) continue // จดก่อนส่ง กันส่งซ้ำ
    if (await deps.pushLine(s.to, s.text)) sent++
    else failed++
  }
  return { sent, failed }
}
