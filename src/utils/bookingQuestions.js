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
const ASK = /ใครบ้าง|มีใคร|คนไหน|กี่คน|กี่ราย|กี่ใบ|กี่คัน|รายชื่อ|ขอดู|^ใคร|ใบไหน|ใบจองไหน|คันไหน|ของใคร|รถใคร|^ใบจอง(?:ที่)?|^ลูกค้าที่|^ลูกค้า\s*(?:ของ)?\s*(?:ฉัน|ผม|หนู|เรา)\s*ที่|^รถ(?:ที่)?ลูกค้า.{0,30}(?:หรือ|รึ)ยัง|^รถ(?:ที่)?ลูกค้า\s*จอง|นานสุด|นานที่สุด|^มี.{2,60}(?:ไหม|มั้ย|หรือเปล่า|รึเปล่า|หรือยัง)(?:ครับ|คะ|ค่ะ)?$/
const FIN = ['รอผลไฟแนนซ์', 'จัดไฟแนนซ์ก่อนจอง']
const WAIT_DELIV = ['รอส่งมอบ', 'ตัดตัวเลขรอส่งมอบ']

export function parseBookingListSpec(q) {
  const s = thaiNumerals(String(q || '').trim()).replace(/[?？]+$/, '').trim()
  if (!s || s.length > 120 || !ASK.test(s)) return null
  // (v1.0.1116) "ทีมฉันมีใบจองค้างกี่ใบ" — คำว่าทีมใช้ได้ถ้าถามเรื่องใบจอง (ขอบเขตทีมจัดการโดยสิทธิ์อยู่แล้ว)
  if (/ทีม/.test(s) && !/ใบจอง/.test(s)) return null
  // (v1.0.1118) "ใบจองของเซลส์สอง" → กรองตามเซลส์ (หาชื่อจริงตอนโหลด)
  const seller = /(?:ของ|ที่)\s*(?:เซลส์|เซล|คุณ|พี่|น้อง)\s*\S/.test(s) && !/ทีม|ทุกคน|แต่ละ/.test(s)
  if (/ทุกคน|ทั้งหมด|ยอด|เป้า|พนักงาน|ยังไง|อย่างไร|ทำไม|เพราะ|ลองขับ/.test(s) || (!seller && /เซลส์/.test(s))) return null
  const noDate = /ไม่(?:ได้|มี)?\s*นัด\s*(?:วัน)?\s*(?:ส่งมอบ|ส่งรถ|รับรถ)|ส่งมอบ.*ยังไม่(?:ได้|มี)?\s*นัด/.test(s)
  const when = !noDate && /ส่งมอบ|ส่งรถ|รับรถ/.test(s) ? (/พรุ่งนี้/.test(s) ? 'tomorrow' : /วันนี้/.test(s) ? 'today' : /สัปดาห์นี้|อาทิตย์นี้|7\s*วัน/.test(s) ? 'week' : null) : null
  const stuck = /ค้างนาน|ค้างเกิน|นานเกิน|นานสุด|นานที่สุด|ค้างสถานะ|เกิน\s*\d{1,3}\s*วัน/.test(s) && /จอง|ใบ|ไฟแนนซ์|รอรถ|รอส่งมอบ/.test(s) && !/ยังไม่(?:ได้)?\s*(?:จอง|ปิด|ซื้อ)|คุยนาน/.test(s)
  const sd = s.match(/(?:ค้าง|นาน)?เกิน\s*(\d{1,3})\s*วัน/)
  // (v1.0.1110) "ลูกค้าที่ไฟแนนซ์ไม่ผ่าน" (โดนปฏิเสธ ≠ "ยังไม่ผ่าน" ที่รอผล) · "รถที่ลูกค้าจองมาถึงหรือยัง" = รอรถ
  const finFail = /ไฟแนนซ์\s*(?:ไม่ผ่าน|ไม่อนุมัติ|ตก|ปฏิเสธ)|(?:ไม่ผ่าน|ตก)\s*ไฟแนนซ์|โดน(?:ไฟแนนซ์)?\s*ปฏิเสธ/.test(s) && !/ยัง\s*ไม่(?:ได้)?\s*(?:ผ่าน|อนุมัติ)/.test(s)
  const arrive = /จอง/.test(s) && /(?:มาถึง|มา|เข้า)\s*(?:หรือ|รึ)?\s*ยัง/.test(s)
  const statuses = noDate ? WAIT_DELIV
    : finFail ? null
    : arrive ? ['รอรถ']
    : /รอ(?:ผล)?\s*ไฟแนนซ์|ตาม\s*ผล\s*ไฟแนนซ์|ไฟแนนซ์(?:ยัง)?ไม่(?:ได้)?\s*(?:ผ่าน|อนุมัติ)|ติดไฟแนนซ์|ยังไม่(?:ได้)?\s*(?:อนุมัติ|ผ่าน)\s*ไฟแนนซ์/.test(s) ? FIN
    : /รอรถ|ยังไม่มาถึง|รถยังไม่มา|ยังไม่ได้รถ|รถยังไม่เข้า|ยังไม่มี(?:รถ)?(?:ใน)?(?:สต็อก|สต๊อก)/.test(s) ? ['รอรถ']
    : !when && /รอส่งมอบ|ค้างส่งมอบ|พร้อมส่ง/.test(s) ? WAIT_DELIV
    // (v1.0.1118) สถานะอื่นในใบจอง (ตรงกับคอลัมน์ Sheet)
    : /ผ่านไฟแนนซ์(?:แล้ว)?\s*(?:รอ)?\s*เบิก|รอเบิก(?!รถ)/.test(s) ? ['ผ่านไฟแนนซ์รอเบิก']
    : /ไฟแนนซ์\s*(?:อนุมัติ|ผ่าน)\s*แล้ว|ผ่านไฟแนนซ์(?:แล้ว)?/.test(s) ? ['ผ่านไฟแนนซ์รอจอง', 'ผ่านไฟแนนซ์รอเบิก']
    : /ซื้อสด|เงินสด/.test(s) ? ['ซื้อสดรอเบิกรถ'] : null
  // (v1.0.1086) "ใบจองไหนยังไม่มีเลขตัวถัง" (ไม่นับใบที่ยังรอรถ เพราะยังไม่ได้จัดรถ)
  const noVin = /(?:ยังไม่|ไม่)(?:ได้)?\s*(?:กรอก|ใส่|มี|ลง|ผูก|จับคู่|จับ)?\s*(?:เลข)?\s*(?:ตัวถัง|vin|คัสซี)/i.test(s)
  // (v1.0.1110) "ใบจองไหนยังไม่ได้ใส่สีรถ"
  const noColor = /(?:ยังไม่|ไม่)(?:ได้)?\s*(?:กรอก|ใส่|ระบุ|เลือก|มี|ลง)?\s*สี\s*(?:รถ)?(?!\S*ขาย)/.test(s)
  // (v1.0.1087) "จองแล้วแต่ยังไม่ได้วางมัดจำ"
  const noDeposit = /ยังไม่(?:ได้)?\s*(?:วาง|จ่าย|ชำระ|โอน)?\s*(?:เงิน)?\s*มัดจำ|ไม่มี(?:เงิน)?มัดจำ|ไม่ได้วางมัดจำ/.test(s)
  // (v1.0.1103) "ใครยังไม่ได้วางเงินดาวน์" → ใบจองผ่อน (ไม่ใช่ซื้อสด) ที่ยังไม่ได้กรอกยอดดาวน์
  const noDown = !noDeposit && /ยังไม่(?:ได้)?\s*(?:วาง|จ่าย|ชำระ|โอน|กรอก|ใส่|ระบุ)?\s*(?:เงิน|ยอด)?\s*ดาวน์|ไม่มี(?:เงิน|ยอด)?ดาวน์/.test(s)
  // (v1.0.1121) "ลูกค้าที่จองแล้วยังไม่ได้ส่งเอกสาร" → ใบจองที่ยังไม่มีไฟล์แนบ (📎 ในใบจอง)
  const noDocs = /(?:ยังไม่|ไม่)(?:ได้)?\s*(?:ส่ง|แนบ|อัปโหลด|อัพโหลด|ให้|ครบ)?\s*(?:ไฟล์\s*)?เอกสาร|เอกสาร\s*(?:ยัง)?\s*ไม่ครบ/.test(s)
  // (v1.0.1090) "ลูกค้าที่จองแต่ยังไม่ส่งมอบมีกี่คน" → ใบจองที่ยังเปิดอยู่ทั้งหมด
  // (v1.0.1096) "ใครยังไม่ได้รับรถทั้งที่ถึงวันนัด" → นัดส่งมอบเลยวันแล้วแต่ยังไม่ส่งมอบ
  const late = /ถึงวันนัด|เลย(?:วัน)?(?:นัด|กำหนด)\s*(?:ส่งมอบ|ส่งรถ|รับรถ)?|(?:ส่งมอบ|ส่งรถ)\s*(?:ช้า|ล่าช้า|เลยกำหนด|เกินกำหนด)|เกินวัน(?:นัด)?\s*ส่งมอบ/.test(s) && /ส่งมอบ|รับรถ|ส่งรถ|วันนัด/.test(s)
  const allOpen = !late && !statuses && !when && /ยังไม่(?:ได้)?\s*(?:ส่งมอบ|ส่งรถ|รับรถ)|ค้างจอง|ใบจอง\s*(?:ที่)?\s*ค้าง\s*(?:อยู่)?\s*(?:กี่|อะไร|ใคร|บ้าง)|^ใบจอง\s*(?:ของ)?\s*(?:ฉัน|ผม|หนู|เรา)\s*(?:มี|ค้าง)?\s*(?:กี่ใบ|อะไรบ้าง|มีใครบ้าง|ใครบ้าง)|^ใบจอง(?:ที่)?ค้างอยู่/.test(s)
  const none = !statuses && !when && !stuck && !noVin && !noDeposit && !noDown && !noColor && !noDocs && !finFail && !allOpen && !late
  if (none && !(seller && /ใบจอง/.test(s))) return null
  return { late, allOpen: allOpen || none, ...(seller ? { seller: true } : {}), noVin, noDeposit, noDown, ...(noColor ? { noColor } : {}), ...(noDocs ? { noDocs } : {}), ...(finFail ? { finFail } : {}), ...(arrive && !noDate && !finFail ? { arrive: true } : {}), statuses, noDate, when, stuck, stuckDays: stuck ? (sd ? +sd[1] : 14) : null, countOnly: /กี่คน|กี่ราย|กี่ใบ|กี่คัน/.test(s) }
}

