// หลัง deploy ใหม่ ไฟล์ assets เดิม (ชื่อมี hash) ถูกแทนที่ หน้าเว็บที่เปิดค้างไว้จะโหลดโมดูลที่ import ทีหลังไม่ได้
// ("Failed to fetch dynamically imported module") — รีโหลดหน้าเองหนึ่งครั้งเพื่อเอาเวอร์ชันใหม่ แทนการโชว์ error
const KEY = 'lamom.staleReloadAt'
const STALE_RE = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i

export function isStaleChunkError(msg) { return STALE_RE.test(String(msg || '')) }

function reloadOnce() {
  let last = 0
  try { last = +sessionStorage.getItem(KEY) || 0 } catch (e) { /* ignore */ }
  if (Date.now() - last < 30000) return false   // เพิ่งรีโหลดไป — ไม่วนรีโหลด ถ้ายังพังให้ error ขึ้นตามปกติ
  try { sessionStorage.setItem(KEY, String(Date.now())) } catch (e) { /* ignore */ }
  location.reload()
  return true
}

export function initStaleChunkReload() {
  window.addEventListener('vite:preloadError', e => { if (reloadOnce()) e.preventDefault() })
  window.addEventListener('unhandledrejection', e => { if (isStaleChunkError(e.reason?.message || e.reason) && reloadOnce()) e.preventDefault() })
}
