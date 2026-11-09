// (v1.0.988) Lead มาจาก "บัญชีไหน" — เพจทีม / เพจโชว์รูม / เพจหรือ TikTok ส่วนตัวของเซลส์
// เพิ่ม Lead ด่วนเลือกบัญชีได้ (social_channels) → หน้าช่องทางโซเชียลนับ Lead/จอง ต่อบัญชีจากข้อมูลจริง
import { ymdBangkok } from './format.js'

export const PLATFORM_OF_SOURCE = { facebook: 'facebook', instagram: 'instagram', line: 'line', tiktok: 'tiktok' }
const key = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ')
const LEVEL_ORDER = { sales: 0, showroom: 1, team: 2 }

// บัญชีของแพลตฟอร์มนั้น — ของฉันก่อน แล้วโชว์รูม แล้วทีม
export function accountsForSource(accounts, source, me = '') {
  const pf = PLATFORM_OF_SOURCE[source]
  if (!pf) return []
  const mine = a => key(a.owner) && key(a.owner) === key(me)
  return (accounts || []).filter(a => a && !a.deleted && a.platform === pf)
    .sort((a, b) => (mine(b) - mine(a)) || ((LEVEL_ORDER[a.level] ?? 3) - (LEVEL_ORDER[b.level] ?? 3)) || String(a.name).localeCompare(String(b.name), 'th'))
}
// ค่าเริ่มต้น: บัญชีของฉันถ้ามีอันเดียว ไม่งั้นถ้าทั้งแพลตฟอร์มมีบัญชีเดียวก็เลือกอันนั้น
export function defaultAccount(list, me = '') {
  const mine = (list || []).filter(a => key(a.owner) && key(a.owner) === key(me))
  if (mine.length === 1) return mine[0]
  return (list || []).length === 1 ? list[0] : null
}
const BOOKED = new Set(['booking', 'delivered', 'จอง', 'ส่งมอบ'])
// ผลต่อบัญชี: Lead ที่เข้ามาในเดือน (ตามวันสร้าง) และในนั้นจองแล้วกี่ราย · ทั้งหมด = ตลอดที่ผ่านมา
export function accountResults(customers, month) {
  const out = {}
  for (const c of customers || []) {
    if (!c || c.deleted || !c.sourceAccountId) continue
    const r = (out[c.sourceAccountId] ||= { leads: 0, booked: 0, allLeads: 0, allBooked: 0 })
    const booked = BOOKED.has(c.stage) || !!c.bookingId
    r.allLeads++; if (booked) r.allBooked++
    if (month && ymdBangkok(c.createdAt).slice(0, 7) === month) { r.leads++; if (booked) r.booked++ }
  }
  return out
}

// (v1.0.996) ค่าโฆษณาที่จ่ายจริงต่อบัญชี (กรอกเองรายเดือน — ยังไม่มีโทเค็น Meta ให้ดึงเอง)
// เก็บใน social_channels.spend = { 'YYYY-MM': บาท }
export function accountSpend(a, month) {
  const n = Number(a?.spend?.[month])
  return Number.isFinite(n) && n > 0 ? n : 0
}
export function withSpend(a, month, amount) {
  const spend = { ...(a?.spend || {}) }
  const n = Math.round(Number(amount) || 0)
  if (n > 0) spend[month] = n; else delete spend[month]
  return spend
}
// รวมทั้งเดือน: ค่าโฆษณา · Lead · จอง · ต้นทุนต่อ Lead / ต่อจอง (นับเฉพาะบัญชีที่ใส่ค่าโฆษณา เพื่อไม่ให้ต้นทุนต่อ Lead ต่ำเกินจริง)
export function spendSummary(accounts, results, month) {
  let spend = 0, leads = 0, booked = 0, paid = 0
  for (const a of accounts || []) {
    if (!a || a.deleted) continue
    const s = accountSpend(a, month)
    if (!s) continue
    paid++; spend += s
    leads += results?.[a.id]?.leads || 0
    booked += results?.[a.id]?.booked || 0
  }
  return { spend, leads, booked, paid, cpl: leads ? Math.round(spend / leads) : null, cpb: booked ? Math.round(spend / booked) : null }
}

// (v1.0.997) ให้ LAMI ตอบ "เพจไหนคุ้มสุด / ยิงแอดเพจไหนดี" ได้ — บัญชีที่มี Lead หรือค่าโฆษณาเดือนนี้ เรียงตาม Lead
const LV = { team: 'ทีม', showroom: 'โชว์รูม', sales: 'เซลส์' }
export function accountFacts(accounts, results, month, limit = 8) {
  const rows = (accounts || []).filter(a => a && !a.deleted).map(a => ({ a, r: results?.[a.id] || { leads: 0, booked: 0 }, s: accountSpend(a, month) }))
    .filter(x => x.r.leads || x.s).sort((x, y) => y.r.leads - x.r.leads || y.s - x.s).slice(0, limit)
  const fmt = n => '฿' + Math.round(n).toLocaleString('en-US')
  const out = rows.map(({ a, r, s }) => `${a.name || a.platform} (${a.platform}${LV[a.level] ? ` · ของ${LV[a.level]}` : ''}${a.owner ? ` · ${a.owner}` : ''}): Lead ${r.leads} จอง ${r.booked}${s ? ` · ค่าโฆษณา ${fmt(s)}${r.leads ? ` = ${fmt(s / r.leads)}/Lead` : ' ยังไม่มี Lead'}${r.booked ? ` · ${fmt(s / r.booked)}/จอง` : ''}` : ''}`)
  const t = spendSummary(accounts, results, month)
  if (t.spend) out.push(`รวมบัญชีที่ยิงแอด ${t.paid} บัญชี ค่าโฆษณา ${fmt(t.spend)} · Lead ${t.leads}${t.cpl != null ? ` (${fmt(t.cpl)}/Lead)` : ''}${t.cpb != null ? ` · ${fmt(t.cpb)}/จอง` : ''}`)
  return out
}
