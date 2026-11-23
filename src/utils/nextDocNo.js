// (v1.0.1335) เลขที่เอกสารถัดไป (เช่น INV-2026-012) — เดิมใช้ "จำนวนเอกสารที่โหลดมา + 1" ซึ่งซ้ำได้ง่าย:
// โหลดสูงสุด 500 ใบ (พอเกิน 500 ทุกใบใหม่ได้เลข 501 ซ้ำกันหมด), นับรวมทุกประเภท, และลบใบไหนไปเลขก็ถอยกลับไปชนใบเดิม
// ตอนนี้หาเลขที่มากที่สุดของคำนำหน้า+ปีนั้นแล้ว +1 (ขึ้นปีใหม่เริ่ม 1 ใหม่)
export function nextDocNo(prefix, existingNos, { year = new Date().getFullYear(), pad = 3 } = {}) {
  const head = `${prefix}-${year}-`
  let max = 0
  for (const no of existingNos || []) {
    const s = String(no || '')
    if (!s.startsWith(head)) continue
    const n = parseInt(s.slice(head.length), 10)
    if (Number.isFinite(n) && n > max) max = n
  }
  return head + String(max + 1).padStart(pad, '0')
}
