// (v1.0.1045) ถามหารายชื่อ: "ลูกค้า hot มีใครบ้าง" / "ใครเงียบเกิน 7 วัน" / "ใครยังไม่มีนัด" / "ลูกค้าสนใจ S05 มีใครบ้าง"
// → LAMI ตอบเป็นรายชื่อจริงพร้อมปุ่มโทร/เปิดทันที (ไม่ต้องรอ AI และ AI ล่มก็ยังตอบได้)
// เลือกจากลูกค้าที่ผู้ใช้เห็นเท่านั้น · ฟังก์ชันล้วน ทดสอบได้
import { thaiNumerals } from './lamiCommands.js'

export const LIST_MAX = 10
const DAY = 86400e3
const dayNum = d => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / DAY
const bkkDate = v => {
  const t = v?.toDate ? v.toDate() : v ? new Date(v) : null
  return t && !isNaN(t) ? new Date(t.getTime() + 7 * 3600e3).toISOString().slice(0, 10) : ''
}
const fullName = c => [c.firstName, c.lastName].filter(Boolean).join(' ') || c.nickname || 'ลูกค้า'
// (v1.0.1091) "ลูกค้า hot ที่ไม่ได้ติดต่อเกิน 7 วัน" (ขึ้นต้นด้วยลูกค้า/ลีด ไม่มีคำถาม) ก็นับเป็นคำถามหารายชื่อ
const ASK = /ใครบ้าง|มีใคร|คนไหน|กี่คน|กี่ราย|รายชื่อ|ขอดู|^ใคร|ลูกค้า\s*ใคร|ลีด\s*ใคร|^(?:ลูกค้า|ลีด|lead)/i

// อ่านคำถาม → เงื่อนไข (null = ไม่ใช่คำถามหารายชื่อ)
export function parseListSpec(q) {
  const s = thaiNumerals(String(q || '').trim()).replace(/[?？]+$/, '').trim()
  if (!s || s.length > 120 || !ASK.test(s)) return null
  if (/(?:ควร|ต้อง)\s*(?:โทร|ตาม|ติดต่อ)|ทุกคน|ทั้งหมด|ยอด|เป้า|เซลส์|พนักงาน|ทีม|ที่สุด|ยังไง|อย่างไร|ทำไม|เพราะ/.test(s)) return null
  const temp = /hot|ร้อน|🔥/i.test(s) ? 'hot' : /warm|อุ่น/i.test(s) ? 'warm' : /\bcold\b|เย็น/i.test(s) ? 'cold' : null
  const qm = s.match(/(?:เงียบ|ไม่ได้(?:ติดต่อ|คุย|โทร|ติดตาม|ตาม)|หาย)\s*(?:ไป)?\s*(?:เกิน|มา|นาน)?\s*(\d{1,3})?\s*(?:วัน)?/)
  const quietDays = qm ? (+qm[1] || 7) : null
  const newToday = /(?:ลีด|lead|ลูกค้า)\s*ใหม่/i.test(s)
  const noFu = /(?:ยัง)?ไม่(?:มี|ได้)\s*นัด/.test(s)
  const mm = s.match(/สนใจ\s*(?:รุ่น)?\s*([A-Za-z0-9ก-๙][A-Za-z0-9ก-๙ .\-]{1,24}?)\s*(?=มีใคร|ใครบ้าง|คนไหน|กี่คน|กี่ราย|มี|บ้าง|$)/)
  const model = mm ? mm[1].trim().toLowerCase() : null
  const leadsOnly = /ลีด|lead/i.test(s) && !/prospect/i.test(s)
  if (!temp && !quietDays && !newToday && !noFu && !model) return null
  return { temp, quietDays, newToday, noFu, model, leadsOnly, countOnly: /กี่คน|กี่ราย/.test(s) }
}

