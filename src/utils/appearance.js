// หน้าตาโปรแกรมที่ปรับเองได้ต่อเครื่อง (นอกจากสีธีม): โหมด มืด/สว่าง/ตามเครื่อง · ขนาดตัวอักษร · ความโค้งมุม ·
// ความหนาแน่น · เอฟเฟกต์ · ภาพพื้นหลัง (ภาพวาด/3D/รูปของฉัน) · การ์ด 3D — ตั้งค่าบน <html> ก่อน render แรก (ไม่กระพริบ)
// และเปลี่ยนสดได้จากหน้าต่าง "ปรับหน้าตา"
import { WALLPAPER_IDS, wallpaperCss } from '../data/wallpapers.js'

export const UI_DEFAULTS = { font: 'md', radius: 'md', density: 'normal', effects: 'on', wall: 'none', wallDim: 'normal', fx3d: 'off' }
export const UI_OPTIONS = {
  font: [['sm', 'เล็ก', 14], ['md', 'ปกติ', 15], ['lg', 'ใหญ่', 16.5], ['xl', 'ใหญ่มาก', 18]],
  radius: [['sm', 'เหลี่ยม'], ['md', 'มน'], ['lg', 'โค้งมาก']],
  density: [['normal', 'ปกติ'], ['compact', 'กะทัดรัด']],
  effects: [['on', 'เปิด'], ['off', 'เรียบ (ไม่มีลาย/อนิเมชัน)']],
  wall: [['none', 'ไม่มี'], ...WALLPAPER_IDS.map(id => [id, id]), ['custom', 'รูปของฉัน']],
  // ความทึบของม่านทับภาพ: ภาพชัด ↔ ตัวหนังสืออ่านง่าย (เปอร์เซ็นต์สีพื้นธีมที่ทับลงบนภาพ)
  wallDim: [['clear', 'ภาพชัด', 15], ['normal', 'พอดี', 40], ['dim', 'จาง', 65]],
  fx3d: [['off', 'ปกติ'], ['on', 'มีมิติ 3D']],
}
export const WALL_IMG_KEY = 'lamom_wall_img'
// ความโค้งมุม: null = ใช้ค่าของธีม/polish.css ตามเดิม
const RADIUS = { sm: [4, 6, 8, 12], md: null, lg: [10, 14, 22, 28] }
const UI_KEY = 'lamom_ui'

export function normalizeUi(raw) {
  const out = { ...UI_DEFAULTS }
  for (const k of Object.keys(UI_OPTIONS)) {
    if (UI_OPTIONS[k].some(([v]) => v === raw?.[k])) out[k] = raw[k]
  }
  return out
}

export function loadUi(storage = globalThis.localStorage) {
  try { return normalizeUi(JSON.parse(storage?.getItem(UI_KEY) || 'null')) } catch { return { ...UI_DEFAULTS } }
}

export function saveUi(ui, storage = globalThis.localStorage) {
  try { storage?.setItem(UI_KEY, JSON.stringify(normalizeUi(ui))) } catch { /* เก็บไม่ได้ก็ใช้ค่าเดิม */ }
}

export function applyUi(ui, root = globalThis.document?.documentElement) {
  if (!root) return
  const u = normalizeUi(ui)
  const px = UI_OPTIONS.font.find(([v]) => v === u.font)[2]
  root.style.fontSize = u.font === 'md' ? '' : px + 'px'
  const r = RADIUS[u.radius]
  ;['--radius-sm', '--radius-md', '--radius-lg', '--radius-xl'].forEach((k, i) => {
    if (r) root.style.setProperty(k, r[i] + 'px'); else root.style.removeProperty(k)
  })
  root.setAttribute('data-density', u.density)
  root.setAttribute('data-effects', u.effects)
  root.setAttribute('data-fx3d', u.fx3d)
  const img = wallImage(u.wall)
  if (img) root.setAttribute('data-wall', u.wall); else root.removeAttribute?.('data-wall')
  root.style.setProperty('--wall-dim', UI_OPTIONS.wallDim.find(([v]) => v === u.wallDim)[2] + '%')
  const doc = root.ownerDocument
  if (!doc?.body) return
  let el = doc.getElementById('lamom-wall')
  if (img && !el) { el = doc.createElement('div'); el.id = 'lamom-wall'; el.setAttribute('aria-hidden', 'true'); doc.body.prepend(el) }
  if (el) el.style.backgroundImage = img || 'none'
  if (u.fx3d === 'on') installTilt(doc)
}

