// บันทึกผลทดลองขับแล้ว → นัดโทรตามวันถัดไปให้เซลส์ที่ดูแล (สนใจมาก/อาจจะ/ยังไม่ระบุ = ชวนปิดการขาย, ไม่มา = นัดใหม่)
// ไม่สร้างถ้าลูกค้าจองแล้ว ไม่สนใจ หรือยกเลิกนัด — ขึ้นในหน้า Follow-up, งานของฉันวันนี้ และเตือน 9 โมง
import { createDoc } from '../core/db.js'
import { myEffectiveCompanyId } from '../core/companyScope.js'
import { todayBangkok } from './format.js'
import { addDaysTo } from './leadFollowups.js'

export const TEST_DRIVE_PURPOSE = 'ติดตามหลังทดลองขับ'

export function buildTestDriveFollowup(td, fields, today = todayBangkok()) {
  if (!td || !fields) return null
  const noShow = fields.status === 'no_show'
  if (!noShow && (fields.status !== 'done' || ['booked', 'notinterested'].includes(fields.result))) return null
  return {
    customerId: td.customerId || '', sourceTestDriveId: td.id || '',
    customerName: td.customerName || 'ลูกค้า', phone: td.phone || '', vehicleModel: td.model || '',
    salesperson: td.staff || '', type: 'call', purpose: TEST_DRIVE_PURPOSE,
    note: noShow ? 'ลูกค้าไม่มาตามนัดทดลองขับ — โทรถามและนัดวันใหม่'
      : `ทดลองขับแล้ว${fields.result === 'interested' ? ' (สนใจมาก)' : fields.result === 'maybe' ? ' (ยังลังเล)' : ''} — โทรถามความรู้สึก เสนอโปรโมชัน/ตารางผ่อน ชวนจอง`,
    dueDate: addDaysTo(today, 1), status: 'pending', result: '',
  }
}

export async function scheduleTestDriveFollowup(td, fields) {
  const f = buildTestDriveFollowup(td, fields)
  if (!f) return false
  try { await createDoc('followups', { ...f, companyId: td.companyId ?? myEffectiveCompanyId() }); return true } catch { return false }
}
