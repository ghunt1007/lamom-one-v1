// สถานะใบจองที่ "เลยขั้นไฟแนนซ์มาแล้ว" (รอรถ/รอส่งมอบ/ตัดตัวเลข/ส่งมอบแล้ว) ถือว่าไฟแนนซ์ผ่านทั้งหมด (เจ้าของกำหนด 25 ต.ค. 69)
// เดิมเซลส์เปลี่ยนสถานะใบจองแต่ลืมแก้ช่องสถานะไฟแนนซ์ ใบจองเลยค้าง "รอผล" และโผล่ในเตือนไฟแนนซ์รอผลนานผิดๆ
// ใบจองซื้อสดไม่แตะ — ใช้ตัวเดียวกับ workers/daily-report.js (finPassPatch)
export const FIN_PASSED_STATUSES = ['ผ่านไฟแนนซ์รอจอง', 'ผ่านไฟแนนซ์รอเบิก', 'รอรถ', 'รอส่งมอบ', 'ตัดตัวเลขรอส่งมอบ', 'ส่งมอบแล้ว']

export function isCashBooking(b) {
  return !!b && (b.finStatus === 'ซื้อสด' || b.financeCo === 'ซื้อสด' || b.status === 'ซื้อสดรอเบิกรถ')
}

export function isFinancePassed(b) {
  return !!b && (b.finStatus === 'ผ่าน' || FIN_PASSED_STATUSES.includes(b.status))
}

// คืน { finStatus: 'ผ่าน' } ถ้าใบจองนี้ต้องแก้สถานะไฟแนนซ์ให้อัตโนมัติ ไม่งั้นคืน null
export function finPassPatch(b) {
  if (!b || b.deleted || !FIN_PASSED_STATUSES.includes(b.status)) return null
  if (isCashBooking(b) || b.finStatus === 'ผ่าน') return null
  return { finStatus: 'ผ่าน' }
}