// ภาพพื้นหลังที่ใช้จริง: ภาพในชุด หรือรูปที่อัปโหลดเก็บไว้ในเครื่อง (ไม่มีรูปก็ไม่มีพื้นหลัง)
export function wallImage(wall, storage = globalThis.localStorage) {
  if (wall === 'custom') {
    try { const d = storage?.getItem(WALL_IMG_KEY); return d ? `url("${d}")` : '' } catch { return '' }
  }
  return wall && wall !== 'none' ? wallpaperCss(wall) : ''
}

// ย่อรูปที่เลือกจากเครื่องให้ด้านยาวไม่เกิน 1920px เป็น JPEG แล้วเก็บในเครื่อง — รูปมือถือ 5–10MB เหลือราว 200–400KB
export async function saveWallImage(file, storage = globalThis.localStorage) {
  const url = URL.createObjectURL(file)
  try {
    const im = await new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = url })
    const k = Math.min(1, 1920 / Math.max(im.naturalWidth, im.naturalHeight))
    const c = document.createElement('canvas')
    c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k)
    c.getContext('2d').drawImage(im, 0, 0, c.width, c.height)
    let data = c.toDataURL('image/jpeg', 0.8)
    if (data.length > 1_500_000) data = c.toDataURL('image/jpeg', 0.6)
    storage.setItem(WALL_IMG_KEY, data)
    return true
  } finally { URL.revokeObjectURL(url) }
}

// การ์ดตัวเลขเอียงตามเมาส์เล็กน้อย (เฉพาะเมาส์ ไม่ทำบนจอสัมผัส และปิดเมื่อเครื่องตั้ง "ลดการเคลื่อนไหว")
let tiltOn = false
function installTilt(doc) {
  if (tiltOn || !globalThis.matchMedia?.('(hover: hover) and (pointer: fine)').matches) return
  if (globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  tiltOn = true
  let cur = null
  const reset = () => { if (cur) { cur.style.removeProperty('--rx'); cur.style.removeProperty('--ry'); cur = null } }
  doc.addEventListener('pointermove', e => {
    if (doc.documentElement.dataset.fx3d !== 'on') return reset()
    const el = e.target.closest?.('.kpi-card, .dash-kpi, .stat-card')
    if (el !== cur) reset()
    if (!el) return
    cur = el
    const r = el.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5
    el.style.setProperty('--rx', (-y * 8).toFixed(2) + 'deg')
    el.style.setProperty('--ry', (x * 10).toFixed(2) + 'deg')
  }, { passive: true })
  doc.addEventListener('pointerleave', reset, true)
}

// โหมด: 'dark' | 'light' | 'auto' (ตามการตั้งค่าของเครื่อง) → ค่าจริงที่ใส่ใน data-mode
export function resolveMode(pref, prefersDark) {
  if (pref === 'light' || pref === 'dark') return pref
  return prefersDark === false ? 'light' : 'dark'
}

let mq = null
export function applyMode(pref, root = globalThis.document?.documentElement) {
  if (!root) return
  const media = globalThis.matchMedia?.('(prefers-color-scheme: dark)')
  root.setAttribute('data-mode', resolveMode(pref, media ? media.matches : true))
  if (media && !mq) {
    mq = media
    // โหมด "ตามเครื่อง": เครื่องสลับมืด/สว่างเอง (เช่นตอนค่ำ) หน้าจอเปลี่ยนตามทันที
    media.addEventListener?.('change', () => {
      let p = 'dark'
      try { p = localStorage.getItem('lamom_mode') || 'dark' } catch { /* */ }
      if (p === 'auto') root.setAttribute('data-mode', resolveMode('auto', media.matches))
    })
  }
}
