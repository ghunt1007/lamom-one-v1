// Firestore helpers — thin wrapper with offline demo support
import { db } from './firebase.js'
import {
  collection, doc, addDoc, setDoc, updateDoc, deleteDoc,
  getDoc, getDocs, query, where, orderBy, limit, startAfter,
  onSnapshot, serverTimestamp, Timestamp, increment, deleteField,
} from 'firebase/firestore'
import { getState } from './store.js'
import { syncRagChunk, RAG_SOURCE_COLLECTIONS } from '../utils/rag.js'

// ── Input sanitization — strip stored XSS before Firestore writes ──
// เดิม export แค่ผ่าน createDoc()/updateDocData() เท่านั้น — จุดที่เขียน Firestore ตรงๆนอก db.js (เช่น
// auth.js's setDoc ตอนสร้างบัญชีพนักงาน) ไม่ได้ผ่านการกรองนี้เลย ทำให้ field ที่พิมพ์เอง (เช่นชื่อพนักงาน)
// ยัง XSS ได้ทั้งที่ตั้งใจกันไว้ที่ระดับนี้แล้ว จึง export ออกมาให้ที่อื่นเรียกใช้ตรงได้ด้วย — เพิ่มการกัน
// javascript:/vbscript: URI scheme (ที่ escHtml() ปลายทางเพียวๆไม่ช่วย ถ้าค่าถูกใส่ใน attribute href/src
// ตรงๆ ไม่ใช่ text content) ต่อจาก script tag/on*= attribute ที่กันไว้เดิม
export function deepSanitize(v) {
  if (typeof v === 'string') return v.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '').replace(/\bon\w+\s*=/gi, '').replace(/\b(javascript|vbscript)\s*:/gi, '')
  if (Array.isArray(v)) return v.map(deepSanitize)
  if (v && typeof v === 'object' && !(v instanceof Date)) return Object.fromEntries(Object.entries(v).map(([k, w]) => [k, deepSanitize(w)]))
  return v
}

// ── Audit log ────────────────────────────────────────────────
// บันทึกทุกการเปลี่ยนแปลง (create/update/delete) ของทุก collection ลง audit_log
// ต้องไม่ throw ออกไปนอกฟังก์ชัน — ถ้า logging พัง ต้องไม่กระทบการทำงานจริง (fire-and-forget-safe)
// actorOverride: ใช้กับหน้าที่เป็น shared kiosk (เช่น Attendance.js — พนักงานหลายคนลงเวลาบนอุปกรณ์เดียว
// ที่ล็อกอินค้างไว้เป็นบัญชีเดียว) เดิม audit_log บันทึกชื่อ "บัญชีที่ล็อกอินอยู่บนเครื่อง" เสมอ ไม่ใช่ชื่อ
// พนักงานที่กดปุ่มจริง ทำให้ audit trail ของ collection นี้ผิดเจ้าของทุกครั้งที่มีคนอื่นมาใช้เครื่องเดียวกัน
// ไม่กระทบพฤติกรรมเดิมของหน้าอื่นๆเลย เพราะเป็น parameter เสริมที่ default เป็น undefined
function logAction(action, colName, id, detail, actorOverride) {
  if (colName === 'audit_log') return // ป้องกัน log การ log ตัวเอง (recursion)
  try {
    const user = getState('user') || {}
    const payload = {
      user: actorOverride || user.displayName || user.email || user.uid || 'unknown',
      role: user.role || '',
      action,
      module: colName,
      resource: id != null ? String(id) : '-',
      detail: detail || '',
      ts: new Date().toISOString(),
    }
    addDoc(collection(db, 'audit_log'), payload).catch(() => {})
  } catch (e) {
    // swallow — logging ต้องไม่ทำให้ CRUD จริงพัง
  }
}

