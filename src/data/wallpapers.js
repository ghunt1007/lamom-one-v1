// ภาพพื้นหลังเต็มจอ (ภาพวาด + ภาพ 3D) วาดเป็น SVG ในโค้ด ไม่ต้องโหลดรูปจากเน็ต ใช้ได้ทั้งออฟไลน์และแอป Android
// ทุกภาพ viewBox 1600×900 + slice จึงเต็มจอทุกขนาด ส่วน "รูปของฉัน" (อัปโหลดเอง) อยู่ใน utils/appearance.js
const W = 1600, H = 900

// สุ่มแบบกำหนดผลได้ — ดาว/หน้าต่าง/กลีบดอกอยู่ที่เดิมทุกครั้ง ไม่กระโดดเวลาเปิดใหม่
function rng(seed) {
  let s = seed >>> 0
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 }
}
const svg = (defs, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice"><defs>${defs}</defs>${body}</svg>`
const lin = (id, stops, x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('')}</linearGradient>`
const rad = (id, stops, cx = 0.5, cy = 0.5, r = 0.5, fx = cx, fy = cy) => `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}" fx="${fx}" fy="${fy}">${stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('')}</radialGradient>`
const blur = (id, d) => `<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${d}"/></filter>`

// สันเขาแบบภาพวาด: จุดสุ่มแล้วโค้งนุ่มด้วย quadratic
function ridge(baseY, amp, seed, n = 9, fill = '#000') {
  const r = rng(seed), pts = []
  for (let i = 0; i <= n; i++) pts.push([Math.round(i * W / n), Math.round(baseY - r() * amp)])
  let d = `M0 ${H} L0 ${pts[0][1]}`
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]
    d += ` Q${Math.round((x0 + x1) / 2)} ${Math.min(y0, y1) - Math.round(amp * 0.25)} ${x1} ${y1}`
  }
  return `<path d="${d} L${W} ${H} Z" fill="${fill}"/>`
}
function stars(seed, n, maxY, color = '#fff') {
  const r = rng(seed)
  return Array.from({ length: n }, () => `<circle cx="${Math.round(r() * W)}" cy="${Math.round(r() * maxY)}" r="${(0.6 + r() * 1.6).toFixed(1)}" fill="${color}" opacity="${(0.35 + r() * 0.6).toFixed(2)}"/>`).join('')
}

function sunset() {
  return svg(
    lin('sk', [[0, '#1E1B4B'], [0.45, '#6D28D9'], [0.75, '#F472B6'], [1, '#FDBA74']]) + rad('sn', [[0, '#FEF3C7'], [0.6, '#FCD34D'], [1, '#FB923C', 0]]),
    `<rect width="${W}" height="${H}" fill="url(#sk)"/>${stars(11, 60, 260)}<circle cx="1080" cy="470" r="250" fill="url(#sn)"/><circle cx="1080" cy="470" r="110" fill="#FEF3C7" opacity=".95"/>`
    + ridge(640, 130, 3, 7, '#7C3AED') + ridge(700, 120, 8, 9, '#5B21B6') + ridge(780, 100, 21, 11, '#3B0764') + ridge(860, 60, 5, 13, '#1E0636'))
}

