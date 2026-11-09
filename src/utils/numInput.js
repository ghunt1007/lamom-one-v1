// (v1.0.978) อ่านตัวเลขจากช่องกรอก — ช่องว่างใช้ค่าเริ่มต้น แต่ "0" คือ 0 จริง
// (เดิมเขียน +el.value || ค่าเริ่มต้น ทำให้ดอกเบี้ย 0%, คะแนน 0, วงเงิน 0, รางวัล 0 กลายเป็นค่าเริ่มต้นเงียบๆ)
export function numOr(v, dflt = 0) {
  const s = String(v ?? '').replace(/,/g, '').trim()
  if (s === '') return dflt
  const n = Number(s)
  return Number.isFinite(n) ? n : dflt
}
export const numVal = (sel, dflt = 0, root = document) => numOr(root.querySelector(sel)?.value, dflt)
