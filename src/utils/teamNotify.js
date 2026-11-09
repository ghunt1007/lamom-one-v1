// (v1.0.1006) แจ้งเตือนในแอปถึงฝ่าย/คนที่เกี่ยวข้องจริง
//
// เดิมทุกหน้าสร้างแจ้งเตือนแบบไม่ระบุผู้รับ (ไม่มี userId) — กฎความปลอดภัยให้อ่านได้แค่เจ้าของ/แอดมิน ฝ่ายการเงินหรือเซลส์
// ที่ควรได้รับจึงไม่เคยเห็นเลย ตอนนี้ notifyTeam() ทำ 3 อย่างในครั้งเดียว:
//   1) ฉบับรวม (ไม่ระบุผู้รับ) ให้เจ้าของ/แอดมินเห็นเหมือนเดิม
//   2) ถึง uid ที่รู้อยู่แล้วโดยตรง (เช่น คนที่สร้างคำขอ — createdByUid)
//   3) ถึงทุกคนในฝ่าย (roles) / คนที่ชื่อตรง (names) ผ่าน worker (/notify) เพราะแอปฝั่งพนักงานอ่านรายชื่อผู้ใช้ไม่ได้
// ทุกขั้นพลาดได้เงียบๆ ไม่กระทบงานหลักที่บันทึกไปแล้ว
import { createDoc } from '../core/db.js'
import { getState, setState } from '../core/store.js'
import { auth } from '../core/firebase.js'

const WORKER = import.meta.env.VITE_DAILY_REPORT_URL || 'https://lamom-daily-report.ghunt1007.workers.dev'
const ROLES = ['finance', 'hr', 'manager', 'service', 'sales']

// แผนกในหน้างาน (Tasks) → ตำแหน่งผู้ใช้ที่ควรได้แจ้งเตือน
export function deptRoles(dept) {
  return ROLES.includes(dept) && dept !== 'manager' ? [dept] : []
}

export function teamNotifyPlan({ roles = [], names = [], uids = [] } = {}, myUid = '') {
  const direct = [...new Set(uids.filter(u => u && u !== myUid))]
  const r = [...new Set(roles.filter(x => ROLES.includes(x)))]
  const n = [...new Set(names.map(x => String(x || '').trim()).filter(Boolean))]
  return { direct, roles: r, names: n, callWorker: r.length > 0 || n.length > 0 }
}

export async function notifyTeam({ type = 'system', title, body = '', link = '', roles = [], names = [], uids = [] }) {
  const me = getState('user')
  const role = getState('role') || me?.role
  const base = { type, title, body, read: false, link, createdAt: new Date().toISOString() }
  const plan = teamNotifyPlan({ roles, names, uids }, me?.uid)
  try {
    await createDoc('notifications', base)
    if (['owner', 'admin'].includes(role)) setState('unreadCount', (getState('unreadCount') || 0) + 1)
  } catch { /* ฉบับรวมพลาดได้ */ }
  await Promise.all(plan.direct.map(userId => createDoc('notifications', { ...base, userId }).catch(() => {})))
  if (!plan.callWorker || import.meta.env.DEV) return
  try {
    const u = auth.currentUser
    if (!u) return
    const token = await u.getIdToken()
    fetch(`${WORKER}/notify`, {
      method: 'POST', keepalive: true,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ type, title, body, link, roles: plan.roles, names: plan.names, exclude: plan.direct }),
    }).catch(() => {})
  } catch { /* worker ไม่ตอบ — ฉบับรวมยังอยู่ */ }
}
