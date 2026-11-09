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
