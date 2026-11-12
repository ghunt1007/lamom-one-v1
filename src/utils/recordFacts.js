import { toDateStr } from './format.js'
import { carLabel } from './carLabel.js'
// (v1.0.913) LAMI ตอบเรื่องลูกค้า/ใบจอง "รายคน" ได้ — เช่น "มานีถึงไหนแล้ว" "ใบจอง SKT2605 สถานะอะไร"
// "รถของคุณสมชายส่งมอบเมื่อไหร่" "เบอร์ 0890000027 คือใคร คุยล่าสุดเมื่อไหร่"
//
// หาเรคคอร์ดที่คำถามเอ่ยถึง (ชื่อ ชื่อเล่น เลขใบจอง หรือเบอร์โทร) จากข้อมูลที่ผู้ใช้คนนี้มีสิทธิ์เห็นเท่านั้น
// แล้วสรุปเป็นข้อความสั้นๆ ส่งให้ AI — ไม่ส่งเบอร์โทร เลขบัตร ที่อยู่ หรือ LINE ID (ใช้เบอร์แค่จับคู่ในเครื่อง)
// ฟังก์ชันล้วน ไม่แตะฐานข้อมูล
import { mentionedCustomers } from './aiActions.js'
import { bookingNextStep } from './bookingNext.js'
import { formatDate } from './format.js'

const STAGE_TH = { lead: 'Lead', pp: 'Prospect (กำลังคุย)', booking: 'จองแล้ว', delivered: 'ส่งมอบแล้ว' }
const TEMP_TH = { hot: 'ร้อน (พร้อมซื้อ)', warm: 'อุ่น', cold: 'เย็น' }
const norm = s => String(s || '').toLowerCase().replace(/\s+/g, '')
export const GENERIC_FIRST = /^(?:ลูกค้า|คุณ|นาย|นาง|นางสาว|น\.ส\.|พี่|น้อง|เซลส์|เซล|ทดสอบ|test)$/i
const digits = s => String(s || '').replace(/\D/g, '')
const DAY = 86400000
const dayNum = d => { const t = Date.parse(String(d || '').slice(0, 10) + 'T00:00:00Z'); return isNaN(t) ? null : Math.round(t / DAY) }
const ymd = v => {
  if (!v) return ''
  if (typeof v === 'string') return v.slice(0, 10)
  return toDateStr(v)
}
// วันที่แบบไทยใช้ formatDate ตัวเดียวกับทั้งแอป (ไม่เขียนสูตรซ้ำ)
export function thaiDate(d) {
  const s = ymd(d)
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? formatDate(s) : ''
}
function relDays(d, today) {
  const a = dayNum(d), b = dayNum(today)
  if (a == null || b == null) return ''
  const n = a - b
  return n === 0 ? 'วันนี้' : n > 0 ? `อีก ${n} วัน` : `${-n} วันก่อน`
}

// ใบจองที่คำถามเอ่ยถึง: เลขใบจองตรงตัว หรือชื่อลูกค้าในใบจอง
export function mentionedBookings(question, bookings = [], max = 3) {
  const q = norm(question)
  if (!q) return []
  const hits = []
  for (const b of bookings) {
    if (!b || b.deleted) continue
    const no = norm(b.bookingNo)
    const name = norm(b.custName)
    let first = norm(String(b.custName || '').trim().split(/\s+/)[0])
    // (v1.0.1093) คำทั่วไป ("ลูกค้า ทดสอบ" / "คุณ สมชาย") ไม่นับเป็นชื่อ — เดิมถาม "ลูกค้าของฉันมีกี่คน" แล้วดึงใบจองคนชื่อ "ลูกค้า ..." มาตอบ
    if (GENERIC_FIRST.test(first)) first = ''
    const score = no.length >= 4 && q.includes(no) ? 3 : name.length >= 4 && q.includes(name) ? 2 : first.length >= 3 && q.includes(first) ? 1 : 0
    if (score) hits.push({ b, score })
  }
  return hits.sort((a, b) => b.score - a.score || String(b.b.bookingDate || '').localeCompare(String(a.b.bookingDate || ''))).slice(0, max).map(h => h.b)
}

// ลูกค้าจากเบอร์โทรในคำถาม (พิมพ์ 9–10 หลัก มีขีดหรือเว้นวรรคได้)
export function customersByPhone(question, customers = []) {
  const nums = (String(question || '').match(/0[\d\s-]{8,12}\d/g) || []).map(digits).filter(n => n.length >= 9 && n.length <= 10)
  if (!nums.length) return []
  return customers.filter(c => c && !c.deleted && nums.includes(digits(c.phone)))
}

