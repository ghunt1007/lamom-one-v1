// ความเร็วในการติดต่อ Lead ใหม่ รายเซลส์ในเดือนหนึ่ง — Lead ที่เพิ่มเข้ามาในเดือนนั้น (ตามเวลาไทย) ติดต่อครั้งแรก
// (firstContactAt) ภายใน `hours` ชั่วโมงกี่ราย / ติดต่อช้ากว่านั้นกี่ราย / ยังไม่ได้ติดต่อเลยกี่ราย
// firstContactAt เริ่มบันทึกตั้งแต่ v1.0.606 — Lead ที่เพิ่มก่อนวันที่ระบบเริ่มบันทึก (ก่อน firstContactAt แรกสุดที่มี)
// ไม่นับ (Lead ที่ยังไม่ได้ติดต่อแต่ยังไม่ครบ `hours` ชม. ก็ยังไม่นับ) เพราะจะดูเหมือน "ยังไม่ได้ติดต่อ" ทั้งที่จริงแค่ยังไม่มีข้อมูล — ถ้ายังไม่มีใครมี firstContactAt เลย คืน []
import { toDate } from './format.js'
import { bangkokDate } from './myDay.js'

export function speedToLead(customers, month, { hours = 24, now = Date.now() } = {}) {
  const alive = (customers || []).filter(c => c && !c.deleted)
  const firsts = alive.map(c => toDate(c.firstContactAt)).filter(Boolean)
  if (!firsts.length) return []
  const sinceDay = bangkokDate(firsts.reduce((a, d) => (d < a ? d : a))) // นับตั้งแต่วันแรกที่ระบบเริ่มบันทึก
  const rows = {}
  alive.forEach(c => {
    const created = toDate(c.createdAt)
    const day = created && bangkokDate(created)
    if (!day || day < sinceDay || day.slice(0, 7) !== month) return
    const first = toDate(c.firstContactAt)
    if (!first && now - created < hours * 3600000) return // ยังไม่ครบ 24 ชม. — ยังไม่ตัดสินว่าช้า
    const key = String(c.assignedTo || '').trim() || '(ยังไม่มีผู้ดูแล)'
    const r = (rows[key] ||= { name: key, total: 0, fast: 0, slow: 0, none: 0 })
    r.total++
    if (!first) r.none++
    else if (first - created <= hours * 3600000) r.fast++
    else r.slow++
  })
  return Object.values(rows)
    .map(r => ({ ...r, rate: Math.round(r.fast / r.total * 100) }))
    .sort((a, b) => a.rate - b.rate || b.none - a.none || a.name.localeCompare(b.name, 'th'))
}
