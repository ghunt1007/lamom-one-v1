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

// (v1.0.1241) "รถจะมาเมื่อไหร่" — ไล่แจกรถให้ลูกค้าที่จองรอแบบจองก่อนได้ก่อน: รถว่าง → รถกำลังขนส่ง → ใบสั่งรถ (ตามวันที่คาดว่าจะถึง)
// คืน Map(bookingId → { kind: 'ready'|'transit'|'order'|'none', date, ref, ahead })  ahead = ลูกค้าที่รอรุ่น/สีเดียวกันอยู่ก่อน
export function etaForBookings({ bookings = [], vehicles = [], orders = [], today = '' } = {}) {
  const open = alive(bookings).filter(isOpenBooking)
  const taken = new Set(open.map(b => norm(b.vin)).filter(Boolean))
  const key = (rec, color) => { const mk = modelKey(rec); return mk ? mk + '|' + norm(String(color || '').trim() || NO_COLOR) : '' }
  const supply = new Map()
  const add = (k, s) => { if (!k) return; if (!supply.has(k)) supply.set(k, []); supply.get(k).push(s) }
  alive(vehicles).forEach(v => {
    if (taken.has(norm(v.vin))) return
    if (v.status === 'available') add(key(v, v.color), { kind: 'ready', date: today, rank: 0, ref: v.vin || '', at: String(v.arrivedAt || '') })
    else if (v.status === 'transit') add(key(v, v.color), { kind: 'transit', date: String(v.eta || v.expectedDate || (String(v.arrivedAt || '').slice(0, 10) > today ? v.arrivedAt : '') || '').slice(0, 10), rank: 1, ref: v.vin || '' })
  })
  alive(orders).forEach(o => {
    if (!ORDER_LIVE.includes(o.status)) return
    for (let i = 0; i < qty(o); i++) add(key(o, o.color), { kind: 'order', date: String(o.expectedDate || '').slice(0, 10), rank: 2, ref: o.orderNo || '' })
  })
  for (const list of supply.values()) list.sort((a, b) => a.rank - b.rank || (a.date || '9').localeCompare(b.date || '9') || a.at?.localeCompare?.(b.at || '') || 0)
  const out = new Map()
  const seen = new Map()
  alive(bookings).filter(needsBooking)
    .sort((a, b) => String(a.bookingDate || a.createdAt || '9').localeCompare(String(b.bookingDate || b.createdAt || '9')))
    .forEach(b => {
      const k = key(b, b.colorOut || b.color)
      const ahead = seen.get(k) || 0
      seen.set(k, ahead + 1)
      const s = supply.get(k)?.shift()
      if (b.id) out.set(b.id, s ? { kind: s.kind, date: s.date, ref: s.ref, ahead } : { kind: 'none', date: '', ref: '', ahead })
    })
  return out
}

export function etaLabel(e, fmt = d => d) {
  if (!e) return ''
  const q = e.ahead ? ` · มีลูกค้ารอรุ่น/สีนี้ก่อน ${e.ahead} คน` : ''
  if (e.kind === 'ready') return `✅ มีรถว่างในสต็อกสำหรับลูกค้านี้แล้ว${e.ref ? ` (ตัวถัง ${e.ref})` : ''}`
  if (e.kind === 'transit') return `🚢 ได้คันที่กำลังขนส่ง${e.date ? ` · คาดว่าถึง ${fmt(e.date)}` : ''}${q}`
  if (e.kind === 'order') return `📦 ได้จากใบสั่งรถ${e.ref ? ` ${e.ref}` : ''}${e.date ? ` · คาดว่าถึง ${fmt(e.date)}` : ' · ยังไม่มีวันที่คาดว่าจะถึง'}${q}`
  return `⚠️ ยังไม่มีรถรุ่น/สีนี้ทั้งในสต็อก ระหว่างขนส่ง และใบสั่งรถ — ต้องสั่งเพิ่ม${q}`
}

// (v1.0.1243) รถรุ่นนี้มีให้ขายลูกค้าใหม่ไหม (หลังหักลูกค้าที่จองรอไว้แล้ว) — ใช้ตอนทำใบเสนอราคา
// rows = ผลจาก orderNeeds · rec = { brand, model } ของรุ่นที่เลือก · คืน [{ color, free, coming }] เรียงว่างมากก่อน
export function stockForModel(rows, rec) {
  const mk = modelKey(rec)
  if (!mk) return []
  return (rows || []).filter(r => modelKey(r) === mk).map(r => {
    const free = Math.max(0, r.ready - r.wait)
    const coming = Math.max(0, r.have - Math.max(r.wait, r.ready))
    return { color: r.color, free, coming }
  }).filter(r => r.free || r.coming).sort((a, b) => b.free - a.free || b.coming - a.coming || a.color.localeCompare(b.color))
}