// ── Gamification hook ────────────────────────────────────────
// ให้แต้มจริงอัตโนมัติเมื่อเกิด business event จริง (ไม่ใช่กรอกมือ) — ทำงานคู่กับ logAction
// เขียนลง gamification_events (ledger) + สะสมยอดรวมใน staff_points
// ต้องไม่ throw ออกไปนอกฟังก์ชัน — ถ้า gamification พัง ต้องไม่กระทบการทำงานจริง (fire-and-forget-safe)
//
// ตารางแต้ม (ใช้วิจารณญาณให้สมเหตุสมผล ไม่เฟ้อ):
//   bookings create                          → +20  (สร้างใบจองใหม่)
//   bookings status → 'ส่งมอบแล้ว' (ครั้งแรก) → +100 (ส่งมอบรถสำเร็จ — bonus ใหญ่สุด)
//   customers stage → 'pp' (ครั้งแรก)         → +10  (เปลี่ยน lead เป็น Prospect)
//   tasks status → 'done' (ครั้งแรก)          → +5   (ทำงานเสร็จสิ้น)
//   comm_logs create                          → +2   (บันทึกการติดต่อ/โน้ตลูกค้า)
//   daily_missions done → true (ครั้งแรก)      → ตาม xp ของภารกิจนั้น
//   gamification_challenges → 'completed'     → +150 ให้ผู้เข้าร่วมที่ถึงเป้าหมาย (ครั้งแรก)
const GAMIFICATION_EXCLUDED_COLLECTIONS = ['audit_log', 'gamification_events', 'staff_points']

async function getCurrentDocSnapshot(colName, id) {
  try {
    const snap = await getDoc(doc(db, colName, id))
    return snap.exists() ? { id: snap.id, ...snap.data() } : null
  } catch (e) { return null }
}

// เซ็ต flag "ให้แต้มไปแล้ว" แบบเงียบๆ (ไม่ผ่าน updateDocData) เพื่อกันเรียก logAction/awardGamePoints ซ้ำ
function setFlagQuiet(colName, id, field) {
  try {
    updateDoc(doc(db, colName, id), { [field]: true }).catch(() => {})
  } catch (e) {}
}

// เพิ่ม/ลดค่าตัวเลขแบบอะตอมมิกด้วย increment() ของ Firestore — ปลอดภัยจาก race condition เมื่อมี 2 การเขียน
// แข่งกันในเวลาใกล้กัน (เช่น 2 คนกดปุ่มที่เพิ่มยอดสะสมเดียวกันพร้อมกัน) ต่างจาก updateDocData ทั่วไปที่ต้อง
// อ่านค่าเดิมมาบวกเองในโค้ดฝั่ง client ก่อนเขียนกลับ (stale read) ซึ่งถ้าแข่งกันจริง การเขียนที่แพ้จะหายไป
// เงียบๆโดยไม่มี error ไม่ผ่าน deepSanitize เพราะ increment() คืนค่าเป็น sentinel object พิเศษของ Firestore
// (ไม่ใช่ข้อมูล string ที่ต้องกรอง XSS อยู่แล้ว เป็นตัวเลขล้วน)
export async function incrementField(colName, id, field, amount) {
  await updateDoc(doc(db, colName, id), { [field]: increment(amount), updatedAt: serverTimestamp() })
  logAction('update', colName, id, `+${amount} ${field} (atomic increment)`)
}

async function findStaffPointsDoc(userName) {
  const snap = await getDocs(query(collection(db, 'staff_points'), where('name', '==', userName), limit(1)))
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() }
}

// เขียน ledger event + สะสมยอดรวมใน staff_points ให้ userName ที่ระบุ
async function grantPoints(userName, points, reason, sourceCollection, sourceId) {
  const name = (userName || '').trim()
  if (!name || !points) return
  try {
    await createDoc('gamification_events', {
      userName: name, userId: name, points, reason,
      sourceCollection, sourceId: sourceId != null ? String(sourceId) : '',
    })
    const existing = await findStaffPointsDoc(name)
    if (existing) {
      // เดิมอ่าน existing.points มาบวกเองแล้วเขียนกลับ (stale read) — awardGamePoints() ถูกเรียกจากหลาย
      // action ที่ไม่เกี่ยวกันเลย (ปิดใบจอง/ทำงานเสร็จ/บันทึก comm log ฯลฯ) ถ้า 2 action ของเซลส์คนเดียวกัน
      // เกิดขึ้นใกล้กันมาก แต้มสะสมของฝั่งที่แพ้ race จะหายไปเงียบๆ แก้ให้บวกแบบอะตอมมิกที่ระดับ Firestore แทน
      await incrementField('staff_points', existing.id, 'points', points)
    } else {
      await createDoc('staff_points', { name, points })
    }
  } catch (e) {
    // swallow — ให้แต้มพัง ต้องไม่ทำให้ CRUD จริงพัง
  }
}

