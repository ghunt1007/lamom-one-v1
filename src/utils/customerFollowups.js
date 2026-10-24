// นัดติดตามของลูกค้ารายเดียว — ใช้ในหน้ารายละเอียดลูกค้า (Customers.js) ให้เซลส์เห็นว่ามีนัดค้างอะไรอยู่
// และเพิ่มนัดใหม่ได้ทันทีโดยไม่ต้องสลับไปหน้า Follow-up — ฟังก์ชันล้วน ไม่แตะฐานข้อมูล เทสได้
import { daysBetween } from './myDay.js'

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
