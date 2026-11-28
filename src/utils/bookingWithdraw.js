import { carOf } from './carLabel.js'
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
    phone: b.phone || b.custPhone || '', vehicleModel: carOf(b),
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
  // (v1.0.1502) ย้ายไปจองใบใหม่ = ลูกค้ายังอยู่ ไม่ต้องนัดโทรตามกลับ
  if (b.cancelCategory === 'moved') return out
  try {
    await createDoc('followups', { ...buildWinBackFollowup(b, reason), companyId: b.companyId ?? myEffectiveCompanyId() })
    out.followup = true
  } catch { /* ข้าม */ }
  return out
}

// (v1.0.1502) หมวดเหตุผลถอนจอง — เลือกได้ 1 หมวด (ใช้นับสถิติ) + ข้อความรายละเอียดเหมือนเดิม
// key ตรงกับ classifyLostReason() ยกเว้น moved = ย้ายไปจองใบใหม่ (ไม่ใช่ลูกค้าหาย)
export const WITHDRAW_CATEGORIES = [
  ['finance', 'ไฟแนนซ์ไม่ผ่าน'], ['model', 'รอรถนาน / ไม่มีรุ่น-สี'], ['competitor', 'ไปซื้อยี่ห้อ/ร้านอื่น'],
  ['price', 'ราคา / งบไม่พอ'], ['changed_mind', 'เปลี่ยนใจ / ปัญหาการเงิน'], ['moved', 'ย้ายไปจองใบใหม่'],
  ['timing', 'ยังไม่พร้อม'], ['no_contact', 'ติดต่อไม่ได้'], ['other', 'อื่นๆ'],
]
export const withdrawCategoryLabel = k => (WITHDRAW_CATEGORIES.find(([v]) => v === k) || [])[1] || ''

// ข้อมูลที่บันทึกตอนกด ❌ ถอนจอง — ยอดคืนสุทธิ = เงินจอง − ค่าดำเนินการที่หัก (ไม่ติดลบ)
export function withdrawPatch({ cancelDate, reason, category = '', competitor = '', newBookingNo = '', deposit = 0, deduct = 0, hasMoney = false, by = '', now = new Date().toISOString() }) {
  const dep = Math.max(0, Number(deposit) || 0)
  const ded = hasMoney ? Math.min(dep, Math.max(0, Number(deduct) || 0)) : 0
  const net = hasMoney ? dep - ded : 0
  return {
    status: 'ถอนจอง', cancelDate, cancelReason: String(reason || '').trim(),
    cancelCategory: category || '',
    cancelCompetitor: category === 'competitor' ? String(competitor || '').trim() : '',
    newBookingNo: category === 'moved' ? String(newBookingNo || '').trim() : '',
    refundDeduct: ded, refundAmount: net,
    refundStatus: net > 0 ? 'รอคืนเงิน' : 'ไม่ต้องคืน',
    depositRefunded: net > 0 ? 'N' : '',
    cancelledBy: by || '', cancelledAt: now, updatedAt: now,
  }
}