function nightsea() {
  const r = rng(7)
  const glints = Array.from({ length: 26 }, (_, i) => {
    const y = 600 + i * 11, w = 120 - i * 3 + r() * 60
    return `<rect x="${Math.round(1180 - w / 2 + (r() - 0.5) * 40)}" y="${y}" width="${Math.round(w)}" height="3" rx="1.5" fill="#E0F2FE" opacity="${(0.55 - i * 0.018).toFixed(2)}"/>`
  }).join('')
  return svg(
    lin('sk', [[0, '#020617'], [0.6, '#0C2D48'], [1, '#155E75']]) + lin('sea', [[0, '#0E4D64'], [1, '#020617']]) + rad('gl', [[0, '#E0F2FE', 0.55], [1, '#E0F2FE', 0]]) + blur('b', 6),
    `<rect width="${W}" height="${H}" fill="url(#sk)"/>${stars(41, 140, 520)}<circle cx="1180" cy="230" r="220" fill="url(#gl)"/><circle cx="1180" cy="230" r="70" fill="#F1F5F9"/><circle cx="1160" cy="215" r="12" fill="#CBD5E1" opacity=".6"/><circle cx="1205" cy="250" r="8" fill="#CBD5E1" opacity=".5"/>`
    + `<path d="M0 590 Q160 520 320 575 Q420 548 520 590 Z" fill="#06202C"/><rect y="588" width="${W}" height="${H - 588}" fill="url(#sea)"/><g filter="url(#b)">${glints}</g>`
    + Array.from({ length: 7 }, (_, i) => `<path d="M0 ${660 + i * 38} Q400 ${648 + i * 38} 800 ${660 + i * 38} T1600 ${660 + i * 38}" stroke="#38BDF8" stroke-opacity="${(0.08 + i * 0.01).toFixed(2)}" stroke-width="2" fill="none"/>`).join(''))
}

function city() {
  const r = rng(99)
  const layer = (base, minH, maxH, color, lit, seed) => {
    const q = rng(seed); let x = -20, out = ''
    while (x < W) {
      const w = 50 + Math.round(q() * 90), h = minH + Math.round(q() * (maxH - minH)), y = base - h
      out += `<rect x="${x}" y="${y}" width="${w}" height="${H - y}" fill="${color}"/>`
      if (lit) for (let wy = y + 14; wy < base - 10; wy += 22) for (let wx = x + 8; wx < x + w - 12; wx += 16) if (q() < 0.42) out += `<rect x="${wx}" y="${wy}" width="8" height="11" rx="1" fill="${q() < 0.8 ? '#FCD34D' : '#7DD3FC'}" opacity="${(0.45 + q() * 0.5).toFixed(2)}"/>`
      x += w + 4 + Math.round(q() * 10)
    }
    return out
  }
  return svg(
    lin('sk', [[0, '#0B0B23'], [0.55, '#2E1065'], [1, '#C2410C']]) + rad('gw', [[0, '#FB923C', 0.45], [1, '#FB923C', 0]]),
    `<rect width="${W}" height="${H}" fill="url(#sk)"/>${stars(5, 90, 360)}<circle cx="300" cy="170" r="46" fill="#FDE68A" opacity=".9"/><ellipse cx="800" cy="900" rx="1100" ry="330" fill="url(#gw)"/>`
    + layer(820, 140, 360, '#1E1B4B', false, 2) + layer(900, 120, 330, '#0F0A1F', true, 12)
    + `<rect y="880" width="${W}" height="20" fill="#05030C"/>` + Array.from({ length: 12 }, () => `<rect x="${Math.round(r() * W)}" y="${886 + Math.round(r() * 6)}" width="${30 + Math.round(r() * 40)}" height="2" fill="${r() < 0.5 ? '#F87171' : '#FDE68A'}" opacity=".8"/>`).join(''))
}

