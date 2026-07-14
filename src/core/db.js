// Firestore helpers — thin wrapper with offline demo support
import { db } from './firebase.js'
import {
  collection, doc, addDoc, setDoc, updateDoc, deleteDoc,
  getDoc, getDocs, query, where, orderBy, limit,
  onSnapshot, serverTimestamp, Timestamp,
} from 'firebase/firestore'
import { getState } from './store.js'

// ── Input sanitization — strip stored XSS before Firestore writes ──
function deepSanitize(v) {
  if (typeof v === 'string') return v.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '').replace(/\bon\w+\s*=/gi, '')
  if (Array.isArray(v)) return v.map(deepSanitize)
  if (v && typeof v === 'object' && !(v instanceof Date)) return Object.fromEntries(Object.entries(v).map(([k, w]) => [k, deepSanitize(w)]))
  return v
}

// ── Demo store (in-memory when no Firebase) ─────────────────
// Pinned to window so all Vite module instances share the same object across HMR reloads
const demoStore = window.__lamomDemoStore || (window.__lamomDemoStore = {})

function isDemoMode() {
  const user = getState('user')
  return user?.uid === 'demo-user'
}

function demoCol(col) {
  if (!demoStore[col]) demoStore[col] = {}
  return demoStore[col]
}

function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

