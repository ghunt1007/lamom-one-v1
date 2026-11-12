// (v1.0.1070) แนะนำรถตามงบ/ความต้องการ: "รถไฟฟ้าไม่เกิน 1 ล้าน" / "SUV 7 ที่นั่ง งบ 1.2 ล้าน" / "แนะนำรถงบ 8 แสน"
// → LAMI คัดรุ่นจากฐานข้อมูลรถทันที ให้ยี่ห้อที่โชว์รูมขายขึ้นก่อน · ฟังก์ชันล้วน ทดสอบได้
import { thaiNumerals } from './lamiCommands.js'
import { carLabel } from './carLabel.js'

const ASK = /แนะนำ|รถอะไรดี|รุ่นไหนดี|คันไหนดี|ตัวไหนดี|เหมาะ|ควรซื้อ|มีรุ่นไหน|มีรถอะไร|รถอะไรบ้าง|รุ่นอะไรบ้าง/
const BUDGET = /งบ|ไม่เกิน|ต่ำกว่า|ไม่ถึง|ราคาประมาณ|ประมาณ|ช่วงราคา|ราว|แถว/
// คำที่บอกว่าเป็นเรื่องอื่น
const OTHER = /ลูกค้า|ลีด|lead|โทร|นัด|บันทึก|จด |แล้ว|ใบจอง|ส่งมอบ|ยอดขาย|เป้า|ค่าคอม|รายได้|ผ่อน|ค่างวด|ดาวน์|สต็อก|สต๊อก|พร้อมขาย|พร้อมส่ง|ค้าง|โปร|อะไหล่|มือสอง/

const FUEL = [
  [/ไฟฟ้า|อีวี|\bev\b|bev/i, ['BEV']],
  [/ปลั๊กอิน|phev|reev|erev/i, ['PHEV']],
  [/ไฮบริด|hybrid|hev/i, ['Hybrid', 'PHEV']],
  [/ดีเซล|diesel/i, ['Diesel']],
  [/เบนซิน|น้ำมัน|petrol/i, ['Petrol', 'Hybrid']],
]
const BODY = [
  [/suv|เอสยูวี|อเนกประสงค์/i, 'SUV'], [/เก๋ง|ซีดาน|sedan/i, 'Sedan'], [/แฮทช์|hatch|รถเล็ก|คันเล็ก/i, 'Hatchback'],
  [/mpv|รถครอบครัว|รถตู้|เอ็มพีวี/i, 'MPV'], [/กระบะ|pickup|ปิคอัพ|ปิกอัพ/i, 'Pickup'],
]

function money(s) {
  const m = s.match(/(\d+(?:\.\d+)?)\s*(ล้าน|แสน|หมื่น)/)
  if (m) return Math.round(+m[1] * { ล้าน: 1e6, แสน: 1e5, หมื่น: 1e4 }[m[2]])
  const n = s.match(/(\d{1,3}(?:,\d{3})+|\d{6,8})/)
  return n ? Number(n[1].replace(/,/g, '')) : null
}

export function maybeCarPick(q) {
  const s = String(q || '')
  if (s.length < 4 || s.length > 90 || OTHER.test(s)) return false
  return ASK.test(s) || (BUDGET.test(s) && /รถ|suv|ev|ไฟฟ้า|ไฮบริด|ที่นั่ง|เก๋ง|กระบะ|mpv/i.test(s))
}

export function parseCarPick(q) {
  if (!maybeCarPick(q)) return null
  const s = thaiNumerals(String(q).trim()).replace(/[?？]+$/, '')
  const fuel = FUEL.find(([re]) => re.test(s))?.[1] || null
  const body = BODY.find(([re]) => re.test(s))?.[1] || null
  const sm = s.match(/(\d)\s*ที่นั่ง/)
  const seats = sm ? +sm[1] : /ครอบครัวใหญ่|7 คน/.test(s) ? 7 : null
  let max = null, min = null
  const amt = money(s)
  if (amt && amt >= 100000) {
    if (/ไม่เกิน|ต่ำกว่า|ไม่ถึง|ไม่เกินกว่า/.test(s)) max = amt
    else if (/ขึ้นไป|มากกว่า|เกินกว่า|อย่างน้อย/.test(s)) min = amt
    else { max = Math.round(amt * 1.1); min = Math.round(amt * 0.8) } // "งบ 1 ล้าน" = ราว 0.8–1.1 ล้าน
  }
  if (!fuel && !body && !seats && max == null && min == null) return null
  return { fuel, body, seats, max, min }
}

// สร้างคำถามกลับจากเงื่อนไข (ใช้เป็นปุ่มถามต่อ) — แปลงกลับด้วย parseCarPick ได้
const FUEL_WORD = { BEV: 'รถไฟฟ้า', Hybrid: 'ไฮบริด', PHEV: 'ปลั๊กอินไฮบริด', Diesel: 'ดีเซล', Petrol: 'เบนซิน' }
const millions = n => `${Math.round(n / 1e5) / 10} ล้าน`
export function pickQuery(spec) {
  const parts = [spec.fuel ? FUEL_WORD[spec.fuel[0]] : 'แนะนำรถ', spec.body || '', spec.seats ? `${spec.seats} ที่นั่ง` : '']
  if (spec.max != null && spec.min == null) parts.push(`ไม่เกิน ${millions(spec.max)}`)
  else if (spec.min != null && spec.max == null) parts.push(`${millions(spec.min)} ขึ้นไป`)
  else if (spec.max != null) parts.push(`งบ ${millions((spec.max / 1.1 + spec.min / 0.8) / 2)}`)
  const q = parts.filter(Boolean).join(' ')
  return /แนะนำ|ไม่เกิน|งบ/.test(q) ? q : q + ' แนะนำ'
}