function sakura() {
  const r = rng(31)
  const flowers = Array.from({ length: 90 }, () => {
    const t = r(), x = 40 + t * 820 + (r() - 0.5) * 160, y = 40 + t * t * 360 + (r() - 0.5) * 140, s = 8 + r() * 14
    return `<circle cx="${Math.round(x)}" cy="${Math.round(y)}" r="${s.toFixed(1)}" fill="${['#F9A8D4', '#FBCFE8', '#F472B6', '#FDF2F8'][Math.floor(r() * 4)]}" opacity="${(0.7 + r() * 0.3).toFixed(2)}"/>`
  }).join('')
  const petals = Array.from({ length: 50 }, () => {
    const x = Math.round(300 + r() * 1300), y = Math.round(r() * H)
    return `<ellipse cx="${x}" cy="${y}" rx="${(5 + r() * 5).toFixed(1)}" ry="${(3 + r() * 2).toFixed(1)}" transform="rotate(${Math.round(r() * 180)} ${x} ${y})" fill="#F9A8D4" opacity="${(0.35 + r() * 0.5).toFixed(2)}"/>`
  }).join('')
  return svg(
    lin('sk', [[0, '#FDF2F8'], [0.55, '#FCE7F3'], [1, '#E0F2FE']]) + rad('sn', [[0, '#FFFFFF', 0.9], [1, '#FFFFFF', 0]]),
    `<rect width="${W}" height="${H}" fill="url(#sk)"/><circle cx="1250" cy="230" r="260" fill="url(#sn)"/>`
    + ridge(720, 120, 14, 6, '#E9D5FF') + ridge(790, 90, 15, 8, '#DDD6FE') + ridge(860, 60, 16, 10, '#FBCFE8')
    + `<path d="M-20 60 C200 90 380 150 560 260 S820 420 900 470" stroke="#5B3A29" stroke-width="16" fill="none" stroke-linecap="round"/><path d="M300 140 C360 220 420 260 520 300" stroke="#5B3A29" stroke-width="8" fill="none" stroke-linecap="round"/><path d="M620 330 C700 300 760 250 820 240" stroke="#5B3A29" stroke-width="6" fill="none" stroke-linecap="round"/>`
    + flowers + `<g>${petals}</g>`)
}

function meadow() {
  const r = rng(77)
  const cloud = (x, y, s) => `<g fill="#FFFFFF" opacity=".92"><ellipse cx="${x}" cy="${y}" rx="${90 * s}" ry="${34 * s}"/><ellipse cx="${x - 50 * s}" cy="${y + 8 * s}" rx="${60 * s}" ry="${26 * s}"/><ellipse cx="${x + 40 * s}" cy="${y - 18 * s}" rx="${55 * s}" ry="${36 * s}"/></g>`
  const flowers = Array.from({ length: 70 }, () => `<circle cx="${Math.round(r() * W)}" cy="${Math.round(780 + r() * 120)}" r="${(2 + r() * 3).toFixed(1)}" fill="${['#FDE047', '#FFFFFF', '#F9A8D4'][Math.floor(r() * 3)]}"/>`).join('')
  return svg(
    lin('sk', [[0, '#7DD3FC'], [0.6, '#BAE6FD'], [1, '#F0F9FF']]) + rad('sn', [[0, '#FEF9C3'], [0.4, '#FDE68A', 0.8], [1, '#FDE68A', 0]]),
    `<rect width="${W}" height="${H}" fill="url(#sk)"/><circle cx="1300" cy="160" r="170" fill="url(#sn)"/>${cloud(330, 170, 1.2)}${cloud(900, 120, 0.8)}${cloud(1180, 300, 0.7)}`
    + ridge(600, 90, 41, 5, '#A7F3D0') + ridge(690, 110, 42, 6, '#6EE7B7') + ridge(790, 100, 43, 7, '#34D399') + ridge(880, 60, 44, 9, '#059669') + flowers)
}

