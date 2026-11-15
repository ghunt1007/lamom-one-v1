// สร้าง QR Code เอง (ไม่ต้องพึ่งไลบรารีเพิ่ม) — ใช้กับลิงก์แนะนำเพื่อน / ลิงก์ฟอร์มฝากชื่อ เพื่อพิมพ์ติดบูธหรือส่งเป็นรูป
// มาตรฐาน ISO/IEC 18004: โหมด byte (UTF-8), ระดับแก้ผิด M (~15%), เวอร์ชัน 1–20, เลือก mask ที่คะแนนโทษต่ำสุด
// qrMatrix(text) → array ของแถว (true = จุดดำ) · qrSvg(text) → <svg> พร้อมขอบขาว 4 ช่อง
const ECC_M = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26]
const BLOCKS_M = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16]
const MAX_VER = 20

function gfMul(x, y) {
  let z = 0
  for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11d); z ^= ((y >>> i) & 1) * x }
  return z & 0xff
}
function rsDivisor(degree) {
  const r = new Array(degree).fill(0); r[degree - 1] = 1
  let root = 1
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < r.length; j++) { r[j] = gfMul(r[j], root); if (j + 1 < r.length) r[j] ^= r[j + 1] }
    root = gfMul(root, 0x02)
  }
  return r
}
function rsRemainder(data, divisor) {
  const r = new Array(divisor.length).fill(0)
  for (const b of data) {
    const f = b ^ r.shift(); r.push(0)
    divisor.forEach((c, i) => { r[i] ^= gfMul(c, f) })
  }
  return r
}
const rawModules = v => {
  let n = (16 * v + 128) * v + 64
  if (v >= 2) { const a = Math.floor(v / 7) + 2; n -= (25 * a - 10) * a - 55; if (v >= 7) n -= 36 }
  return n
}
const dataCodewords = v => Math.floor(rawModules(v) / 8) - ECC_M[v] * BLOCKS_M[v]
function alignPositions(v) {
  if (v === 1) return []
  const n = Math.floor(v / 7) + 2
  const step = Math.floor((v * 8 + n * 3 + 5) / (n * 4 - 4)) * 2
  const out = [6]
  for (let i = 0, pos = v * 4 + 10; i < n - 1; i++, pos -= step) out.splice(1, 0, pos)
  return out
}
const utf8 = s => Array.from(new TextEncoder().encode(String(s ?? '')))

export function qrMatrix(text) {
  const bytes = utf8(text)
  let ver = 1
  for (; ver <= MAX_VER; ver++) if (4 + (ver <= 9 ? 8 : 16) + bytes.length * 8 <= dataCodewords(ver) * 8) break
  if (ver > MAX_VER) throw new Error('ข้อความยาวเกินไปสำหรับ QR')
  // บิตข้อมูล
  const bits = []
  const put = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1) }
  put(4, 4); put(bytes.length, ver <= 9 ? 8 : 16); bytes.forEach(b => put(b, 8))
  const cap = dataCodewords(ver) * 8
  put(0, Math.min(4, cap - bits.length)); put(0, (8 - bits.length % 8) % 8)
  for (let p = 0xec; bits.length < cap; p ^= 0xec ^ 0x11) put(p, 8)
  const data = []
  for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0))
  // แบ่งบล็อก + แก้ผิด + สลับ
  const nb = BLOCKS_M[ver], eccLen = ECC_M[ver], raw = Math.floor(rawModules(ver) / 8)
  const nShort = nb - raw % nb, shortLen = Math.floor(raw / nb), div = rsDivisor(eccLen)
  const blocks = []
  for (let i = 0, k = 0; i < nb; i++) {
    const d = data.slice(k, k + shortLen - eccLen + (i < nShort ? 0 : 1)); k += d.length
    const ecc = rsRemainder(d, div)
    if (i < nShort) d.push(0)
    blocks.push(d.concat(ecc))
  }
  const cw = []
  for (let i = 0; i < blocks[0].length; i++) blocks.forEach((b, j) => { if (i !== shortLen - eccLen || j >= nShort) cw.push(b[i]) })
  // วาด
  const size = ver * 4 + 17
  const m = Array.from({ length: size }, () => new Array(size).fill(false))
  const fn = Array.from({ length: size }, () => new Array(size).fill(false))
  const setF = (x, y, dark) => { m[y][x] = dark; fn[y][x] = true }
  for (let i = 0; i < size; i++) { setF(6, i, i % 2 === 0); setF(i, 6, i % 2 === 0) }
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const x = cx + dx, y = cy + dy, d = Math.max(Math.abs(dx), Math.abs(dy))
      if (x >= 0 && x < size && y >= 0 && y < size) setF(x, y, d !== 2 && d !== 4)
    }
  }
  const al = alignPositions(ver), last = al.length - 1
  al.forEach((ax, i) => al.forEach((ay, j) => {
    if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) return
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) setF(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1)
  }))
  const drawFormat = mask => {
    const d = (0 << 3) | mask // ระดับ M = 00
    let r = d
    for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537)
    const b = ((d << 10) | r) ^ 0x5412, bit = i => ((b >>> i) & 1) === 1
    for (let i = 0; i <= 5; i++) setF(8, i, bit(i))
    setF(8, 7, bit(6)); setF(8, 8, bit(7)); setF(7, 8, bit(8))
    for (let i = 9; i < 15; i++) setF(14 - i, 8, bit(i))
    for (let i = 0; i < 8; i++) setF(size - 1 - i, 8, bit(i))
    for (let i = 8; i < 15; i++) setF(8, size - 15 + i, bit(i))
    setF(8, size - 8, true)
  }
  drawFormat(0)
  if (ver >= 7) {
    let r = ver
    for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1f25)
    const b = (ver << 12) | r
    for (let i = 0; i < 18; i++) {
      const dark = ((b >>> i) & 1) === 1, a = size - 11 + i % 3, c = Math.floor(i / 3)
      setF(a, c, dark); setF(c, a, dark)
    }
  }
  let bi = 0
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5
    for (let v = 0; v < size; v++) for (let j = 0; j < 2; j++) {
      const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - v : v
      if (!fn[y][x] && bi < cw.length * 8) { m[y][x] = ((cw[bi >>> 3] >>> (7 - (bi & 7))) & 1) === 1; bi++ }
    }
  }
  const MASKS = [
    (x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, x => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => (x * y) % 2 + (x * y) % 3 === 0,
    (x, y) => ((x * y) % 2 + (x * y) % 3) % 2 === 0, (x, y) => ((x + y) % 2 + (x * y) % 3) % 2 === 0,
  ]
  const applyMask = k => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && MASKS[k](x, y)) m[y][x] = !m[y][x] }
  let best = 0, bestScore = Infinity
  for (let k = 0; k < 8; k++) {
    applyMask(k); drawFormat(k)
    const s = penalty(m)
    if (s < bestScore) { bestScore = s; best = k }
    applyMask(k)
  }
  applyMask(best); drawFormat(best)
  return m
}

