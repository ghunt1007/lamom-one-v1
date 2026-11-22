import { FIN_PASSED_STATUSES } from './finance.js'
// (v1.0.1010) งานฝ่ายการเงินที่ค้าง — ใช้ร่วมกันทั้งหน้าภาพรวมการเงิน และข้อความเตือน 09:00 (workers/daily-report.js)
// นิยามเดียวกับหน้า /finance/refund: เซลส์แจ้งตรวจยอดโอนแล้วรออยู่ · ถอนจองแล้วยังไม่คืนเงินจอง
const DAY = 86400000
export const depositOf = b => Number(b?.bookingDeposit) || Number(b?.down) || 0

export function financeQueue(bookings = [], today) {
  const live = bookings.filter(b => b && !b.deleted)
  const verify = live.filter(b => b.paymentVerifyStatus === 'รอการเงินยืนยัน')
  const refund = live.filter(b => b.status === 'ถอนจอง' && (b.refundStatus || (depositOf(b) > 0 && !b.rightsOnly ? 'รอคืนเงิน' : '')) === 'รอคืนเงิน')
  const t0 = Date.parse(today + 'T00:00:00Z')
  const oldestDays = verify.reduce((m, b) => {
    const at = b.paymentVerifyRequestedAt ? Date.parse(String(b.paymentVerifyRequestedAt).slice(0, 10) + 'T00:00:00Z') : NaN
    return Number.isFinite(at) ? Math.max(m, Math.floor((t0 - at) / DAY)) : m
  }, 0)
  const refundAmt = refund.reduce((s, b) => s + (Number(b.refundAmount) || depositOf(b)), 0)
  return { verify, refund, oldestDays, refundAmt, total: verify.length + refund.length }
}

// (v1.0.1295) คำสั่ง LINE "ไฟแนนซ์" — ใบจองที่ยังเปิดอยู่และไฟแนนซ์ยังไม่จบ (รอส่ง/รอผล/รอโยกหัว/รอเซ็น) เรียงยื่นนานสุดก่อน
// mine(b) = ใบจองของคนถาม (เซลส์: ของตัวเอง / เจ้าของ: ทั้งหมด) · วันที่รอนับจาก submitDate (ไม่มี = ไม่บอกจำนวนวัน ไม่เดา)
export const FIN_WAIT_STATUSES = ['รอส่ง', 'รอผล', 'รอโยกหัว', 'รอเซ็นต์', 'รอเซ็นสัญญา']
// สถานะใบจองที่เลยขั้นไฟแนนซ์แล้ว (รอรถ/รอส่งมอบ ฯลฯ) = ผ่านแล้วแม้ช่องสถานะไฟแนนซ์ค้าง — เกณฑ์เดียวกับ finPassPatch
const CLOSED = ['ถอนจอง', 'ยกเลิก', 'ซื้อสดรอเบิกรถ', ...FIN_PASSED_STATUSES]
export function financeWaitList(bookings = [], today, mine = () => true) {
  const t0 = Date.parse(today + 'T00:00:00Z')
  const days = b => { const at = Date.parse(String(b.submitDate || '').slice(0, 10) + 'T00:00:00Z'); return Number.isFinite(at) ? Math.max(0, Math.floor((t0 - at) / DAY)) : null }
  return (bookings || []).filter(b => b && !b.deleted && !CLOSED.includes(b.status) && FIN_WAIT_STATUSES.includes(b.finStatus) && mine(b))
    .map(b => ({ b, d: days(b) })).sort((x, y) => (y.d ?? -1) - (x.d ?? -1))
}
export function financeWaitAnswer(bookings = [], today, { mine = () => true, max = 10 } = {}) {
  const list = financeWaitList(bookings, today, mine)
  if (!list.length) return '✅ ไม่มีใบจองที่รอไฟแนนซ์'
  const by = {}
  list.forEach(({ b }) => { by[b.finStatus] = (by[b.finStatus] || 0) + 1 })
  const lines = [`🏦 รอไฟแนนซ์ ${list.length} ใบ — ${FIN_WAIT_STATUSES.filter(s => by[s]).map(s => `${s} ${by[s]}`).join(' · ')}`]
  for (const { b, d } of list.slice(0, max)) {
    lines.push([`• ${String(b.custName || '').trim() || 'ไม่ระบุชื่อ'}`, String(b.model || '').trim(), String(b.financeCo || '').trim(), b.finStatus, d != null ? `ยื่นมา ${d} วัน` : ''].filter(Boolean).join(' · '))
  }
  if (list.length > max) lines.push(`…และอีก ${list.length - max} ใบ ดูทั้งหมดในหน้าใบจอง`)
  return lines.join('\n')
}
