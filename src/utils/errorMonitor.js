// Client-side error monitoring — จับ error/unhandledrejection ทั่วทั้งแอปอัตโนมัติ
// บันทึกลง collection 'error_log' ผ่าน core/db.js (ได้ audit trail ฟรีเพราะ createDoc มี hook อยู่แล้ว)
import { createDoc } from '../core/db.js'
import { getState } from '../core/store.js'

const seen = new Map() // signature → last-logged timestamp (ms), กันสแปมถ้า error เดิมเกิดรัวๆ
const DEDUPE_WINDOW_MS = 15000
const MAX_PER_SESSION = 100
let count = 0

function signature(message, source, line) {
  return `${message}|${source}|${line}`
}

async function logError(message, source, line, col, stack) {
  try {
    if (count >= MAX_PER_SESSION) return
    const sig = signature(message, source, line)
    const now = Date.now()
    const last = seen.get(sig)
    if (last && now - last < DEDUPE_WINDOW_MS) return
    seen.set(sig, now)
    count++
    const user = getState('user')
    await createDoc('error_log', {
      message: String(message || '').slice(0, 500),
      source: String(source || '').slice(0, 300),
      line: line || null,
      col: col || null,
      stack: String(stack || '').slice(0, 2000),
      url: location.pathname + location.hash,
      userAgent: navigator.userAgent,
      userName: user?.displayName || user?.email || 'unknown',
    })
  } catch { /* ห้ามให้ error-logger เองพังแอป */ }
}

export function initErrorMonitor() {
  window.addEventListener('error', (e) => {
    logError(e.message, e.filename, e.lineno, e.colno, e.error?.stack)
  })
  window.addEventListener('unhandledrejection', (e) => {
    const reason = e.reason
    const message = reason?.message || String(reason)
    logError(message, location.pathname, null, null, reason?.stack)
  })
}
