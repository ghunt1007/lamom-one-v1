// (v1.0.1048) ถามถึงลูกค้าคนเดียว: "สมชายถึงไหนแล้ว" / "สรุปมานี" / "สถานะปิติ" → LAMI สรุปจากข้อมูลจริงทันที
// (ขั้น ความสนใจ ติดต่อล่าสุด นัดถัดไป ใบจอง + คำแนะนำสั้นๆ) พร้อมปุ่มทำต่อในแตะเดียว · ฟังก์ชันล้วน ทดสอบได้
import { mentionedCustomers } from './aiActions.js'
import { pendingFollowupsFor } from './customerFollowups.js'
import { thaiNumerals, WHEN } from './lamiCommands.js'
import { dmy } from './format.js'
import { carOf } from './carLabel.js'

const DAY = 86400e3
const dayNum = d => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / DAY
const bkkDate = v => {
  const t = v?.toDate ? v.toDate() : v ? new Date(v) : null
  return t && !isNaN(t) ? new Date(t.getTime() + 7 * 3600e3).toISOString().slice(0, 10) : ''
}
const isDate = d => /^\d{4}-\d{2}-\d{2}/.test(d || '')
const STAGE = { lead: '🧲 Lead', pp: '📇 Prospect', booked: '📝 จองแล้ว', delivered: '✅ ส่งมอบแล้ว' }
const TEMP = { hot: '🔥 HOT', warm: '🟡 WARM', cold: '🔵 COLD' }
const ASK = /ถึงไหน|เป็นยังไง|เป็นอย่างไร|เป็นไง|สรุป|ข้อมูล|สถานะ|ล่าสุด|ประวัติ|คืบหน้า|ว่าไง|ยังไงบ้าง/

// คืนลูกค้าที่ถูกถามถึง (null = ไม่ใช่คำถามแบบนี้)
export function briefTarget(q, customers = []) {
  const s = thaiNumerals(String(q || '').trim()).replace(/[?？]+$/, '').trim()
  if (!s || s.length > 80 || !ASK.test(s)) return null
  if (WHEN.test(s) || /ทุกคน|ทั้งหมด|ยอด|เป้า|ทีม|ควร|ทำไม|เพราะ|พูด|ปิดการขาย|แนะนำ/.test(s)) return null
  return mentionedCustomers(s, customers, 1)[0] || null
}

export function customerBrief({ customer: c, followups = [], booking = null, today }) {
  const name = [c.firstName, c.lastName].filter(Boolean).join(' ') || c.nickname || 'ลูกค้า'
  const t = dayNum(today)
  const lines = [`👤 ${name} — ${[c.isLost ? '⬛ เสียดีล' : STAGE[c.stage] || c.stage || '', TEMP[c.temperature] || '', c.interestedModel ? '🚗 ' + c.interestedModel : ''].filter(Boolean).join(' · ')}`]
  const last = bkkDate(c.lastContactAt)
  const quiet = last ? t - dayNum(last) : null
  lines.push(last ? `📞 ติดต่อล่าสุด ${dmy(last)} (${quiet <= 0 ? 'วันนี้' : quiet + ' วันก่อน'})` : '📞 ยังไม่เคยบันทึกการติดต่อ')
  const pend = pendingFollowupsFor(followups, c.id, today)
  const next = pend[0]
  if (next) lines.push(`📅 นัดถัดไป ${dmy(next.dueDate.slice(0, 10))}${next.time ? ' ' + next.time : ''}${next.purpose ? ' — ' + next.purpose : ''}${next.late > 0 ? ` (เลยมา ${next.late} วัน)` : next.late === 0 ? ' (วันนี้)' : ''}${pend.length > 1 ? ` · อีก ${pend.length - 1} นัด` : ''}`)
  else if (!c.isLost && ['lead', 'pp'].includes(c.stage)) lines.push('⚠️ ยังไม่มีนัดติดตาม')
  let tip = ''
  if (booking) {
    const age = isDate(booking.bookingDate) ? t - dayNum(String(booking.bookingDate).slice(0, 10)) : 0
    const dd = isDate(booking.deliveryDate) ? String(booking.deliveryDate).slice(0, 10) : ''
    lines.push(`📝 ใบจอง${booking.bookingNo ? ' ' + booking.bookingNo : ''}: ${[booking.status, carOf(booking), age > 0 ? `จองมา ${age} วัน` : '', dd ? `ส่งมอบ ${dmy(dd)}${booking.deliveryTime ? ' ' + booking.deliveryTime : ''}` : ''].filter(Boolean).join(' · ')}`)
    if (['รอส่งมอบ', 'ตัดตัวเลขรอส่งมอบ'].includes(booking.status) && !dd) tip = 'รถพร้อมส่งแล้วแต่ยังไม่ได้นัดวันส่งมอบ — โทรนัดวันได้เลย'
    else if (booking.status === 'รอผลไฟแนนซ์' && age >= 7) tip = `รอผลไฟแนนซ์มา ${age} วันแล้ว — ตามผลกับไฟแนนซ์`
  }
  if (!tip && !c.isLost && ['lead', 'pp'].includes(c.stage)) {
    if (next?.late > 0) tip = `นัดเลยกำหนดมา ${next.late} วัน — โทรวันนี้เลย`
    else if (!next && quiet !== null && quiet >= 7) tip = `เงียบมา ${quiet} วันและไม่มีนัด — โทรแล้วนัดครั้งถัดไปไว้`
    else if (!next) tip = 'นัดติดตามครั้งถัดไปไว้ จะได้ไม่หลุด'
    else if (c.temperature === 'hot') tip = 'ลูกค้า HOT — ชวนลองขับหรือเสนอเงื่อนไขปิดการขาย'
  }
  if (tip) lines.push('💡 ' + tip)
  return lines.join('\n')
}

// ปุ่มหลักใต้สรุป: โทร (ถ้ามีเบอร์) + เปิดหน้าลูกค้า
export function briefCommands(c) {
  const name = [c.firstName, c.lastName].filter(Boolean).join(' ') || 'ลูกค้า'
  const phone = String(c.phone || '').replace(/[^\d+]/g, '')
  return [
    ...(phone.length >= 9 ? [{ kind: 'tel', customer: c, phone, label: `📞 โทร ${name}`, desc: c.phone }] : []),
    { kind: 'open', customer: c, label: `👤 เปิดหน้า ${name}`, desc: 'ดูประวัติและแก้ข้อมูล' },
  ]
}
