// (v1.0.1309) หน้าวิเคราะห์สต็อก — คำนวณจากข้อมูลจริงล้วน (เดิมใช้ "เป้าสต็อก" ที่แต่งขึ้นต่อรุ่น 4–10 คัน
// แล้วตัดสิน "วิกฤต/ต่ำ" + ปุ่มสั่งรถเขียนจำนวนจากเป้าปลอมนั้น, ขาย 30 วัน = 0 เสมอ, อายุสต็อก = 0 เสมอ)
// สต็อก = รถในระบบที่ยังไม่ขาย · ขาย 30 วัน = ใบจองที่ส่งมอบ/ตัดตัวเลขใน 30 วัน จับคู่รุ่นแบบเดียวกับตารางสีรถ
import { modelKey } from './orderNeeds.js'
import { isDelivered } from './bookingStatus.js'
import { stockAgeDays } from './stockAge.js'

const SOLD = ['sold', 'ขายแล้ว', 'delivered', 'ส่งมอบแล้ว']
const RESERVED = ['reserved', 'จอง', 'จองแล้ว']
export const AGING_BUCKETS = [['0-30 วัน', 0, 30], ['31-60 วัน', 31, 60], ['61-90 วัน', 61, 90], ['91-120 วัน', 91, 120], ['120+ วัน', 121, Infinity]]

const dayNum = iso => { const t = Date.parse(String(iso || '').slice(0, 10) + 'T00:00:00Z'); return Number.isFinite(t) ? t / 864e5 : NaN }
export const vehicleArrived = v => String(v.arrivedAt || v.stockDate || v.arrivedDate || '').slice(0, 10)

export function stockAnalysis({ vehicles = [], bookings = [], today } = {}) {
  const inStock = (vehicles || []).filter(v => v && !v.deleted && !SOLD.includes(v.status) && (v.brand || v.model))
  const t = dayNum(today)
  const byKey = new Map()
  for (const v of inStock) {
    const k = modelKey(v) || String(v.model || v.brand || '').toLowerCase()
    if (!byKey.has(k)) byKey.set(k, { key: k, name: `${v.brand || ''} ${v.model || ''}`.trim(), stock: 0, reserved: 0, sold30: 0, price: 0 })
    const m = byKey.get(k)
    m.stock++
    if (RESERVED.includes(v.status)) m.reserved++
    if (!m.price) m.price = Number(v.listPrice || v.salePrice || v.price) || 0
  }
  for (const b of (bookings || [])) {
    if (!b || b.deleted || !isDelivered(b)) continue
    const d = dayNum(b.cutDate || b.actualDeliveryDate)
    if (!(t - d >= 0 && t - d < 30)) continue
    const m = byKey.get(modelKey(b))
    if (m) m.sold30++
  }
  const models = [...byKey.values()].map(m => {
    const avail = m.stock - m.reserved
    const dos = m.sold30 > 0 ? Math.round(avail / (m.sold30 / 30)) : null
    const status = m.sold30 === 0 ? { label: 'ไม่มีขาย 30 วัน', color: 'secondary' }
      : dos < 15 ? { label: 'ใกล้หมด', color: 'danger' }
      : dos <= 60 ? { label: 'ปกติ', color: 'success' }
      : { label: 'เหลือเยอะ', color: 'warning' }
    return { ...m, avail, dos, status }
  })
  const aging = AGING_BUCKETS.map(([range]) => ({ range, count: 0, pct: 0 }))
  let aged = 0
  for (const v of inStock) {
    const age = stockAgeDays(vehicleArrived(v), today)
    if (age == null) continue
    aged++
    const i = AGING_BUCKETS.findIndex(([, a, b]) => age >= a && age <= b)
    if (i >= 0) aging[i].count++
  }
  aging.forEach(a => { a.pct = aged ? Math.round(a.count / aged * 100) : 0 })
  return { models, aging, noDate: inStock.length - aged }
}
