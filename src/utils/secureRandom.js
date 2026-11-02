// สุ่มแบบปลอดภัย (crypto) สำหรับรหัสผ่านเริ่มต้นและคีย์ API — ห้ามใช้ Math.random กับของพวกนี้
// เพราะ Math.random เดาลำดับได้ ถ้ามีคนเห็นรหัสหลายชุดก็อาจเดารหัสชุดต่อไปได้
const PASS_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
const KEY_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789'

function cryptoObj() {
  const c = globalThis.crypto
  if (!c?.getRandomValues) throw new Error('เบราว์เซอร์นี้ไม่รองรับการสุ่มแบบปลอดภัย')
  return c
}

// เลือกตัวอักษรแบบไม่เอียง (rejection sampling) ให้ทุกตัวมีโอกาสเท่ากัน
export function randomString(len, chars) {
  const n = chars.length
  const limit = 256 - (256 % n)
  const out = []
  const buf = new Uint8Array(len * 2)
  while (out.length < len) {
    cryptoObj().getRandomValues(buf)
    for (const b of buf) {
      if (b < limit) out.push(chars[b % n])
      if (out.length === len) break
    }
  }
  return out.join('')
}

// รหัสผ่านเริ่มต้น: 10 ตัว (ไม่มีตัวที่สับสน เช่น 0/O 1/l) + # + เลข 2 หลัก
export function genPassword() {
  return randomString(10, PASS_CHARS) + '#' + randomString(2, '23456789')
}

export function genApiKey() {
  return 'lmm_live_' + randomString(32, KEY_CHARS)
}