const baht = n => '฿' + Math.round(n).toLocaleString('en-US')
const short = m => String(m || '').replace(/\s*\(\d{4}\)\s*$/, '')

// vehicles มาจาก getVehicles() (เรียงยี่ห้อที่โชว์รูมขายก่อนแล้ว) · dealerRank บอกว่ายี่ห้อไหนโชว์รูมขาย (< 6)
export function carPick(spec, vehicles = [], { dealerRank = () => 99, dealerCount = 6 } = {}) {
  const fit = vehicles.filter(v => v && Number(v.price) > 0 && v.model
    && (!spec.fuel || spec.fuel.includes(v.fuel))
    && (!spec.body || v.type === spec.body)
    && (!spec.seats || Number(v.seats) >= spec.seats)
    && (spec.max == null || v.price <= spec.max)
    && (spec.min == null || v.price >= spec.min))
  // รวมเป็นรายรุ่น (เอารุ่นย่อยที่เข้าเงื่อนไขทั้งหมด) · ตัดรุ่นปีเก่าถ้ามีปีใหม่ชื่อเดียวกัน
  const by = new Map()
  fit.forEach(v => {
    const k = v.brand + '|' + short(v.model)
    const cur = by.get(k)
    if (!cur) by.set(k, { brand: v.brand, model: short(v.model), year: Number(v.year) || 0, vs: [v] })
    else if ((Number(v.year) || 0) > cur.year) by.set(k, { ...cur, year: Number(v.year) || 0, vs: [v] })
    else if ((Number(v.year) || 0) === cur.year) cur.vs.push(v)
  })
  const groups = [...by.values()].map(g => ({ ...g, vs: g.vs.sort((a, b) => a.price - b.price), ours: dealerRank(g.brand) < dealerCount }))
  const ours = groups.filter(g => g.ours).sort((a, b) => dealerRank(a.brand) - dealerRank(b.brand) || a.vs[0].price - b.vs[0].price)
  const others = groups.filter(g => !g.ours).sort((a, b) => a.vs[0].price - b.vs[0].price)
  const want = [
    spec.fuel ? (spec.fuel.includes('BEV') && spec.fuel.length === 1 ? 'รถไฟฟ้า' : spec.fuel.join('/')) : '',
    spec.body || '', spec.seats ? `${spec.seats} ที่นั่งขึ้นไป` : '',
    spec.max != null && spec.min != null ? `ราว ${baht(spec.min)}–${baht(spec.max)}` : spec.max != null ? `ไม่เกิน ${baht(spec.max)}` : spec.min != null ? `ตั้งแต่ ${baht(spec.min)}` : '',
  ].filter(Boolean).join(' · ')
  if (!groups.length) {
    // ปุ่มถามต่อ: ขยับงบขึ้น 20% (เงื่อนไขเดิม) และลองตัดจำนวนที่นั่ง/ประเภทตัวถังออก
    const next = []
    if (spec.max != null) next.push(pickQuery({ ...spec, min: null, max: Math.round(spec.max * 1.2 / 1e5) * 1e5 }))
    if (spec.seats || spec.body) next.push(pickQuery({ ...spec, seats: null, body: spec.seats ? spec.body : null }))
    return { text: `🔎 ไม่พบรุ่นที่ตรง: ${want}\nลองขยับงบหรือลดเงื่อนไขดูครับ`, next: [...new Set(next)].filter(Boolean), copy: '', top: [] }
  }
  const row = g => {
    const v = g.vs[0], hi = g.vs[g.vs.length - 1]
    const price = g.vs.length > 1 && hi.price !== v.price ? `${baht(v.price)}–${baht(hi.price)}` : baht(v.price)
    const extra = [Number(v.range) > 0 && /BEV|PHEV/.test(v.fuel) ? `${Math.max(...g.vs.map(x => Number(x.range) || 0))} กม.` : '', v.seats ? `${v.seats} ที่นั่ง` : '', v.type || ''].filter(Boolean).join(' · ')
    return `${carLabel(g.brand, g.model)} · ${price}${extra ? ' · ' + extra : ''}`
  }
  const lines = [`🔎 รถที่ตรง: ${want}`]
  if (ours.length) { lines.push(`🏢 รุ่นที่โชว์รูมขาย (${ours.length})`); ours.slice(0, 8).forEach(g => lines.push('• ' + row(g))) }
  if (others.length) { lines.push(`${ours.length ? '🚗 ยี่ห้ออื่นในตลาด' : '🚗 ในตลาด'} (${others.length})`); others.slice(0, ours.length ? 4 : 8).forEach(g => lines.push('• ' + row(g))) }
  lines.push('ℹ️ ราคาจากฐานข้อมูลรถในระบบ ตรวจกับใบราคาล่าสุดก่อนยืนยันกับลูกค้า')
  const top = (ours.length ? ours : others).slice(0, 3)
  const copy = ours.length ? [`รุ่นที่แนะนำ${want ? ` (${want})` : ''}`, ...ours.slice(0, 5).map(g => '• ' + row(g)), 'สนใจรุ่นไหน นัดทดลองขับได้เลยค่ะ/ครับ'].join('\n') : ''
  const next = [...top.slice(0, 2).map(g => `ราคา ${g.model} เท่าไหร่`), ...(top.length >= 2 ? [`เทียบ ${top[0].model} กับ ${top[1].model}`] : [])]
  return { text: lines.join('\n'), next, copy, top }
}
