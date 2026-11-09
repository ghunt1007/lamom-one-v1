// (v1.0.1006) ส่งแจ้งเตือนในแอปถึง "ฝ่าย" หรือ "คนที่ชื่อ X" — POST /notify
//
// ปัญหาเดิม: หน้าในแอป (เช่น เซลส์แจ้งตรวจยอดโอน, ถอนจองรอคืนเงิน, ผลอนุมัติไฟแนนซ์) สร้างแจ้งเตือนแบบไม่ระบุผู้รับ
// (ไม่มี userId) — กฎความปลอดภัยให้อ่านได้เฉพาะแจ้งเตือนของตัวเองหรือแอดมิน แปลว่าฝ่ายการเงิน/เซลส์ที่ควรได้รับ
// มองไม่เห็นเลย เห็นแต่เจ้าของ/แอดมิน และเซลส์อ่านรายชื่อผู้ใช้เพื่อหา uid เองไม่ได้
// ตอนนี้แอปยังสร้างฉบับไม่ระบุผู้รับไว้เหมือนเดิม (เจ้าของ/แอดมินเห็น) แล้วเรียก worker นี้ให้สร้างสำเนาถึงทุกคน
// ในฝ่ายที่เกี่ยวข้อง (ยกเว้นเจ้าของ/แอดมิน ที่เห็นฉบับรวมอยู่แล้ว และคนที่กดส่งเอง) — ไม่ต้องแก้กฎ Firestore

export const NOTIFY_ROLES = ['finance', 'hr', 'manager', 'service', 'sales']
const SKIP_ROLES = ['owner', 'admin']
const MAX_TARGETS = 50

const clip = (s, n) => String(s ?? '').trim().slice(0, n)
export const normName = n => String(n || '').toLowerCase().replace(/^คุณ/, '').replace(/[\s.]/g, '')

// ตรวจและตัดข้อมูลที่ส่งมา — คืน null ถ้าไม่มีหัวข้อหรือไม่ได้ระบุผู้รับเลย
export function cleanNotify(b = {}) {
  const title = clip(b.title, 120)
  const roles = (Array.isArray(b.roles) ? b.roles : []).filter(r => NOTIFY_ROLES.includes(r))
  const names = (Array.isArray(b.names) ? b.names : []).map(n => clip(n, 60)).filter(Boolean).slice(0, 10)
  if (!title || (!roles.length && !names.length)) return null
  const link = typeof b.link === 'string' && b.link.startsWith('/') && !b.link.startsWith('//') ? clip(b.link, 200) : ''
  // exclude = uid ที่แอปส่งถึงโดยตรงไปแล้ว (เช่น เจ้าของคำขอ) — กันได้ 2 ฉบับ
  const exclude = (Array.isArray(b.exclude) ? b.exclude : []).map(u => clip(u, 128)).filter(Boolean).slice(0, 50)
  return { title, body: clip(b.body, 1000), link, type: clip(b.type, 20) || 'system', roles, names, exclude }
}

// เลือก uid ผู้รับ: ตำแหน่งตรงกับ roles หรือชื่อตรงกับ names (ชื่อในระบบ/ชื่อจริง/ชื่อเล่นในทะเบียนพนักงาน)
export function notifyTargets(users = [], staff = [], { roles = [], names = [], exclude = [] } = {}, senderUid = '') {
  const skip = new Set([senderUid, ...exclude])
  const want = new Set(names.map(normName).filter(Boolean))
  const staffByUid = new Map(staff.filter(s => s.uid && !s.deleted).map(s => [s.uid, s]))
  const namesOf = u => {
    const s = staffByUid.get(u.id) || {}
    const dn = String(u.displayName || '')
    return [dn, dn.split(/\s+/)[0], s.nickname, s.firstName, `${s.firstName || ''}${s.lastName || ''}`].map(normName).filter(Boolean)
  }
  const out = []
  for (const u of users) {
    if (!u?.id || skip.has(u.id) || u.deleted || u.active === false) continue
    if (SKIP_ROLES.includes(u.role) || u.role === 'pending' || u.role === 'viewer') continue
    if (roles.includes(u.role) || (want.size && namesOf(u).some(n => want.has(n)))) out.push(u.id)
    if (out.length >= MAX_TARGETS) break
  }
  return out
}

// คำสั่งเขียน Firestore (commit) — 1 เอกสารต่อผู้รับ ฟิลด์เหมือนที่แอปสร้างเอง + userId
export function notificationWrites(projectId, uids, n, nowIso, newId) {
  return uids.map(uid => ({
    update: {
      name: `projects/${projectId}/databases/(default)/documents/notifications/${newId()}`,
      fields: {
        userId: { stringValue: uid },
        type: { stringValue: n.type },
        title: { stringValue: n.title },
        body: { stringValue: n.body },
        link: { stringValue: n.link },
        read: { booleanValue: false },
        createdAt: { stringValue: nowIso },
        via: { stringValue: 'team-notify' },
      },
    },
    currentDocument: { exists: false },
  }))
}

// deps: { uid, projectId, getAccessToken, runQuery(token, collection, fields), fetch }
export async function handleNotify(body, deps) {
  const n = cleanNotify(body)
  if (!n) return { status: 400, body: { error: 'ต้องมีหัวข้อและผู้รับ (roles หรือ names)' } }
  const token = await deps.getAccessToken()
  const [users, staff] = await Promise.all([
    deps.runQuery(token, 'users', ['role', 'displayName', 'active', 'deleted']),
    n.names.length ? deps.runQuery(token, 'staff', ['firstName', 'lastName', 'nickname', 'uid', 'deleted']).catch(() => []) : [],
  ])
  const uids = notifyTargets(users, staff, n, deps.uid)
  if (!uids.length) return { status: 200, body: { sent: 0 } }
  const writes = notificationWrites(deps.projectId, uids, n, new Date().toISOString(), () => crypto.randomUUID().replace(/-/g, '').slice(0, 20))
  const res = await deps.fetch(`https://firestore.googleapis.com/v1/projects/${deps.projectId}/databases/(default)/documents:commit`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ writes }),
  })
  if (!res.ok) return { status: 502, body: { error: `เขียนแจ้งเตือนไม่สำเร็จ (${res.status})` } }
  return { status: 200, body: { sent: uids.length } }
}
