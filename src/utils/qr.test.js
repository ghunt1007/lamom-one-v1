import { describe, it, expect } from 'vitest'
import { qrMatrix, qrSvg } from './qr.js'

// โครงสร้างที่สแกนเนอร์ต้องเจอ: ขนาดตามเวอร์ชัน, finder 3 มุม, timing, dark module, format bits ถูกต้องทั้ง 2 ชุด
const finderOk = (m, x0, y0) => {
  for (let dy = 0; dy < 7; dy++) for (let dx = 0; dx < 7; dx++) {
    const d = Math.max(Math.abs(dx - 3), Math.abs(dy - 3))
    if (m[y0 + dy][x0 + dx] !== (d !== 2)) return false
  }
  return true
}
function formatBits(m) {
  const n = m.length, b = []
  for (let i = 0; i <= 5; i++) b[i] = m[i][8]
  b[6] = m[7][8]; b[7] = m[8][8]; b[8] = m[8][7]
  for (let i = 9; i < 15; i++) b[i] = m[8][14 - i]
  const c = []
  for (let i = 0; i < 8; i++) c[i] = m[8][n - 1 - i]
  for (let i = 8; i < 15; i++) c[i] = m[n - 15 + i][8]
  const num = a => a.reduce((s, v, i) => s | ((v ? 1 : 0) << i), 0)
  return [num(b), num(c)]
}
const validFormat = bits => {
  const d = (bits ^ 0x5412) >>> 10
  let r = d
  for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537)
  return (((d << 10) | r) ^ 0x5412) === bits && (d >>> 3) === 0 // ระดับ M
}

describe('qrMatrix', () => {
  it.each([
    ['A', 1], ['https://lamom-one.pages.dev/lead.html?ref=RAB12', 4], ['ภาษาไทย ทดสอบ QR ลามอม', 4], ['x'.repeat(220), 11], ['u'.repeat(600), 19],
  ])('%#: เวอร์ชันถูก + โครงสร้างครบ', (text, ver) => {
    const m = qrMatrix(text), n = m.length
    expect(n).toBe(ver * 4 + 17)
    expect(finderOk(m, 0, 0) && finderOk(m, n - 7, 0) && finderOk(m, 0, n - 7)).toBe(true)
    for (let i = 8; i < n - 8; i++) { expect(m[6][i]).toBe(i % 2 === 0); expect(m[i][6]).toBe(i % 2 === 0) }
    expect(m[n - 8][8]).toBe(true)
    const [a, b] = formatBits(m)
    expect(a).toBe(b); expect(validFormat(a)).toBe(true)
  })
  it('ผลเหมือนเดิมทุกครั้ง และยาวเกินรับไม่ได้', () => {
    expect(qrMatrix('abc')).toEqual(qrMatrix('abc'))
    expect(() => qrMatrix('z'.repeat(1000))).toThrow()
  })
  it('qrSvg มีขอบขาวและจุดดำ', () => {
    const s = qrSvg('hi', { size: 120 })
    expect(s).toMatch(/^<svg[^>]+viewBox="0 0 29 29"[^>]+width="120"/)
    expect(s).toContain('<path d="M4,4h1v1h-1z')
  })
})
