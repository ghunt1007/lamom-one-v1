// คะแนนโอกาสปิดการขายเบื้องต้น (0-100) จากข้อมูลจริงในระบบ ไม่เรียก AI — ใช้ร่วมกันทุกหน้า (Lead Scoring, LAMI, Lead Generation)
// เดิมดูแค่ช่อง c.status (vip/hot/...) ซึ่งเอกสารลูกค้าไม่มี (ใช้ c.temperature) ทุกคนจึงได้ 45 และ "Hot Lead" นับได้ 0 เสมอ
import { toDate } from './format.js'

const STATUS_BASE = { vip: 90, hot: 85, warm: 60, cold: 35, lost: 5 }
const TEMP_BASE = { hot: 85, warm: 60, cold: 35 }

export function heuristicScore(c, now = Date.now()) {
  const signals = []
  if (c.isLost) return { score: 5, signals: [`เสียดีลแล้ว${c.lostReason ? `: ${c.lostReason}` : ''}`] }
  let score = STATUS_BASE[c.status] ?? TEMP_BASE[c.temperature] ?? 45
  if (c.status === 'vip') signals.push('ลูกค้า VIP')
  if (c.status === 'hot' || c.temperature === 'hot') signals.push('จัดระดับความสนใจสูง (Hot)')
  else if (c.temperature === 'warm') signals.push('ความสนใจปานกลาง (Warm)')
  if (c.stage === 'pp') { score += 5; signals.push('คุยแล้ว มีช่องทางติดต่อ (Prospect)') }
  if (c.interestedModel) { score += 5; signals.push(`ระบุรถที่สนใจ: ${c.interestedModel}`) }
  if (c.budget) { score += 5; signals.push(`ระบุงบประมาณ: ${Number(c.budget).toLocaleString('en-US')} บาท`) }
  if (c.source) signals.push(`ที่มา: ${c.source}`)
  // อาชีพ/รายได้ครบ + รายได้เพียงพอเทียบงบ = มีโอกาสได้ไฟแนนซ์จริง ไม่ใช่แค่ "อยากซื้อ"
  if (c.occupation && c.monthlyIncome) {
    score += 5
    signals.push('มีข้อมูลอาชีพ/รายได้ครบ — ประเมินไฟแนนซ์ได้ทันที')
    if (!c.budget || c.monthlyIncome * 36 >= c.budget * 0.5) {
      score += 5
      signals.push('รายได้น่าจะเพียงพอสำหรับงบที่ตั้งใจซื้อ')
    }
  }
  // ความสดของการติดต่อ — ยิ่งเงียบนาน โอกาสยิ่งลด
  const last = toDate(c.lastContactAt)
  if (last) {
    const days = Math.floor((now - last.getTime()) / 86400000)
    if (days <= 3) { score += 5; signals.push('เพิ่งติดต่อล่าสุดไม่เกิน 3 วัน') }
    else if (days > 21) { score -= 10; signals.push(`ไม่ได้ติดต่อมา ${days} วัน`) }
  }
  return { score: Math.min(100, Math.max(5, score)), signals }
}
