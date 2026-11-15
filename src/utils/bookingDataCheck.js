// (v1.0.1164) 🧹 ตรวจใบจองที่ข้อมูลไม่ครบ/ผิดรูป จนทำให้ "ตัวเลขในรายงานผิดเงียบๆ"
// ข้อมูลใบจองกรอกที่ Google Sheet แล้วซิงก์เข้าแอป — ถ้าช่องสำคัญว่าง รายงาน/ค่าคอม/เป้า จะนับพลาดโดยไม่มีใครรู้
// แต่ละข้อบอก "แก้คอลัมน์ไหนใน Sheet" ตรงๆ · ฟังก์ชันล้วน ไม่แตะฐานข้อมูล
import { BOOKING_STATUSES, isCancelled, isDelivered } from './bookingStatus.js'

export const CHECKS = {
  noDeliveredDate: { level: 'high', title: 'ส่งมอบ/ตัดตัวเลขแล้ว แต่ไม่มีวันที่', why: 'ไม่ถูกนับเป็นยอดส่งมอบของเดือนไหนเลย (รายงาน เป้า ค่าคอม)', col: 'วันที่ตัดตัวเลข หรือ วันที่รับจริง' },
  noSales: { level: 'high', title: 'ไม่มีชื่อเซลส์', why: 'ไม่นับเข้ายอด/ค่าคอมของใคร', col: 'ชื่อเซลล์' },
  noBookingDate: { level: 'high', title: 'ไม่มีวันที่จอง', why: 'ไม่ถูกนับเป็นยอดจองของเดือนไหน', col: 'วันที่จอง' },
  badStatus: { level: 'high', title: 'สถานะสะกดไม่ตรงรายการ', why: 'ระบบไม่รู้ว่าอยู่ขั้นไหน รายงานสถานะนับไม่ถูก', col: 'สถานะ' },
  futureDate: { level: 'medium', title: 'วันที่อยู่ในอนาคต (อาจพิมพ์ปีผิด)', why: 'ถูกนับไปเดือน/ปีอื่น', col: 'วันที่จอง / วันที่ตัดตัวเลข / วันที่รับจริง' },
  dupNo: { level: 'medium', title: 'เลขใบจองซ้ำกัน', why: 'อาจเป็นใบเดียวกันกรอกสองแถว ยอดจะนับเกิน', col: 'เลขใบจอง' },
  noPrice: { level: 'medium', title: 'ไม่มีราคารถ', why: 'มูลค่ายอดขาย/ค่างวดคำนวณไม่ได้', col: 'ราคารถ' },
  badPhone: { level: 'low', title: 'เบอร์โทรไม่ครบ/ผิดรูป', why: 'กดโทรหรือส่ง LINE หาลูกค้าไม่ได้', col: 'หมายเลขโทรศัพท์' },
}
export const CHECK_ORDER = ['noDeliveredDate', 'noSales', 'noBookingDate', 'badStatus', 'futureDate', 'dupNo', 'noPrice', 'badPhone']

const ymd = v => String(v || '').slice(0, 10)
const addDays = (d, n) => { const t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10) }

/** @returns {{key:string, rows:object[]}[]} เฉพาะข้อที่เจอ เรียงตามความสำคัญ */
export function bookingDataIssues(bookings = [], { today = '' } = {}) {
  const live = (bookings || []).filter(b => b && !b.deleted)
  const found = Object.fromEntries(CHECK_ORDER.map(k => [k, []]))
  const tomorrow = today ? addDays(today, 1) : ''
  const counts = new Map()
  live.forEach(b => { const n = String(b.bookingNo || '').trim(); if (n) counts.set(n, (counts.get(n) || 0) + 1) })
  for (const b of live) {
    const cancelled = isCancelled(b)
    if (isDelivered(b) && !ymd(b.cutDate) && !ymd(b.actualDeliveryDate)) found.noDeliveredDate.push(b)
    if (!cancelled && !String(b.salesName || '').trim()) found.noSales.push(b)
    if (!cancelled && !ymd(b.bookingDate)) found.noBookingDate.push(b)
    if (b.status && !BOOKING_STATUSES.includes(b.status) && !cancelled) found.badStatus.push(b)
    if (tomorrow && [b.bookingDate, b.cutDate, b.actualDeliveryDate].map(ymd).some(d => /^\d{4}-\d\d-\d\d$/.test(d) && d > tomorrow)) found.futureDate.push(b)
    const no = String(b.bookingNo || '').trim()
    if (no && counts.get(no) > 1) found.dupNo.push(b)
    if (!cancelled && !(Number(b.price) > 0)) found.noPrice.push(b)
    const digits = String(b.phone || '').replace(/\D/g, '')
    if (!cancelled && digits && !/^0\d{8,9}$/.test(digits)) found.badPhone.push(b)
  }
  return CHECK_ORDER.filter(k => found[k].length).map(k => ({ key: k, ...CHECKS[k], rows: found[k] }))
}

export function issueCount(issues = []) { return issues.reduce((s, i) => s + i.rows.length, 0) }

/** ป้ายสั้นของแถวให้หาใน Sheet เจอ: เลขใบจอง · ชื่อลูกค้า · เซลส์ */
export function rowLabel(b = {}) {
  return [b.bookingNo ? `#${b.bookingNo}` : '', b.custName || '', b.salesName ? `(${b.salesName})` : ''].filter(Boolean).join(' ') || 'ใบจองไม่มีเลข'
}
