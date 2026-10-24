// นัดติดตาม Lead อัตโนมัติ — เพิ่มลูกค้าใหม่ (Lead/Prospect) แล้วสร้างงานใน collection `followups` ให้ 3 ครั้ง
// วันที่ +1, +3, +7 นับจากวันนี้ (เวลาไทย) ผู้ติดตาม = ผู้ดูแลลูกค้า งานพวกนี้ขึ้นในหน้า Follow-up และในข้อความ
// เตือน 9 โมงเช้าเหมือนงานที่สร้างเอง — ติด autoLead:true ไว้ เพื่อให้การเตือนตอนเช้าข้ามงานของลูกค้าที่จองไปแล้ว
// หรือเสียดีลไปแล้ว (ดู workers/daily-report.js) แก้จำนวนวัน/ข้อความได้ที่ LEAD_FOLLOWUP_PLAN ด้านล่าง
import { createDoc } from '../core/db.js'
import { myEffectiveCompanyId } from '../core/companyScope.js'
import { todayBangkok } from './format.js'

export const LEAD_FOLLOWUP_PURPOSE = 'ติดตาม Lead ใหม่'

export const LEAD_FOLLOWUP_PLAN = [
  { days: 1, type: 'call', note: 'ครั้งที่ 1: โทรแนะนำตัว ถามความต้องการ งบ และรุ่นที่สนใจ' },
  { days: 3, type: 'line', note: 'ครั้งที่ 2: ส่งรูป สเปก และโปรโมชันรุ่นที่สนใจทาง LINE' },
  { days: 7, type: 'call', note: 'ครั้งที่ 3: ชวนทดลองขับ หรือนัดเข้าโชว์รูม' },
]

export function addDaysTo(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

// เฉพาะลูกค้าที่ยังอยู่ขั้น Lead/Prospect และยังไม่เสียดีล
export function buildLeadFollowups(customer, customerId, today = todayBangkok()) {
  if (!customer || !['lead', 'pp'].includes(customer.stage) || customer.isLost) return []
  const customerName = [customer.firstName, customer.lastName].filter(Boolean).join(' ') || 'ลูกค้า'
  return LEAD_FOLLOWUP_PLAN.map(p => ({
    customerId: customerId || '', customerName,
    phone: customer.phone || '', vehicleModel: customer.interestedModel || '',
    salesperson: customer.assignedTo || '', type: p.type,
    purpose: LEAD_FOLLOWUP_PURPOSE, note: p.note,
    dueDate: addDaysTo(today, p.days), status: 'pending', result: '',
    autoLead: true,
  }))
}

// สร้างจริงใน Firestore — ไม่ throw (ถ้าสร้างนัดไม่สำเร็จ ไม่ควรทำให้การบันทึกลูกค้าล้ม) คืนจำนวนที่สร้างได้
export async function scheduleLeadFollowups(customer, customerId) {
  let n = 0
  for (const f of buildLeadFollowups(customer, customerId)) {
    try { await createDoc('followups', { ...f, companyId: customer.companyId ?? myEffectiveCompanyId() }); n++ } catch { /* ข้าม */ }
  }
  return n
}
