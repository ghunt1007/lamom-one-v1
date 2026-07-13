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
    return id
  }
  const ref = await addDoc(collection(db, colName), { ...clean, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
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
  if (isDemoMode()) {
    const col = demoCol(colName)
    col[id] = { ...(col[id] || {}), ...payload }
    return
  }
  await updateDoc(doc(db, colName, id), { ...clean, updatedAt: serverTimestamp() })
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