async function awardGamePoints(action, colName, id, data) {
  if (GAMIFICATION_EXCLUDED_COLLECTIONS.includes(colName)) return // ป้องกัน recursion จากการเขียน ledger เอง
  try {
    const user = getState('user') || {}
    const currentName = user.displayName || user.email || user.uid || ''

    // 1) สร้างใบจองใหม่ — +20
    if (action === 'create' && colName === 'bookings') {
      const name = (data && data.salesName) || currentName
      await grantPoints(name, 20, '📝 สร้างใบจองใหม่', 'bookings', id)
      return
    }

    // 2) ใบจองส่งมอบแล้ว (ให้แต้มครั้งแรกเท่านั้น กันกดซ้ำ/แก้ไขซ้ำ)  — +100
    if (action === 'update' && colName === 'bookings' && data && data.status === 'ส่งมอบแล้ว') {
      const cur = await getCurrentDocSnapshot('bookings', id)
      if (cur && !cur._deliveryPointsAwarded) {
        setFlagQuiet('bookings', id, '_deliveryPointsAwarded')
        await grantPoints(cur.salesName || currentName, 100, '🚗 ส่งมอบรถสำเร็จ', 'bookings', id)
      }
      return
    }

    // 3) ลูกค้าเปลี่ยนสถานะ lead → pp (Prospect) ครั้งแรก — +10
    if (action === 'update' && colName === 'customers' && data && data.stage === 'pp') {
      const cur = await getCurrentDocSnapshot('customers', id)
      if (cur && !cur._ppPointsAwarded) {
        setFlagQuiet('customers', id, '_ppPointsAwarded')
        await grantPoints(cur.salesName || cur.assignedTo || currentName, 10, '📇 อัปเกรดลูกค้าเป็น Prospect', 'customers', id)
      }
      return
    }

    // 4) งาน (task) เสร็จสิ้นครั้งแรก — +5
    if (action === 'update' && colName === 'tasks' && data && data.status === 'done') {
      const cur = await getCurrentDocSnapshot('tasks', id)
      if (cur && !cur._taskPointsAwarded) {
        setFlagQuiet('tasks', id, '_taskPointsAwarded')
        await grantPoints(cur.assignedTo || currentName, 5, '✅ ทำงานเสร็จสิ้น', 'tasks', id)
      }
      return
    }

    // 5) บันทึกการติดต่อ/โน้ตลูกค้าใหม่ — +2 (ให้กับผู้ใช้ที่ล็อกอินอยู่จริง)
    if (action === 'create' && colName === 'comm_logs') {
      await grantPoints(currentName, 2, '💬 บันทึกการติดต่อลูกค้า', 'comm_logs', id)
      return
    }

    // 6) Daily mission สำเร็จครั้งแรก — ให้ตาม xp ของภารกิจ
    if (action === 'update' && colName === 'daily_missions' && data && data.done === true) {
      const cur = await getCurrentDocSnapshot('daily_missions', id)
      if (cur && !cur._missionPointsAwarded) {
        setFlagQuiet('daily_missions', id, '_missionPointsAwarded')
        await grantPoints(currentName, cur.xp || 20, '🎯 ภารกิจสำเร็จ: ' + (cur.title || ''), 'daily_missions', id)
      }
      return
    }

    // 7) Challenge พิชิตสำเร็จครั้งแรก — ให้ผู้เข้าร่วมที่ถึงเป้าหมาย
    if (action === 'update' && colName === 'gamification_challenges' && data && data.status === 'completed') {
      const cur = await getCurrentDocSnapshot('gamification_challenges', id)
      if (cur && !cur._challengePointsAwarded) {
        setFlagQuiet('gamification_challenges', id, '_challengePointsAwarded')
        const winners = (cur.participants || []).filter(p => p.progress >= cur.target)
        for (const w of winners) {
          await grantPoints(w.name, 150, '🏆 พิชิต Challenge: ' + (cur.name || ''), 'gamification_challenges', id)
        }
      }
      return
    }
  } catch (e) {
    // swallow — gamification ต้องไม่ทำให้ CRUD จริงพัง
  }
}

