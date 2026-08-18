// ── Management hierarchy resolver (v1.0.454) ────────────────────────────────
// "ผู้ใช้จะมองเห็นแค่ผู้ใต้บังคับบัญชาที่ตัวเองดูแลเท่านั้น" — ไล่หาผู้ใต้บังคับบัญชาทุกระดับ (transitive) จาก
// staff.managerId (ฟิลด์หลักที่ผูกโครงสร้างองค์กรจริง — คนละอันกับ companyMemberships[].managerId ที่เป็น
// หัวหน้าเฉพาะรายบริษัทสำหรับพนักงาน shared-service) ใช้กับหน้าที่มี "own scope" อยู่แล้ว (Customers/
// Bookings/JobCards — เดิม sales/service/staff เห็นแค่ของตัวเอง) ให้หัวหน้าทีมเห็นของทีมทั้งหมดด้วย ไม่ใช่
// แค่ของตัวเองเฉยๆ — เทียบชื่อแบบ normalize (ตัดช่องว่าง/ตัวพิมพ์เล็กใหญ่) เหมือน pattern เดิมของหน้าเหล่านี้
// เพราะ assignedTo/salesName/techName เป็นชื่อข้อความอิสระที่พิมพ์เอง ไม่ใช่ uid ผูกตรงๆ
import { listDocs } from './db.js'
import { getState } from './store.js'

export function normName(s) {
  return String(s || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function fullName(s) {
  return `${s.firstName || ''} ${s.lastName || ''}`.trim()
}

// คืน { names: Set<string> (normalize แล้ว), hasSubordinates: boolean } — hasSubordinates=false หมายถึง
// หา staff doc ของตัวเองไม่เจอ (ยังไม่เชื่อมบัญชี) หรือเจอแต่ไม่มีใครอยู่ใต้บังคับบัญชาเลย — ให้หน้าที่เรียกใช้
// ตัดสินใจเองว่าจะ fallback ยังไง (เช่น role=manager ที่ไม่มีลูกทีมจริง ควรเห็นกว้างเหมือนเดิม ไม่ใช่เห็นว่างเปล่า)
export async function getMyTeamNames() {
  const me = getState('user')
  const names = new Set()
  if (me?.displayName) names.add(normName(me.displayName))
  if (!me?.uid) return { names, hasSubordinates: false }

  let staffList = []
  try { staffList = await listDocs('staff', [], 'firstName', 'asc', 1000) } catch { return { names, hasSubordinates: false } }

  const myStaff = staffList.find(s => s.uid === me.uid && !s.deleted)
  if (!myStaff) return { names, hasSubordinates: false }
  names.add(normName(fullName(myStaff)))

  const byManager = {}
  staffList.forEach(s => { if (s.managerId && !s.deleted) (byManager[s.managerId] ||= []).push(s) })

  const queue = [myStaff.id]
  const visited = new Set()
  let subordinateCount = 0
  while (queue.length) {
    const id = queue.shift()
    if (visited.has(id)) continue
    visited.add(id)
    ;(byManager[id] || []).forEach(child => {
      names.add(normName(fullName(child)))
      queue.push(child.id)
      subordinateCount++
    })
  }
  return { names, hasSubordinates: subordinateCount > 0 }
}

// ── RBAC ตามผังองค์กร (v1.0.465) ─────────────────────────────────────────────
// นโยบายที่เจ้าของระบบยืนยันไว้ชัดเจน:
//   1. เจ้าของโปรแกรม (บัญชีนี้เท่านั้น — ผูกกับอีเมล ไม่ใช่ role เพราะ role 'owner' ในอนาคตอาจมีเจ้าของธุรกิจ
//      จริงคนอื่นถืออยู่ด้วย) เห็น/แก้ไขได้ทุกอย่างทุกบริษัท ไม่มีข้อจำกัด
//   2. แอดมิน/เจ้าของบริษัท (role admin หรือ owner ที่ไม่ใช่เจ้าของโปรแกรม) เห็น/แก้ไขได้ทุกคนแต่เฉพาะใน
//      บริษัทที่ตัวเองสังกัดเท่านั้น ไม่ข้ามบริษัท ไม่ถูกจำกัดตามสายบังคับบัญชา (มีอำนาจสูงสุดในบริษัทตัวเอง)
//   3. คนอื่นทั้งหมด (manager/sales/service/staff) เห็นเฉพาะตัวเอง + ผู้ใต้บังคับบัญชาที่ลงไปทุกระดับ
//      (managerId) เท่านั้น — เห็นคนที่อยู่สูงกว่าไม่ได้ ข้ามทีมไม่ได้ ข้ามบริษัทที่ตัวเองไม่ได้สังกัดไม่ได้
// ⚠️ ฟังก์ชันนี้เป็นเครื่องมือใหม่ ไม่กระทบ getMyTeamNames() เดิมด้านบน (หน้าที่ใช้อยู่แล้ว — Customers/
// Bookings/JobCards — ยังทำงานเหมือนเดิมทุกประการ) จะค่อยๆย้ายมาใช้ตัวนี้ทีละหน้าแยกต่างหาก
export const PROGRAM_OWNER_EMAIL = 'ghunt1007@gmail.com'

export function isProgramOwner() {
  const me = getState('user')
  return !!me?.email && me.email.toLowerCase() === PROGRAM_OWNER_EMAIL.toLowerCase()
}

function staffCompanyIds(s) {
  return s?.companyIds?.length ? s.companyIds : (s?.companyId ? [s.companyId] : [])
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
  if (['admin', 'owner'].includes(role)) {
    return { companyOnly: true, companyIds: myCompanyIds }
  }

  // อื่นๆ — ตัวเอง + ลูกทีมทุกระดับ (transitive) ผ่าน managerId เท่านั้น
  const names = new Set()
  if (me?.displayName) names.add(normName(me.displayName))
  if (!myStaff) return { names, staffIds: new Set(), companyIds: myCompanyIds, hasSubordinates: false }
  names.add(normName(fullName(myStaff)))
  const staffIds = new Set([myStaff.id])
  const byManager = {}
  staffList.forEach(s => { if (s.managerId && !s.deleted) (byManager[s.managerId] ||= []).push(s) })
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
