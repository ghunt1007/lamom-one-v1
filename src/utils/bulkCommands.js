// (v1.0.1039) สั่งทีละหลายคน: "นัดโทรลูกค้า hot ทุกคนพรุ่งนี้ 10 โมง" / "นัดลีดที่เงียบเกิน 7 วันทั้งหมด พรุ่งนี้"
// เลือกจากลูกค้าที่ผู้ใช้เห็นเท่านั้น · ข้ามคนที่มีนัดค้างอยู่แล้ว (ไม่สร้างนัดซ้ำ) · ข้ามลูกค้าเสียดีล/ส่งมอบแล้ว
// คืนคำสั่ง kind 'fu' ทีละคน → การ์ดมีปุ่ม "✅ ทำทั้งหมด" กดครั้งเดียวจบ
import { WHEN, timeIn, thaiNumerals } from './lamiCommands.js'
import { suggestNextDue } from './nextFollowup.js'
import { dmy } from './format.js'

export const BULK_MAX = 30
const DAY = 86400e3
const dayNum = d => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / DAY
const bkkDate = v => {
  const t = v?.toDate ? v.toDate() : v ? new Date(v) : null
  return t && !isNaN(t) ? new Date(t.getTime() + 7 * 3600e3).toISOString().slice(0, 10) : ''
}
const fullName = c => [c.firstName, c.lastName].filter(Boolean).join(' ') || c.nickname || 'ลูกค้า'

// อ่านประโยค → เงื่อนไขกลุ่ม (null = ไม่ใช่คำสั่งกลุ่ม)
export function parseBulkSpec(q, today) {
  const s = thaiNumerals(String(q || '').trim())
  if (!s || s.length > 200 || /[?？]$|ไหม$|มั้ย$|ยังไง|เท่าไร|กี่คน/.test(s)) return null
  if (!/ทุกคน|ทั้งหมด|ทุกราย/.test(s)) return null
  if (!/^(?:ช่วย\s*)?(?:นัด|ตาม|โทร|ทัก|ติดต่อ)/.test(s)) return null
  if (!/ลูกค้า|ลีด|lead|prospect/i.test(s)) return null
  const rest = s.replace(/ทุกคน|ทั้งหมด|ทุกราย/g, ' ')
  if (!WHEN.test(rest.replace(/เกิน\s*\d+\s*วัน|\d+\s*วันแล้ว/g, ''))) return null
  const temp = /hot|ร้อน|🔥/i.test(s) ? 'hot' : /warm|อุ่น/i.test(s) ? 'warm' : /\bcold\b/i.test(s) ? 'cold' : null
  const q2 = s.match(/(?:เงียบ|ไม่ได้(?:ติดต่อ|คุย|โทร))\s*(?:เกิน|มา|นาน)?\s*(\d{1,3})\s*วัน/)
  const quietDays = q2 ? +q2[1] : null
  const newToday = /(?:ลีด|lead|ลูกค้า)\s*ใหม่\s*(?:วันนี้)?/i.test(s)
  const leadsOnly = /ลีด|lead/i.test(s) && !/prospect/i.test(s)
  const due = suggestNextDue(rest.replace(/(?:เงียบ|ไม่ได้(?:ติดต่อ|คุย|โทร))\s*(?:เกิน|มา|นาน)?\s*\d{1,3}\s*วัน/g, '').replace(/(?:ลีด|lead|ลูกค้า)\s*ใหม่\s*วันนี้/gi, ''), today)
  if (!due?.dueDate || due.skip) return null
  const type = /ไลน์|line/i.test(s) ? 'line' : 'call'
  return { temp, quietDays, newToday, leadsOnly, dueDate: due.dueDate, time: timeIn(s), type, text: s }
}

export function bulkLabel(spec) {
  const who = [spec.newToday ? 'ลีดใหม่วันนี้' : spec.leadsOnly ? 'ลีด' : 'ลูกค้า', spec.temp ? spec.temp.toUpperCase() : '', spec.quietDays ? `ที่เงียบ ≥ ${spec.quietDays} วัน` : ''].filter(Boolean).join(' ')
  return `${who} · นัด${spec.type === 'line' ? 'ทักไลน์' : 'โทร'} ${dmy(spec.dueDate)}${spec.time ? ' ' + spec.time + ' น.' : ''}`
}

// เลือกลูกค้าตามเงื่อนไข (ฟังก์ชันล้วน ทดสอบได้)
export function bulkTargets({ customers = [], followups = [], today, spec }) {
  if (!spec) return { list: [], skipped: 0, more: 0 }
  const pending = new Set(followups.filter(f => f && !f.deleted && f.status === 'pending').map(f => f.customerId))
  const t = dayNum(today)
  let skipped = 0
  const hit = customers.filter(c => {
    if (!c || c.deleted || c.isLost || c.stage === 'delivered' || c.bookingId) return false
    if (spec.leadsOnly ? c.stage !== 'lead' : !['lead', 'pp'].includes(c.stage)) return false
    if (spec.temp && c.temperature !== spec.temp) return false
    if (spec.newToday && bkkDate(c.createdAt) !== today) return false
    if (spec.quietDays) {
      const last = bkkDate(c.lastContactAt) || bkkDate(c.createdAt)
      if (last && t - dayNum(last) < spec.quietDays) return false
    }
    if (pending.has(c.id)) { skipped++; return false }
    return true
  })
  return { list: hit.slice(0, BULK_MAX), skipped, more: Math.max(0, hit.length - BULK_MAX) }
}

export function bulkCommands(list, spec) {
  return list.map(c => ({
    kind: 'fu', customer: c, dueDate: spec.dueDate, time: spec.time, type: spec.type, note: spec.text.slice(0, 120),
    label: `📅 ${fullName(c)}`, desc: `${c.temperature ? c.temperature.toUpperCase() + ' · ' : ''}${c.interestedModel ? '🚗 ' + c.interestedModel + ' · ' : ''}นัด ${dmy(spec.dueDate)}${spec.time ? ' ' + spec.time + ' น.' : ''}`,
  }))
}

export function bulkIntro(spec, { list, skipped, more }) {
  if (!list.length) return `ไม่มี${bulkLabel(spec).split(' · ')[0]} ที่ต้องนัดเพิ่ม${skipped ? ` (มีนัดค้างอยู่แล้ว ${skipped} คน)` : ''}`
  return `📅 ${bulkLabel(spec)} — ${list.length} คน${skipped ? ` · ข้าม ${skipped} คนที่มีนัดค้างอยู่แล้ว` : ''}${more ? ` · แสดง ${BULK_MAX} คนแรก (เหลืออีก ${more})` : ''} กด ✅ ทำทั้งหมด ครั้งเดียวจบ หรือกดทีละคน`
}
