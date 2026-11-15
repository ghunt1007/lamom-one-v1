// (v1.0.1172) ลิงก์ที่ส่งให้ลูกค้าภายนอก ต้องชี้ไปเว็บจริงเสมอ
// เดิมบางหน้าสร้างลิงก์ไปโดเมน lamom.app ซึ่งไม่มีอยู่จริง (ลูกค้าเปิดแล้วเจอหน้าเปล่า)
// ใช้ origin ตายตัว เพราะในแอป Android location.origin เป็น https://localhost
export const PUBLIC_ORIGIN = 'https://lamom-one.pages.dev'

// origin ที่ใช้ทำลิงก์ให้คนภายนอก: เว็บจริงที่เปิดอยู่ (เช่นโดเมนของบริษัทในอนาคต) ถ้าเป็น https และไม่ใช่เครื่องตัวเอง
// ไม่งั้น (แอป Android = https://localhost, เครื่องนักพัฒนา, ตัวอย่าง PR) ใช้เว็บจริงเสมอ
export function publicOrigin(loc = typeof location !== 'undefined' ? location : null) {
  try {
    const host = String(loc?.hostname || '')
    if (loc?.protocol === 'https:' && host && host !== 'localhost' && !/^(127\.|\[::1\])/.test(host) && !/\.lamom-one\.pages\.dev$/.test(host)) return loc.origin
  } catch (e) {}
  return PUBLIC_ORIGIN
}

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
  for (const [k, v] of Object.entries(referralStats(customers))) out[k] = v.leads
  return out
}

// (v1.0.1174) ต่อรหัสผู้แนะนำ: ลีดทั้งหมด / จองแล้ว / ส่งมอบแล้ว (ส่งมอบ = ขายได้ นับค่าคอมผู้แนะนำ)
export function referralStats(customers = []) {
  const out = {}
  for (const c of customers) {
    if (!c || c.deleted) continue
    const k = String(c.referralCode || '').trim().toUpperCase()
    if (!k) continue
    const o = (out[k] ||= { leads: 0, booked: 0, sold: 0 })
    o.leads++
    if (c.stage === 'booking' || c.stage === 'delivered') o.booked++
    if (c.stage === 'delivered') o.sold++
  }
  return out
}

// (v1.0.1176) ใส่ UTM ต่อท้ายลิงก์ (รองรับลิงก์ที่มี ?... อยู่แล้ว)
export function withUtm(url, { source = '', medium = '', campaign = '' } = {}) {
  try {
    const u = new URL(String(url || ''), PUBLIC_ORIGIN)
    if (source) u.searchParams.set('utm_source', source)
    if (medium) u.searchParams.set('utm_medium', medium)
    if (campaign) u.searchParams.set('utm_campaign', campaign)
    return u.href
  } catch (e) { return String(url || '') }
}

// ลีดที่เข้าฟอร์มของเราผ่านลิงก์ UTM — นับตาม source|campaign (ตัวพิมพ์เล็ก)
export const utmKey = (source, campaign) => `${String(source || '').trim().toLowerCase()}|${String(campaign || '').trim().toLowerCase()}`
export function utmLeadCounts(customers = []) {
  const out = {}
  for (const c of customers) {
    if (!c || c.deleted || !c.utmCampaign) continue
    const k = utmKey(c.utmSource, c.utmCampaign)
    out[k] = (out[k] || 0) + 1
  }
  return out
}