// ── CRUD ────────────────────────────────────────────────────

// actorOverride (พารามิเตอร์เสริม, ไม่บังคับ): ดู comment ที่ logAction() — ใช้เฉพาะหน้า shared kiosk ที่
// ต้องการให้ audit_log บันทึกชื่อคนที่ทำจริง ไม่ใช่บัญชีที่ล็อกอินค้างอยู่บนเครื่อง
export async function createDoc(colName, data, actorOverride) {
  // ตัด field "id" ที่ผู้เรียกอาจใส่มาเองทิ้งก่อนเสมอ — ป้องกันไปทับ id จริงที่ระบบ
  // สร้างให้ (genId() ใน demo / ref.id ของ Firestore จริง) ซึ่งเป็นตัวที่ listDocs/updateDocData
  // ใช้อ้างอิง record จริง — ถ้าปล่อยให้ทับ จะทำให้ document key กับ .id field ไม่ตรงกัน
  // (แก้ไข/ลบ record หลังจากนั้นจะพลาดเป้าแบบเงียบๆ)
  const { id: _ignoredId, ...rest } = data || {}
  const clean = deepSanitize(rest)
  const ref = await addDoc(collection(db, colName), { ...clean, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
  logAction('create', colName, ref.id, `สร้างข้อมูลใหม่ใน ${colName}`, actorOverride)
  awardGamePoints('create', colName, ref.id, clean).catch(() => {})
  syncRagChunk(colName, ref.id, clean).catch(() => {})
  return ref.id
}

export async function readDoc(colName, id) {
  const snap = await getDoc(doc(db, colName, id))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

// สร้าง/แก้ไขเอกสารโดยกำหนด id เอง (upsert) — ต่างจาก createDoc() ที่ Firestore สุ่ม id ให้เสมอ ใช้ตอนต้องการ
// ให้ id ของ collection หนึ่งตรงกับ id ของอีก collection หนึ่ง (เช่น staff_salaries/{staffId} ที่ต้องอ้างอิง
// staff/{staffId} ตัวเดียวกันแบบ 1:1 โดยไม่ต้องเก็บ field อ้างอิงแยกต่างหาก)
export async function setDocData(colName, id, data) {
  const clean = deepSanitize(data)
  await setDoc(doc(db, colName, id), { ...clean, updatedAt: serverTimestamp() }, { merge: true })
  logAction('update', colName, id, `บันทึกข้อมูลใน ${colName}`)
}

// ── One-time migration: ย้ายเงินเดือนออกจาก staff/{docId} ไปเก็บที่ staff_salaries แยกต่างหาก (v1.0.303) ──
// เดิม salary ฝังอยู่ใน staff doc ที่ isStaff() (พนักงานทุกคน) อ่านได้กว้างมาก — โค้ดที่แก้ไปแล้วเลิกเขียน
// field นี้ลง staff doc แล้ว แต่ "เอกสารเก่าที่มีอยู่จริงในระบบ" ยังฝัง salary ค้างอยู่จนกว่าจะรันย้ายข้อมูล
// จริงสักครั้ง ฟังก์ชันนี้ทำ 2 อย่างต่อพนักงาน 1 คน: (1) คัดลอกค่า salary ปัจจุบันไปที่ staff_salaries/{id}
// (2) ลบ field salary ออกจาก staff doc ต้นทางจริงๆด้วย deleteField() (ไม่ใช่ตั้งเป็น null — ตั้งเป็น null
// จะยังนับว่า field "มีอยู่" และโดนกฎ Firestore ที่เพิ่งเพิ่มบล็อกไว้) ปลอดภัยที่จะรันซ้ำได้เสมอ (idempotent —
// เอกสารที่ไม่มี salary แล้วจะถูกข้ามอัตโนมัติ) ไม่ผ่าน updateDocData()/deepSanitize() เพราะ deleteField()
// เป็น sentinel object พิเศษของ Firestore เหมือน increment()/serverTimestamp() ไม่ใช่ข้อมูลจริง
export async function migrateStaffSalaries() {
  const snap = await getDocs(collection(db, 'staff'))
  let migrated = 0, skipped = 0
  const errors = []
  for (const d of snap.docs) {
    const data = d.data()
    if (data.salary == null) { skipped++; continue }
    try {
      await setDoc(doc(db, 'staff_salaries', d.id), { salary: data.salary, updatedAt: serverTimestamp() }, { merge: true })
      await updateDoc(doc(db, 'staff', d.id), { salary: deleteField() })
      migrated++
    } catch (e) {
      errors.push({ id: d.id, message: e.message || String(e) })
    }
  }
  logAction('update', 'staff_salaries', 'migration', `ย้ายเงินเดือนออกจาก staff doc แล้ว ${migrated} คน (ข้าม ${skipped} คนที่ไม่มี salary อยู่แล้ว)`)
  return { migrated, skipped, errors }
}

// actorOverride (พารามิเตอร์เสริม, ไม่บังคับ): ดู comment ที่ logAction() — ใช้เฉพาะหน้า shared kiosk ที่
// ต้องการให้ audit_log บันทึกชื่อคนที่ทำจริง ไม่ใช่บัญชีที่ล็อกอินค้างอยู่บนเครื่อง
export const DEFAULT_ROLE_PERMISSIONS = {
  owner:   { roleName: 'เจ้าของ',      modules: ['*'] },
  admin:   { roleName: 'แอดมิน',       modules: ['*'] },
  manager: { roleName: 'ผู้จัดการ',    modules: ['*'] },
  finance: { roleName: 'การเงิน',      modules: ['finance', 'insurance', 'b2b', 'documents', 'ai', 'comms'] },
  hr:      { roleName: 'HR',           modules: ['hr', 'documents', 'ai', 'comms'] },
  sales:   { roleName: 'เซลส์',        modules: ['sales', 'dms', 'marketing', 'b2b', 'documents', 'ai', 'comms'] },
  service: { roleName: 'ช่าง/บริการ',  modules: ['service', 'quality', 'dms', 'documents', 'ai', 'comms'] },
  staff:   { roleName: 'พนักงาน',      modules: ['documents', 'ai', 'comms'] },
  pending: { roleName: 'รออนุมัติ',    modules: [] },
}

// ── One-time seeding: ตั้งค่าสิทธิ์เข้าถึงโมดูลเริ่มต้นต่อตำแหน่งงาน (v1.0.315) ──────────────────
// เดิม collection 'roles' ไม่มีเอกสารอยู่เลยตั้งแต่สร้างระบบ (ไม่มีจุดไหนเขียนสร้างเอกสารใหม่ มีแค่แก้ไข
// เอกสารที่มีอยู่แล้วผ่านหน้า Settings > Roles) ทำให้ hasModuleAccess() ใน core/permissions.js เจอ
// "role ไม่มีข้อมูลกำหนดสิทธิ์" แล้ว fail-open (คืนค่าอนุญาตเสมอ) กับทุก role จริงๆ — ทุกตำแหน่งเห็นทุกเมนู/
// เข้าทุกหน้าได้ผ่านการพิมพ์ URL ตรง ระบบจำกัดสิทธิ์หน้าจอทั้งระบบไม่มีผลจริงมาตลอด (Firestore Rules ยัง
// ป้องกันข้อมูลจริงอยู่ ไม่ใช่ช่องโหว่ข้อมูลรั่ว แต่เป็นช่องโหว่ระดับ UI/defense-in-depth) แก้โดยสร้างฟังก์ชัน
// seeding นี้ (ปลอดภัยกดซ้ำได้ — สร้างเฉพาะ role ที่ "ยังไม่มี" เอกสารอยู่ ไม่ทับของที่เจ้าของแก้ไขเองไว้แล้ว)
// ให้กดจากปุ่มในหน้า Settings > Roles (เจ้าของ/แอดมินเท่านั้น) ไม่ auto-run เอง — เป็นค่าเริ่มต้นที่แนะนำ
// ตามแผนก แก้ไขเพิ่ม/ลดได้ทีหลังจากหน้า Settings > Roles ตามปกติ
export async function seedDefaultRolePermissions() {
  const snap = await getDocs(collection(db, 'roles'))
  const existing = new Set(snap.docs.map(d => d.id))
  let seeded = 0, skipped = 0
  for (const [roleId, data] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
    if (existing.has(roleId)) { skipped++; continue }
    await setDoc(doc(db, 'roles', roleId), { ...data, updatedAt: serverTimestamp() })
    seeded++
  }
  logAction('update', 'roles', 'seed', `ตั้งค่าสิทธิ์เริ่มต้น ${seeded} ตำแหน่ง (ข้าม ${skipped} ตำแหน่งที่มีการกำหนดไว้แล้ว)`)
  return { seeded, skipped }
}

export async function updateDocData(colName, id, data, actorOverride) {
  const clean = deepSanitize(data)
  const isDelete = !!(data && data.deleted === true)
  const action = isDelete ? 'delete' : 'update'
  const detail = isDelete ? `ลบข้อมูลใน ${colName}` : `แก้ไขข้อมูลใน ${colName}`
  await updateDoc(doc(db, colName, id), { ...clean, updatedAt: serverTimestamp() })
  logAction(action, colName, id, detail, actorOverride)
  awardGamePoints(action, colName, id, clean).catch(() => {})
  if (isDelete) {
    syncRagChunk(colName, id, { deleted: true }).catch(() => {})
  } else if (RAG_SOURCE_COLLECTIONS.includes(colName)) {
    // ต้องอ่านเอกสารฉบับเต็มมาประกอบ text ใหม่ — payload ของการแก้ไขอาจมีแค่บางฟิลด์ (partial update)
    getDoc(doc(db, colName, id)).then(snap => {
      if (snap.exists()) syncRagChunk(colName, id, { id: snap.id, ...snap.data() })
    }).catch(() => {})
  }
}

export async function softDelete(colName, id) {
  return updateDocData(colName, id, { deleted: true, deletedAt: new Date().toISOString() })
}

// (v1.0.351) Data Retention Policy ต้อง "ลบจริง" ถาวร (ไม่ใช่ soft-delete — soft-delete ยังกินพื้นที่/แถว
// ใน Firestore ตลอดไป ไม่ตอบโจทย์การล้างข้อมูลเก่าจริงๆ) ต้องกดยืนยันเองทุกครั้งจากหน้า UI เท่านั้น ไม่มี
// cron ลบอัตโนมัติ (ตัดสินใจร่วมกับเจ้าของแล้วว่าเสี่ยงเกินไปสำหรับ MVP แรก) — ใช้ deleteDoc() ของ Firestore
// SDK ตรงๆ (import ไว้อยู่แล้วแต่ไม่มีจุดไหนเรียกใช้มาก่อนเลย)
export async function hardDeleteDoc(colName, id) {
  await deleteDoc(doc(db, colName, id))
  logAction('delete', colName, id, `ลบถาวรจาก ${colName} (Data Retention)`)
}

export async function listDocs(colName, filters = [], sortBy = 'createdAt', sortDir = 'desc', maxDocs = 100) {
  let q = collection(db, colName)
  const constraints = [...filters.map(([f, op, v]) => where(f, op, v)), orderBy(sortBy, sortDir), limit(maxDocs)]
  q = query(q, ...constraints)
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

// ดึงเอกสาร "ทั้งหมด" จริงๆ ไม่ใช่แค่ N แถวล่าสุดแบบ listDocs — วนดึงเป็นก้อนด้วย cursor (startAfter) จนกว่า
// จะหมดจริง เหมาะกับข้อมูลที่ใช้คำนวณสถิติ "รวมทั้งหมด/ตลอดเวลา" ที่ต้องถูกครบทุกแถว (เช่น getSalesData()
// ด้านล่าง — เดิมใช้ listDocs cap 1000 แถว ทำให้ตัวเลข "ยอดขายรวม/กำไรสุทธิรวม" ผิดเงียบๆทันทีที่มีใบจอง
// เกิน 1000 ใบ เพราะใบจองเก่าสุดถูกตัดออกไปโดยไม่มี error/สัญญาณอะไรเลย) ไม่ใช้กับหน้าที่แค่ต้องการรายการ
// ล่าสุด N รายการ (ใช้ listDocs ตามเดิม เพราะดึงทั้งหมดแพงกว่าถ้าไม่จำเป็น)
export async function listAllDocs(colName, filters = [], sortBy = 'createdAt', sortDir = 'desc', batchSize = 500) {
  const all = []
  let cursor = null
  const baseConstraints = [...filters.map(([f, op, v]) => where(f, op, v)), orderBy(sortBy, sortDir)]
  for (let i = 0; i < 50; i++) { // เพดานกันวนลูปไม่จบ (50×500 = 25,000 เอกสาร) ไม่ใช่ข้อจำกัดทางธุรกิจจริง
    const constraints = cursor ? [...baseConstraints, startAfter(cursor), limit(batchSize)] : [...baseConstraints, limit(batchSize)]
    const snap = await getDocs(query(collection(db, colName), ...constraints))
    if (snap.empty) break
    all.push(...snap.docs.map(d => ({ id: d.id, ...d.data() })))
    if (snap.docs.length < batchSize) break
    cursor = snap.docs[snap.docs.length - 1]
  }
  return all
}

// เหมือน listDocs แต่รับ callback แล้วอัปเดตสดทุกครั้งที่ข้อมูลเปลี่ยนบน Firestore (ของตัวเองหรือคนอื่น)
// คืนค่า unsubscribe — หน้าที่เรียกต้องเก็บไว้เรียกตอนออกจากหน้า ไม่งั้น listener จะรั่วค้างไปเรื่อยๆ
export function watchDocs(colName, filters = [], sortBy = 'createdAt', sortDir = 'desc', maxDocs = 100, callback) {
  let q = collection(db, colName)
  const constraints = [...filters.map(([f, op, v]) => where(f, op, v)), orderBy(sortBy, sortDir), limit(maxDocs)]
  q = query(q, ...constraints)
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  }, err => {
    console.error('[watchDocs]', colName, err)
    callback([]) // แจ้ง [] แทนการปล่อยให้ผู้เรียกที่รอ snapshot แรกค้างตลอดไป (เช่น permission denied)
  })
}

// Demo mode ถูกลบออกจากระบบแล้ว (2026-07-23) — seedDemoData() คงไว้เป็น no-op เฉยๆ เพราะยังมี
// การเรียกอยู่ใน 231 หน้าทั่วทั้งแอป การลบฟังก์ชันนี้ทิ้งจะต้องแก้ทุกหน้าที่เรียกโดยไม่ได้ประโยชน์
// เพิ่มขึ้นจริง (เรียกแล้วไม่ทำอะไรอยู่ดี) จึงปล่อยไว้แบบนี้เพื่อความเสี่ยงต่ำที่สุด
export function seedDemoData() {
  return Promise.resolve()
}

// ── แหล่งข้อมูลการขายกลาง: แปลงจาก "ใบจอง" (bookings) → รูปแบบ sales ──────────────
// ทุกหน้าการเงิน/กำไร/คอมมิชชั่น เรียกใช้ตัวนี้ → ตัวเลขตรงกับใบจองเสมอ
export async function getSalesData() {
  let bookings = []
  // ใช้ listAllDocs (ไม่ใช่ listDocs cap ตายตัว) — ฟังก์ชันนี้เป็นแหล่งข้อมูลกลางให้ทุกหน้าการเงิน/แดชบอร์ด/
  // CRM คำนวณสถิติ "รวมทั้งหมด/ตลอดเวลา" (ยอดขายรวม, กำไรสุทธิรวม, Customer Lifetime Value ฯลฯ) ต้องได้
  // ใบจองครบทุกใบจริงๆ ไม่ใช่แค่ 1,000 ใบล่าสุด
  try { bookings = await listAllDocs('bookings', [], 'createdAt', 'desc') } catch (e) {}
  return bookings
    // softDelete() ไม่ได้ลบเอกสารจริง แค่ตั้ง deleted:true — ถ้าไม่กรองออกตรงนี้ ใบจองที่ "ลบ" ไปแล้วจะยัง
    // ปนอยู่ใน Dashboard/คอมมิชชั่น/รายงานการเงินทุกหน้าที่เรียกใช้ฟังก์ชันกลางนี้
    .filter(b => !b.deleted && b.status !== 'ถอนจอง')
    .map(b => ({
      id: b.id, bookingNo: b.bookingNo,
      date: b.actualDeliveryDate || b.cutDate || b.bookingDate || (b.createdAt || '').slice(0, 10),
      custName: b.custName, phone: b.phone || '', brand: b.brand, model: ((b.model || '') + ' ' + (b.variant || '')).trim(), plate: b.vin || '',
      salePrice: b.price || 0, cost: b.cost || 0, financeAmount: b.financeAmount || 0,
      finance: b.comFinance || 0, insurance: b.insuranceAmount || 0, accessory: b.accessoryAmount || 0, discount: 0,
      margin: b.margin || 0, marginLeft: b.marginLeft || 0, totalIncome: b.totalIncome || 0,
      com70: b.com70 || 0, comFinance: b.comFinance || 0, budgetUsed: b.budgetUsed || 0,
      financeCo: b.financeCo || '', salesName: b.salesName || '', status: b.status || '',
      delivered: b.status === 'ส่งมอบแล้ว',
      createdAt: b.createdAt,
    }))
}

// คอมมิชชั่นกลาง: สรุปจากใบจองที่ส่งมอบแล้ว แยกตามเซลส์/เดือน
export async function getCommissionData() {
  const sales = await getSalesData()
  const byKey = {}
  sales.filter(s => s.delivered).forEach(s => {
    const month = (s.date || '').slice(0, 7)
    const key = s.salesName + '|' + month
    if (!byKey[key]) byKey[key] = { id: key, salesName: s.salesName, month, carsSold: 0, salePriceTotal: 0, financeTotal: 0, insuranceTotal: 0, accessoryTotal: 0, com70Total: 0, comFinanceTotal: 0, incomeTotal: 0, status: 'pending' }
    const c = byKey[key]
    c.carsSold++; c.salePriceTotal += s.salePrice; c.financeTotal += s.financeAmount
    // เดิม insuranceTotal/accessoryTotal ประกาศไว้ตอนสร้าง object แต่ไม่มีจุดไหนบวกเพิ่มเลย (ค้างที่ 0 ตลอด
    // ทุกครั้ง) เพราะ getSalesData() เองก็ hardcode insurance/accessory เป็น 0 มาก่อน — ตอนนี้ทั้งคู่มีข้อมูล
    // จริงจาก bookings.insuranceAmount/accessoryAmount แล้ว (ดู Bookings.js) จึงบวกสะสมได้จริง
    c.insuranceTotal += s.insurance; c.accessoryTotal += s.accessory
    c.com70Total += s.com70; c.comFinanceTotal += s.comFinance; c.incomeTotal += s.totalIncome
  })
  return Object.values(byKey)
}
