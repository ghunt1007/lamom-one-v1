// แบ่งกลุ่มลูกค้าจากประวัติซื้อจริง (ยอดขายที่ส่งมอบแล้ว) — ลูกค้าแต่ละคนอยู่ได้กลุ่มเดียว
// รวมทุกกลุ่มต้องเท่ากับจำนวนลูกค้าจริงเสมอ (เดิมบางกลุ่มเดาเป็น 40%/15% ของลูกค้าใหม่)
//   lost      = ซื้อครั้งล่าสุดเกิน 2 ปี
//   at_risk   = ซื้อครั้งล่าสุด 1–2 ปีก่อน
//   champions = ซื้อ ≥2 คัน ภายใน 1 ปี และยอดรวม ≥ 2 ล้าน
//   loyal     = ซื้อ ≥2 คัน ภายใน 1 ปี
//   new       = ซื้อ 1 คัน ภายใน 90 วัน
//   potential = ซื้อ 1 คัน 90 วัน–1 ปี
const DAY = 86400000

export const RFM_RULES = {
  champions: 'ซื้อ 2 คันขึ้นไป ยอดรวม 2 ล้านขึ้นไป ซื้อล่าสุดภายใน 1 ปี',
  loyal: 'ซื้อ 2 คันขึ้นไป ซื้อล่าสุดภายใน 1 ปี',
  potential: 'ซื้อ 1 คัน เมื่อ 3–12 เดือนก่อน',
  new: 'ซื้อ 1 คัน ภายใน 3 เดือนนี้',
  at_risk: 'ซื้อครั้งล่าสุดเมื่อ 1–2 ปีก่อน',
  lost: 'ไม่ได้ซื้อมาเกิน 2 ปี',
}

export function customerKey(s) {
  return String(s.customerId || s.phone || s.custName || '').trim()
}

export function rfmTierOf(c, now = Date.now()) {
  const t = c.lastDate ? Date.parse(c.lastDate) : NaN
  const age = Number.isFinite(t) ? (now - t) / DAY : Infinity
  if (age > 730) return 'lost'
  if (age > 365) return 'at_risk'
  if (c.count >= 2) return c.total >= 2000000 ? 'champions' : 'loyal'
  return age <= 90 ? 'new' : 'potential'
}

export function rfmSegments(sales, now = Date.now()) {
  const byCustomer = {}
  for (const s of sales || []) {
    const key = customerKey(s)
    if (!key) continue
    const c = byCustomer[key] || (byCustomer[key] = { name: s.custName || key, count: 0, total: 0, lastDate: '' })
    c.count++
    c.total += Number(s.salePrice) || 0
    const d = String(s.date || '')
    if (d > c.lastDate) c.lastDate = d
  }
  const tiers = { champions: [], loyal: [], potential: [], new: [], at_risk: [], lost: [] }
  for (const c of Object.values(byCustomer)) tiers[rfmTierOf(c, now)].push(c)
  const out = {}
  for (const [id, list] of Object.entries(tiers)) {
    out[id] = {
      count: list.length,
      avgValue: list.length ? Math.round(list.reduce((a, c) => a + c.total, 0) / list.length) : 0,
      customers: list,
    }
  }
  return out
}
