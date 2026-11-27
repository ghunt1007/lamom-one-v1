// (v1.0.1447) รุ่นไหนคนสนใจเยอะ / ปิดได้ดี / ปิดยาก — จากลูกค้าจริงที่ระบุ "รุ่นที่สนใจ" (อายุ 30 วัน–1 ปี ให้เวลาตัดสินใจแล้ว)
// ปิดได้ = stage จอง/ส่งมอบ · รุ่นละ < 10 ราย ไม่เทียบ · รวม < 30 ราย = null ไม่เดา · ฟังก์ชันล้วน
import { toDate } from './format.js'
import { modelKey } from './orderNeeds.js'

export function modelFunnel(customers = [], now = Date.now(), { minModel = 10, minTotal = 30 } = {}) {
  const rows = []
  for (const c of customers || []) {
    if (!c || c.deleted) continue
    const t = toDate(c.createdAt)?.getTime()
    if (!t) continue
    const age = (now - t) / 86400000
    if (age < 30 || age > 365) continue
    const label = String(c.interestedModel || '').trim()
    const key = label && modelKey({ model: label, brand: c.interestedBrand || '' })
    if (!key) continue
    rows.push({ key, label, won: ['booking', 'delivered'].includes(c.stage) ? 1 : 0 })
  }
  if (rows.length < minTotal) return null
  // รุ่นที่พิมพ์ยาว ("DEEPAL S07 Long Range") รวมเข้ารุ่นสั้นที่ขึ้นต้นเหมือนกัน ("DEEPAL S07")
  const keys = [...new Set(rows.map(r => r.key))].sort((a, b) => a.length - b.length)
  const root = new Map()
  for (const k of keys) root.set(k, keys.find(s => s.length >= 3 && k !== s && k.startsWith(s) && root.get(s) === s) || k)
  const g = new Map()
  for (const r of rows) {
    const k = root.get(r.key)
    const m = g.get(k) || { key: k, label: '', n: 0, won: 0 }
    if (!m.label || r.label.length < m.label.length) m.label = r.label
    m.n++; m.won += r.won; g.set(k, m)
  }
  const won = rows.reduce((a, r) => a + r.won, 0)
  const models = [...g.values()].filter(m => m.n >= minModel).map(m => ({ ...m, rate: m.won / m.n })).sort((a, b) => b.n - a.n)
  if (!models.length) return null
  return { n: rows.length, overall: won / rows.length, models }
}

const pct = v => Math.round(v * 100) + '%'
export function modelFunnelText(r) {
  if (!r) return '🚘 ยังสรุปไม่ได้ว่ารุ่นไหนคนสนใจ/ปิดได้ดี — ต้องมีลูกค้าที่ใส่ "รุ่นที่สนใจ" อายุ 30 วัน–1 ปี ≥ 30 ราย และรุ่นละ ≥ 10 ราย'
  const lines = [`🚘 รุ่นที่ลูกค้าสนใจ & ปิดได้จริง — จาก ${r.n} ราย (ร้านเฉลี่ยปิด ${pct(r.overall)})`,
    ...r.models.slice(0, 8).map(m => `• ${m.label} สนใจ ${m.n} ราย · ปิดได้ ${pct(m.rate)}${m.rate >= r.overall + 0.1 ? ' ⭐' : m.rate <= r.overall - 0.1 ? ' ⚠️' : ''}`)]
  const hard = r.models.filter(m => m.rate <= r.overall - 0.1).sort((a, b) => b.n - a.n)[0]
  if (hard) lines.push(`💡 ${hard.label} คนสนใจ ${hard.n} รายแต่ปิดได้แค่ ${pct(hard.rate)} — ลองดูโปร/ราคา/ทดลองขับ หรือถามลูกค้าที่ไม่จองว่าติดอะไร`)
  return lines.join('\n')
}
