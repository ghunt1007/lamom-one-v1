// (v1.0.1030) ธีมหลายแบบ ปรับแต่งได้ — เจ้าของขอ "ธีมให้มีความหลากหลาย มีลูกเล่น ปรับแต่งได้"
// สีทุกชุดคำนวณจากสีหลัก/สีรอง 2 สี แล้วปรับความสว่างให้ตัวหนังสืออ่านชัด (WCAG ≥ 4.5:1) ทั้งโหมดมืด/สว่างอัตโนมัติ
// → เลือกสีอะไรก็อ่านง่ายเสมอ (รวมสีที่ผู้ใช้เลือกเอง) · ธีมมาตรฐาน (น้ำเงินทะเล) ใช้ค่าใน themes.css ตามเดิมทุกอย่าง

// ---- คำนวณสี ----
export function hexToRgb(hex) {
  const h = String(hex || '').replace('#', '')
  const f = h.length === 3 ? h.split('').map(c => c + c).join('') : h
  if (!/^[0-9a-f]{6}$/i.test(f)) return null
  return [0, 2, 4].map(i => parseInt(f.slice(i, i + 2), 16))
}
export const rgbToHex = ([r, g, b]) => '#' + [r, g, b].map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('').toUpperCase()
export function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2
  if (max === min) return [0, 0, l * 100]
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [h * 60, s * 100, l * 100]
}
export function hslToRgb([h, s, l]) {
  h = ((h % 360) + 360) % 360; s /= 100; l /= 100
  const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l)
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return [f(0) * 255, f(8) * 255, f(4) * 255]
}
const hsl = (h, s, l) => rgbToHex(hslToRgb([h, s, l]))
export function luminance(hex) {
  const c = hexToRgb(hex).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 })
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
export function contrast(a, b) {
  const x = luminance(a), y = luminance(b)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}
// ปรับความสว่าง (คงสีเดิม) จนตัดกับพื้นได้ตามที่กำหนด
export function fitContrast(hex, bg, min = 4.5) {
  if (contrast(hex, bg) >= min) return rgbToHex(hexToRgb(hex))
  const [h, s, l0] = rgbToHsl(hexToRgb(hex))
  const lighter = luminance(bg) < 0.2
  for (let l = l0; l >= 0 && l <= 100; l += lighter ? 1 : -1) {
    const c = hsl(h, s, l)
    if (contrast(c, bg) >= min) return c
  }
  return lighter ? '#FFFFFF' : '#000000'
}
const rgba = (hex, a) => { const [r, g, b] = hexToRgb(hex); return `rgba(${r},${g},${b},${a})` }
export const hueOf = hex => rgbToHsl(hexToRgb(hex))[0]

// ---- ชุดสี ----
export const PRESETS = [
  { id: 'ocean', name: 'น้ำเงินทะเล', p: '#5B7FF5', a: '#2DD4BF' },
  { id: 'sky', name: 'ฟ้าใส', p: '#0EA5E9', a: '#6366F1' },
  { id: 'emerald', name: 'มรกต', p: '#10B981', a: '#06B6D4' },
  { id: 'forest', name: 'ป่าเขียว', p: '#22A355', a: '#A3C614' },
  { id: 'royal', name: 'ม่วงราชา', p: '#8B5CF6', a: '#EC4899' },
  { id: 'rose', name: 'กุหลาบ', p: '#F43F5E', a: '#F59E0B' },
  { id: 'sunset', name: 'อาทิตย์ตก', p: '#F97316', a: '#E8457C' },
  { id: 'lava', name: 'แดงลาวา', p: '#E11D2E', a: '#F97316' },
  { id: 'gold', name: 'ทองหรู', p: '#D4A017', a: '#C2410C' },
  { id: 'graphite', name: 'กราไฟต์', p: '#7A8BA6', a: '#A1A1AA' },
]
// พื้นผิว (โทนพื้นหลัง/การ์ด) ต่อโหมด — null = ใช้ค่ามาตรฐานใน themes.css
const SURFACES = {
  default: null,
  tinted: h => ({
    dark: { '--bg': hsl(h, 38, 6.5), '--surface': hsl(h, 32, 10.5), '--surface-2': hsl(h, 30, 13.5), '--surface-3': hsl(h, 28, 18), '--border': hsl(h, 26, 22), '--border-light': hsl(h, 24, 30), '--border-subtle': hsl(h, 30, 13) },
    light: { '--bg': hsl(h, 45, 96.5), '--surface': '#FFFFFF', '--surface-2': hsl(h, 40, 95.5), '--surface-3': hsl(h, 34, 91), '--border': hsl(h, 28, 86), '--border-light': hsl(h, 22, 77), '--border-subtle': hsl(h, 36, 93.5) },
  }),
  midnight: () => ({
    dark: { '--bg': '#000000', '--surface': '#0B0B0F', '--surface-2': '#131318', '--surface-3': '#1C1C23', '--border': '#26262F', '--border-light': '#383844', '--border-subtle': '#15151A' },
    light: { '--bg': '#FFFFFF', '--surface': '#FFFFFF', '--surface-2': '#F6F7F9', '--surface-3': '#ECEEF2', '--border': '#E1E4EA', '--border-light': '#C9CED8', '--border-subtle': '#F0F2F5' },
  }),
  warm: () => ({
    dark: { '--bg': '#13100D', '--surface': '#1C1814', '--surface-2': '#241F1A', '--surface-3': '#2E2822', '--border': '#3A322A', '--border-light': '#4D4338', '--border-subtle': '#201B16' },
    light: { '--bg': '#F7F3EC', '--surface': '#FFFDF9', '--surface-2': '#F3EDE3', '--surface-3': '#E9E1D4', '--border': '#DED4C4', '--border-light': '#C9BCA8', '--border-subtle': '#EFE8DC' },
  }),
}
export const SURFACE_IDS = Object.keys(SURFACES)
const REF = { dark: '#17223A', light: '#F1F4F9' } // พื้นที่ใช้เทียบความชัด (surface-2 ของธีมมาตรฐาน)

