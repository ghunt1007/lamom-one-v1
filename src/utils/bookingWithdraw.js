// ลูกค้าถอนจอง — ไม่ปล่อยให้ลูกค้าค้างสถานะ "จองแล้ว" ทั้งที่ไม่มีใบจองแล้ว: พาลูกค้ากลับเป็น Prospect
// (เฉพาะถ้าใบจองที่ผูกไว้คือใบนี้ — ถ้าผูกใบอื่นอยู่แปลว่ามีใบจองใหม่แล้ว ไม่ไปแตะ) และนัดเซลส์โทรกลับ
// ภายใน WIN_BACK_DAYS วัน เพื่อเสนอทางเลือกใหม่ (รุ่นอื่น/ไฟแนนซ์อื่น/โปร) ก่อนลูกค้าไปซื้อที่อื่น
import { readDoc, updateDocData, createDoc } from '../core/db.js'
import { myEffectiveCompanyId } from '../core/companyScope.js'
import { todayBangkok } from './format.js'
import { addDays } from './customerFollowups.js'

export const WIN_BACK_DAYS = 3

export function withdrawCustomerPatch(customer, bookingId, now = new Date().toISOString()) {
  if (!customer || customer.deleted || customer.stage !== 'booking') return null
  if (customer.bookingId && customer.bookingId !== bookingId) return null
  return { stage: 'pp', stageChangedAt: now, bookingId: null }
}

export function buildWinBackFollowup(b, reason, today = todayBangkok()) {
  return {
    customerId: b.customerId || '', customerName: b.custName || 'ลูกค้า',
    phone: b.phone || b.custPhone || '', vehicleModel: [b.brand, b.model].filter(Boolean).join(' '),
    salesperson: b.salesName || '', type: 'call', purpose: 'ทั่วไป',
    note: `ลูกค้าถอนจอง${reason ? ` (${String(reason).trim()})` : ''} — โทรเสนอทางเลือกใหม่ เช่น รุ่นอื่น ไฟแนนซ์อื่น หรือโปรโมชัน`,
    dueDate: addDays(today, WIN_BACK_DAYS), status: 'pending', result: '', winBack: true,
  }
}

// ไม่ throw — ถอนจองต้องสำเร็จแม้ขั้นนี้ล้ม คืน { reverted, followup }
export async function afterWithdraw(b, reason) {
  const out = { reverted: false, followup: false }
  if (!b?.customerId) return out
  try {
    const c = await readDoc('customers', b.customerId)
    const patch = withdrawCustomerPatch(c, b.id)
    if (patch) { await updateDocData('customers', b.customerId, patch); out.reverted = true }
  } catch { /* ข้าม */ }
  try {
    await createDoc('followups', { ...buildWinBackFollowup(b, reason), companyId: b.companyId ?? myEffectiveCompanyId() })
    out.followup = true
  } catch { /* ข้าม */ }
  return out
}