function road() {
  const dashes = Array.from({ length: 9 }, (_, i) => {
    const t = i / 9, y = 560 + t * t * 340, h = 6 + t * 40, w = 3 + t * 16
    return `<rect x="${Math.round(800 - w / 2)}" y="${Math.round(y)}" width="${Math.round(w)}" height="${Math.round(h)}" fill="#FDE68A" opacity="${(0.5 + t * 0.5).toFixed(2)}"/>`
  }).join('')
  const sunBands = Array.from({ length: 6 }, (_, i) => `<rect x="560" y="${470 + i * 16}" width="480" height="${3 + i * 1.5}" fill="#2A0B3D"/>`).join('')
  return svg(
    lin('sk', [[0, '#12052A'], [0.55, '#5B1A6E'], [1, '#F43F5E']]) + lin('sn', [[0, '#FDE047'], [1, '#F472B6']]) + lin('rd', [[0, '#1F1033'], [1, '#0B0614']]) + rad('gw', [[0, '#F472B6', 0.5], [1, '#F472B6', 0]]),
    `<rect width="${W}" height="${H}" fill="url(#sk)"/>${stars(3, 70, 330)}<circle cx="800" cy="470" r="300" fill="url(#gw)"/><circle cx="800" cy="470" r="200" fill="url(#sn)"/>${sunBands}`
    + ridge(570, 120, 61, 10, '#2A0B3D') + `<rect y="560" width="${W}" height="${H - 560}" fill="#14081F"/>`
    + `<path d="M770 560 L830 560 L1500 900 L100 900 Z" fill="url(#rd)"/><path d="M770 560 L100 900" stroke="#F472B6" stroke-width="4" opacity=".8"/><path d="M830 560 L1500 900" stroke="#F472B6" stroke-width="4" opacity=".8"/>${dashes}`
    // รถสปอร์ตเงาดำวิ่งเข้าหาพระอาทิตย์
    + `<g transform="translate(640 728)"><path d="M0 92 L8 58 Q16 40 50 34 L110 30 Q140 4 200 0 Q258 0 290 30 L322 34 Q344 40 344 62 L340 92 Z" fill="#0A0412"/><path d="M118 32 Q146 10 198 8 Q246 8 270 32 Z" fill="#3B1D5A" opacity=".9"/><rect x="14" y="60" width="56" height="9" rx="4" fill="#F43F5E"/><rect x="274" y="60" width="56" height="9" rx="4" fill="#F43F5E"/><ellipse cx="172" cy="96" rx="190" ry="10" fill="#000" opacity=".5"/></g>`)
}

// ── 3D ──
function orbs() {
  const ball = (id, c1, c2, c3) => rad(id, [[0, c1], [0.45, c2], [1, c3]], 0.5, 0.5, 0.5, 0.32, 0.28)
  const defs = ball('o1', '#E0E7FF', '#6366F1', '#1E1B4B') + ball('o2', '#CFFAFE', '#22D3EE', '#083344') + ball('o3', '#FCE7F3', '#EC4899', '#500724') + ball('o4', '#FEF3C7', '#F59E0B', '#451A03')
    + lin('bg', [[0, '#0B1024'], [1, '#05060F']]) + rad('fl', [[0, '#312E81', 0.55], [1, '#312E81', 0]]) + blur('sh', 18) + blur('sh2', 30)
  const o = (g, cx, cy, rr) => `<ellipse cx="${cx + rr * 0.25}" cy="${cy + rr * 1.05}" rx="${rr * 0.95}" ry="${rr * 0.22}" fill="#000" opacity=".55" filter="url(#sh)"/><circle cx="${cx}" cy="${cy}" r="${rr}" fill="url(#${g})"/><ellipse cx="${cx - rr * 0.35}" cy="${cy - rr * 0.42}" rx="${rr * 0.28}" ry="${rr * 0.16}" fill="#fff" opacity=".55" transform="rotate(-30 ${cx - rr * 0.35} ${cy - rr * 0.42})"/>`
  return svg(defs,
    `<rect width="${W}" height="${H}" fill="url(#bg)"/><ellipse cx="800" cy="760" rx="900" ry="260" fill="url(#fl)"/><circle cx="1250" cy="260" r="260" fill="#6366F1" opacity=".18" filter="url(#sh2)"/>`
    + o('o1', 1220, 380, 210) + o('o2', 420, 560, 130) + o('o3', 860, 230, 90) + o('o4', 1480, 700, 80) + o('o2', 180, 180, 55) + o('o3', 640, 760, 60) + o('o1', 1000, 640, 42))
}