export function colorsFor(themeId, custom) {
  if (themeId === 'custom') {
    const p = hexToRgb(custom) ? rgbToHex(hexToRgb(custom)) : '#5B7FF5'
    const [h, s, l] = rgbToHsl(hexToRgb(p))
    return { p, a: hsl(h + 40, Math.max(45, s), Math.min(Math.max(l, 45), 60)) }
  }
  return PRESETS.find(t => t.id === themeId) || PRESETS[0]
}

// ตัวแปร CSS ของธีม/พื้นผิว ต่อโหมด → { dark: {...}, light: {...} } (ธีมมาตรฐาน + พื้นผิวมาตรฐาน = ว่าง)
export function themeVars({ theme = 'ocean', custom = '', surface = 'default' } = {}) {
  const out = { dark: {}, light: {} }
  const { p, a } = colorsFor(theme, custom)
  const sf = SURFACES[surface]?.(hueOf(p))
  if (sf) { Object.assign(out.dark, sf.dark); Object.assign(out.light, sf.light) }
  if (theme !== 'ocean') {
    for (const mode of ['dark', 'light']) {
      const ref = sf ? sf[mode]['--surface-2'] : REF[mode]
      const pr = fitContrast(p, ref, 4.5), ac = fitContrast(a, ref, 4.5)
      // ปุ่มหลักตัวขาว: ทั้งสองปลายของสีไล่ต้องอ่านตัวขาวได้
      const g1 = fitContrast(p, '#FFFFFF', 4.5), g2 = fitContrast(a, '#FFFFFF', 4.5)
      Object.assign(out[mode], {
        '--primary': pr, '--primary-dim': rgba(pr, mode === 'dark' ? 0.14 : 0.09), '--primary-glow': rgba(pr, mode === 'dark' ? 0.38 : 0.24),
        '--accent': ac, '--accent-dim': rgba(ac, mode === 'dark' ? 0.12 : 0.09),
        '--grad-primary': `linear-gradient(135deg, ${g1}, ${g2})`,
      })
    }
  }
  return out
}

export function themeCss(opts) {
  const v = themeVars(opts)
  const block = (sel, o) => (Object.keys(o).length ? `${sel}{${Object.entries(o).map(([k, x]) => `${k}:${x}`).join(';')}}` : '')
  return block(':root,:root[data-mode="dark"]', v.dark) + block(':root[data-mode="light"]', v.light)
}

// ตัวอักษร (โหลดจาก Google Fonts เฉพาะตอนเลือก)
export const FONTS = {
  plex: { name: 'IBM Plex', css: "'Inter', 'IBM Plex Sans Thai', 'Sarabun', sans-serif" },
  sarabun: { name: 'สารบรรณ', css: "'Sarabun', sans-serif", g: 'Sarabun:wght@400;500;600;700' },
  noto: { name: 'Noto', css: "'Noto Sans Thai', sans-serif", g: 'Noto+Sans+Thai:wght@400;500;600;700' },
  prompt: { name: 'Prompt', css: "'Prompt', sans-serif", g: 'Prompt:wght@400;500;600;700' },
  kanit: { name: 'Kanit', css: "'Kanit', sans-serif", g: 'Kanit:wght@300;400;500;600' },
  anuphan: { name: 'Anuphan', css: "'Anuphan', sans-serif", g: 'Anuphan:wght@400;500;600;700' },
}
