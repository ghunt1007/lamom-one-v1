// ส่งใบเสนอราคาให้ลูกค้าแล้ว → นัดโทรถามผลอีก 2 วันให้เซลส์ที่ทำใบเสนอราคา (ขึ้นในหน้า Follow-up, งานของฉันวันนี้, เตือน 9 โมง)
import { createDoc } from '../core/db.js'
import { myEffectiveCompanyId } from '../core/companyScope.js'
import { todayBangkok, formatCurrency } from './format.js'
import { addDaysTo } from './leadFollowups.js'

export const QUOTE_FOLLOWUP_DAYS = 2

export function buildQuoteFollowup(q, today = todayBangkok()) {
  if (!q?.id || ['sent', 'accepted', 'rejected', 'expired'].includes(q.status)) return null
  const price = Number(q.finalPrice) || 0
  return {
    customerId: q.customerId || '', sourceQuotationId: q.id,
    customerName: q.customerName || 'ลูกค้า', phone: q.phone || '', vehicleModel: q.vehicleLabel || '',
    salesperson: q.salesperson || '', type: 'call', purpose: 'ติดตามใบเสนอราคา',
    note: `ส่งใบเสนอราคาไปแล้ว ${QUOTE_FOLLOWUP_DAYS} วัน${price ? ` (ราคาสุทธิ ${formatCurrency(price)}${q.monthlyPayment ? `, ผ่อน ${formatCurrency(q.monthlyPayment)}/เดือน` : ''})` : ''} — โทรถามผล ตอบข้อสงสัย ชวนจอง`,
    dueDate: addDaysTo(today, QUOTE_FOLLOWUP_DAYS), status: 'pending', result: '',
  }
}

export async function scheduleQuoteFollowup(q) {
  const f = buildQuoteFollowup(q)
  if (!f) return false
  try { await createDoc('followups', { ...f, companyId: q.companyId ?? myEffectiveCompanyId() }); return true } catch { return false }
}