function cubes() {
  // คิวบ์ไอโซเมตริก 3 หน้าแสงเงาต่างกัน วางเป็นกองบันได
  const cube = (x, y, s, top, left, right) => {
    const h = s * 0.5
    return `<path d="M${x} ${y} l${s} ${-h} l${s} ${h} l${-s} ${h} Z" fill="${top}"/><path d="M${x} ${y} l${s} ${h} l0 ${s * 1.15} l${-s} ${-h} Z" fill="${left}"/><path d="M${x + s} ${y + h} l${s} ${-h} l0 ${s * 1.15} l${-s} ${h} Z" fill="${right}"/>`
  }
  const pal = [['#FDBA74', '#EA580C', '#9A3412'], ['#A5B4FC', '#4F46E5', '#312E81'], ['#E4E4E7', '#71717A', '#3F3F46'], ['#5EEAD4', '#0D9488', '#134E4A']]
  const r = rng(13); let out = ''
  const s = 70
  for (let row = 0; row < 9; row++) for (let col = 0; col < 14; col++) {
    const x = col * s * 2 + (row % 2) * s - 140, y = row * s * 0.5 * 2 + 40
    const v = r()
    if (v < 0.42) continue
    const [a, b, c] = v > 0.93 ? pal[0] : v > 0.86 ? pal[1] : v > 0.8 ? pal[3] : pal[2]
    const lift = v > 0.86 ? -Math.round(r() * 60) : 0
    out += cube(x, y + lift, s, a, b, c)
  }
  return svg(lin('bg', [[0, '#18181B'], [1, '#09090B']]) + rad('vg', [[0, '#000', 0], [1, '#000', 0.65]]),
    `<rect width="${W}" height="${H}" fill="url(#bg)"/><g opacity=".9">${out}</g><rect width="${W}" height="${H}" fill="url(#vg)"/>`)
}

function grid() {
  // ทางวิ่ง 3D แบบ synthwave: เส้นตารางพุ่งเข้าเส้นขอบฟ้า
  const hy = 470, lines = []
  for (let i = -24; i <= 24; i++) lines.push(`<line x1="${800 + i * 14}" y1="${hy}" x2="${800 + i * 150}" y2="${H}"/>`)
  for (let k = 1; k <= 16; k++) { const y = hy + Math.pow(k / 16, 2.2) * (H - hy); lines.push(`<line x1="0" y1="${y.toFixed(1)}" x2="${W}" y2="${y.toFixed(1)}"/>`) }
  return svg(
    lin('sk', [[0, '#05010F'], [0.7, '#2E0A4E'], [1, '#7E22CE']]) + lin('fl', [[0, '#1E0539'], [1, '#05010F']]) + lin('sn', [[0, '#FDE047'], [0.5, '#FB7185'], [1, '#C026D3']]) + blur('g', 4) + rad('hz', [[0, '#E879F9', 0.6], [1, '#E879F9', 0]]),
    `<rect width="${W}" height="${H}" fill="url(#sk)"/>${stars(9, 110, 420)}<ellipse cx="800" cy="${hy}" rx="700" ry="110" fill="url(#hz)"/><circle cx="800" cy="${hy - 10}" r="170" fill="url(#sn)"/>`
    + Array.from({ length: 7 }, (_, i) => `<rect x="600" y="${hy - 90 + i * 14}" width="400" height="${2 + i}" fill="#2E0A4E"/>`).join('')
    + `<rect y="${hy}" width="${W}" height="${H - hy}" fill="url(#fl)"/><g stroke="#22D3EE" stroke-width="2" opacity=".55" filter="url(#g)">${lines.join('')}</g><g stroke="#67E8F9" stroke-width="1.2" opacity=".8">${lines.join('')}</g>`)
}

