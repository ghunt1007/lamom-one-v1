// ตัวเลขหลักของหน้าภาพรวม (Dashboard) — รวมสูตรไว้ที่เดียว ทุกการ์ดในหน้าใช้นิยามเดียวกัน ตัวเลขจึงตรงกันทุกช่อง
// · จองใหม่ = ใบจองที่ bookingDate อยู่ในเดือนนั้น (รวมที่ถอนไปแล้ว เพราะเป็น "ยอดเปิดใบจอง")
// · มูลค่า/Margin = เฉพาะใบจองที่ยังไม่ถอน/ไม่ยกเลิก (เดิมรวมใบที่ถอนแล้วด้วย ทำให้มูลค่าสูงเกินจริง)
// · ส่งมอบ = ส่งมอบแล้ว + ตัดตัวเลขรอส่งมอบ นับตามวันตัดตัวเลข (cutDate) เหมือนรายงาน LINE
import { DELIVERED_STATUSES } from './deliveryIncome.js'

export const CANCELLED_STATUSES = ['ถอนจอง', 'ยกเลิก']

export const isCancelled = b => CANCELLED_STATUSES.includes(b?.status)
export const isDelivered = b => DELIVERED_STATUSES.includes(b?.status)
export const deliveredMonth = b => String(b?.cutDate || b?.actualDeliveryDate || '').slice(0, 7)
const inMonth = (d, ym) => String(d || '').startsWith(ym)

export function shiftYm(ym, delta) {
  const [y, m] = String(ym).split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
}

export function monthStats(bookings = [], ym) {
  const booked = bookings.filter(b => inMonth(b.bookingDate, ym))
  const live = booked.filter(b => !isCancelled(b))
  return {
    booked: booked.length,
    active: live.length,
    withdrawn: booked.length - live.length,
    delivered: bookings.filter(b => isDelivered(b) && deliveredMonth(b) === ym).length,
    value: live.reduce((s, b) => s + (Number(b.price) || 0), 0),
    margin: live.reduce((s, b) => s + (Number(b.margin) || 0), 0),
  }
}

// ใบจองที่ยังไม่จบ (ยังไม่ส่งมอบ/ตัดตัวเลข และไม่ถอน) — ยอดค้างจริงสะสมทุกเดือน
export function openBookings(bookings = []) {
  return bookings.filter(b => !isCancelled(b) && !isDelivered(b))
}

// ค่าย้อนหลัง n เดือน (เก่า → ใหม่) สำหรับกราฟเส้นเล็กในการ์ดตัวเลข
export function monthSeries(bookings, ym, n, key) {
  return Array.from({ length: n }, (_, i) => monthStats(bookings, shiftYm(ym, i - n + 1))[key])
}

// วันที่รถเข้าสต็อก — รถส่วนใหญ่มีแต่ arrivedAt ไม่มี createdAt (เดิมใช้ createdAt อย่างเดียว แจ้งเตือนรถค้างจึงไม่เคยขึ้น)
export const stockSince = v => v?.arrivedAt || v?.createdAt || null

// % เปลี่ยนแปลงเทียบเดือนก่อน: null = เทียบไม่ได้ (เดือนก่อนเป็น 0)
export function pctChange(cur, prev) {
  if (!prev) return null
  return (cur - prev) / prev * 100
}

// เส้นกราฟเล็ก (sparkline) เป็น SVG path — ไม่มีข้อมูลเลยคืน ''
export function sparkPath(values, w = 100, h = 28) {
  if (!values?.length || !values.some(v => v)) return ''
  const max = Math.max(...values), min = Math.min(...values, 0)
  const span = max - min || 1
  const step = values.length > 1 ? w / (values.length - 1) : 0
  return values.map((v, i) => `${i ? 'L' : 'M'}${(i * step).toFixed(1)},${(h - 2 - (v - min) / span * (h - 4)).toFixed(1)}`).join(' ')
}
