// สรุปรายได้/ค่าคอมรายเซลส์ต่อเดือน จากตัวเลขที่กรอกจริงในใบจอง (มาร์จิ้น, งบการตลาด, คอมเซลส์, คอมไฟแนนซ์)
// ต่างจากหน้า Commission (/finance/commission) ที่ "คำนวณ" ค่าคอมจากกติกา — หน้านี้รวมยอดที่กรอกไว้ตอนส่งมอบตรงๆ
// นิยามเดียวกับรายงานประจำวัน: ส่งมอบ = ส่งมอบแล้ว/ตัดตัวเลขรอส่งมอบ นับเดือนตามวันตัดตัวเลข (หรือวันส่งมอบจริง)
import { DELIVERED_STATUSES, needsIncome } from './deliveryIncome.js'

const CANCELLED = ['ถอนจอง', 'ยกเลิก']
const n = v => Number(v) || 0

export function deliveredMonth(b) { return (b.cutDate || b.actualDeliveryDate || '').slice(0, 7) }

export function summarizeSalesIncome(bookings, month) {
  const rows = {}
  const seller = name => {
    const key = (name || '').trim() || '(ไม่ระบุเซลส์)'
    return (rows[key] ||= { name: key, booked: 0, cancelled: 0, delivered: 0, missing: 0, marginLeft: 0, com70: 0, comFinance: 0, income: 0, cars: [] })
  }
  ;(bookings || []).filter(b => b && !b.deleted).forEach(b => {
    if ((b.bookingDate || '').startsWith(month) && !CANCELLED.includes(b.status)) seller(b.salesName).booked++
    // ถอนจอง/ยกเลิกในเดือนนี้ (นับตามวันถอนจริง ถ้าไม่มีใช้วันจอง)
    if (CANCELLED.includes(b.status) && (b.cancelDate || b.bookingDate || '').startsWith(month)) seller(b.salesName).cancelled++
    if (DELIVERED_STATUSES.includes(b.status) && deliveredMonth(b) === month) {
      const r = seller(b.salesName)
      r.delivered++
      r.marginLeft += n(b.marginLeft ?? (n(b.margin) - n(b.budgetUsed)))
      r.com70 += n(b.com70)
      r.comFinance += n(b.comFinance)
      r.income += n(b.totalIncome)
      if (needsIncome(b)) r.missing++
      r.cars.push(b)
    }
  })
  const list = Object.values(rows).sort((a, b) => b.income - a.income || b.delivered - a.delivered || a.name.localeCompare(b.name))
  const total = list.reduce((t, r) => {
    ;['booked', 'cancelled', 'delivered', 'missing', 'marginLeft', 'com70', 'comFinance', 'income'].forEach(k => { t[k] += r[k] })
    return t
  }, { booked: 0, cancelled: 0, delivered: 0, missing: 0, marginLeft: 0, com70: 0, comFinance: 0, income: 0 })
  return { rows: list, total }
}

// 12 เดือนล่าสุด (ล่าสุดก่อน) จากเดือนปัจจุบัน 'YYYY-MM'
export function lastMonths(current, count = 12) {
  const [y, m] = current.split('-').map(Number)
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - i, 1))
    return d.toISOString().slice(0, 7)
  })
}
