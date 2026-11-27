// คะแนนโอกาสปิดการขายเบื้องต้น (0-100) จากข้อมูลจริงในระบบ ไม่เรียก AI — ใช้ร่วมกันทุกหน้า (Lead Scoring, LAMI, Lead Generation)
// เดิมดูแค่ช่อง c.status (vip/hot/...) ซึ่งเอกสารลูกค้าไม่มี (ใช้ c.temperature) ทุกคนจึงได้ 45 และ "Hot Lead" นับได้ 0 เสมอ
import { toDate } from './format.js'

const STATUS_BASE = { vip: 90, hot: 85, warm: 60, cold: 35, lost: 5 }
const TEMP_BASE = { hot: 85, warm: 60, cold: 35 }

export function heuristicScore(c, now = Date.now(), { conv = null } = {}) {
  const signals = []
  if (c.isLost) return { score: 5, signals: [`เสียดีลแล้ว${c.lostReason ? `: ${c.lostReason}` : ''}`] }
  let score = STATUS_BASE[c.status] ?? TEMP_BASE[c.temperature] ?? 45
  if (c.status === 'vip') signals.push('ลูกค้า VIP')
  if (c.status === 'hot' || c.temperature === 'hot') signals.push('จัดระดับความสนใจสูง (Hot)')
  else if (c.temperature === 'warm') signals.push('ความสนใจปานกลาง (Warm)')
  if (c.stage === 'pp') { score += 5; signals.push('คุยแล้ว มีช่องทางติดต่อ (Prospect)') }
  if (c.interestedModel) { score += 5; signals.push(`ระบุรถที่สนใจ: ${c.interestedModel}`) }
  if (c.budget) { score += 5; signals.push(`ระบุงบประมาณ: ${Number(c.budget).toLocaleString('en-US')} บาท`) }
  const sa = conv ? sourceAdjust(c, conv) : null
  if (sa) { score += sa.adj; signals.push(sa.text) } else if (c.source) signals.push(`ที่มา: ${c.source}`)
  // อาชีพ/รายได้ครบ + รายได้เพียงพอเทียบงบ = มีโอกาสได้ไฟแนนซ์จริง ไม่ใช่แค่ "อยากซื้อ"
  if (c.occupation && c.monthlyIncome) {
    score += 5
    signals.push('มีข้อมูลอาชีพ/รายได้ครบ — ประเมินไฟแนนซ์ได้ทันที')
    if (!c.budget || c.monthlyIncome * 36 >= c.budget * 0.5) {
      score += 5
      signals.push('รายได้น่าจะเพียงพอสำหรับงบที่ตั้งใจซื้อ')
    }
  }
  // ความสดของการติดต่อ — ยิ่งเงียบนาน โอกาสยิ่งลด (ลดเป็นขั้น: >21 วัน −10, >45 วัน −25, >90 วัน −40)
  // เดิมลดแค่ 10 คะแนนไม่ว่าจะเงียบนานแค่ไหน และไม่ลดเลยถ้าไม่เคยบันทึกการติดต่อ — Lead "Hot" ที่เงียบมา 3 เดือน
  // จึงยังได้ 95% และดันยอด "คาดว่าปิดได้" ให้สูงเกินจริง · ใช้วันล่าสุดชุดเดียวกับป้าย 💤 (ติดต่อ/แก้ไข/เปลี่ยนขั้น/สร้าง)
  const contact = toDate(c.lastContactAt)
  if (contact && Math.floor((now - contact.getTime()) / 86400000) <= 3) { score += 5; signals.push('เพิ่งติดต่อล่าสุดไม่เกิน 3 วัน') }
  const lastMs = [c.lastContactAt, c.updatedAt, c.stageChangedAt, c.createdAt].map(v => toDate(v)?.getTime()).filter(Boolean).sort((x, y) => y - x)[0]
  if (lastMs) {
    const days = Math.floor((now - lastMs) / 86400000)
    const cut = days > 90 ? 40 : days > 45 ? 25 : days > 21 ? 10 : 0
    if (cut) { score -= cut; signals.push(`ไม่มีความเคลื่อนไหวมา ${days} วัน`) }
  }
  return { score: Math.min(100, Math.max(5, score)), signals }
}

// (v1.0.1417) เรียนรู้จากประวัติจริง: ลีดจากแต่ละช่องทาง (c.source) ปิดเป็นใบจองได้จริงกี่ %
// นับเฉพาะลูกค้าที่เข้ามา 30–365 วันก่อน (มีเวลาพอจะตัดสินใจแล้ว) · จองแล้ว/ส่งมอบแล้ว = ปิดได้
// ช่องทางละอย่างน้อย 15 ราย และรวมอย่างน้อย 30 ราย ไม่งั้นคืน null (ไม่ปรับคะแนน — ไม่เดา)
export const normSource = s => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
export function sourceConversion(customers = [], now = Date.now(), { minPerSource = 15, minTotal = 30 } = {}) {
  const rows = new Map(); let n = 0, won = 0
  for (const c of customers || []) {
    if (!c || c.deleted) continue
    const t = toDate(c.createdAt)?.getTime()
    if (!t) continue
    const age = (now - t) / 86400000
    if (age < 30 || age > 365) continue
    const w = ['booking', 'delivered'].includes(c.stage) ? 1 : 0
    n++; won += w
    const k = normSource(c.source)
    if (!k) continue
    const r = rows.get(k) || { label: String(c.source).trim(), n: 0, won: 0 }
    r.n++; r.won += w; rows.set(k, r)
  }
  if (n < minTotal) return null
  const bySource = new Map([...rows].filter(([, r]) => r.n >= minPerSource).map(([k, r]) => [k, { ...r, rate: r.won / r.n }]))
  return bySource.size ? { overall: won / n, n, bySource } : null
}
// คะแนนปรับตามช่องทาง: ห่างจากค่าเฉลี่ยร้าน ±1 จุด % → ±0.5 คะแนน สูงสุด ±10
export function sourceAdjust(c, conv) {
  const r = conv?.bySource?.get(normSource(c?.source))
  if (!r) return null
  const adj = Math.max(-10, Math.min(10, Math.round((r.rate - conv.overall) * 50)))
  return { adj, text: `ลีดจาก "${r.label}" ปิดได้จริง ${Math.round(r.rate * 100)}% (ร้านเฉลี่ย ${Math.round(conv.overall * 100)}% · จาก ${r.n} ราย)` }
}
