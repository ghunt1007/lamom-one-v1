// ── RBAC ตามผังองค์กร (v1.0.454, เข้มงวดขึ้นเป็น v1.0.465-467) ──────────────────
// "ผู้ใช้จะมองเห็นแค่ผู้ใต้บังคับบัญชาที่ตัวเองดูแลเท่านั้น" — ไล่หาผู้ใต้บังคับบัญชาทุกระดับ (transitive) จาก
// staff.managerId (ฟิลด์หลักที่ผูกโครงสร้างองค์กรจริง — คนละอันกับ companyMemberships[].managerId ที่เป็น
// หัวหน้าเฉพาะรายบริษัทสำหรับพนักงาน shared-service) — เทียบชื่อแบบ normalize (ตัดช่องว่าง/ตัวพิมพ์เล็กใหญ่)
// เพราะ assignedTo/salesName/techName ในหน้า Customers/Bookings/JobCards เป็นชื่อข้อความอิสระที่พิมพ์เอง
// ไม่ใช่ uid ผูกตรงๆ
//
// นโยบายที่เจ้าของระบบยืนยันไว้ชัดเจน (ไม่มี fallback ผ่อนปรนอีกต่อไป):
//   1. เจ้าของโปรแกรม (บัญชีนี้เท่านั้น — ผูกกับอีเมล ไม่ใช่ role เพราะ role 'owner' ในอนาคตอาจมีเจ้าของธุรกิจ
//      จริงคนอื่นถืออยู่ด้วย) เห็น/แก้ไขได้ทุกอย่างทุกบริษัท ไม่มีข้อจำกัด
//   2. แอดมิน/เจ้าของบริษัท (role admin หรือ owner ที่ไม่ใช่เจ้าของโปรแกรม) หรือ groupWide:true (HR/การตลาด/
//      PDI/ตรวจสอบที่ต้องดูแลข้ามบริษัทจริงตามผังองค์กร) เห็น/แก้ไขได้ทุกคนแต่เฉพาะในบริษัทที่ตัวเองสังกัด
//      เท่านั้น (groupWide ไม่ถูกจำกัดบริษัทด้วย) ไม่ถูกจำกัดตามสายบังคับบัญชา (มีอำนาจสูงสุดในบริษัทตัวเอง)
//   3. คนอื่นทั้งหมด (manager/sales/service/staff) เห็นเฉพาะตัวเอง + ผู้ใต้บังคับบัญชาที่ลงไปทุกระดับ
//      (managerId) เท่านั้น — เห็นคนที่อยู่สูงกว่าไม่ได้ ข้ามทีมไม่ได้ ข้ามบริษัทที่ตัวเองไม่ได้สังกัดไม่ได้
import { listDocs } from './db.js'
import { getState } from './store.js'

