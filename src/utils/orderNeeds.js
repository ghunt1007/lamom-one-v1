// (v1.0.1224) ต้องสั่งรถรุ่นไหน สีอะไร — เทียบ "ลูกค้าจองรอรถ" กับ "รถที่มี/กำลังมา/สั่งไว้แล้ว" แยกรุ่น + สี
// ฟังก์ชันล้วน ไม่แตะฐานข้อมูล ใช้ร่วมกันทั้งหน้าตารางสีรถ (/dms/color-matrix) และ LAMI
import { carOf } from './carLabel.js'
import { isOpenBooking } from './bookingStatus.js'

// ใบจองที่รถมาถึงแล้ว (ไม่ต้องสั่งเพิ่ม) — ใบจองเปิดอื่นๆ ที่ยังไม่มีเลขตัวถัง = ลูกค้ายังรอรถ
const CAR_ARRIVED = ['ได้รถแล้วรอสั่งแต่ง', 'รอส่งมอบ', 'ตัดตัวเลขรอส่งมอบ']
// ใบสั่งรถที่ส่งไปแล้วและยังไม่ถึง (ร่าง = ยังไม่ได้สั่งจริง แยกนับ)
export const ORDER_LIVE = ['ordered', 'confirmed', 'production', 'shipped']

const norm = s => String(s || '').toLowerCase().replace(/[\s\-_.()]+/g, '')
const alive = a => (a || []).filter(x => x && !x.deleted)
const qty = o => Math.max(1, Number(o.qty) || 1)
const NO_COLOR = 'ไม่ระบุสี'
// คีย์รุ่น: ชื่อรุ่นตัดคำยี่ห้อออก — ใบจองจาก Sheet มักเขียนแค่ "S07" ส่วนสต็อกเขียน "DEEPAL S07"
export function modelKey(rec) {
  const brandWords = new Set(String(rec?.brand || '').toLowerCase().split(/[^a-z0-9ก-๙]+/i).filter(Boolean))
  const words = String(rec?.model || '').toLowerCase().split(/[^a-z0-9ก-๙+]+/i).filter(w => w && !brandWords.has(w) && !KNOWN_BRANDS.has(w))
  return words.join('')
}
const KNOWN_BRANDS = new Set(['deepal', 'changan', 'aion', 'gac', 'byd', 'mg', 'neta', 'gwm', 'ora', 'zeekr', 'xpeng', 'omoda', 'jaecoo', 'chery', 'avatr', 'denza', 'leapmotor'])

export const needsBooking = b => isOpenBooking(b) && !CAR_ARRIVED.includes(b.status) && !String(b.vin || '').trim()

export function orderNeeds({ bookings = [], vehicles = [], orders = [] } = {}) {
  const m = new Map()
  const row = (rec, color) => {
    const car = carOf(rec) || String(rec.model || '').trim()
    const mk = modelKey(rec)
    if (!car || !mk) return null
    const c = String(color || '').trim() || NO_COLOR
    const key = mk + '|' + norm(c)
    if (!m.has(key)) m.set(key, { key, car, brand: rec.brand || '', model: rec.model || '', color: c, wait: 0, ready: 0, coming: 0, ordered: 0, draft: 0, waitNames: [] })
    const r = m.get(key)
    // ชื่อที่แสดง: ใช้แบบที่มียี่ห้อ (ยาวกว่า) ถ้ามี เช่น "DEEPAL S07" แทน "S07"
    if (car.length > r.car.length) Object.assign(r, { car, brand: rec.brand || r.brand, model: rec.model || r.model })
    return r
  }
  const open = alive(bookings).filter(isOpenBooking)
  // รถที่ผูกกับใบจองแล้ว (เลขตัวถังตรงกัน) ไม่นับเป็นรถว่าง
  const taken = new Set(open.map(b => norm(b.vin)).filter(Boolean))
  alive(bookings).filter(needsBooking).forEach(b => {
    const r = row(b, b.colorOut || b.color)
    if (!r) return
    r.wait++
    if (r.waitNames.length < 5) r.waitNames.push(String(b.custName || '').trim() || 'ลูกค้า')
  })
  alive(vehicles).forEach(v => {
    if (taken.has(norm(v.vin))) return
    if (v.status !== 'available' && v.status !== 'transit') return
    const r = row(v, v.color)
    if (!r) return
    if (v.status === 'available') r.ready++
    else r.coming++
  })
  alive(orders).forEach(o => {
    if (o.status === 'draft') { const r = row(o, o.color); if (r) r.draft += qty(o); return }
    if (!ORDER_LIVE.includes(o.status)) return
    const r = row(o, o.color)
    if (r) r.ordered += qty(o)
  })
  return [...m.values()].map(r => {
    const have = r.ready + r.coming + r.ordered
    return { ...r, have, short: Math.max(0, r.wait - have) }
  }).sort((a, b) => b.short - a.short || b.wait - a.wait || a.have - b.have || a.car.localeCompare(b.car) || a.color.localeCompare(b.color))
}

