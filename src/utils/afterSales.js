// นัดดูแลหลังการขาย — ส่งมอบรถแล้ว (กดเปลี่ยนสถานะ/บันทึกใบจอง/ปฏิทินส่งมอบ) ระบบสร้างนัดใน `followups` ให้ 3 ครั้ง:
// +7 วัน ถามความพึงพอใจ, +30 วัน ขอรีวิว/แนะนำเพื่อน, +180 วัน ชวนเข้าเช็กระยะครั้งแรก — ผู้ติดตาม = เซลส์ในใบจอง
// ใส่ sourceBookingId ไว้ หน้า Follow-up จึงไม่สร้างนัด "หลังส่งมอบรถ" แบบชั่วคราวซ้ำให้อีก และติด afterSalesScheduled
// ที่ใบจอง กันสร้างซ้ำเมื่อแก้ใบจองเดิม ส่งมอบเก่าเกิน 14 วัน (เช่น แก้ข้อมูลย้อนหลัง) จะไม่สร้างนัดย้อนหลังให้
import { createDoc, updateDocData } from '../core/db.js'
import { myEffectiveCompanyId } from '../core/companyScope.js'
import { todayBangkok } from './format.js'
import { addDaysTo } from './leadFollowups.js'

export const AFTER_SALES_PLAN = [
  { days: 7, type: 'call', purpose: 'หลังส่งมอบรถ', note: 'โทรถามความพึงพอใจหลังรับรถ 7 วัน การใช้งาน/การชาร์จ มีปัญหาอะไรไหม' },
  { days: 30, type: 'line', purpose: 'ตรวจสอบความพึงพอใจ', note: 'ขอรีวิว/ให้คะแนน และชวนแนะนำเพื่อนที่สนใจรถ' },
  { days: 180, type: 'call', purpose: 'แจ้งบริการถึงกำหนด', note: 'ครบ 6 เดือน ชวนนัดเข้าเช็กระยะครั้งแรกที่ศูนย์บริการ' },
]
const MAX_BACKDATE_DAYS = 14

export function buildAfterSalesFollowups(booking, today = todayBangkok()) {
  if (!booking?.id || booking.afterSalesScheduled || booking.deleted) return []
  const delivered = /^\d{4}-\d{2}-\d{2}/.test(booking.actualDeliveryDate || '') ? booking.actualDeliveryDate.slice(0, 10) : today
  if (delivered > today || addDaysTo(delivered, MAX_BACKDATE_DAYS) < today) return []
  return AFTER_SALES_PLAN.map(p => ({
    customerId: booking.customerId || '', sourceBookingId: booking.id,
    customerName: booking.custName || 'ลูกค้า', phone: booking.custPhone || '',
    vehicleModel: [booking.brand, booking.model].filter(Boolean).join(' '),
    salesperson: booking.salesName || '', type: p.type, purpose: p.purpose, note: p.note,
    dueDate: addDaysTo(delivered, p.days), status: 'pending', result: '', afterSales: true,
  }))
}

// ไม่ throw — สร้างนัดไม่สำเร็จต้องไม่ทำให้การส่งมอบล้ม คืนจำนวนนัดที่สร้างได้
export async function scheduleAfterSales(booking) {
  const list = buildAfterSalesFollowups(booking)
  if (!list.length) return 0
  let n = 0
  for (const f of list) {
    try { await createDoc('followups', { ...f, companyId: booking.companyId ?? myEffectiveCompanyId() }); n++ } catch { /* ข้าม */ }
  }
  if (n) {
    try { await updateDocData('bookings', booking.id, { afterSalesScheduled: true }); booking.afterSalesScheduled = true } catch { /* ข้าม */ }
  }
  return n
}
