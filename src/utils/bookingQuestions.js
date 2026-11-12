// (v1.0.1046) ถามหาใบจอง: "ใครรอไฟแนนซ์" / "ใครรอรถ" / "ใครยังไม่นัดส่งมอบ" / "ใบจองไหนค้างนานสุด" / "ส่งมอบพรุ่งนี้มีใครบ้าง"
// → LAMI ตอบเป็นรายการใบจองจริงพร้อมปุ่มเปิดใบจอง (ไม่ต้องรอ AI) · ฟังก์ชันล้วน ทดสอบได้
import { thaiNumerals } from './lamiCommands.js'
import { isOpenBooking } from './bookingStatus.js'
import { dmy, addDaysBangkok } from './format.js'
import { carOf } from './carLabel.js'

export const BK_LIST_MAX = 10
const DAY = 86400e3
const dayNum = d => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / DAY
const isDate = d => /^\d{4}-\d{2}-\d{2}/.test(d || '')
const ASK = /ใครบ้าง|มีใคร|คนไหน|กี่คน|กี่ราย|กี่ใบ|กี่คัน|รายชื่อ|ขอดู|^ใคร|ใบไหน|ใบจองไหน|คันไหน|ของใคร|รถใคร|^มี.{2,60}(?:ไหม|มั้ย|หรือเปล่า|รึเปล่า|หรือยัง)(?:ครับ|คะ|ค่ะ)?$/
const FIN = ['รอผลไฟแนนซ์', 'จัดไฟแนนซ์ก่อนจอง']
const WAIT_DELIV = ['รอส่งมอบ', 'ตัดตัวเลขรอส่งมอบ']

export function parseBookingListSpec(q) {
  const s = thaiNumerals(String(q || '').trim()).replace(/[?？]+$/, '').trim()
  if (!s || s.length > 120 || !ASK.test(s)) return null
  if (/ทุกคน|ทั้งหมด|ยอด|เป้า|เซลส์|พนักงาน|ทีม|ยังไง|อย่างไร|ทำไม|เพราะ|ลองขับ/.test(s)) return null
  const noDate = /ไม่(?:ได้|มี)?\s*นัด\s*(?:วัน)?\s*(?:ส่งมอบ|ส่งรถ|รับรถ)|ส่งมอบ.*ยังไม่(?:ได้|มี)?\s*นัด/.test(s)
  const when = !noDate && /ส่งมอบ|ส่งรถ|รับรถ/.test(s) ? (/พรุ่งนี้/.test(s) ? 'tomorrow' : /วันนี้/.test(s) ? 'today' : /สัปดาห์นี้|อาทิตย์นี้|7\s*วัน/.test(s) ? 'week' : null) : null
  const stuck = /ค้างนาน|ค้างเกิน|นานสุด|นานที่สุด|ค้างสถานะ/.test(s) && /จอง|ใบ/.test(s)
  const sd = s.match(/ค้างเกิน\s*(\d{1,3})\s*วัน/)
  const statuses = noDate ? WAIT_DELIV
    : /รอ(?:ผล)?\s*ไฟแนนซ์|ไฟแนนซ์(?:ยัง)?ไม่ผ่าน|ติดไฟแนนซ์/.test(s) ? FIN
    : /รอรถ/.test(s) ? ['รอรถ']
    : !when && /รอส่งมอบ|ค้างส่งมอบ|พร้อมส่ง/.test(s) ? WAIT_DELIV : null
  // (v1.0.1086) "ใบจองไหนยังไม่มีเลขตัวถัง" (ไม่นับใบที่ยังรอรถ เพราะยังไม่ได้จัดรถ)
  const noVin = /(?:ยังไม่|ไม่)(?:ได้)?\s*(?:กรอก|ใส่|มี|ลง)?\s*(?:เลข)?\s*(?:ตัวถัง|vin|คัสซี)/i.test(s)
  if (!statuses && !when && !stuck && !noVin) return null
  return { noVin, statuses, noDate, when, stuck, stuckDays: stuck ? (sd ? +sd[1] : 14) : null, countOnly: /กี่คน|กี่ราย|กี่ใบ|กี่คัน/.test(s) }
}