// คะแนนโทษตามมาตรฐาน (ใช้เลือก mask ที่สแกนง่ายที่สุด)
function penalty(m) {
  const n = m.length
  let s = 0
  const line = get => {
    let run = 1
    for (let i = 1; i <= n; i++) {
      if (i < n && get(i) === get(i - 1)) run++
      else { if (run >= 5) s += run - 2; run = 1 }
    }
    for (let i = 0; i + 11 <= n; i++) {
      const p = Array.from({ length: 11 }, (_, k) => get(i + k) ? 1 : 0).join('')
      if (p === '10111010000' || p === '00001011101') s += 40
    }
  }
  for (let y = 0; y < n; y++) line(x => m[y][x])
  for (let x = 0; x < n; x++) line(y => m[y][x])
  let dark = 0
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (m[y][x]) dark++
    if (x < n - 1 && y < n - 1 && m[y][x] === m[y][x + 1] && m[y][x] === m[y + 1][x] && m[y][x] === m[y + 1][x + 1]) s += 3
  }
  s += Math.floor(Math.abs(dark * 20 - n * n * 10) / (n * n)) * 10
  return s
}

export function qrSvg(text, { size = 200, border = 4 } = {}) {
  const m = qrMatrix(text), n = m.length + border * 2
  let d = ''
  m.forEach((row, y) => row.forEach((v, x) => { if (v) d += `M${x + border},${y + border}h1v1h-1z` }))
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" width="${size}" height="${size}" shape-rendering="crispEdges" role="img" aria-label="QR Code"><rect width="${n}" height="${n}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`
}

// รูป PNG (data URL) สำหรับบันทึก/ส่งต่อทาง LINE — ใช้ได้เฉพาะในเบราว์เซอร์ (ต้องมี canvas)
export function qrPngDataUrl(text, { px = 720, border = 4 } = {}) {
  const m = qrMatrix(text), n = m.length + border * 2, scale = Math.max(1, Math.floor(px / n)), w = n * scale
  const c = document.createElement('canvas'); c.width = w; c.height = w
  const g = c.getContext('2d')
  g.fillStyle = '#fff'; g.fillRect(0, 0, w, w); g.fillStyle = '#000'
  m.forEach((row, y) => row.forEach((v, x) => { if (v) g.fillRect((x + border) * scale, (y + border) * scale, scale, scale) }))
  return c.toDataURL('image/png')
}
// ปุ่มบันทึกรูป: <a download> พร้อม data URL (ถ้าสร้างไม่ได้คืนค่าว่าง ไม่ทำให้หน้าพัง)
export function qrDownloadLink(text, filename, label = '💾 บันทึกรูป QR', cls = 'btn btn-secondary btn-xs') {
  try { return `<a class="${cls}" download="${String(filename).replace(/[^\w฀-๿-]+/g, '_')}.png" href="${qrPngDataUrl(text)}">${label}</a>` } catch { return '' }
}
