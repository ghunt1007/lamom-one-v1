// (v1.0.925) เรียงแถวในเครื่อง — ใช้ตอนฐานข้อมูลยังไม่มี "ดัชนี" (index) สำหรับคำค้นแบบกรอง+เรียง
// เดิมคำค้นแบบนั้น error แล้วหน้าโชว์ว่างเงียบๆ (เช่น เซลส์ที่ถูกจำกัดบริษัทเปิดหน้า Funnel/War Room เห็น 0)
const keyOf = v => {
  if (v == null) return null
  if (typeof v === 'number') return v
  if (typeof v === 'string') return v
  if (typeof v.toMillis === 'function') { try { return v.toMillis() } catch { return null } }
  if (typeof v.seconds === 'number') return v.seconds * 1000 + Math.floor((v.nanoseconds || 0) / 1e6)
  if (v instanceof Date) return v.getTime()
  return String(v)
}

export function sortRows(rows, field, dir = 'desc') {
  const sign = dir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    const x = keyOf(a?.[field]), y = keyOf(b?.[field])
    if (x === y) return 0
    if (x == null) return 1 // ไม่มีค่า → ไว้ท้ายเสมอ
    if (y == null) return -1
    if (typeof x === typeof y) return (x < y ? -1 : 1) * sign
    return (String(x) < String(y) ? -1 : 1) * sign
  })
}

export const isMissingIndexError = e => e?.code === 'failed-precondition' || /requires an index/i.test(String(e?.message || ''))
