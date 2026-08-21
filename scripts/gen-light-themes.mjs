// One-off generator (not part of build) — reads src/styles/themes.css, extracts every theme block's
// primary/accent/success/warning/danger/info, and prints a ready-to-paste light-mode CSS override block
// per theme using the shared Midnight-light neutral base (bg/surface/text/border) + that theme's own
// accent colors darkened to a safe lightness for readability on a white background.
import { readFileSync } from 'fs'

const css = readFileSync(new URL('../src/styles/themes.css', import.meta.url), 'utf8')

// Find every [data-theme="X"] { ... } block (skip the light-mode override block already added)
const blockRe = /\[data-theme="([a-z0-9]+)"\]\s*\{([^}]+)\}/g
const themes = {}
let m
while ((m = blockRe.exec(css))) {
  const id = m[1]
  const body = m[2]
  if (!/--primary:/.test(body)) continue // skip decorative-only blocks (e.g. bg-image-only re-declarations)
  if (themes[id]) continue // keep first (main variable block), skip bg-image-only second declaration
  const get = (name) => {
    const mm = new RegExp(`--${name}:\\s*([^;]+);`).exec(body)
    return mm ? mm[1].trim() : null
  }
  themes[id] = {
    primary: get('primary'), accent: get('accent'), success: get('success'),
    warning: get('warning'), danger: get('danger'), info: get('info'),
  }
}
delete themes.midnight // already has a bespoke light override

function hexToHsl(hex) {
  hex = hex.replace('#', '')
  const r = parseInt(hex.slice(0,2),16)/255, g = parseInt(hex.slice(2,4),16)/255, b = parseInt(hex.slice(4,6),16)/255
  const max = Math.max(r,g,b), min = Math.min(r,g,b)
  let h, s, l = (max+min)/2
  if (max === min) { h = s = 0 }
  else {
    const d = max - min
    s = l > 0.5 ? d/(2-max-min) : d/(max+min)
    switch (max) {
      case r: h = (g-b)/d + (g<b?6:0); break
      case g: h = (b-r)/d + 2; break
      case b: h = (r-g)/d + 4; break
    }
    h /= 6
  }
  return [h*360, s*100, l*100]
}
function hslToHex(h,s,l) {
  s/=100; l/=100
  const c = (1-Math.abs(2*l-1))*s
  const x = c*(1-Math.abs((h/60)%2-1))
  const mm = l-c/2
  let r,g,b
  if (h<60) [r,g,b]=[c,x,0]
  else if (h<120) [r,g,b]=[x,c,0]
  else if (h<180) [r,g,b]=[0,c,x]
  else if (h<240) [r,g,b]=[0,x,c]
  else if (h<300) [r,g,b]=[x,0,c]
  else [r,g,b]=[c,0,x]
  const to255 = v => Math.round((v+mm)*255).toString(16).padStart(2,'0')
  return `#${to255(r)}${to255(g)}${to255(b)}`.toUpperCase()
}
// Real WCAG relative luminance + contrast ratio (not HSL lightness, which is NOT perceptually
// uniform across hues — a green at 40% HSL lightness reads much lighter than a blue at the same
// HSL lightness, so a fixed HSL-lightness target alone would under-darken greens/yellows).
function relLuminance(hex) {
  const [r,g,b] = hexToRgb(hex).map(v => {
    const c = v/255
    return c <= 0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4)
  })
  return 0.2126*r + 0.7152*g + 0.0722*b
}
function contrastRatio(hex1, hex2) {
  const l1 = relLuminance(hex1), l2 = relLuminance(hex2)
  const [lighter, darker] = l1 > l2 ? [l1,l2] : [l2,l1]
  return (lighter+0.05)/(darker+0.05)
}
// Darken (reduce HSL lightness, keep hue/saturation) until real contrast vs white AND vs the
// lightest surface (#E2E8F0, used for badges/chips) both clear 4.5:1 — same bar v1.0.362 used for
// text-muted across all dark themes. Floor at L=18% so we never go fully black and lose hue identity.
function darkenForLight(hex) {
  const [h,s] = hexToHsl(hex)
  let l = 55
  let candidate = hex
  while (l > 18) {
    candidate = hslToHex(h, Math.max(s, 60), l)
    if (contrastRatio(candidate, '#FFFFFF') >= 4.5 && contrastRatio(candidate, '#E2E8F0') >= 4.5) break
    l -= 2
  }
  return candidate
}
function hexToRgb(hex) {
  hex = hex.replace('#','')
  return [parseInt(hex.slice(0,2),16), parseInt(hex.slice(2,4),16), parseInt(hex.slice(4,6),16)]
}

let out = ''
for (const [id, c] of Object.entries(themes)) {
  const lp = darkenForLight(c.primary), la = darkenForLight(c.accent), ls = darkenForLight(c.success)
  const lw = darkenForLight(c.warning), ld = darkenForLight(c.danger), li = darkenForLight(c.info)
  const dim = hex => { const [r,g,b] = hexToRgb(hex); return `rgba(${r},${g},${b},0.08)` }
  const glow = hex => { const [r,g,b] = hexToRgb(hex); return `rgba(${r},${g},${b},0.22)` }
  out += `[data-theme="${id}"][data-mode="light"] {
  --bg: #F8FAFC; --surface: #FFFFFF; --surface-2: #F1F5F9; --surface-3: #E2E8F0;
  --border: #CBD5E1; --border-light: #94A3B8; --border-subtle: #EEF2F7;
  --text: #0F172A; --text-2: #334155; --text-3: #64748B; --text-muted: #475569;
  --primary: ${lp}; --primary-dim: ${dim(lp)}; --primary-glow: ${glow(lp)};
  --accent: ${la}; --accent-dim: ${dim(la)};
  --success: ${ls}; --success-dim: ${dim(ls)};
  --warning: ${lw}; --warning-dim: ${dim(lw)};
  --danger: ${ld}; --danger-dim: ${dim(ld)};
  --info: ${li}; --info-dim: ${dim(li)};
  --bg-image: none;
}
`
}
console.log(out)
console.log(`/* generated ${Object.keys(themes).length} theme light overrides */`)
