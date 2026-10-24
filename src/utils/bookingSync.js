// ซิงก์ข้อมูลที่ผูกกับใบจองเมื่อสถานะเปลี่ยน — ใช้ทั้งหน้าใบจอง (Bookings.js) และปฏิทินส่งมอบ (DeliveryCalendar.js)
import { listAllDocs, updateDocData } from '../core/db.js'
import { companyScopeFilters } from '../core/companyScope.js'

// ── เมื่อใบจองถูกอัปเดตสถานะเป็น "ส่งมอบแล้ว" และมี customerId เชื่อมอยู่ → อัปเดตลูกค้าเป็น stage 'delivered' ──
export async function maybeMarkCustomerDelivered(booking) {
  if (!booking?.customerId) return
  try {
    await updateDocData('customers', booking.customerId, { stage: 'delivered', stageChangedAt: new Date().toISOString() })
  } catch { /* ไม่กระทบการบันทึกใบจองหลัก ถ้าอัปเดตลูกค้าไม่สำเร็จ */ }
}

// (v1.0.543) เชื่อมใบจอง ↔ สต็อกรถด้วย VIN — เดิมส่งมอบรถในใบจองแล้ว รถคันเดียวกันในหน้าสต็อกยังเป็น "พร้อมขาย"
// อยู่ ตัวเลขสต็อกบน Dashboard/หน้าสต็อก/อายุสต็อก จึงไม่ตรงกับยอดขายจริง: ส่งมอบแล้ว → ขายแล้ว, ใบจองที่ยังเดินอยู่ →
// จองแล้ว (เฉพาะคันที่ยังพร้อมขาย), ถอนจอง → กลับเป็นพร้อมขาย (เฉพาะคันที่ค้างสถานะจองแล้ว)
export function stockStatusForBooking(bookingStatus, vehicleStatus) {
  if (bookingStatus === 'ส่งมอบแล้ว') return vehicleStatus === 'sold' ? null : 'sold'
  if (bookingStatus === 'ถอนจอง') return vehicleStatus === 'reserved' ? 'available' : null
  return vehicleStatus === 'available' ? 'reserved' : null
}
export async function syncStockForBookings(list, vehiclesCache) {
  const withVin = (list || []).filter(b => String(b?.vin || '').trim())
  if (!withVin.length) return 0
  let vehicles = vehiclesCache
  if (!vehicles) { try { vehicles = (await listAllDocs('vehicles', companyScopeFilters(), 'arrivedAt', 'desc', 500)).filter(v => !v.deleted) } catch { return 0 } }
  const byVin = new Map(vehicles.filter(v => v.vin).map(v => [String(v.vin).trim().toUpperCase(), v]))
  let n = 0
  for (const b of withVin) {
    const v = byVin.get(String(b.vin).trim().toUpperCase())
    const next = v && stockStatusForBooking(b.status, v.status)
    if (!next) continue
    try { await updateDocData('vehicles', v.id, { status: next }); v.status = next; n++ } catch { /* ไม่กระทบการบันทึกใบจอง */ }
  }
  return n
}