export function bookingListLabel(spec) {
  if (spec.noVin) return 'ใบจองที่ยังไม่มีเลขตัวถัง (ไม่นับใบที่รอรถ)'
  if (spec.noDate) return 'รถพร้อมส่งที่ยังไม่นัดวันส่งมอบ'
  if (spec.when) return `นัดส่งมอบ${{ today: 'วันนี้', tomorrow: 'พรุ่งนี้', week: 'ใน 7 วันนี้' }[spec.when]}`
  if (spec.stuck) return `ใบจองที่ค้างเกิน ${spec.stuckDays} วัน`
  return `ใบจองสถานะ ${spec.statuses[0] === 'รอผลไฟแนนซ์' ? 'รอไฟแนนซ์' : spec.statuses[0]}`
}

// เห็นเฉพาะใบจองที่ผูกกับลูกค้าที่ผู้ใช้มองเห็น
export function bookingTargets({ customers = [], bookings = [], today, spec, tomorrow = addDaysBangkok(1), weekEnd = addDaysBangkok(7) }) {
  if (!spec) return { list: [], total: 0 }
  const byBooking = new Map(), byId = new Map()
  customers.forEach(c => { if (!c || c.deleted) return; byId.set(c.id, c); if (c.bookingId) byBooking.set(c.bookingId, c) })
  const t = dayNum(today)
  const hit = []
  bookings.forEach(b => {
    if (!b || b.deleted) return
    const c = byBooking.get(b.id) || byId.get(b.customerId)
    if (!c) return
    const open = isOpenBooking(b) || b.status === 'ตัดตัวเลขรอส่งมอบ'
    if (!open) return
    if (spec.statuses && !spec.statuses.includes(b.status)) return
    if (spec.noDate && isDate(b.deliveryDate)) return
    if (spec.noVin && (String(b.vin || '').trim() || b.status === 'รอรถ')) return
    if (spec.when) {
      const d = String(b.deliveryDate || '').slice(0, 10)
      if (!isDate(d)) return
      if (spec.when === 'today' ? d !== today : spec.when === 'tomorrow' ? d !== tomorrow : (d < today || d > weekEnd)) return
    }
    const age = isDate(b.bookingDate) ? t - dayNum(String(b.bookingDate).slice(0, 10)) : 0
    if (spec.stuck && age < spec.stuckDays) return
    hit.push({ b, c, age })
  })
  hit.sort((x, y) => spec.when ? String(x.b.deliveryDate + (x.b.deliveryTime || '')).localeCompare(String(y.b.deliveryDate + (y.b.deliveryTime || ''))) : y.age - x.age)
  return { list: hit.slice(0, BK_LIST_MAX), total: hit.length }
}

export function bookingListCommands(list) {
  return list.map(({ b, c, age }) => {
    const name = b.custName || b.customerName || [c.firstName, c.lastName].filter(Boolean).join(' ') || 'ลูกค้า'
    const car = carOf(b)
    const desc = [b.status, car ? '🚗 ' + car : '', age > 0 ? `จองมา ${age} วัน` : '',
      isDate(b.deliveryDate) ? `ส่งมอบ ${dmy(String(b.deliveryDate).slice(0, 10))}${b.deliveryTime ? ' ' + b.deliveryTime : ''}` : ''].filter(Boolean).join(' · ')
    return { kind: 'bk', customer: c, bookingId: b.id, label: `📝 ${name}`, desc }
  })
}

export function bookingListIntro(spec, { list, total }) {
  const who = bookingListLabel(spec)
  if (!total) return `ไม่มี${who} ในใบจองที่คุณดูแลตอนนี้`
  return `📝 ${who} — ${total} ใบ${total > list.length ? ` (แสดง ${list.length} ใบแรก)` : ''}${spec.countOnly ? '' : ' · กดเปิดใบจองได้เลย'}`
}
