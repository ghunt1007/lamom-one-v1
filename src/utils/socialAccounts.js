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