function waves() {
  // ริบบิ้นโค้ง 3D ซ้อนชั้น มีเงาใต้แต่ละชั้น — โทนสว่าง
  const g = (id, c1, c2) => lin(id, [[0, c1], [1, c2]], 1, 0)
  const defs = g('w1', '#C7D2FE', '#A5F3FC') + g('w2', '#A5B4FC', '#67E8F9') + g('w3', '#818CF8', '#22D3EE') + g('w4', '#6366F1', '#06B6D4') + g('w5', '#4F46E5', '#0891B2')
    + lin('bg', [[0, '#F8FAFF'], [1, '#EEF2FF']]) + blur('s', 14)
  const wave = (y, a, ph, g) => {
    const d = `M0 ${y} C${300 + ph} ${y - a} ${600 + ph} ${y + a} ${900} ${y} S${1400 - ph} ${y - a} ${W} ${y + a * 0.3} L${W} ${H} L0 ${H} Z`
    return `<path d="${d}" fill="#1E1B4B" opacity=".18" filter="url(#s)" transform="translate(0 14)"/><path d="${d}" fill="url(#${g})"/>`
  }
  return svg(defs, `<rect width="${W}" height="${H}" fill="url(#bg)"/><circle cx="1320" cy="180" r="120" fill="#C7D2FE" opacity=".6"/><circle cx="1240" cy="120" r="44" fill="#A5F3FC" opacity=".7"/>`
    + wave(430, 120, 40, 'w1') + wave(530, 110, -60, 'w2') + wave(630, 100, 80, 'w3') + wave(730, 90, -20, 'w4') + wave(820, 70, 60, 'w5'))
}

// kind: draw = ภาพวาด, 3d = ภาพ 3D · light = ภาพโทนสว่าง (ใช้คู่กับโหมดสว่าง) · theme/mode = ธีมสีที่เข้ากันเมื่อเลือกแบบ "ธีมสำเร็จรูป"
export const WALLPAPERS = [
  { id: 'sunset', label: 'ภูเขายามเย็น', icon: '🌄', kind: 'draw', theme: 'aurora', mode: 'dark', make: sunset },
  { id: 'nightsea', label: 'ทะเลใต้แสงจันทร์', icon: '🌙', kind: 'draw', theme: 'lagoon', mode: 'dark', make: nightsea },
  { id: 'city', label: 'เมืองยามค่ำ', icon: '🌃', kind: 'draw', theme: 'graphite', mode: 'dark', make: city },
  { id: 'road', label: 'ถนนสู่พระอาทิตย์', icon: '🏎️', kind: 'draw', theme: 'rose', mode: 'dark', make: road },
  { id: 'sakura', label: 'ซากุระ', icon: '🌸', kind: 'draw', theme: 'rose', mode: 'light', make: sakura },
  { id: 'meadow', label: 'ทุ่งหญ้าฟ้าใส', icon: '🌤️', kind: 'draw', theme: 'lagoon', mode: 'light', make: meadow },
  { id: 'orbs', label: 'ลูกแก้ว 3D', icon: '🔮', kind: '3d', theme: 'aurora', mode: 'dark', make: orbs },
  { id: 'cubes', label: 'กล่อง 3D', icon: '🧊', kind: '3d', theme: 'graphite', mode: 'dark', make: cubes },
  { id: 'grid', label: 'อุโมงค์นีออน 3D', icon: '🛣️', kind: '3d', theme: 'rose', mode: 'dark', make: grid },
  { id: 'waves', label: 'คลื่น 3D', icon: '🌊', kind: '3d', theme: 'aurora', mode: 'light', make: waves },
]
export const WALLPAPER_IDS = WALLPAPERS.map(w => w.id)

const cache = {}
// คืนค่า url("data:...") สำหรับ CSS — สร้างครั้งเดียวแล้วจำไว้
export function wallpaperCss(id) {
  const w = WALLPAPERS.find(x => x.id === id)
  if (!w) return ''
  return cache[id] || (cache[id] = `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(w.make())}")`)
}
