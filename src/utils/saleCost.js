// ต้นทุนรถต่อคัน: ใช้ "ต้นทุนรถ" ที่กรอกในใบจองถ้ามี ถ้าไม่มีประมาณเป็น 82% ของราคาขาย
// รวมไว้ที่เดียว ทุกหน้า (กำไร/กระแสเงินสด/รายงาน) จะได้ใช้ตัวเลขเดียวกัน และบอกผู้ใช้ได้ว่ามีกี่คันที่เป็นตัวประมาณ
export const COST_ESTIMATE_RATIO = 0.82

export function saleCost(s) {
  const cost = Number(s?.cost) || 0
  if (cost > 0) return cost
  return Math.round((Number(s?.salePrice) || 0) * COST_ESTIMATE_RATIO)
}

export function isCostEstimated(s) {
  return !(Number(s?.cost) > 0) && (Number(s?.salePrice) || 0) > 0
}

// ข้อความเล็กๆ บอกว่ามีกี่คันที่ไม่ได้กรอกต้นทุน (ว่างถ้ากรอกครบ)
export function costEstimateNote(sales) {
  const n = (sales || []).filter(isCostEstimated).length
  if (!n) return ''
  return `<div class="cost-est-note" style="font-size:0.75rem;color:var(--text-muted);margin-top:4px">ℹ️ ${n.toLocaleString('th-TH')} คันยังไม่ได้กรอกต้นทุนรถในใบจอง ใช้ประมาณ ${Math.round(COST_ESTIMATE_RATIO * 100)}% ของราคาขาย</div>`
}
