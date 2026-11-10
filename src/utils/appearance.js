// หน้าตาโปรแกรมที่ปรับเองได้ต่อเครื่อง: โหมด มืด/สว่าง/ตามเครื่อง · ขนาดตัวอักษร · ความโค้งมุม · ความหนาแน่น
// ตั้งค่าบน <html> ก่อน render แรก (ไม่กระพริบ) และเปลี่ยนสดได้จากหน้าต่าง "ปรับหน้าตา"
// (v1.0.962) เหลือธีมเดียว — ตัดภาพพื้นหลัง/การ์ด 3D/เอฟเฟกต์ออกตามที่เจ้าของขอ "ลบธีมออกให้หมด แล้วทำใหม่"

import { setDateEra } from './format.js'
import { PRESETS, FONTS, themeCss, hexToRgb } from './themeEngine.js'

export const UI_DEFAULTS = { font: 'md', radius: 'md', density: 'normal', era: 'be', theme: 'ocean', custom: '', surface: 'default', card: 'soft', bg: 'glow', motion: 'on', family: 'plex' }
export const UI_OPTIONS = {
  font: [['sm', 'เล็ก', 14], ['md', 'ปกติ', 15], ['lg', 'ใหญ่', 16.5], ['xl', 'ใหญ่มาก', 18]],
  radius: [['sm', 'เหลี่ยม'], ['md', 'มน'], ['lg', 'โค้งมาก']],
  density: [['normal', 'ปกติ'], ['compact', 'กะทัดรัด']],
  era: [['be', 'พ.ศ. (10/11/2569)'], ['ce', 'ค.ศ. (10/11/2026)']],
  // (v1.0.1030) ธีม/ลูกเล่น
  theme: [...PRESETS.map(t => [t.id, t.name]), ['custom', 'เลือกสีเอง']],
  surface: [['default', 'มาตรฐาน'], ['tinted', 'อมสีธีม'], ['midnight', 'ดำสนิท/ขาวล้วน'], ['warm', 'โทนอุ่น']],
  card: [['soft', 'นุ่มนวล'], ['flat', 'เรียบ'], ['glass', 'กระจก'], ['bold', 'เด่นชัด']],
  bg: [['glow', 'แสงเรือง'], ['none', 'เรียบ'], ['aurora', 'ออโรร่า'], ['mesh', 'ไล่สี'], ['grid', 'จุดตาราง']],
  motion: [['on', 'เปิด'], ['off', 'ปิด (เครื่องช้า)']],
  family: Object.entries(FONTS).map(([k, f]) => [k, f.name]),
}
// ชุดสำเร็จรูป: กดครั้งเดียวเปลี่ยนทั้งชุด (mode = ตั้งโหมดมืด/สว่างให้ด้วย)
export const LOOKS = [
  { name: 'มาตรฐาน', hint: 'น้ำเงินทะเล อ่านง่าย สบายตา', ui: { theme: 'ocean', surface: 'default', card: 'soft', bg: 'glow' } },
  { name: 'โชว์รูมหรู', hint: 'ทอง + ดำสนิท + การ์ดกระจก', ui: { theme: 'gold', surface: 'midnight', card: 'glass', bg: 'aurora' }, mode: 'dark' },
  { name: 'นีออนยามค่ำ', hint: 'ม่วงชมพู ออโรร่าเคลื่อนไหว', ui: { theme: 'royal', surface: 'midnight', card: 'glass', bg: 'aurora' }, mode: 'dark' },
  { name: 'ธรรมชาติ', hint: 'เขียวป่า โทนอุ่น สบายตา', ui: { theme: 'forest', surface: 'warm', card: 'soft', bg: 'glow' } },
  { name: 'พลังงานสดใส', hint: 'ส้มชมพู การ์ดเด่นชัด', ui: { theme: 'sunset', surface: 'tinted', card: 'bold', bg: 'mesh' } },
  { name: 'ฟ้าใสออฟฟิศ', hint: 'ฟ้า สว่าง จุดตาราง', ui: { theme: 'sky', surface: 'tinted', card: 'soft', bg: 'grid' }, mode: 'light' },
  { name: 'มินิมอล', hint: 'เทากราไฟต์ เรียบ ไม่มีลาย', ui: { theme: 'graphite', surface: 'midnight', card: 'flat', bg: 'none' } },
  { name: 'กุหลาบ', hint: 'ชมพูแดง โทนอุ่น', ui: { theme: 'rose', surface: 'warm', card: 'bold', bg: 'mesh' } },
]
export function randomLook(rand = Math.random) {
  const pick = a => a[Math.floor(rand() * a.length)][0]
  return { name: 'สุ่ม', ui: { theme: pick(UI_OPTIONS.theme.filter(([v]) => v !== 'custom')), surface: pick(UI_OPTIONS.surface), card: pick(UI_OPTIONS.card), bg: pick(UI_OPTIONS.bg) } }
}
// ความโค้งมุม: null = ใช้ค่าของธีม/polish.css ตามเดิม
const RADIUS = { sm: [4, 6, 8, 12], md: null, lg: [10, 14, 22, 28] }
const UI_KEY = 'lamom_ui'
// ค่าที่ธีมเก่าเคยเก็บไว้ในเครื่อง (ธีมสี 33 แบบ, รูปพื้นหลัง) — ล้างทิ้งตอนเปิดโปรแกรม
export const OLD_KEYS = ['lamom_theme', 'lamom_wall_img']

