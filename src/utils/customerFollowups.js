// นัดติดตามของลูกค้ารายเดียว — ใช้ในหน้ารายละเอียดลูกค้า (Customers.js) ให้เซลส์เห็นว่ามีนัดค้างอะไรอยู่
// และเพิ่มนัดใหม่ได้ทันทีโดยไม่ต้องสลับไปหน้า Follow-up — ฟังก์ชันล้วน ไม่แตะฐานข้อมูล เทสได้
import { daysBetween, bangkokDate } from './myDay.js'

export const FOLLOWUP_PURPOSES = ['ติดตาม Lead ใหม่', 'ติดตามหลังทดลองขับ', 'ติดตามใบเสนอราคา', 'หลังส่งมอบรถ', 'ตรวจสอบความพึงพอใจ', 'แจ้งบริการถึงกำหนด', 'เสนอต่ออายุประกัน', 'แนะนำรุ่นใหม่', 'กิจกรรม/โปรโมชัน', 'วันเกิด/เทศกาล', 'ทั่วไป']

// นัดที่ยังไม่ทำของลูกค้ารายนี้ เรียงจากนัดที่ใกล้/เลยกำหนดก่อน — late > 0 = เลยกำหนดมาแล้วกี่วัน
export function pendingFollowupsFor(followups, customerId, today) {
  if (!customerId) return []
  return (followups || [])
    .filter(f => f && !f.deleted && f.customerId === customerId && f.status === 'pending' && /^\d{4}-\d{2}-\d{2}/.test(f.dueDate || ''))
    .map(f => ({ ...f, late: daysBetween(f.dueDate.slice(0, 10), today) }))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
}

// วันที่ 'YYYY-MM-DD' บวก n วัน
export function addDays(date, n) {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

// ตัวกรองดึงนัดติดตามเฉพาะช่วงใกล้ๆ (เลยกำหนดไม่เกิน days วัน + อนาคตทั้งหมด) — นัดอัตโนมัติ (Lead 3 ครั้ง,
// หลังส่งมอบ 3 ครั้ง ฯลฯ) สะสมเร็ว ถ้าดึงแบบเรียงจากวันเก่าสุดแล้วจำกัดจำนวน นัดเก่าที่ทำไปแล้วจะกินโควตาหมด
// จนนัดของวันนี้ตกหล่น — กรองช่วงบน field เดียวกับที่เรียง (dueDate) ใช้ index เดิม (companyId+dueDate) ได้เลย
export const FOLLOWUP_WINDOW_DAYS = 120
export function followupWindowFilters(today, days = FOLLOWUP_WINDOW_DAYS) {
  return [['dueDate', '>=', addDays(today, -days)]]
}

// สร้างข้อมูลนัดติดตามใหม่จากลูกค้า (ยังไม่บันทึก) — ผู้ดูแล = ผู้ดูแลลูกค้า ถ้าไม่มีใช้ชื่อผู้กด
export function buildManualFollowup(c, { dueDate, purpose, type = 'call', note = '', me = '' }) {
  return {
    customerId: c.id,
    customerName: [c.firstName, c.lastName].filter(Boolean).join(' ') || 'ลูกค้า',
    phone: c.phone || '',
    vehicleModel: c.interestedModel || '',
    salesperson: c.assignedTo || me || '',
    type, purpose: purpose || 'ทั่วไป', dueDate, status: 'pending', note: String(note || '').trim(), result: '',
  }
}

// สรุปนัดค้างต่อลูกค้า: Map(customerId → { pending: จำนวนนัดค้าง, late: จำนวนนัดที่เลยกำหนด, next: วันนัดถัดไป })
export function followupStatusByCustomer(followups, today) {
  const map = new Map()
  ;(followups || []).forEach(f => {
    if (!f || f.deleted || f.status !== 'pending' || !f.customerId || !/^\d{4}-\d{2}-\d{2}/.test(f.dueDate || '')) return
    const d = f.dueDate.slice(0, 10)
    const s = map.get(f.customerId) || { pending: 0, late: 0, next: '' }
    s.pending++
    if (d < today) s.late++
    else if (!s.next || d < s.next) s.next = d
    map.set(f.customerId, s)
  })
  return map
}

export const QUIET_DAYS = 7

// กี่วันแล้วที่ไม่มีความเคลื่อนไหวกับลูกค้ารายนี้ (ติดต่อล่าสุด/แก้ไข/เปลี่ยนสถานะ/วันที่เพิ่ม — เอาวันล่าสุด)
export function quietDays(c, today) {
  const last = [c?.lastContactAt, c?.updatedAt, c?.stageChangedAt, c?.createdAt].map(bangkokDate).filter(Boolean).sort().pop()
  return last ? daysBetween(last, today) : null
}

// ตัวกรองหน้าลูกค้า: 'none' = Lead/Prospect ที่ยังไม่เสียดีลแต่ไม่มีนัดค้างเลย (เสี่ยงหลุด), 'late' = มีนัดเลยกำหนด,
// 'quiet' = Lead/Prospect ที่เงียบไปตั้งแต่ QUIET_DAYS วันขึ้นไป (ไม่ต้องโหลดนัดติดตาม)
export function matchFollowupFilter(c, filter, statusMap, today) {
  if (!filter) return true
  if (filter === 'quiet') {
    if (!['lead', 'pp'].includes(c.stage) || c.isLost || !today) return false
    const d = quietDays(c, today)
    return d != null && d >= QUIET_DAYS
  }
  const s = statusMap?.get(c.id)
  if (filter === 'none') return ['lead', 'pp'].includes(c.stage) && !c.isLost && !s
  if (filter === 'late') return !!(s && s.late)
  return true
}
