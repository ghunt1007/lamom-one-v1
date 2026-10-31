// ตัวเลขหลักของหน้าภาพรวม (Dashboard) — รวมสูตรไว้ที่เดียว ทุกการ์ดในหน้าใช้นิยามเดียวกัน ตัวเลขจึงตรงกันทุกช่อง
// · จองใหม่ = ใบจองที่ bookingDate อยู่ในเดือนนั้น (รวมที่ถอนไปแล้ว เพราะเป็น "ยอดเปิดใบจอง")
// · มูลค่า/Margin = เฉพาะใบจองที่ยังไม่ถอน/ไม่ยกเลิก (เดิมรวมใบที่ถอนแล้วด้วย ทำให้มูลค่าสูงเกินจริง)
// · ส่งมอบ = ส่งมอบแล้ว + ตัดตัวเลขรอส่งมอบ นับตามวันตัดตัวเลข (cutDate) เหมือนรายงาน LINE
import { DELIVERED_STATUSES } from './deliveryIncome.js'

export const CANCELLED_STATUSES = ['ถอนจอง', 'ยกเลิก']

export const isCancelled = b => CANCELLED_STATUSES.includes(b?.status)
export const isDelivered = b => DELIVERED_STATUSES.includes(b?.status)
export const deliveredMonth = b => String(b?.cutDate || b?.actualDeliveryDate || '').slice(0, 7)

export function shiftYm(ym, delta) {
  const [y, m] = String(ym).split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
}

// ช่วงเวลา: เดือน / ไตรมาส / ปี ที่ครอบเดือนที่เลือก → รายการเดือน (YYYY-MM) ในช่วงนั้น
export function periodMonths(ym, period = 'month') {
  const [y, m] = String(ym).split('-').map(Number)
  const mk = mm => `${y}-${String(mm).padStart(2, '0')}`
  if (period === 'year') return Array.from({ length: 12 }, (_, i) => mk(i + 1))
  if (period === 'quarter') { const q0 = Math.floor((m - 1) / 3) * 3 + 1; return [mk(q0), mk(q0 + 1), mk(q0 + 2)] }
  return [ym]
}

// ช่วงก่อนหน้าที่ยาวเท่ากัน (ไตรมาสก่อน / ปีก่อน)
export function prevPeriodAnchor(ym, period = 'month') {
  return shiftYm(ym, period === 'year' ? -12 : period === 'quarter' ? -3 : -1)
}

const TH_M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
export function periodLabel(ym, period = 'month') {
  const [y, m] = String(ym).split('-').map(Number)
  if (period === 'year') return `ปี ${y + 543}`
  if (period === 'quarter') return `ไตรมาส ${Math.floor((m - 1) / 3) + 1}/${y + 543}`
  return `${TH_M[m - 1]} ${y + 543}`
}

// ใบจองที่อยู่เบื้องหลังตัวเลขแต่ละช่อง — ใช้ทั้งนับและแสดงรายการ (กดตัวเลขแล้วเห็นว่านับใบไหนบ้าง)
export function statRows(bookings = [], months, key) {
  const set = new Set(Array.isArray(months) ? months : [months])
  const bookedIn = bookings.filter(b => set.has(String(b.bookingDate || '').slice(0, 7)))
  if (key === 'booked') return bookedIn
  if (key === 'value' || key === 'margin' || key === 'active') return bookedIn.filter(b => !isCancelled(b))
  if (key === 'withdrawn') return bookedIn.filter(isCancelled)
  if (key === 'delivered') return bookings.filter(b => isDelivered(b) && set.has(deliveredMonth(b)))
  if (key === 'open') return openBookings(bookings)
  return []
}

export function rangeStats(bookings = [], months) {
  const live = statRows(bookings, months, 'active')
  const booked = statRows(bookings, months, 'booked').length
  return {
    booked,
    active: live.length,
    withdrawn: booked - live.length,
    delivered: statRows(bookings, months, 'delivered').length,
    value: live.reduce((s, b) => s + (Number(b.price) || 0), 0),
    margin: live.reduce((s, b) => s + (Number(b.margin) || 0), 0),
  }
}

export function monthStats(bookings = [], ym) {
  return rangeStats(bookings, [ym])
}

// ใบจองที่ยังไม่จบ (ยังไม่ส่งมอบ/ตัดตัวเลข และไม่ถอน) — ยอดค้างจริงสะสมทุกเดือน
export function openBookings(bookings = []) {
  return bookings.filter(b => !isCancelled(b) && !isDelivered(b))
}

