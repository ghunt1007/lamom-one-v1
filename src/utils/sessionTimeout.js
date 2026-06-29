// Session Timeout — auto-logout after 30 min idle
const IDLE_MS      = 30 * 60 * 1000
const WARN_MS      = 25 * 60 * 1000
const EVENTS       = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll', 'pointerdown']

let idleTimer  = null
let warnTimer  = null
let warnToast  = null
let onLogout   = null

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

function reset() {
  clearTimeout(idleTimer)
  clearTimeout(warnTimer)
  clearWarnToast()

  warnTimer = setTimeout(showWarnToast, WARN_MS)
  idleTimer = setTimeout(() => {
    clearWarnToast()
    if (onLogout) onLogout()
  }, IDLE_MS)
}

export function initSessionTimeout(logoutCallback) {
  onLogout = logoutCallback
  EVENTS.forEach(e => document.addEventListener(e, reset, { passive: true }))
  reset()
}

export function destroySessionTimeout() {
  clearTimeout(idleTimer)
  clearTimeout(warnTimer)
  clearWarnToast()
  EVENTS.forEach(e => document.removeEventListener(e, reset))
  onLogout = null
}