// ── Audit log ────────────────────────────────────────────────
// บันทึกทุกการเปลี่ยนแปลง (create/update/delete) ของทุก collection ลง audit_log
// ต้องไม่ throw ออกไปนอกฟังก์ชัน — ถ้า logging พัง ต้องไม่กระทบการทำงานจริง (fire-and-forget-safe)
function logAction(action, colName, id, detail) {
  if (colName === 'audit_log') return // ป้องกัน log การ log ตัวเอง (recursion)
  try {
    const user = getState('user') || {}
    const payload = {
      user: user.displayName || user.email || user.uid || 'unknown',
      role: user.role || '',
      action,
      module: colName,
      resource: id != null ? String(id) : '-',
      detail: detail || '',
      ts: new Date().toISOString(),
    }
    if (isDemoMode()) {
      const logId = genId()
      demoCol('audit_log')[logId] = { id: logId, ...payload }
      return
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
    if (isDemoMode()) return demoCol(colName)[id] || null
    const snap = await getDoc(doc(db, colName, id))
    return snap.exists() ? { id: snap.id, ...snap.data() } : null
  } catch (e) { return null }
}

// เซ็ต flag "ให้แต้มไปแล้ว" แบบเงียบๆ (ไม่ผ่าน updateDocData) เพื่อกันเรียก logAction/awardGamePoints ซ้ำ
function setFlagQuiet(colName, id, field) {
  try {
    if (isDemoMode()) {
      const col = demoCol(colName)
      if (col[id]) col[id][field] = true
      return
    }
    updateDoc(doc(db, colName, id), { [field]: true }).catch(() => {})
  } catch (e) {}
}

async function findStaffPointsDoc(userName) {
  if (isDemoMode()) {
    const rows = Object.entries(demoCol('staff_points')).map(([k, v]) => ({ id: k, ...v }))
    return rows.find(s => s.name === userName) || null
  }
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
      await updateDocData('staff_points', existing.id, { points: (existing.points || 0) + points })
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

export async function createDoc(colName, data) {
  // ตัด field "id" ที่ผู้เรียกอาจใส่มาเองทิ้งก่อนเสมอ — ป้องกันไปทับ id จริงที่ระบบ
  // สร้างให้ (genId() ใน demo / ref.id ของ Firestore จริง) ซึ่งเป็นตัวที่ listDocs/updateDocData
  // ใช้อ้างอิง record จริง — ถ้าปล่อยให้ทับ จะทำให้ document key กับ .id field ไม่ตรงกัน
  // (แก้ไข/ลบ record หลังจากนั้นจะพลาดเป้าแบบเงียบๆ)
  const { id: _ignoredId, ...rest } = data || {}
  const clean = deepSanitize(rest)
  const payload = { ...clean, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
  if (isDemoMode()) {
    const id = genId()
    demoCol(colName)[id] = { id, ...payload }
    logAction('create', colName, id, `สร้างข้อมูลใหม่ใน ${colName}`)
    awardGamePoints('create', colName, id, clean).catch(() => {})
    return id
  }
  const ref = await addDoc(collection(db, colName), { ...clean, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
  logAction('create', colName, ref.id, `สร้างข้อมูลใหม่ใน ${colName}`)
  awardGamePoints('create', colName, ref.id, clean).catch(() => {})
  return ref.id
}

export async function readDoc(colName, id) {
  if (isDemoMode()) return demoCol(colName)[id] || null
  const snap = await getDoc(doc(db, colName, id))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export async function updateDocData(colName, id, data) {
  const clean = deepSanitize(data)
  const payload = { ...clean, updatedAt: new Date().toISOString() }
  const isDelete = !!(data && data.deleted === true)
  const action = isDelete ? 'delete' : 'update'
  const detail = isDelete ? `ลบข้อมูลใน ${colName}` : `แก้ไขข้อมูลใน ${colName}`
  if (isDemoMode()) {
    const col = demoCol(colName)
    col[id] = { ...(col[id] || {}), ...payload }
    logAction(action, colName, id, detail)
    awardGamePoints(action, colName, id, clean).catch(() => {})
    return
  }
  await updateDoc(doc(db, colName, id), { ...clean, updatedAt: serverTimestamp() })
  logAction(action, colName, id, detail)
  awardGamePoints(action, colName, id, clean).catch(() => {})
}

export async function softDelete(colName, id) {
  return updateDocData(colName, id, { deleted: true, deletedAt: new Date().toISOString() })
}

export async function listDocs(colName, filters = [], sortBy = 'createdAt', sortDir = 'desc', maxDocs = 100) {
  if (isDemoMode()) {
    let rows = Object.values(demoCol(colName)).filter(r => !r.deleted)
    filters.forEach(([field, op, val]) => {
      rows = rows.filter(r => {
        if (op === '==') return r[field] === val
        if (op === '!=') return r[field] !== val
        if (op === 'in') return Array.isArray(val) && val.includes(r[field])
        if (op === '>=') return r[field] >= val
        if (op === '<=') return r[field] <= val
        return true
      })
    })
    rows.sort((a, b) => {
      const av = a[sortBy] || '', bv = b[sortBy] || ''
      return sortDir === 'desc' ? (bv > av ? 1 : -1) : (av > bv ? 1 : -1)
    })
    return rows.slice(0, maxDocs)
  }
  let q = collection(db, colName)
  const constraints = [...filters.map(([f, op, v]) => where(f, op, v)), orderBy(sortBy, sortDir), limit(maxDocs)]
  q = query(q, ...constraints)
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

// Demo seed data
// Demo seed data — ย้ายไป demoSeedData.js (โหลด lazy เฉพาะโหมด Demo ครั้งแรก)
// คืน Promise เสมอ: main.js / Login.js จะ await ก่อนเข้าหน้าแรก ส่วนหน้าอื่นเรียกซ้ำได้ (idempotent)
let _seedPromise = null
export function seedDemoData() {
  if (!isDemoMode()) return Promise.resolve()
  if (!_seedPromise) _seedPromise = import('./demoSeedData.js').then(m => m.runSeed(demoCol))
  return _seedPromise
}

// ── แหล่งข้อมูลการขายกลาง: แปลงจาก "ใบจอง" (bookings) → รูปแบบ sales ──────────────
// ทุกหน้าการเงิน/กำไร/คอมมิชชั่น เรียกใช้ตัวนี้ → ตัวเลขตรงกับใบจองเสมอ
export async function getSalesData() {
  let bookings = []
  try { bookings = await listDocs('bookings', [], 'createdAt', 'desc', 1000) } catch (e) {}
  return bookings
    .filter(b => b.status !== 'ถอนจอง')
    .map(b => ({
      id: b.id, bookingNo: b.bookingNo,
      date: b.actualDeliveryDate || b.cutDate || b.bookingDate || (b.createdAt || '').slice(0, 10),
      custName: b.custName, brand: b.brand, model: ((b.model || '') + ' ' + (b.variant || '')).trim(), plate: b.vin || '',
      salePrice: b.price || 0, cost: b.cost || 0, financeAmount: b.financeAmount || 0,
      finance: b.comFinance || 0, insurance: 0, accessory: 0, discount: 0,
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
    c.com70Total += s.com70; c.comFinanceTotal += s.comFinance; c.incomeTotal += s.totalIncome
  })
  return Object.values(byKey)
}

export { demoStore, isDemoMode }
