// (v1.0.1017) ลูกค้าไม่มาตามนัดเข้าโชว์รูม → นัดโทรนัดใหม่วันนี้ให้เซลส์เจ้าของนัด
// ขึ้นในหน้า Follow-up, งานของฉันวันนี้ และข้อความเตือน 09:00 — ไม่ต้องจำเองว่าต้องโทรใคร
import { createDoc, updateDocData } from '../core/db.js'
import { myEffectiveCompanyId } from '../core/companyScope.js'
import { todayBangkok } from './format.js'

export function buildNoShowFollowup(a, { customerId = '', today = todayBangkok() } = {}) {
  if (!a?.id || a.noshowFollowupAt) return null
  return {
    customerId, sourceAppointmentId: a.id,
    customerName: a.custName || 'ลูกค้า', phone: a.phone || '', vehicleModel: a.interestedIn || '',
    salesperson: a.salesperson || '', type: 'call', purpose: 'ลูกค้าไม่มาตามนัด — โทรนัดใหม่',
    note: `นัดเข้าโชว์รูม ${a.date || ''}${a.time ? ' ' + a.time : ''}${a.purpose ? ` (${a.purpose})` : ''} แต่ลูกค้าไม่มา — โทรถามสะดวกวันไหน`,
    dueDate: today, status: 'pending', result: '',
  }
}

export async function scheduleNoShowFollowup(a, customerId = '') {
  const f = buildNoShowFollowup(a, { customerId })
  if (!f) return false
  try {
    await createDoc('followups', { ...f, companyId: a.companyId ?? myEffectiveCompanyId() })
    await updateDocData('appointments', a.id, { noshowFollowupAt: new Date().toISOString() }).catch(() => {})
    return true
  } catch { return false }
}
