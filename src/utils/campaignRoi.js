// (v1.0.1314) ROI แคมเปญ — เดิมสมมติว่าขายได้ 1 คัน = รายได้ 200,000 บาท ทุกคัน (ตัวเลขแต่งขึ้น)
// ตอนนี้ใช้ "รายได้จริงเฉลี่ยต่อคัน" (totalIncome ของใบจองที่ขายแล้ว) สูตรเดียวกับหน้า ROI การตลาด
// ยังไม่มีคันที่กรอกรายได้ = ไม่รู้ = null (หน้าจอแสดง -) ไม่เดา
export function avgIncomePerCar(sales = []) {
  const xs = (sales || []).filter(s => s && s.delivered && Number(s.totalIncome) > 0).map(s => Number(s.totalIncome))
  return xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null
}

export function campaignRoiPct(c, perCar) {
  const spent = Number(c?.spent) || 0
  if (!(spent > 0) || perCar == null) return null
  return Math.round(((Number(c.sales) || 0) * perCar - spent) / spent * 1000) / 10
}
