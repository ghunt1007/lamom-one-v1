// หน้าตาโปรแกรมที่ปรับเองได้ต่อเครื่อง (นอกจากสีธีม): โหมด มืด/สว่าง/ตามเครื่อง · ขนาดตัวอักษร · ความโค้งมุม ·
// ความหนาแน่น · เอฟเฟกต์ — ตั้งค่าบน <html> ก่อน render แรก (ไม่กระพริบ) และเปลี่ยนสดได้จากหน้าต่าง "ปรับหน้าตา"
export const UI_DEFAULTS = { font: 'md', radius: 'md', density: 'normal', effects: 'on' }
export const UI_OPTIONS = {
  font: [['sm', 'เล็ก', 14], ['md', 'ปกติ', 15], ['lg', 'ใหญ่', 16.5], ['xl', 'ใหญ่มาก', 18]],
  radius: [['sm', 'เหลี่ยม'], ['md', 'มน'], ['lg', 'โค้งมาก']],
  density: [['normal', 'ปกติ'], ['compact', 'กะทัดรัด']],
  effects: [['on', 'เปิด'], ['off', 'เรียบ (ไม่มีลาย/อนิเมชัน)']],
}
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