// ค่าย้อนหลัง n เดือน (เก่า → ใหม่) สำหรับกราฟเส้นเล็กในการ์ดตัวเลข
export function monthSeries(bookings, ym, n, key) {
  return Array.from({ length: n }, (_, i) => monthStats(bookings, shiftYm(ym, i - n + 1))[key])
}

// วันที่รถเข้าสต็อก — รถส่วนใหญ่มีแต่ arrivedAt ไม่มี createdAt (เดิมใช้ createdAt อย่างเดียว แจ้งเตือนรถค้างจึงไม่เคยขึ้น)
export const stockSince = v => v?.arrivedAt || v?.createdAt || null

// % เปลี่ยนแปลงเทียบเดือนก่อน: null = เทียบไม่ได้ (เดือนก่อนเป็น 0)
export function pctChange(cur, prev) {
  if (!prev) return null
  return (cur - prev) / prev * 100
}

// เส้นกราฟเล็ก (sparkline) เป็น SVG path — ไม่มีข้อมูลเลยคืน ''
export function sparkPath(values, w = 100, h = 28) {
  if (!values?.length || !values.some(v => v)) return ''
  const max = Math.max(...values), min = Math.min(...values, 0)
  const span = max - min || 1
  const step = values.length > 1 ? w / (values.length - 1) : 0
  return values.map((v, i) => `${i ? 'L' : 'M'}${(i * step).toFixed(1)},${(h - 2 - (v - min) / span * (h - 4)).toFixed(1)}`).join(' ')
}

// ขั้นของใบจองที่ยังไม่จบ เรียงตามลำดับงานจริง (ไฟแนนซ์ → รอรถ → เบิกรถ → ส่งมอบ) — ใช้วาด "เส้นทางใบจอง"
// บนหน้าภาพรวม ให้เห็นว่ารถค้างอยู่ขั้นไหน กี่คัน มูลค่าเท่าไร ค้างเฉลี่ยกี่วัน
export const PIPELINE_ORDER = ['จัดไฟแนนซ์ก่อนจอง', 'รอผลไฟแนนซ์', 'ผ่านไฟแนนซ์รอจอง', 'ยอดจองคงค้าง', 'รอรถ', 'ผ่านไฟแนนซ์รอเบิก', 'ซื้อสดรอเบิกรถ', 'รอส่งมอบ', 'ตัดตัวเลขรอส่งมอบ']
export function pipelineStages(bookings = [], today = '') {
  const t = Date.parse(today) || Date.now()
  const age = b => { const d = Date.parse(b.bookingDate); return Number.isFinite(d) ? Math.max(0, Math.floor((t - d) / 86400000)) : null }
  const live = bookings.filter(b => !isCancelled(b) && b.status !== 'ส่งมอบแล้ว')
  const known = new Set(PIPELINE_ORDER)
  const groups = PIPELINE_ORDER.map(status => ({ status, rows: live.filter(b => b.status === status) }))
  const other = live.filter(b => !known.has(b.status))
  if (other.length) groups.push({ status: 'อื่นๆ', rows: other })
  return groups.filter(g => g.rows.length).map(g => {
    const ages = g.rows.map(age).filter(a => a != null)
    return {
      status: g.status, rows: g.rows, count: g.rows.length,
      value: g.rows.reduce((s, b) => s + (Number(b.price) || 0), 0),
      avgAge: ages.length ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length) : null,
      maxAge: ages.length ? Math.max(...ages) : null,
    }
  })
}

// อันดับเซลส์: ส่งมอบ (นับตามวันตัดตัวเลข) + จองใหม่ ในช่วงเดือนที่เลือก — ชื่อว่าง = "ไม่ระบุ"
export function salesBoard(bookings = [], months) {
  const by = {}
  const row = n => (by[n] = by[n] || { name: n, delivered: 0, booked: 0, income: 0, value: 0 })
  statRows(bookings, months, 'delivered').forEach(b => {
    const r = row(String(b.salesName || '').trim() || 'ไม่ระบุ')
    r.delivered++; r.income += b.totalIncome != null ? Number(b.totalIncome) || 0 : Number(b.price) || 0
  })
  statRows(bookings, months, 'active').forEach(b => {
    const r = row(String(b.salesName || '').trim() || 'ไม่ระบุ')
    r.booked++; r.value += Number(b.price) || 0
  })
  return Object.values(by).sort((a, b) => b.delivered - a.delivered || b.booked - a.booked || b.income - a.income)
}
