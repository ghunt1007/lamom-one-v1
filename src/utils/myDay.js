// "งานของฉันวันนี้" — รวมงานที่เซลส์ต้องทำวันนี้ไว้หน้าเดียว (เกณฑ์เดียวกับข้อความเตือน 9 โมงเช้าใน
// workers/daily-report.js: Lead ไม่ได้ติดตามเกิน 3 วัน, Follow-up ถึงกำหนด/เลยกำหนด, ส่งมอบแล้วยังไม่กรอกรายได้,
// ใบจองค้างเกิน 14 วัน) + นัดส่งมอบ 7 วันข้างหน้า และ Lead ใหม่วันนี้ — ฟังก์ชันล้วน ไม่แตะฐานข้อมูล เทสได้
import { toDate } from './format.js'
import { DELIVERED_STATUSES, needsIncome } from './deliveryIncome.js'

export const STALE_LEAD_DAYS = 3
export const STUCK_BOOKING_DAYS = 14
export const UPCOMING_DELIVERY_DAYS = 7
const CANCELLED = ['ถอนจอง', 'ยกเลิก']

// วันที่ตามเวลาไทย 'YYYY-MM-DD' ของค่าวันที่ทุกแบบ (Timestamp / ISO / 'YYYY-MM-DD')
export function bangkokDate(v) {
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v
  const d = toDate(v)
  return d ? new Date(d.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10) : ''
}
const dayNum = s => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d) / 86400000 }
export const daysBetween = (from, to) => dayNum(to) - dayNum(from)
const custName = c => [c.firstName, c.lastName].filter(Boolean).join(' ') || 'ไม่มีชื่อ'

// mine(ownerName, rec) → true ถ้าเป็นงานที่ผู้ใช้คนนี้ควรเห็น (หน้าเพจส่ง scopeIncludesRecord + ตัวกรองเซลส์มาให้)
export function buildMyDay({ customers = [], followups = [], bookings = [], testDrives = [] }, { today, mine = () => true }) {
  const alive = rows => (rows || []).filter(r => r && !r.deleted)
  const out = { followups: [], stale: [], newLeads: [], income: [], stuck: [], deliveries: [], testDrives: [] }

  const custById = new Map((customers || []).map(c => [c.id, c]))
  alive(followups)
    .filter(f => f.status === 'pending' && f.dueDate && f.dueDate <= today && mine(f.salesperson, f))
    .filter(f => {
      // นัดติดตาม Lead อัตโนมัติของลูกค้าที่จองแล้ว/เสียดีลแล้ว ไม่ต้องทำต่อ
      if (!f.autoLead) return true
      const c = custById.get(f.customerId)
      return !(c && (c.deleted || c.isLost || !['lead', 'pp'].includes(c.stage)))
    })
    .forEach(f => out.followups.push({ ...f, late: daysBetween(f.dueDate, today) }))

  alive(customers).filter(c => (c.stage === 'lead' || c.stage === 'pp') && !c.isLost && mine(c.assignedTo, c)).forEach(c => {
    const created = bangkokDate(c.createdAt)
    if (created === today) { out.newLeads.push({ ...c, name: custName(c) }); return }
    const last = [c.updatedAt, c.stageChangedAt, c.createdAt].map(bangkokDate).filter(Boolean).sort().pop()
    if (last && daysBetween(last, today) >= STALE_LEAD_DAYS) out.stale.push({ ...c, name: custName(c), days: daysBetween(last, today) })
  })

  const thisMonth = today.slice(0, 7)
  alive(bookings).filter(b => mine(b.salesName, b)).forEach(b => {
    if (DELIVERED_STATUSES.includes(b.status)) {
      if ((b.cutDate || b.actualDeliveryDate || '').startsWith(thisMonth) && needsIncome(b)) out.income.push(b)
      return
    }
    if (CANCELLED.includes(b.status)) return
    const dd = (b.deliveryDate || '').slice(0, 10)
    if (/^\d{4}-\d{2}-\d{2}$/.test(dd) && daysBetween(today, dd) >= 0 && daysBetween(today, dd) <= UPCOMING_DELIVERY_DAYS) {
      out.deliveries.push({ ...b, inDays: daysBetween(today, dd) })
    }
    const bd = (b.bookingDate || '').slice(0, 10)
    if (/^\d{4}-\d{2}-\d{2}$/.test(bd) && daysBetween(bd, today) >= STUCK_BOOKING_DAYS) out.stuck.push({ ...b, days: daysBetween(bd, today) })
  })

  // นัดทดลองขับวันนี้ที่ยังไม่จบ (ผู้ดูแล = staff ของนัด)
  alive(testDrives)
    .filter(t => (t.date || '').slice(0, 10) === today && ['scheduled', 'confirmed', 'in_progress'].includes(t.status || 'scheduled') && mine(t.staff, t))
    .forEach(t => out.testDrives.push(t))
  out.testDrives.sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')))

  out.followups.sort((a, b) => b.late - a.late)
  out.stale.sort((a, b) => b.days - a.days)
  out.stuck.sort((a, b) => b.days - a.days)
  out.deliveries.sort((a, b) => a.inDays - b.inDays)
  out.total = out.followups.length + out.stale.length + out.income.length + out.stuck.length
  return out
}
