// (v1.0.1311) ตัวเลือกรุ่นรถกลางสำหรับฟอร์มเล็กๆ (จองรถ, ใบรับรองลองขับ, เช็คอินงานอีเวนต์, ประวัติราคา, ใบเสนอราคา Fleet)
// เดิมแต่ละหน้าพิมพ์รุ่น BYD/MG ไว้ในโค้ด ซึ่งโชว์รูมไม่ได้ขาย — ตอนนี้ดึงจากฐานข้อมูลรถกลาง ยี่ห้อที่โชว์รูมขายขึ้นก่อน
import { getVehicles, dealerRank, DEALER_BRANDS } from '../data/vehicleDatabase.js'
import { escHtml } from './escape.js'

const nameOf = v => `${v.brand || ''} ${v.model || ''}`.trim()

export function modelNames(vehicles = getVehicles()) {
  return [...new Set((vehicles || []).map(nameOf).filter(Boolean))]
}

// <option> ของรุ่นรถ: ยี่ห้อที่โชว์รูมขายอยู่กลุ่มแรก · ค่าที่บันทึกไว้เดิม (ไม่อยู่ในรายการ) ยังเลือกค้างไว้ได้
export function modelOptionsHtml(selected = '', { vehicles = getVehicles(), extra = [] } = {}) {
  const names = modelNames(vehicles)
  const rankOf = n => dealerRank((vehicles.find(v => nameOf(v) === n) || {}).brand)
  const own = names.filter(n => rankOf(n) < DEALER_BRANDS.length)
  const rest = names.filter(n => rankOf(n) >= DEALER_BRANDS.length)
  const opt = n => `<option value="${escHtml(n)}"${n === selected ? ' selected' : ''}>${escHtml(n)}</option>`
  const keep = selected && !names.includes(selected) && !extra.includes(selected) ? opt(selected) : ''
  const groups = own.length && rest.length
    ? `<optgroup label="รุ่นที่โชว์รูมขาย">${own.map(opt).join('')}</optgroup><optgroup label="รุ่นอื่น">${rest.map(opt).join('')}</optgroup>`
    : names.map(opt).join('')
  return keep + groups + extra.map(opt).join('')
}

// ราคาเริ่มต้นของรุ่น (ถูกสุดในฐานข้อมูล) — ไม่มีราคา = 0
export function modelStartPrice(name, vehicles = getVehicles()) {
  const ps = (vehicles || []).filter(v => nameOf(v) === name).map(v => Number(v.price) || 0).filter(p => p > 0)
  return ps.length ? Math.min(...ps) : 0
}
