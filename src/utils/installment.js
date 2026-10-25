// ค่างวดรถแบบดอกเบี้ยคงที่ (flat rate) ตามที่ไฟแนนซ์รถในไทยใช้ — สูตรเดียวกับหน้า Loan Calculator
// (ยอดจัด + ยอดจัด × ดอกเบี้ย% × ปี) ÷ จำนวนงวด · ตัวเลขเบื้องต้น อัตราจริงขึ้นกับการอนุมัติ
export function flatMonthly(price, downPct, months, ratePct) {
  const p = Number(price) || 0, m = Number(months) || 0
  if (p <= 0 || m <= 0) return { down: 0, loan: 0, monthly: 0 }
  const down = Math.round(p * (Number(downPct) || 0) / 100)
  const loan = p - down
  const monthly = Math.round((loan + loan * (Number(ratePct) || 0) / 100 * (m / 12)) / m)
  return { down, loan, monthly }
}
