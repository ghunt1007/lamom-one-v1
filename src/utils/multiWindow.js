// (v1.0.1076) เปิด LAMOM One หลายหน้าต่างพร้อมกันในเครื่องเดียว — จอนี้ดูหน้าหนึ่ง อีกจอดูอีกหน้า
// • ทุกหน้ามีลิงก์ของตัวเองอยู่แล้ว (core/router.js) หน้าต่างใหม่จึงเปิดตรงหน้านั้นได้เลย ไม่ต้องล็อกอินซ้ำ
//   (Firebase เก็บการล็อกอินไว้ในเครื่อง ทุกหน้าต่างใช้ร่วมกัน · ออกจากระบบที่หน้าต่างไหน ทุกหน้าต่างออกด้วย)
// • ปุ่ม 🗗 บนแถบบน: เปิดหน้านี้/หน้าอื่นในหน้าต่างใหม่ (วางไว้ครึ่งขวาของจอ ลากไปอีกจอได้)
// • Ctrl+คลิก / คลิกปุ่มกลางเมาส์ ที่เมนูซ้าย = เปิดหน้านั้นในหน้าต่างใหม่
// • ข้อมูลอัปเดตเองทุกหน้าต่าง (Firestore) · เปลี่ยนโหมดมืด/สว่าง ภาษา หน้าตา ที่หน้าต่างไหน หน้าต่างอื่นเปลี่ยนตาม
// • ชื่อแท็บ/หน้าต่าง = ชื่อหน้า จะได้แยกออกบนแถบงาน Windows ว่าหน้าต่างไหนคือหน้าอะไร
import { NAV } from '../data/navMenu.js'
import { breadcrumbFor } from './breadcrumb.js'

// หน้าที่มักเปิดค้างไว้อีกจอ (โชว์เป็นปุ่มลัดในเมนู 🗗 ตามสิทธิ์ของแต่ละคน)
export const WINDOW_SHORTCUTS = [
  '/crm/my-day', '/crm/customers', '/crm/bookings', '/calendar', '/crm/pipeline',
  '/', '/crm', '/dms/stock', '/ai/ask', '/tv',
]

// แอปมือถือ (Capacitor) / จอเล็ก เปิดหลายหน้าต่างไม่ได้ — ซ่อนปุ่ม
export function canUseWindows(win = globalThis.window) {
  if (!win || typeof win.open !== 'function') return false
  if (win.Capacitor?.isNativePlatform?.()) return false
  return (win.innerWidth || 0) >= 900
}

// Ctrl/⌘/Shift+คลิก หรือคลิกปุ่มกลาง = ผู้ใช้ตั้งใจเปิดหน้าต่าง/แท็บใหม่ (เหมือนลิงก์ทั่วไปในเบราว์เซอร์)
export function wantsNewWindow(e) {
  if (!e) return false
  return e.button === 1 || !!(e.ctrlKey || e.metaKey || e.shiftKey)
}

// ตำแหน่งหน้าต่างใหม่: ครึ่งขวาของจอที่หน้าต่างนี้อยู่ (ถ้าจอแคบ = เต็มจอ) — ลากไปจอที่ 2 ได้ทันที
export function windowFeatures(scr = {}) {
  const aw = Math.max(800, scr.availWidth || 1280)
  const ah = Math.max(600, scr.availHeight || 800)
  const left0 = scr.availLeft || 0
  const top0 = scr.availTop || 0
  const half = aw >= 1600
  const width = half ? Math.floor(aw / 2) : Math.floor(aw * 0.85)
  const left = half ? left0 + aw - width : left0 + Math.floor((aw - width) / 2)
  const height = half ? ah : Math.floor(ah * 0.9)
  const top = half ? top0 : top0 + Math.floor((ah - height) / 2)
  return `popup=yes,noopener=yes,width=${width},height=${height},left=${left},top=${top}`
}

// เปิดหน้า path ในหน้าต่างใหม่ (หน้าต่างแยก ลากไปอีกจอได้ ใช้ล็อกอินเดิม)
export function openInNewWindow(path, win = globalThis.window) {
  const url = new URL(path || '/', win.location.origin).href
  win.open(url, '_blank', windowFeatures(win.screen || {}))
}

// รายการหน้าที่เปิดได้ (ตามสิทธิ์) สำหรับเมนู 🗗 — ไม่มีคำค้น = ปุ่มลัด · มีคำค้น = หาจากเมนูทั้งหมด
export function pickWindowPages(nav, canOpen = () => true, query = '', limit = 12) {
  const all = []
  const seen = new Set()
  for (const g of nav || []) for (const i of g.items || []) {
    if (!i.path || seen.has(i.path)) continue
    seen.add(i.path)
    if (canOpen(i.path)) all.push({ path: i.path, icon: i.icon, label: i.label, group: g.group, en: i.labelEn || '' })
  }
  const q = String(query || '').trim().toLowerCase()
  if (!q) {
    const byPath = new Map(all.map(p => [p.path, p]))
    return WINDOW_SHORTCUTS.map(p => byPath.get(p)).filter(Boolean)
  }
  return all.filter(p => (p.label + ' ' + p.en + ' ' + p.group + ' ' + p.path).toLowerCase().includes(q)).slice(0, limit)
}

