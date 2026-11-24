// กลุ่มเป้าหมายแคมเปญ (Broadcast / SMS Marketing) — คำนวณจากข้อมูลจริงใน Firestore
// เดิมหน้า SMSMarketing.js เขียนตัวเลขไว้ตายตัวในดรอปดาวน์ (เช่น "ลูกค้าทั้งหมด (1,842 ราย)")
// ไม่ได้นับจากฐานข้อมูลจริงเลย ไฟล์นี้แทนที่ด้วยการนับ+ดึงรายชื่อจริงทุกครั้ง (ดู CHANGELOG)
import { listDocs } from './db.js'
import { companyScopeFilters } from './companyScope.js'
import { phoneKey, optedOutPhones } from '../utils/marketingOptOut.js'

const AT_RISK_DAYS = 90        // Lead/Prospect ที่เงียบไปนานกว่านี้ถือว่า "At Risk"
// เกณฑ์ "ใกล้หมดประกัน" ใช้ status ที่ WarrantyExpiry.js คำนวณไว้แล้ว (expiring = เหลือ ≤60 วัน)
// ไม่คำนวณซ้ำที่นี่ เพื่อไม่ให้ตัวเลข 2 หน้านี้เพี้ยนไม่ตรงกัน

export const TARGET_SEGMENTS = {
  all:               'ลูกค้าทั้งหมด',
  active:            'ลูกค้า Active (มีใบจอง/ส่งมอบแล้ว)',
  at_risk:           `At Risk (Lead/Prospect เงียบเกิน ${AT_RISK_DAYS} วัน)`,
  expiring_warranty: 'ใกล้หมดประกัน (ภายใน 60 วัน)',
}

function daysSince(iso) {
  if (!iso) return Infinity
  const t = typeof iso === 'string' ? new Date(iso).getTime() : (iso.toDate ? iso.toDate().getTime() : NaN)
  if (Number.isNaN(t)) return Infinity
  return (Date.now() - t) / 86400000
}

// คืนรายชื่อ "สมาชิกกลุ่มเป้าหมาย" จริง พร้อมช่องทางติดต่อที่มีอยู่จริง (phone/lineId/email)
export async function getSegmentMembers(target) {
  if (target === 'expiring_warranty') {
    let vehicles = []
    try { vehicles = await listDocs('warranty_expiry_vehicles', [], 'warrantyEnd', 'asc', 2000) } catch { vehicles = [] }
    // (v1.0.1376) เจ้าของรถที่ปฏิเสธรับข่าวสารในเอกสารลูกค้า (เทียบเบอร์) ไม่ได้รับ SMS กลุ่ม
    let blocked = new Set()
    try { blocked = optedOutPhones(await listDocs('customers', companyScopeFilters(), 'createdAt', 'desc', 3000)) } catch { blocked = new Set() }
    return vehicles
      .filter(v => v.status === 'expiring')
      .map(v => ({ id: v.id, name: v.owner || '', phone: blocked.has(phoneKey(v.phone)) ? '' : (v.phone || ''), lineId: '', email: '' }))
  }

  let customers = []
  try { customers = await listDocs('customers', companyScopeFilters(), 'createdAt', 'desc', 3000) } catch { customers = [] }
  customers = customers.filter(c => !c.deleted)
  // (v1.0.1376) เบอร์ที่ปฏิเสธรับข่าวสารในเอกสารใดก็ตาม (ลูกค้าคนเดียวมีหลายเอกสารได้) = ไม่ส่งทุกเอกสารที่ใช้เบอร์นั้น
  const blocked = optedOutPhones(customers)

  if (target === 'active') {
    customers = customers.filter(c => c.stage === 'booking' || c.stage === 'delivered')
  } else if (target === 'at_risk') {
    customers = customers.filter(c => (c.stage === 'lead' || c.stage === 'pp') && daysSince(c.updatedAt) >= AT_RISK_DAYS)
  }
  // target === 'all' → ทุกคนที่ไม่ถูกลบ ไม่กรองเพิ่ม

  return customers.map(c => blocked.has(phoneKey(c.phone)) ? { ...c, marketingConsent: 'no' } : c).map(c => ({
    id: c.id,
    name: [c.firstName, c.lastName].filter(Boolean).join(' '),
    // (v1.0.1230) PDPA: ลูกค้าที่ไม่ติ๊กรับข่าวสารในฟอร์ม (marketingConsent 'no') ไม่ได้รับ SMS/อีเมลกลุ่ม
    phone: c.marketingConsent === 'no' ? '' : (c.phone || ''), lineId: c.lineId || '', email: c.marketingConsent === 'no' ? '' : (c.email || ''), lineUserId: c.lineOptOut || c.lineBlockedAt || c.marketingConsent === 'no' ? '' : (c.lineUserId || ''), // (v1.0.1230) ลูกค้าพิมพ์ "เลิกรับ"/บล็อก OA = ไม่ส่ง
  }))
}

// กรองเฉพาะสมาชิกที่ "ส่งได้จริง" ในช่องทางที่ระบุ (ต้องมีช่องทางติดต่อของช่องทางนั้นจริง)
// (v1.0.1376) เบอร์/อีเมลซ้ำ (ลูกค้าคนเดียวหลายเอกสาร) ส่งครั้งเดียว — ไม่เสียค่า SMS ซ้ำ และลูกค้าไม่ได้ข้อความซ้ำ
function uniqueBy(list, keyOf) {
  const seen = new Set(), out = []
  for (const m of list) { const k = keyOf(m); if (!k || seen.has(k)) continue; seen.add(k); out.push(m) }
  return out
}

export function reachableMembers(members, channel) {
  if (channel === 'sms') return uniqueBy(members, m => m.phone ? phoneKey(m.phone) || String(m.phone) : '')
  if (channel === 'email') return uniqueBy(members, m => String(m.email || '').trim().toLowerCase())
  if (channel === 'line') return members // LINE ส่งผ่าน Broadcast API (ทุกคนที่เป็นเพื่อน OA) ไม่ต้องมีรายชื่อ — ดู comms.js
  if (channel === 'push') return [] // ยังไม่มีระบบเก็บ Push token ของลูกค้าในแอปนี้
  return members
}

export async function getSegmentCount(target, channel) {
  const members = await getSegmentMembers(target)
  return reachableMembers(members, channel).length
}

// (v1.0.1376) สมาชิกที่ส่ง LINE รายคนได้ — lineUserId ซ้ำ (หลายเอกสาร) นับ/ส่งครั้งเดียว
export const lineReachable = members => uniqueBy(members || [], m => m.lineUserId || '')