// สรุปเป็นข้อความ (LAMI) — เฉพาะรุ่น/สีที่ขาด
export function orderNeedsText(rows, max = 10) {
  const short = rows.filter(r => r.short > 0)
  if (!short.length) return ''
  const total = short.reduce((a, r) => a + r.short, 0)
  return [`🛒 ต้องสั่งรถเพิ่ม ${total} คัน (${short.length} รุ่น/สี) — มีลูกค้าจองรออยู่แล้ว`,
    ...short.slice(0, max).map(r => `• ${r.car} สี${r.color} — ขาด ${r.short} คัน (จองรอ ${r.wait}${r.have ? ` · มี/กำลังมา/สั่งแล้ว ${r.have}` : ''}${r.draft ? ` · ร่างใบสั่ง ${r.draft}` : ''})`),
    short.length > max ? `…และอีก ${short.length - max} รายการ ดูครบที่ เมนูรถ › 🎨 ตารางสีรถ` : '💡 ดูรายชื่อลูกค้าที่รอ และกดสั่งได้ที่ เมนูรถ › 🎨 ตารางสีรถ'].join('\n')
}

// (v1.0.1238) รถว่างที่ตรงรุ่น+สีกับลูกค้าที่จองรอ — จับคู่ "ใครจองก่อนได้ก่อน" กับ "รถที่เข้าสต็อกก่อนออกก่อน"
// แนะนำเท่านั้น (ไม่แก้ใบจอง) — ผู้ใช้ใส่เลขตัวถังในใบจอง/Sheet เอง
export function matchReadyCars({ bookings = [], vehicles = [] } = {}) {
  const open = alive(bookings).filter(isOpenBooking)
  const taken = new Set(open.map(b => norm(b.vin)).filter(Boolean))
  const key = (rec, color) => { const mk = modelKey(rec); return mk ? mk + '|' + norm(String(color || '').trim() || NO_COLOR) : '' }
  const cars = new Map()
  alive(vehicles).filter(v => v.status === 'available' && !taken.has(norm(v.vin)))
    .sort((a, b) => String(a.arrivedAt || '9').localeCompare(String(b.arrivedAt || '9')))
    .forEach(v => { const k = key(v, v.color); if (!k) return; if (!cars.has(k)) cars.set(k, []); cars.get(k).push(v) })
  const pairs = []
  alive(bookings).filter(needsBooking)
    .sort((a, b) => String(a.bookingDate || a.createdAt || '9').localeCompare(String(b.bookingDate || b.createdAt || '9')))
    .forEach(b => {
      const list = cars.get(key(b, b.colorOut || b.color))
      if (list?.length) pairs.push({ booking: b, vehicle: list.shift() })
    })
  return pairs
}

export function matchReadyText(pairs, max = 10) {
  if (!pairs.length) return ''
  return [`🔑 มีรถว่างตรงกับลูกค้าที่จองรอ ${pairs.length} คัน (จองก่อนได้ก่อน)`,
    ...pairs.slice(0, max).map(({ booking: b, vehicle: v }) => `• ${String(b.custName || '').trim() || 'ลูกค้า'} — ${carOf(v) || v.model} สี${v.color || '-'}${v.vin ? ` · ตัวถัง ${v.vin}` : ''}`),
    ...(pairs.length > max ? [`…และอีก ${pairs.length - max} คัน`] : []),
    '💡 ใส่เลขตัวถังในใบจอง (หรือใน Sheet) แล้วแจ้งลูกค้าได้เลย'].join('\n')
}
