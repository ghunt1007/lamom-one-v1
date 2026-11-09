// 🎁 "โปรนี้ใช่ลูกค้าคนไหน" — จับคู่แคมเปญที่ลูกค้าได้ (ส่วนลด/ดอกเบี้ย/ของแถม) กับ Lead ที่สนใจรุ่นนั้น
// ให้เซลส์มีเหตุผลโทรหาลูกค้า: โปรจะหมดใน 7 วัน หรือโปรใหม่เพิ่งเริ่ม (3 วันแรก) · ฟังก์ชันล้วน เทสได้
import { programsForCar, carSummary, CUSTOMER_TYPES, daysLeft } from './salesPrograms.js'
import { toDateStr } from './format.js'

export const ENDING_DAYS = 7
export const NEW_DAYS = 3
const dayNum = s => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 864e5
const nameOf = c => [c.firstName, c.lastName].filter(Boolean).join(' ') || c.name || 'ลูกค้า'

// ข้อความสั้นๆ ของโปรที่ลูกค้าได้ (ใช้ทั้งในหน้าลูกค้า หน้างานวันนี้ และข้อความส่งลูกค้า)
export function promoLines(list) {
  const s = carSummary(list)
  const out = []
  if (s.customerCash) out.push(`ส่วนลดรวม ${s.customerCash.toLocaleString('en-US')} บาท`)
  if (s.bestRate) out.push(`ดอกเบี้ยพิเศษ ${s.bestRate.rate}% ดาวน์ ${s.bestRate.down}% ${s.bestRate.months} งวด${s.bestRate.financeCo ? ` (${s.bestRate.financeCo})` : ''}`)
  ;[...new Set(s.gifts)].forEach(g => out.push(`แถม ${g}`))
  return out
}

// โปรที่ลูกค้าได้วันนี้สำหรับรุ่นที่สนใจ (เฉพาะโปรฝั่งลูกค้า ไม่รวมมาร์จิ้น/ค่าบริหาร/รางวัลภายใน)
export function customerPrograms(programs, model, { brand = '', today }) {
  if (!model) return []
  return programsForCar(programs, { brand, model, date: today, isManager: false }).filter(p => CUSTOMER_TYPES.includes(p.type))
}

// customers → [{ c, name, model, list, lines, reason:'ending'|'new', left, endsOn }] เรียงด่วนสุดก่อน
export function campaignLeads(programs, customers, { today, mine = () => true, brandOf = () => '' } = {}) {
  const out = []
  ;(customers || []).forEach(c => {
    if (!c || c.deleted || c.isLost || c.bookingId || !['lead', 'pp'].includes(c.stage) || !c.interestedModel) return
    if (!mine(c.assignedTo, c)) return
    if (toDateStr(c.lastContactAt) === today) return // วันนี้คุยไปแล้ว ไม่ต้องขึ้นซ้ำ
    const list = customerPrograms(programs, c.interestedModel, { brand: brandOf(c.interestedModel), today })
    if (!list.length) return
    const lefts = list.map(p => daysLeft(p, today)).filter(n => n !== null && n >= 0)
    const left = lefts.length ? Math.min(...lefts) : null
    const fresh = list.some(p => p.dateFrom && dayNum(today) - dayNum(p.dateFrom) < NEW_DAYS)
    const reason = left !== null && left <= ENDING_DAYS ? 'ending' : fresh ? 'new' : ''
    if (!reason) return
    const lines = promoLines(list)
    if (!lines.length) return
    out.push({ c, name: nameOf(c), model: c.interestedModel, list, lines, reason, left })
  })
  return out.sort((a, b) => (a.reason === 'ending' ? a.left : 99) - (b.reason === 'ending' ? b.left : 99) || a.name.localeCompare(b.name, 'th'))
}

// ข้อความทักลูกค้า (แก้ได้ก่อนส่ง) — ไม่มีข้อมูลภายใน
export function campaignMessage(row) {
  const first = String(row.c.firstName || '').trim()
  const hi = first ? `สวัสดีครับคุณ${first}` : 'สวัสดีครับ'
  const when = row.reason === 'ending' ? (row.left === 0 ? 'ถึงวันนี้วันสุดท้าย' : `ถึงอีก ${row.left} วันเท่านั้น`) : 'เพิ่งเริ่มเดือนนี้'
  return [`${hi} ${row.model} ตอนนี้มีโปรพิเศษ${when}ครับ`, ...row.lines.map(x => '• ' + x), 'สนใจนัดดูรถหรือให้คำนวณค่างวดให้ ทักกลับได้เลยครับ 🙏'].join('\n')
}
