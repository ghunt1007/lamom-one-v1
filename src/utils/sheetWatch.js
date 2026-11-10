// (2026-11-02) เช็ก Google Sheet DATA Booking ทุกชั่วโมง (เจ้าของโปรแกรมเท่านั้น ระหว่างเปิดแอปอยู่)
// ถ้า Sheet ถูกแก้หลังการซิงก์ครั้งล่าสุด → เด้งแถบเล็กมุมล่าง "Sheet มีแก้ไข · ซิงก์เลย" กดทีเดียวเปิดหน้าซิงก์
// ไม่ซิงก์เองโดยไม่ถาม เพราะการซิงก์มีลบ/แก้ข้อมูล ต้องให้เจ้าของเห็นก่อนทุกครั้ง
// ยังไม่ได้แชร์ไฟล์ให้ระบบ/ออฟไลน์ → เงียบ (ปุ่ม 🔄 ซิงก์ Sheet จะบอกวิธีแก้เอง)
import { isProgramOwner } from '../core/hierarchy.js'
import { dmy as fmtDMY, hm as fmtHM } from './format.js'

export const SHEET_WATCH_MS = 60 * 60 * 1000
const SYNCED_KEY = 'lamom_sheet_synced_mod'
const DISMISS_KEY = 'lamom_sheet_dismissed_mod'

const read = k => { try { return localStorage.getItem(k) || '' } catch { return '' } }
const write = (k, v) => { try { localStorage.setItem(k, v) } catch {} }

// true = Sheet ใหม่กว่าที่ซิงก์ไว้ และยังไม่ได้กดปิดแถบของเวอร์ชันนี้
export function sheetNeedsSync(modifiedTime, syncedMod, dismissedMod) {
  const m = Date.parse(modifiedTime || '')
  if (!m) return false
  if (dismissedMod && dismissedMod === modifiedTime) return false
  const s = Date.parse(syncedMod || '')
  return !s || m > s
}

function showBar(modifiedTime, open) {
  if (document.getElementById('sheet-watch-bar')) return
  const bar = document.createElement('div')
  bar.id = 'sheet-watch-bar'
  bar.setAttribute('role', 'status')
  bar.style.cssText = 'position:fixed;left:12px;right:12px;bottom:calc(76px + env(safe-area-inset-bottom,0px));z-index:900;max-width:420px;margin:0 auto;display:flex;gap:8px;align-items:center;background:var(--surface);color:var(--text);border:1px solid var(--primary);border-radius:12px;padding:10px 12px;box-shadow:0 6px 24px rgba(0,0,0,.18);font-size:0.85rem'
  const when = `${fmtDMY(modifiedTime)} ${fmtHM(modifiedTime)}`
  bar.innerHTML = `<span style="flex:1;min-width:0">📄 Sheet มีแก้ไข (${when})</span>
    <button class="btn btn-primary btn-sm" id="sw-go" style="white-space:nowrap">🔄 ซิงก์เลย</button>
    <button class="btn btn-ghost btn-sm" id="sw-x" aria-label="ปิด">✕</button>`
  document.body.appendChild(bar)
  bar.querySelector('#sw-go').addEventListener('click', () => { bar.remove(); open() })
  bar.querySelector('#sw-x').addEventListener('click', () => { bar.remove(); write(DISMISS_KEY, modifiedTime) })
}

let lastCheck = 0
async function check() {
  if (!isProgramOwner() || document.hidden) return
  lastCheck = Date.now()
  try {
    const { getSheetStatus } = await import('./dailyReport.js')
    const { modifiedTime } = await getSheetStatus()
    if (!sheetNeedsSync(modifiedTime, read(SYNCED_KEY), read(DISMISS_KEY))) return
    showBar(modifiedTime, async () => {
      const { openSheetReconcile } = await import('./sheetReconcileModal.js')
      openSheetReconcile({ onDone: () => window.dispatchEvent(new PopStateEvent('popstate')) })
    })
  } catch { /* ยังไม่ได้ตั้งค่า/ออฟไลน์ — เงียบไว้ */ }
}

let timer = null
export function initSheetWatch() {
  if (timer) return
  setTimeout(check, 15000)
  timer = setInterval(check, SHEET_WATCH_MS)
  // (v1.0.958) กลับมาเปิดแอป/สลับแท็บกลับมา → เช็กเลย (ไม่เกินทุก 10 นาที) ไม่ต้องรอครบชั่วโมง
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && Date.now() - lastCheck > 10 * 60 * 1000) check()
  })
}
