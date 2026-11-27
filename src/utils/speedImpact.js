// (v1.0.1446) โทรลีดเร็ว ช่วยปิดการขายจริงไหม — เทียบ % ปิดจอง/ส่งมอบ ของลีดที่ติดต่อครั้งแรกภายใน 1 ชม. กับช้ากว่า 24 ชม./ไม่ได้ติดต่อ
// นับลีดอายุ 30 วัน–1 ปี ที่สร้างหลังระบบเริ่มบันทึก firstContactAt · ไม่นับ walk-in/หน้าร้าน (เจอตัวก่อนบันทึก เวลาโทรไม่มีความหมาย)
// ตัวอย่างไม่พอ (รวม < 30 หรือกลุ่มเร็ว/ช้า < 10) = null ไม่เดา · ฟังก์ชันล้วน
import { toDate } from './format.js'

const WALKIN = /walk|หน้าร้าน|โชว์รูม|showroom|เดินเข้า/i
const H = 3600000

export function speedImpact(customers = [], now = Date.now(), { minTotal = 30, minGroup = 10 } = {}) {
  const alive = (customers || []).filter(c => c && !c.deleted)
  const firsts = alive.map(c => toDate(c.firstContactAt)?.getTime()).filter(Boolean)
  if (!firsts.length) return null
  const since = Math.min(...firsts)
  const g = { fast: { n: 0, won: 0 }, mid: { n: 0, won: 0 }, slow: { n: 0, won: 0 } }
  for (const c of alive) {
    const t = toDate(c.createdAt)?.getTime()
    if (!t || t < since) continue
    const age = (now - t) / 86400000
    if (age < 30 || age > 365) continue
    if (WALKIN.test(String(c.source || ''))) continue
    const f = toDate(c.firstContactAt)?.getTime()
    const gap = f ? f - t : Infinity
    const k = gap <= H ? 'fast' : gap <= 24 * H ? 'mid' : 'slow'
    g[k].n++
    if (['booking', 'delivered'].includes(c.stage)) g[k].won++
  }
  const n = g.fast.n + g.mid.n + g.slow.n
  if (n < minTotal || g.fast.n < minGroup || g.slow.n < minGroup) return null
  for (const k of Object.keys(g)) g[k].rate = g[k].n ? g[k].won / g[k].n : null
  return { n, ...g }
}

const pct = v => Math.round(v * 100) + '%'
export function speedImpactText(r) {
  if (!r) return '⚡ ยังบอกไม่ได้ว่าโทรเร็วช่วยปิดการขายแค่ไหน — ต้องมีลีด (ไม่นับ walk-in) อายุ 30 วัน–1 ปี ≥ 30 ราย ที่โทรภายใน 1 ชม. ≥ 10 ราย และช้ากว่า 24 ชม. ≥ 10 ราย (ระบบนับเวลาจากการกดโทร/บันทึกการติดต่อครั้งแรก)'
  const lines = [`⚡ โทรลีดเร็ว ช่วยปิดการขายแค่ไหน — จาก ${r.n} ลีด (ไม่นับ walk-in)`,
    `• โทรภายใน 1 ชม. ปิดได้ ${pct(r.fast.rate)} (${r.fast.won}/${r.fast.n})`]
  if (r.mid.n) lines.push(`• 1–24 ชม. ปิดได้ ${pct(r.mid.rate)} (${r.mid.won}/${r.mid.n})`)
  lines.push(`• ช้ากว่า 24 ชม./ไม่ได้โทร ปิดได้ ${pct(r.slow.rate)} (${r.slow.won}/${r.slow.n})`)
  if (r.fast.rate > r.slow.rate && r.slow.rate > 0) lines.push(`💡 โทรภายใน 1 ชม. ปิดได้มากกว่า ${(r.fast.rate / r.slow.rate).toFixed(1)} เท่า — ลีดใหม่เข้ามาให้โทรทันที`)
  else if (r.fast.rate > r.slow.rate) lines.push('💡 ลีดที่โทรภายใน 1 ชม. ปิดได้ดีกว่าชัดเจน — ลีดใหม่เข้ามาให้โทรทันที')
  else lines.push('💡 ร้านนี้ความเร็วยังไม่ต่างกันมาก — เน้นคุณภาพการคุยและการตามต่อ')
  return lines.join('\n')
}
