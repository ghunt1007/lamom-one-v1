// (v1.0.964) ต้นเหตุจริงของ "พิมพ์แล้วเด้ง พิมพ์ได้ตัวเดียว" ตอนใช้งานจริง (บนเครื่องทดสอบไม่เกิด เพราะเน็ตเร็วมาก)
//
// ทุกครั้งที่บันทึก (updateDocData/createDoc) เราใส่ updatedAt = เวลาของเซิร์ฟเวอร์ — Firestore จึงแจ้งข้อมูลเปลี่ยน 2 รอบ:
//   รอบ 1 ทันที (ค่าในเครื่อง updatedAt ยังว่าง) · รอบ 2 อีก 0.2–2 วินาทีต่อมาเมื่อเซิร์ฟเวอร์ตอบ (updatedAt ได้ค่าจริง)
// รอบ 2 ไม่มีอะไรเปลี่ยนให้เห็นเลย แต่หน้าเพจวาดใหม่ทั้งหน้า — ซึ่งมักตรงกับตอนที่ผู้ใช้กำลังพิมพ์ช่องถัดไปพอดี
// บวกกับการแก้จากเครื่องอื่น (เพื่อนร่วมทีม) ที่เข้ามาระหว่างพิมพ์ → ช่องที่พิมพ์ถูกสร้างใหม่ คีย์บอร์ดมือถือปิด
//
// แก้ 2 ชั้น ที่จุดเดียวที่ทุกหน้าใช้ (db.js watchDocs):
// 1) makeChangeFilter — ไม่แจ้งรอบที่เปลี่ยนแค่เวลาประทับ (updatedAt/createdAt) ของเซิร์ฟเวอร์
// 2) deliverWhenIdle — ถ้ากำลังพิมพ์อยู่ (กดแป้นภายใน 1.2 วิ หรือกำลังประกอบคำภาษาไทย/IME) พักการแจ้งไว้
//    แล้วแจ้งครั้งเดียวด้วยข้อมูลล่าสุดเมื่อหยุดพิมพ์ หรือออกจากช่อง — ข้อมูลยังสดเหมือนเดิม แค่ไม่แทรกกลางคำ

const STAMP_KEYS = ['updatedAt', 'createdAt', 'serverUpdatedAt']

function sigOf(data) {
  try {
    const o = { ...data }
    for (const k of STAMP_KEYS) delete o[k]
    return JSON.stringify(o)
  } catch { return null } // ข้อมูลแปลก (อ้างอิงวน) → ถือว่าเปลี่ยน
}

// คืนฟังก์ชัน (snap) => true ถ้ามีข้อมูลเปลี่ยนจริง (ต้องแจ้งหน้าเพจ)
export function makeChangeFilter() {
  const seen = new Map()
  let first = true
  return snap => {
    const changes = typeof snap?.docChanges === 'function' ? snap.docChanges() : null
    if (!changes) return true
    let real = first
    first = false
    for (const ch of changes) {
      const id = ch.doc.id
      if (ch.type === 'removed') { seen.delete(id); real = true; continue }
      const s = sigOf(ch.doc.data())
      if (ch.type === 'added' || s === null || seen.get(id) !== s) real = true
      seen.set(id, s)
    }
    return real
  }
}

// ── พักการวาดหน้าใหม่ระหว่างพิมพ์ ─────────────────────────────────────────
const IDLE_MS = 1200
let lastType = 0
let composing = false
const installedOn = new WeakSet()
const pending = new Map() // watcher → ฟังก์ชันแจ้งข้อมูลล่าสุด
let timer = null
let gateDoc = null

function textActive(doc) {
  const a = doc?.activeElement
  if (!a || !a.tagName) return false
  if (a.isContentEditable) return true
  if (a.tagName === 'TEXTAREA') return true
  return a.tagName === 'INPUT' && /^(text|search|tel|email|url|number|password|)$/.test((a.getAttribute('type') || '').toLowerCase())
}

export function isTypingNow(now = Date.now(), doc = globalThis.document) {
  if (!doc || !textActive(doc)) return false
  return composing || now - lastType < IDLE_MS
}

function flush() {
  clearTimeout(timer); timer = null
  const fns = [...pending.values()]
  pending.clear()
  for (const fn of fns) { try { fn() } catch (e) { console.error('[watchDocs]', e) } }
}

function schedule() {
  if (timer) return
  const tick = () => {
    timer = null
    if (!pending.size) return
    if (isTypingNow(Date.now(), gateDoc || globalThis.document)) { timer = setTimeout(tick, 250); return }
    flush()
  }
  timer = setTimeout(tick, 250)
}

function install(doc) {
  if (!doc?.addEventListener || installedOn.has(doc)) return
  installedOn.add(doc)
  const mark = () => { lastType = Date.now() }
  doc.addEventListener('keydown', mark, true)
  doc.addEventListener('input', mark, true)
  doc.addEventListener('compositionstart', () => { composing = true; mark() }, true)
  doc.addEventListener('compositionend', () => { composing = false; mark() }, true)
  // ออกจากช่อง (กดปุ่มบันทึก/แตะที่อื่น) → แสดงข้อมูลล่าสุดทันที
  doc.addEventListener('focusout', () => setTimeout(() => { if (pending.size && !isTypingNow(Date.now(), doc)) flush() }, 0), true)
}

// key = ตัวระบุ watcher (ข้อมูลรอบใหม่แทนรอบเก่าที่ยังพักอยู่ — แจ้งแค่ครั้งล่าสุด)
export function deliverWhenIdle(key, fn, doc = globalThis.document) {
  install(doc)
  gateDoc = doc
  if (!isTypingNow(Date.now(), doc)) { pending.delete(key); fn(); return }
  pending.set(key, fn)
  schedule()
}

export function cancelPending(key) { pending.delete(key) }
export function __resetTypingGate() { lastType = 0; composing = false; pending.clear(); clearTimeout(timer); timer = null }
