// (v1.0.1104) ติดตามป้ายทะเบียนจาก "ใบจอง" โดยตรง (แหล่งข้อมูลเดียวกับ Sheet) — ไม่มีรายการป้ายแดงสมมติอีกต่อไป
// ฟังก์ชันล้วน ทดสอบได้
const DAY = 86400e3
const dnum = d => /^\d{4}-\d{2}-\d{2}/.test(d || '') ? Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / DAY : null
export const PLATE_LATE_DAYS = 45
export const deliveredOn = b => String(b?.actualDeliveryDate || b?.deliveryDate || '').slice(0, 10)
const isDelivered = b => b && !b.deleted && (b.status === 'ส่งมอบแล้ว' || b.status === 'delivered')
const clean = v => String(v || '').trim()
const plateKey = v => clean(v).replace(/[\s-]/g, '')

/** แถวรถที่ส่งมอบแล้วในช่วง days วัน: { b, age, red, white, late, dupRed } เรียงคันที่รอนานสุดขึ้นก่อน */
export function plateRows(bookings = [], { today, days = 180 } = {}) {
  const t0 = dnum(today)
  const rows = bookings.filter(isDelivered).map(b => {
    const d = dnum(deliveredOn(b))
    return { b, age: d == null || t0 == null ? null : t0 - d, red: clean(b.redPlate), white: clean(b.whitePlate) }
  }).filter(r => r.age != null && r.age >= 0 && r.age <= days)
  // ป้ายแดงแผ่นเดียวกันที่ยังใช้อยู่กับรถมากกว่า 1 คัน (ยังไม่ได้ป้ายขาว)
  const use = {}
  rows.forEach(r => { if (r.red && !r.white) { const k = plateKey(r.red); use[k] = (use[k] || 0) + 1 } })
  rows.forEach(r => { r.late = !r.white && r.age > PLATE_LATE_DAYS; r.dupRed = !!(r.red && !r.white && use[plateKey(r.red)] > 1) })
  return rows.sort((x, y) => (!!x.white - !!y.white) || y.age - x.age)
}

export function plateSummary(rows = []) {
  const pending = rows.filter(r => !r.white)
  return {
    pending: pending.length,
    late: pending.filter(r => r.late).length,
    done: rows.length - pending.length,
    redInUse: new Set(pending.filter(r => r.red).map(r => plateKey(r.red))).size,
    dup: pending.filter(r => r.dupRed).length,
    noRed: pending.filter(r => !r.red).length,
  }
}

export function filterPlateRows(rows = [], { view = 'pending', q = '' } = {}) {
  const s = String(q || '').toLowerCase().replace(/\s+/g, '')
  return rows.filter(r => view === 'all' ? true : view === 'done' ? !!r.white : view === 'late' ? r.late : !r.white)
    .filter(r => !s || [r.b.custName, r.b.customerName, r.b.model, r.b.vin, r.red, r.white, r.b.salesName, r.b.bookingNo]
      .some(v => String(v || '').toLowerCase().replace(/\s+/g, '').includes(s)))
}