// ชื่อหน้าต่าง = "ชื่อหน้า · ชื่อแบรนด์"
export function windowTitle(path, brandName = 'LAMOM ONE', nav = NAV) {
  const label = breadcrumbFor(nav, path, 'th')[1]
  return label ? `${label} · ${brandName}` : brandName
}

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

// เมนู 🗗 (ลอยใต้ปุ่ม) — เปิดหน้านี้ / ปุ่มลัด / ค้นหาหน้าอื่น
export function openWindowMenu(anchor, { canOpen = () => true, nav = NAV } = {}) {
  document.getElementById('win-menu')?.remove()
  const pop = document.createElement('div')
  pop.id = 'win-menu'
  pop.className = 'win-menu'
  pop.setAttribute('role', 'dialog')
  pop.setAttribute('aria-label', 'เปิดหน้าต่างใหม่')
  const here = window.location.pathname + window.location.search
  pop.innerHTML = `
    <button class="win-menu-main" id="wm-here" type="button">🗗 เปิดหน้านี้ในหน้าต่างใหม่</button>
    <div class="win-menu-label">เปิดหน้าอื่นในหน้าต่างใหม่</div>
    <input type="search" class="form-input win-menu-find" id="wm-find" placeholder="🔍 พิมพ์ชื่อหน้า เช่น สต็อก, ใบเสนอราคา" autocomplete="off">
    <div class="win-menu-list" id="wm-list"></div>
    <div class="win-menu-tip">💡 Ctrl+คลิก หรือคลิกปุ่มกลางเมาส์ที่เมนูซ้าย ก็เปิดหน้าต่างใหม่ได้ · ลากหน้าต่างไปอีกจอ หรือกด ⊞ Win + ← / → จัดซ้าย-ขวา</div>`
  document.body.appendChild(pop)
  const r = anchor?.getBoundingClientRect?.()
  if (r) {
    pop.style.top = `${Math.round(r.bottom + 6)}px`
    pop.style.right = `${Math.max(8, Math.round(window.innerWidth - r.right))}px`
  }
  const list = pop.querySelector('#wm-list')
  const draw = (q) => {
    const pages = pickWindowPages(nav, canOpen, q)
    list.innerHTML = pages.length
      ? pages.map(p => `<button type="button" class="win-menu-item" data-path="${esc(p.path)}"><span>${esc(p.icon)}</span><span class="win-menu-name">${esc(p.label)}</span></button>`).join('')
      : '<div class="win-menu-empty">ไม่พบหน้านี้</div>'
  }
  draw('')
  const close = () => { pop.remove(); document.removeEventListener('mousedown', onDoc, true); document.removeEventListener('keydown', onKey, true) }
  const onDoc = (e) => { if (!pop.contains(e.target) && e.target !== anchor && !anchor?.contains?.(e.target)) close() }
  const onKey = (e) => { if (e.key === 'Escape') close() }
  setTimeout(() => { document.addEventListener('mousedown', onDoc, true); document.addEventListener('keydown', onKey, true) }, 0)
  pop.querySelector('#wm-here').addEventListener('click', () => { close(); openInNewWindow(here) })
  pop.querySelector('#wm-find').addEventListener('input', e => draw(e.target.value))
  pop.querySelector('#wm-find').addEventListener('keydown', e => {
    if (e.key !== 'Enter') return
    const first = list.querySelector('.win-menu-item')
    if (first) { close(); openInNewWindow(first.dataset.path) }
  })
  list.addEventListener('click', e => {
    const b = e.target.closest('.win-menu-item')
    if (b) { close(); openInNewWindow(b.dataset.path) }
  })
  return close
}

// ค่าที่ต้องตามกันทุกหน้าต่าง (เบราว์เซอร์ยิง 'storage' ให้หน้าต่างอื่นเมื่อมีหน้าต่างหนึ่งเขียน localStorage)
// handlers: { mode(value), ui(), lang(value) }
export function syncKeyAction(key) {
  if (key === 'lamom_mode') return 'mode'
  if (key === 'lamom_ui') return 'ui'
  if (key === 'lamom_lang') return 'lang'
  return null
}

export function initMultiWindow({ getState, setState, on, applyMode, applyUi, loadUi }) {
  // ชื่อหน้าต่างตามหน้า
  const setTitle = () => {
    try { document.title = windowTitle(window.location.pathname, getState('brand')?.brandName || 'LAMOM ONE') } catch { /* */ }
  }
  setTitle()
  on('currentRoute', setTitle)
  on('brand', setTitle)

  window.addEventListener('storage', (e) => {
    const act = syncKeyAction(e.key)
    if (!act) return
    try {
      if (act === 'mode') { applyMode(e.newValue || 'dark'); setState('mode', e.newValue || 'dark') }
      else if (act === 'ui') applyUi(loadUi())
      else if (act === 'lang' && e.newValue && e.newValue !== getState('language')) setState('language', e.newValue)
    } catch { /* */ }
  })
}
