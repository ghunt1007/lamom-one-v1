// (v1.0.1437) โทรช่วงไหนลูกค้ารับสายมากสุด — จากผลการโทรจริงที่บันทึกผ่านปุ่ม 📞 (90 วันล่าสุด) · ฟังก์ชันล้วน
// นับเฉพาะบันทึกที่ระบบถามผลให้ (ขึ้นต้นด้วย "คุยแล้ว/ขอคิด/ไม่สนใจ" = รับสาย, "ไม่รับสาย" = ไม่รับ) — ข้อความพิมพ์เองไม่นับ
// ข้อมูลไม่พอ (รวม < 40 สาย หรือช่วงเวลาที่มี ≥ 8 สาย น้อยกว่า 2 ช่วง) = null ไม่เดา
import { toDate } from './format.js'

export const CALL_BLOCKS = [[8, 10], [10, 12], [12, 14], [14, 16], [16, 18], [18, 20], [20, 22]]
const ANSWERED = /^(?:คุยแล้ว|ขอคิด|ไม่สนใจ)/
const NO_ANSWER = /^ไม่รับสาย/
const bkkHour = d => Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', hour: '2-digit', hourCycle: 'h23' }).format(d))

export function bestCallTimes(logs = [], { now = Date.now(), days = 90, minTotal = 40, minBlock = 8 } = {}) {
  const from = now - days * 86400000
  const blocks = CALL_BLOCKS.map(([a, b]) => ({ from: a, to: b, n: 0, answered: 0 }))
  let total = 0
  for (const l of logs || []) {
    if (!l || l.deleted || l.type !== 'call') continue
    const note = String(l.note || '').trim()
    const ok = ANSWERED.test(note), no = NO_ANSWER.test(note)
    if (!ok && !no) continue
    const d = toDate(l.createdAt)
    if (!d || d.getTime() < from || d.getTime() > now) continue
    const h = bkkHour(d)
    const blk = blocks.find(x => h >= x.from && h < x.to)
    if (!blk) continue
    blk.n++; total++
    if (ok) blk.answered++
  }
  const usable = blocks.filter(x => x.n >= minBlock).map(x => ({ ...x, rate: x.answered / x.n }))
  if (total < minTotal || usable.length < 2) return null
  const ranked = [...usable].sort((a, b) => b.rate - a.rate || b.n - a.n)
  return { total, blocks: usable, best: ranked[0], worst: ranked[ranked.length - 1] }
}

const hh = h => String(h).padStart(2, '0') + ':00'
const pct = v => Math.round(v * 100) + '%'
export const blockLabel = b => `${hh(b.from)}–${hh(b.to)} น.`

export function callTimeLine(r) {
  if (!r) return ''
  const gap = r.best.rate - r.worst.rate >= 0.1
  return `⏰ ช่วงที่ลูกค้ารับสายมากสุด ${blockLabel(r.best)} (รับ ${pct(r.best.rate)})${gap ? ` · น้อยสุด ${blockLabel(r.worst)} (${pct(r.worst.rate)})` : ''}`
}

export function callTimeAnswer(logs, opts = {}) {
  const r = bestCallTimes(logs, opts)
  if (!r) return { n: 0, text: '⏰ ยังบอกไม่ได้ว่าช่วงไหนลูกค้ารับสายมากสุด — ต้องมีผลการโทรที่บันทึกผ่านปุ่ม 📞 อย่างน้อย 40 สายใน 90 วัน (กดโทรจากแอป วางสายแล้วเลือกผล ระบบจะนับให้เอง)' }
  return { n: Math.round(r.best.rate * 100), text: [`⏰ โทรช่วงไหนลูกค้ารับสาย — จาก ${r.total} สายใน 90 วันล่าสุด`,
    ...[...r.blocks].sort((a, b) => a.from - b.from).map(b => `• ${blockLabel(b)} รับ ${pct(b.rate)} (${b.answered}/${b.n})${b === r.best ? ' ⭐' : ''}`),
    `💡 นัดโทรลูกค้าสำคัญช่วง ${blockLabel(r.best)} จะติดง่ายสุด`].join('\n') }
}