export function listLabel(spec) {
  return [spec.newToday ? 'ลีดใหม่วันนี้' : spec.leadsOnly ? 'ลีด' : 'ลูกค้า', spec.temp ? spec.temp.toUpperCase() : '',
    spec.model ? `สนใจ ${spec.model.toUpperCase()}` : '', spec.quietDays ? `เงียบ ≥ ${spec.quietDays} วัน` : '', spec.noFu ? 'ยังไม่มีนัด' : ''].filter(Boolean).join(' ')
}

export function listTargets({ customers = [], followups = [], today, spec }) {
  if (!spec) return { list: [], total: 0 }
  const pending = new Set(followups.filter(f => f && !f.deleted && f.status === 'pending').map(f => f.customerId))
  const t = dayNum(today)
  const quiet = c => { const last = bkkDate(c.lastContactAt) || bkkDate(c.createdAt); return last ? t - dayNum(last) : 0 }
  const hit = customers.filter(c => {
    if (!c || c.deleted || c.isLost || c.stage === 'delivered' || c.bookingId) return false
    if (spec.leadsOnly ? c.stage !== 'lead' : !['lead', 'pp'].includes(c.stage)) return false
    if (spec.temp && c.temperature !== spec.temp) return false
    if (spec.newToday && bkkDate(c.createdAt) !== today) return false
    if (spec.model && !String(c.interestedModel || '').toLowerCase().replace(/[\s\-]+/g, '').includes(String(spec.model).replace(/[\s\-]+/g, ''))) return false
    if (spec.quietDays && quiet(c) < spec.quietDays) return false
    if (spec.noFu && pending.has(c.id)) return false
    return true
  }).map(c => ({ c, quiet: quiet(c), hasFu: pending.has(c.id) }))
  const rank = { hot: 0, warm: 1, cold: 2 }
  hit.sort((a, b) => (rank[a.c.temperature] ?? 3) - (rank[b.c.temperature] ?? 3) || b.quiet - a.quiet)
  return { list: hit.slice(0, LIST_MAX), total: hit.length }
}

export function listCommands(list) {
  return list.map(({ c, quiet, hasFu }) => {
    const desc = [c.temperature ? c.temperature.toUpperCase() : '', c.interestedModel ? '🚗 ' + c.interestedModel : '',
      quiet > 0 ? `เงียบ ${quiet} วัน` : 'ติดต่อวันนี้', hasFu ? 'มีนัดแล้ว' : 'ยังไม่มีนัด'].filter(Boolean).join(' · ')
    const phone = String(c.phone || '').replace(/[^\d+]/g, '')
    return phone.length >= 9
      ? { kind: 'tel', customer: c, phone, label: `📞 ${fullName(c)}`, desc }
      : { kind: 'open', customer: c, label: `👤 ${fullName(c)}`, desc }
  })
}

export function listIntro(spec, { list, total }) {
  const who = listLabel(spec)
  if (!total) return `ไม่มีใครตรงเงื่อนไข "${who}" ในรายชื่อที่คุณดูแลตอนนี้`
  return `👥 ${who} — ${total} คน${total > list.length ? ` (แสดง ${list.length} คนแรก เรียงจากร้อนและเงียบนานสุด)` : ''}${spec.countOnly ? '' : ' · กดโทรหรือเปิดได้เลย'}`
}

// คำสั่งต่อยอดที่กดได้ทันที เช่น "นัดลูกค้า hot ทุกคนพรุ่งนี้ 10 โมง"
export function listFollowUp(spec, { total }) {
  if (!total) return ''
  const who = [spec.leadsOnly || spec.newToday ? 'ลีด' : 'ลูกค้า', spec.newToday ? 'ใหม่วันนี้' : '', spec.temp || '', spec.quietDays ? `ที่เงียบเกิน ${spec.quietDays} วัน` : ''].filter(Boolean).join(' ')
  return spec.model ? '' : `นัดโทร${who} ทุกคน พรุ่งนี้ 10 โมง`
}
