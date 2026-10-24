// มอบลูกค้าให้เซลส์ (หรือกด "รับดูแล" เอง) — ใช้กับลูกค้าที่ยังไม่มีผู้ดูแล เช่น ลูกค้าที่ทัก LINE OA เข้ามาเอง
// ทำ 3 อย่างพร้อมกัน: (1) ใส่ผู้ดูแล + บริษัทของเซลส์คนนั้น (ลูกค้าจาก LINE ไม่มีบริษัท กฎฐานข้อมูลจะซ่อนจากเซลส์)
// (2) โอนนัดติดตามที่ยังค้างของลูกค้ารายนี้ไปให้เซลส์คนใหม่ (3) ถ้ายังไม่มีนัดเลย สร้างนัดวันที่ 1/3/7 ให้
import { updateDocData } from '../core/db.js'
import { normName } from '../core/hierarchy.js'
import { scheduleLeadFollowups } from './leadFollowups.js'

const fullName = s => `${s.firstName || ''} ${s.lastName || ''}`.trim()

// รายชื่อพนักงานสำหรับเลือก (ชื่อเต็ม + บริษัทแรก) — ตัดคนที่ลบแล้ว/ไม่มีชื่อ เรียงตามชื่อ
export function staffChoices(staff) {
  const seen = new Set()
  return (staff || [])
    .filter(s => s && !s.deleted && fullName(s))
    .map(s => ({ name: fullName(s), nickname: s.nickname || '', companyId: (Array.isArray(s.companyIds) && s.companyIds[0]) || s.companyId || null }))
    .filter(s => { const k = normName(s.name); if (seen.has(k)) return false; seen.add(k); return true })
    .sort((a, b) => a.name.localeCompare(b.name, 'th'))
}

export function findStaffCompany(choices, name) {
  const k = normName(name)
  const s = (choices || []).find(x => normName(x.name) === k || (x.nickname && normName(x.nickname) === k))
  return s?.companyId || null
}

// followups = รายการนัดติดตามที่โหลดไว้แล้ว (จะถูกแก้ค่าในที่ด้วย เพื่อให้หน้าจอแสดงผลใหม่ได้ทันที)
export async function assignCustomer(customer, name, companyId, followups = []) {
  const cid = customer.companyId || companyId || null
  await updateDocData('customers', customer.id, { assignedTo: name, ...(customer.companyId ? {} : { companyId: cid }) })
  customer.assignedTo = name
  customer.companyId = cid
  customer.updatedAt = new Date().toISOString()
  const mine = (followups || []).filter(f => f.customerId === customer.id && !f.deleted && f.status === 'pending')
  for (const f of mine) {
    try {
      await updateDocData('followups', f.id, { salesperson: name, ...(f.companyId ? {} : { companyId: cid }) })
      f.salesperson = name
    } catch { /* ข้าม — นัดที่โอนไม่ได้ยังแก้เองได้ในหน้า Follow-up */ }
  }
  if (!mine.length) return scheduleLeadFollowups({ ...customer, assignedTo: name, companyId: cid }, customer.id)
  return 0
}
