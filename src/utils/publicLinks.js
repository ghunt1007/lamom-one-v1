// (v1.0.1172) ลิงก์ที่ส่งให้ลูกค้าภายนอก ต้องชี้ไปเว็บจริงเสมอ
// เดิมบางหน้าสร้างลิงก์ไปโดเมน lamom.app ซึ่งไม่มีอยู่จริง (ลูกค้าเปิดแล้วเจอหน้าเปล่า)
// ใช้ origin ตายตัว เพราะในแอป Android location.origin เป็น https://localhost
export const PUBLIC_ORIGIN = 'https://lamom-one.pages.dev'

// ฟอร์มรับลีดสาธารณะ (public/lead.html) — ref = รหัสผู้แนะนำ, model = เติมรุ่นที่สนใจให้ก่อน
export function leadFormUrl({ ref = '', model = '', account = '' } = {}) {
  const q = new URLSearchParams()
  if (ref) q.set('ref', String(ref))
  if (model) q.set('m', String(model).slice(0, 80))
  if (account) q.set('a', String(account))
  const s = q.toString()
  return `${PUBLIC_ORIGIN}/lead.html${s ? '?' + s : ''}`
}

export const referralUrl = code => leadFormUrl({ ref: code })

// รหัสผู้แนะนำใหม่: ตัวอักษรอังกฤษ/ตัวเลขล้วน (พิมพ์/สแกนง่าย ไม่ขึ้นกับชื่อภาษาไทย)
export function newReferralCode(rand = Math.random) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let s = 'R'
  for (let i = 0; i < 5; i++) s += chars[Math.floor(rand() * chars.length)]
  return s
}

// นับลีดที่มาจากลิงก์ของผู้แนะนำแต่ละคน (customers.referralCode)
export function referralLeadCounts(customers = []) {
  const out = {}
  for (const c of customers) {
    if (!c || c.deleted) continue
    const k = String(c.referralCode || '').trim().toUpperCase()
    if (k) out[k] = (out[k] || 0) + 1
  }
  return out
}
