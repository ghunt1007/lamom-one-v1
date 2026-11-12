// Session Timeout — auto-logout after 30 min idle
// (v1.0.1077) หลายหน้าต่างพร้อมกัน: การออกจากระบบมีผลทุกหน้าต่าง (Firebase ใช้การล็อกอินร่วมกัน) เดิมแต่ละหน้าต่าง
// นับเวลาว่างของตัวเอง → หน้าต่างที่เปิดค้างไว้อีกจอ (ไม่มีใครแตะ) เตะทุกคนออกทั้งที่ยังทำงานอยู่ในอีกหน้าต่าง
// ตอนนี้ทุกหน้าต่างแชร์ "ใช้งานล่าสุด" ผ่าน localStorage — ออกจากระบบเมื่อไม่มีการใช้งานในทุกหน้าต่างครบ 30 นาทีเท่านั้น
const IDLE_MS      = 30 * 60 * 1000
const WARN_MS      = 25 * 60 * 1000
const EVENTS       = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll', 'pointerdown']

let idleTimer  = null
let warnTimer  = null
let warnToast  = null
let onLogout   = null
const SHARED_KEY  = 'lamom_last_active'
const WRITE_EVERY = 15 * 1000
let lastWrite  = 0

function readShared() {
  try { return +localStorage.getItem(SHARED_KEY) || 0 } catch { return 0 }
}
function writeShared(now) {
  if (now - lastWrite < WRITE_EVERY) return
  lastWrite = now
  try { localStorage.setItem(SHARED_KEY, String(now)) } catch { /* */ }
}

// เวลาที่เหลือก่อนออกจากระบบ (ms) จากการใช้งานล่าสุดของทุกหน้าต่าง — export ไว้ทดสอบ
export function idleRemaining(now, lastLocal, lastShared, idleMs = IDLE_MS) {
  return idleMs - (now - Math.max(lastLocal || 0, lastShared || 0))
}
let lastLocal = 0

function clearWarnToast() {
  if (warnToast) { warnToast.remove(); warnToast = null }
}

function showWarnToast() {
  clearWarnToast()
  warnToast = document.createElement('div')
  warnToast.id = 'session-warn-toast'
  warnToast.style.cssText = `
    position:fixed;bottom:80px;left:50%;transform:translateX(-50%);
    background:var(--warning);color:#fff;padding:10px 20px;
    border-radius:8px;font-size:0.85rem;font-weight:600;z-index:99999;
    box-shadow:0 4px 16px rgba(0,0,0,0.25);display:flex;gap:12px;align-items:center
  `
  warnToast.innerHTML = `⚠️ ไม่มีการใช้งาน 25 นาที — ระบบจะออกจากระบบอัตโนมัติใน 5 นาที
    <button onclick="document.getElementById('session-warn-toast')?.remove()" style="background:rgba(255,255,255,0.25);border:none;color:#fff;padding:2px 8px;border-radius:4px;cursor:pointer;font-size:0.8rem">ยกเลิก</button>`
  document.body.appendChild(warnToast)
}

function schedule(remainingMs) {
  clearTimeout(idleTimer)
  clearTimeout(warnTimer)
  clearWarnToast()
  const warnIn = remainingMs - (IDLE_MS - WARN_MS)
  if (warnIn > 0) warnTimer = setTimeout(showWarnToast, warnIn)
  else showWarnToast()
  idleTimer = setTimeout(() => {
    // ก่อนออกจริง เช็กอีกครั้งว่าหน้าต่างอื่นเพิ่งมีคนใช้ไหม (เขียนค่ารวมทุก 15 วิ)
    const left = idleRemaining(Date.now(), lastLocal, readShared())
    if (left > 1000) { schedule(left); return }
    clearWarnToast()
    if (onLogout) onLogout()
  }, Math.max(0, remainingMs))
}

function reset() {
  const now = Date.now()
  lastLocal = now
  writeShared(now)
  schedule(IDLE_MS)
}

// หน้าต่างอื่นมีการใช้งาน → เริ่มนับใหม่ที่หน้าต่างนี้ด้วย (และปิดแถบเตือน)
function onStorage(e) {
  if (e.key !== SHARED_KEY || !onLogout) return
  schedule(idleRemaining(Date.now(), lastLocal, +e.newValue || 0))
}

export function initSessionTimeout(logoutCallback) {
  onLogout = logoutCallback
  EVENTS.forEach(e => document.addEventListener(e, reset, { passive: true }))
  window.addEventListener('storage', onStorage)
  lastWrite = 0
  reset()
}

export function destroySessionTimeout() {
  clearTimeout(idleTimer)
  clearTimeout(warnTimer)
  clearWarnToast()
  EVENTS.forEach(e => document.removeEventListener(e, reset))
  window.removeEventListener('storage', onStorage)
  onLogout = null
}
