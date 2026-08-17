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
