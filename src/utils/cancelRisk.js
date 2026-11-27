// (v1.0.1453) ใบจองเสี่ยงถอน — จากประวัติจริงของร้าน: ใบจองที่ "ค้างมาถึงอายุ X วัน" ในอดีต สุดท้ายถอนกี่ %
// เทียบกับอัตราถอนรวม → อายุที่ถอนสูงกว่าปกติชัดเจน (≥ เฉลี่ย + 10 จุด และ ≥ 1.5 เท่า) ใบที่เปิดอยู่และอายุถึงแล้ว = เสี่ยง
// นับเฉพาะใบที่จบแล้ว (ถอน: มีวันถอน · ส่งมอบ: มีวันตัดตัวเลข) จองใน 1 ปีล่าสุด · กลุ่มอายุละ < 10 ใบ ไม่ใช้ · ไม่พอ = null
import { isCancelled, isDelivered, isOpenBooking } from './bookingStatus.js'
import { carOf } from './carLabel.js'

const DAY = 86400000
const ms = v => { const t = Date.parse(String(v || '').slice(0, 10)); return Number.isFinite(t) ? t : null }
export const RISK_AGES = [30, 45, 60, 90, 120]

export function cancelRisk(bookings = [], today, { minAge = 10, minTotal = 20 } = {}) {
  const t0 = ms(today)
  if (t0 == null) return null
  const live = (bookings || []).filter(b => b && !b.deleted)
  const settled = []
  for (const b of live) {
    const s = ms(b.bookingDate)
    if (s == null || s < t0 - 365 * DAY || s > t0) continue
    const end = isCancelled(b) ? ms(b.cancelDate) : isDelivered(b) ? ms(b.cutDate || b.actualDeliveryDate) : null
    if (end == null || end < s) continue
    settled.push({ age: (end - s) / DAY, cancel: isCancelled(b) })
  }
  if (settled.length < minTotal) return null
  const overall = settled.filter(x => x.cancel).length / settled.length
  const ages = RISK_AGES.map(a => {
    const still = settled.filter(x => x.age >= a)
    return { age: a, n: still.length, rate: still.length ? still.filter(x => x.cancel).length / still.length : 0 }
  }).filter(g => g.n >= minAge)
  const hot = ages.find(g => g.rate >= overall + 0.1 && g.rate >= overall * 1.5)
  if (!hot) return { overall, n: settled.length, ages, threshold: null, risky: [] }
  const risky = live.filter(b => isOpenBooking(b) && ms(b.bookingDate) != null && (t0 - ms(b.bookingDate)) / DAY >= hot.age)
    .map(b => ({ b, age: Math.round((t0 - ms(b.bookingDate)) / DAY) }))
    .sort((a, b) => b.age - a.age)
  return { overall, n: settled.length, ages, threshold: hot, risky }
}

const pct = v => Math.round(v * 100) + '%'
export function cancelRiskText(r, { mine = () => true } = {}) {
  if (!r) return '⚠️ ยังบอกไม่ได้ว่าใบจองไหนเสี่ยงถอน — ต้องมีใบจองที่จบแล้ว (ถอน/ส่งมอบ) พร้อมวันที่ ใน 1 ปีล่าสุด ≥ 20 ใบ'
  if (!r.threshold) return `✅ จากใบจองที่จบแล้ว ${r.n} ใบ (ถอน ${pct(r.overall)}) ยังไม่เห็นช่วงอายุใบจองที่ถอนสูงผิดปกติ — ยังไม่มีใบที่เข้าข่ายเสี่ยง`
  const list = r.risky.filter(x => mine(x.b.salesName, x.b))
  const head = `⚠️ ใบจองที่ค้างเกิน ${r.threshold.age} วัน ในอดีตถอน ${pct(r.threshold.rate)} (ร้านเฉลี่ย ${pct(r.overall)} · จาก ${r.threshold.n} ใบ)`
  if (!list.length) return head + '\n✅ ตอนนี้ไม่มีใบจองที่ค้างนานถึงช่วงเสี่ยง'
  return [head, `📝 ใบที่เปิดอยู่และค้างถึงช่วงนี้ ${list.length} ใบ — โทรเช็กความตั้งใจ/อัปเดตกำหนดรถ:`,
    ...list.slice(0, 8).map(x => `• ${String(x.b.custName || 'ลูกค้า').trim()} · ${carOf(x.b) || x.b.model || ''} · จองมา ${x.age} วัน${x.b.status ? ' · ' + x.b.status : ''}${x.b.salesName ? ' · 👤 ' + x.b.salesName : ''}`),
    ...(list.length > 8 ? [`… และอีก ${list.length - 8} ใบ`] : [])].join('\n')
}