export function normName(s) {
  return String(s || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function fullName(s) {
  return `${s.firstName || ''} ${s.lastName || ''}`.trim()
}

export const PROGRAM_OWNER_EMAIL = 'ghunt1007@gmail.com'

export function isProgramOwner() {
  const me = getState('user')
  return !!me?.email && me.email.toLowerCase() === PROGRAM_OWNER_EMAIL.toLowerCase()
}

function staffCompanyIds(s) {
  return s?.companyIds?.length ? s.companyIds : (s?.companyId ? [s.companyId] : [])
}

// (v1.0.475) พนักงาน 1 คนมีหัวหน้างานได้มากกว่า 1 คน (เช่น รายงานตรงต่อผู้จัดการสาขา + รายงานเส้นประต่อ
// ผู้จัดการฝ่ายส่วนกลางด้วย) — เดิม managerId เป็นค่าเดี่ยว เก็บ fallback ไว้ให้ยังอ่านข้อมูลเก่าได้ปกติ
// เหมือน companyId→companyIds ที่ทำไว้แล้ว ไม่ต้อง migrate ย้อนหลัง
export function staffManagerIds(s) {
  return s?.managerIds?.length ? s.managerIds : (s?.managerId ? [s.managerId] : [])
}

// คืน scope object ใช้ร่วมกับ scopeIncludesStaff()/scopeCompanyFilter() ด้านล่าง
export async function getVisibilityScope() {
  if (isProgramOwner()) return { unrestricted: true }
  const me = getState('user')
  const role = getState('role') || me?.role || 'staff'

  let staffList = []
  try { staffList = await listDocs('staff', [], 'firstName', 'asc', 1000) } catch { staffList = [] }
  const myStaff = staffList.find(s => s.uid === me?.uid && !s.deleted) || null
  const myCompanyIds = myStaff ? staffCompanyIds(myStaff) : (me?.companyIds || [])

  // แอดมิน/เจ้าของบริษัท — เห็นทุกคนในบริษัทตัวเอง ไม่ถูกจำกัดตามสายบังคับบัญชา
  // groupWide:true (ตั้งได้รายบุคคลที่ User Management — สำหรับ HR/การตลาด/PDI/ตรวจสอบ/หัวหน้าบัญชีที่ต้อง
  // ดูแลทุกบริษัทจริงตามผังองค์กร) เห็นทุกคนทุกบริษัทเหมือนกัน ไม่ถูกจำกัดทั้งบริษัทและสายบังคับบัญชา —
  // companyIds ว่างเปล่า (ไม่ใช่ unrestricted แบบเจ้าของโปรแกรม) หมายถึง "ทุกบริษัท" ใน scopeIncludesStaff()
  if (['admin', 'owner'].includes(role) || me?.groupWide === true) {
    return { companyOnly: true, companyIds: me?.groupWide === true ? [] : myCompanyIds }
  }

  // อื่นๆ — ตัวเอง + ลูกทีมทุกระดับ (transitive) ผ่าน managerId เท่านั้น
  const names = new Set()
  if (me?.displayName) names.add(normName(me.displayName))
  if (!myStaff) return { names, staffIds: new Set(), companyIds: myCompanyIds, hasSubordinates: false }
  names.add(normName(fullName(myStaff)))
  const staffIds = new Set([myStaff.id])
  const byManager = {}
  // (v1.0.475) พนักงาน 1 คนอาจอยู่ใต้หัวหน้างานหลายคน — เก็บลูกทีมไว้ใน "ทุก" หัวหน้าที่มีสิทธิ์เห็นจริง
  // (ไม่ใช่แค่หัวหน้าคนแรก) ใช้ staffManagerIds() ที่ fallback ไปหา managerId เดี่ยวได้ถ้ายังไม่ได้ตั้งหลายคน
  staffList.forEach(s => { if (!s.deleted) staffManagerIds(s).forEach(mid => { (byManager[mid] ||= []).push(s) }) })
  const queue = [myStaff.id]
  const visited = new Set()
  while (queue.length) {
    const id = queue.shift()
    if (visited.has(id)) continue
    visited.add(id)
    ;(byManager[id] || []).forEach(child => {
      names.add(normName(fullName(child)))
      staffIds.add(child.id)
      queue.push(child.id)
    })
  }
  return { names, staffIds, companyIds: myCompanyIds, hasSubordinates: staffIds.size > 1 }
}

// เช็คว่า scope ที่ได้จาก getVisibilityScope() เห็นพนักงานคนนี้ได้หรือไม่ (ใช้กรองรายชื่อ/การ์ด/แถวตาราง)
export function scopeIncludesStaff(scope, s) {
  if (!scope || scope.unrestricted) return true
  const targetCompanyIds = staffCompanyIds(s)
  const sameCompany = !scope.companyIds?.length || !targetCompanyIds.length || targetCompanyIds.some(id => scope.companyIds.includes(id))
  if (!sameCompany) return false
  if (scope.companyOnly) return true
  return !!scope.staffIds?.has(s.id)
}