export function normalizeUi(raw) {
  const out = { ...UI_DEFAULTS }
  for (const k of Object.keys(UI_OPTIONS)) {
    if (UI_OPTIONS[k].some(([v]) => v === raw?.[k])) out[k] = raw[k]
  }
  if (hexToRgb(raw?.custom)) out.custom = String(raw.custom)
  if (out.theme === 'custom' && !out.custom) out.theme = 'ocean'
  return out
}

export function loadUi(storage = globalThis.localStorage) {
  try { return normalizeUi(JSON.parse(storage?.getItem(UI_KEY) || 'null')) } catch { return { ...UI_DEFAULTS } }
}

export function saveUi(ui, storage = globalThis.localStorage) {
  try { storage?.setItem(UI_KEY, JSON.stringify(normalizeUi(ui))) } catch { /* เก็บไม่ได้ก็ใช้ค่าเดิม */ }
}

export function clearOldTheme(storage = globalThis.localStorage, root = globalThis.document?.documentElement) {
  try { OLD_KEYS.forEach(k => storage?.removeItem(k)) } catch { /* */ }
  ;['data-theme', 'data-wall', 'data-effects', 'data-fx3d'].forEach(a => root?.removeAttribute?.(a))
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
  setDateEra(u.era)
  // (v1.0.1030) ธีม: สีคำนวณเป็นตัวแปร CSS ใส่ใน <style> เดียว (ธีมมาตรฐาน = ว่าง ใช้ themes.css)
  root.setAttribute('data-card', u.card)
  root.setAttribute('data-bg', u.bg)
  root.setAttribute('data-motion', u.motion)
  const doc = globalThis.document
  if (doc?.head) {
    let st = doc.getElementById('lamom-theme-vars')
    if (!st) { st = doc.createElement('style'); st.id = 'lamom-theme-vars'; doc.head.appendChild(st) }
    st.textContent = themeCss(u)
    const f = FONTS[u.family]
    if (f?.g && !doc.getElementById('lamom-font-' + u.family)) {
      const l = doc.createElement('link'); l.id = 'lamom-font-' + u.family; l.rel = 'stylesheet'
      l.href = `https://fonts.googleapis.com/css2?family=${f.g}&display=swap`
      doc.head.appendChild(l)
    }
  }
  // แถบสีเบราว์เซอร์บนมือถือให้เข้ากับพื้นของธีม
  try { const bg = globalThis.getComputedStyle?.(root)?.getPropertyValue('--bg').trim(); if (bg) doc?.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg) } catch { /* */ }
  if (u.family === 'plex') root.style.removeProperty?.('--font-main')
  else root.style.setProperty('--font-main', FONTS[u.family].css)
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
  try { const bg = globalThis.getComputedStyle?.(root)?.getPropertyValue('--bg').trim(); if (bg) globalThis.document?.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg) } catch { /* */ }
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