export function bookingListLabel(spec) {
  const lbl = bookingListLabel0(spec)
  return spec.sellerName ? `${lbl} ของ ${spec.sellerName}` : lbl
}
const ST_LABEL = { 'รอผลไฟแนนซ์': 'รอไฟแนนซ์', 'ผ่านไฟแนนซ์รอจอง': 'ผ่านไฟแนนซ์แล้ว' }
function bookingListLabel0(spec) {
  if (spec.late) return 'นัดส่งมอบเลยวันแล้วแต่ยังไม่ส่งมอบ'
  if (spec.allOpen && !spec.noVin && !spec.noDeposit && !spec.noDown && !spec.noColor && !spec.noDocs && !spec.finFail && !spec.stuck) return 'ใบจองที่ยังไม่ส่งมอบ'
  if (spec.noColor) return 'ใบจองที่ยังไม่ได้ใส่สีรถ'
  if (spec.noDocs) return 'ใบจองที่ยังไม่ได้แนบเอกสาร'
  if (spec.finFail) return 'ใบจองที่ไฟแนนซ์ไม่ผ่าน'
  if (spec.arrive && !spec.stuck) return 'ใบจองที่รถยังไม่มาถึง (รอรถ)'
  if (spec.noVin) return 'ใบจองที่ยังไม่มีเลขตัวถัง (ไม่นับใบที่รอรถ)'
  if (spec.noDeposit) return 'ใบจองที่ยังไม่มียอดมัดจำ'
  if (spec.noDown) return 'ใบจองผ่อนที่ยังไม่ได้กรอกยอดดาวน์'
  if (spec.noDate) return 'รถพร้อมส่งที่ยังไม่นัดวันส่งมอบ'
  if (spec.when) return `นัดส่งมอบ${{ today: 'วันนี้', tomorrow: 'พรุ่งนี้', week: 'ใน 7 วันนี้' }[spec.when]}`
  if (spec.stuck) return `ใบจอง${spec.statuses ? 'สถานะ ' + (ST_LABEL[spec.statuses[0]] || spec.statuses[0]) + ' ' : 'ที่'}ค้างเกิน ${spec.stuckDays} วัน`
  return `ใบจองสถานะ ${ST_LABEL[spec.statuses[0]] || spec.statuses[0]}`
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
    if (spec.sellerName && String(b.salesName || '').trim() !== spec.sellerName) return
    if (spec.noDate && isDate(b.deliveryDate)) return
    if (spec.late && !(isDate(b.deliveryDate) && String(b.deliveryDate).slice(0, 10) < today)) return
    if (spec.noVin && (String(b.vin || '').trim() || b.status === 'รอรถ')) return
    if (spec.noDeposit && (Number(b.bookingDeposit) || 0) > 0) return
    if (spec.noDown && ((Number(b.down) || 0) > 0 || b.finStatus === 'ซื้อสด')) return
    if (spec.noColor && String(b.color || '').trim()) return
    if (spec.noDocs && (b.files || []).length) return
    if (spec.finFail && b.finStatus !== 'ไม่ผ่าน') return
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
