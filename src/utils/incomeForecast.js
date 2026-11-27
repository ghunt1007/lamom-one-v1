// (v1.0.1416) คาดรายได้/ค่าคอมสิ้นเดือน — ต่อยอดจากคาดการณ์ส่งมอบ (deliveryForecast)
// รายได้ที่กรอกจริงเดือนนี้ + (คันที่คาดว่าจะส่งมอบเพิ่ม × รายได้เฉลี่ยต่อคันของ 3 เดือนก่อน)
// คันที่ส่งมอบแล้วแต่ยังไม่กรอกรายได้ นับเป็นค่าเฉลี่ยด้วย · ประวัติไม่ถึง minCars คัน → คืน null (ไม่เดา)
import { deliveryForecast } from './deliveryForecast.js'
import { summarizeSalesIncome, deliveredMonth } from './salesIncome.js'
import { DELIVERED_STATUSES } from './bookingStatus.js'
import { shiftYm } from './dashStats.js'

const n = v => Number(v) || 0

// เฉลี่ยต่อคันจากใบที่ส่งมอบใน `months` เดือนเต็มก่อนเดือนนี้ และกรอกรายได้แล้ว
export function incomePerCar(bookings = [], today, months = 3) {
  const ym = String(today || '').slice(0, 7)
  const span = new Set(Array.from({ length: months }, (_, i) => shiftYm(ym, -(i + 1))))
  const rows = (bookings || []).filter(b => b && !b.deleted && DELIVERED_STATUSES.includes(b.status) && span.has(deliveredMonth(b)) && n(b.totalIncome) > 0)
  if (!rows.length) return { n: 0, income: 0, com70: 0, comFinance: 0 }
  const avg = k => rows.reduce((s, b) => s + n(b[k]), 0) / rows.length
  return { n: rows.length, income: avg('totalIncome'), com70: avg('com70'), comFinance: avg('comFinance') }
}

export function incomeForecast({ bookings = [], today, months = 3, minCars = 3, fc = null } = {}) {
  const per = incomePerCar(bookings, today, months)
  if (per.n < minCars) return null
  const f = fc || deliveryForecast({ bookings, today })
  const cur = summarizeSalesIncome(bookings, String(today).slice(0, 7)).total
  const more = Math.max(0, f.expectedRaw - f.delivered)
  const lo = Math.max(0, f.worst - f.delivered), hi = Math.max(0, f.best - f.delivered)
  const base = k => cur[k] + cur.missing * per[k === 'income' ? 'income' : k]
  const r = v => Math.abs(v) >= 10000 ? Math.round(v / 1000) * 1000 : Math.round(v) // ค่าคาด ปัดหลักพันให้ไม่ดูแม่นเกินจริง
  return {
    soFar: cur.income, missing: cur.missing, per, months, moreCars: Math.round(more * 10) / 10,
    expected: r(base('income') + more * per.income),
    low: r(base('income') + lo * per.income),
    high: r(base('income') + hi * per.income),
    com70: r(base('com70') + more * per.com70),
  }
}

const baht = v => '฿' + Math.round(v).toLocaleString('en-US')

export function incomeForecastLine(x) {
  if (!x) return ''
  return `🔮 คาดรายได้สิ้นเดือน ≈ ${baht(x.expected)} (${baht(x.low)}–${baht(x.high)}) · คอมเซลส์ ≈ ${baht(x.com70)}`
}

export function incomeForecastNote(x) {
  if (!x) return ''
  return `คาดส่งมอบเพิ่ม ≈ ${x.moreCars} คัน × เฉลี่ยคันละ ${baht(x.per.income)} (จาก ${x.per.n} คันใน ${x.months} เดือนก่อน)${x.missing ? ` · รวม ${x.missing} คันที่ยังไม่กรอกรายได้` : ''}`
}