function bookingLine(b, today) {
  const parts = [`ใบจอง ${b.bookingNo || '(ไม่มีเลข)'}`]
  if (b.model) parts.push(`${carLabel(b.brand, b.model)}${b.color ? ' สี' + b.color : ''}`)
  if (b.status) parts.push(`สถานะ "${b.status}"`)
  if (b.bookingDate) parts.push(`จองเมื่อ ${thaiDate(b.bookingDate)}`)
  if (b.deliveryDate && !['ถอนจอง', 'ยกเลิก'].includes(b.status)) {
    parts.push(b.status === 'ส่งมอบแล้ว' ? `ส่งมอบแล้ว ${thaiDate(b.actualDeliveryDate || b.deliveryDate)}` : `นัดส่งมอบ ${thaiDate(b.deliveryDate)} (${relDays(b.deliveryDate, today)})`)
  }
  if (b.financeCo) parts.push(`ไฟแนนซ์ ${b.financeCo}`)
  if (b.vin) parts.push('ผูกเลขตัวถังแล้ว')
  if (b.salesName) parts.push(`เซลส์ ${b.salesName}`)
  const next = bookingNextStep(b, today)
  if (next) parts.push(`ขั้นต่อไป: ${next.text}`)
  return parts.join(' · ')
}

function customerLine(c, today, followups) {
  const name = [c.firstName, c.lastName].filter(Boolean).join(' ') || c.nickname || 'ลูกค้า'
  const parts = [name]
  if (c.stage) parts.push(c.isLost ? `เสียดีลแล้ว${c.lostReason && c.lostReason !== 'other' ? ' (' + c.lostReason + ')' : ''}` : (STAGE_TH[c.stage] || c.stage))
  if (c.interestedModel) parts.push(`สนใจ ${c.interestedModel}`)
  if (c.temperature) parts.push(`ความสนใจ ${TEMP_TH[c.temperature] || c.temperature}`)
  if (c.source) parts.push(`มาจาก ${c.source}`)
  if (c.assignedTo) parts.push(`ผู้ดูแล ${c.assignedTo}`)
  const last = [c.lastContactAt, c.updatedAt, c.stageChangedAt, c.createdAt].map(ymd).filter(Boolean).sort().pop()
  if (last) parts.push(`ติดต่อ/อัปเดตล่าสุด ${thaiDate(last)} (${relDays(last, today)})`)
  const fu = (followups || []).filter(f => f && !f.deleted && f.customerId === c.id && !['done', 'cancelled'].includes(f.status))
    .sort((a, b) => String(a.dueDate || '').localeCompare(String(b.dueDate || '')))[0]
  if (fu) parts.push(`นัดติดตามถัดไป ${thaiDate(fu.dueDate)} (${relDays(fu.dueDate, today)})${fu.type ? ' ' + fu.type : ''}`)
  if (c.notes) parts.push(`โน้ต: ${String(c.notes).replace(/\s+/g, ' ').slice(0, 120)}`)
  return parts.join(' · ')
}

// คำถามต่อจากเรื่องเดิม: สั้น หรือมีคำชี้กลับ (เขา/คนนี้/แล้ว…ล่ะ) — ใช้ตัดสินว่าจะเอาคำถามก่อนหน้ามาช่วยหาคนไหม
export function isFollowUpQuestion(q) {
  const t = String(q || '').trim()
  if (!t) return false
  return /^(แล้ว|และ|ส่วน)|เขา|เธอ|คนนี้|คนนั้น|ลูกค้าคนนี้|รายนี้|ใบนี้|คันนี้|ล่ะ|ละ\s*$|ด้วยไหม/.test(t) || t.length <= 12
}

/**
 * คืน { 'ข้อมูลลูกค้า/ใบจองที่ถามถึง': '...' } หรือ {} ถ้าคำถามไม่ได้เอ่ยถึงใคร
 * customers/bookings ต้องกรองตามสิทธิ์มาแล้ว (เห็นเฉพาะทีมตัวเอง)
 */
export function recordFacts(question, { customers = [], bookings = [], followups = [] } = {}, today) {
  // เอ่ยชื่อ-นามสกุลเต็ม → เอาเฉพาะคนที่ชื่อเต็มตรง (ไม่ดึงคนชื่อต้นซ้ำมาปน)
  const q = norm(question)
  let named = mentionedCustomers(question, customers, 3)
  const full = named.filter(c => { const f = norm([c.firstName, c.lastName].filter(Boolean).join('')); return f.length >= 4 && c.lastName && q.includes(f) })
  if (full.length) named = full
  const cs = [...customersByPhone(question, customers), ...named]
  const uniq = [...new Map(cs.map(c => [c.id, c])).values()].slice(0, 3)
  const bks = mentionedBookings(question, bookings, 3)
  // ใบจองของลูกค้าที่ถูกเอ่ยชื่อ (จับจาก customerId) ด้วย
  for (const c of uniq) for (const b of bookings) if (b && !b.deleted && b.customerId && b.customerId === c.id && !bks.includes(b) && bks.length < 4) bks.push(b)
  const lines = []
  for (const c of uniq) lines.push('👤 ' + customerLine(c, today, followups))
  for (const b of bks) lines.push('📝 ' + (b.custName ? String(b.custName).trim() + ' — ' : '') + bookingLine(b, today))
  if (!lines.length) return {}
  return { 'ข้อมูลลูกค้า/ใบจองที่ถามถึง (จากระบบ ตอบตามนี้ ห้ามเดา)': lines.join('\n') }
}
