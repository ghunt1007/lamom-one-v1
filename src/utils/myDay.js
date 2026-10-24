// "งานของฉันวันนี้" — รวมงานที่เซลส์ต้องทำวันนี้ไว้หน้าเดียว (เกณฑ์เดียวกับข้อความเตือน 9 โมงเช้าใน
// workers/daily-report.js: Lead ไม่ได้ติดตามเกิน 3 วัน, Follow-up ถึงกำหนด/เลยกำหนด, ส่งมอบแล้วยังไม่กรอกรายได้,
// ใบจองค้างเกิน 14 วัน) + นัดส่งมอบ 7 วันข้างหน้า และ Lead ใหม่วันนี้ — ฟังก์ชันล้วน ไม่แตะฐานข้อมูล เทสได้
import { toDate } from './format.js'
import { DELIVERED_STATUSES, needsIncome } from './deliveryIncome.js'

export const STALE_LEAD_DAYS = 3
export const STUCK_BOOKING_DAYS = 14
export const UPCOMING_DELIVERY_DAYS = 7
export const FINANCE_WAIT_DAYS = 3
const CANCELLED = ['ถอนจอง', 'ยกเลิก']
const UNSCHEDULED_STATUSES = ['รอส่งมอบ', 'ตัดตัวเลขรอส่งมอบ']

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
  const out = { followups: [], stale: [], newLeads: [], income: [], stuck: [], deliveries: [], testDrives: [], finance: [], unscheduled: [] }

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
    const last = [c.lastContactAt, c.updatedAt, c.stageChangedAt, c.createdAt].map(bangkokDate).filter(Boolean).sort().pop()
    if (last && daysBetween(last, today) >= STALE_LEAD_DAYS) out.stale.push({ ...c, name: custName(c), days: daysBetween(last, today) })
  })

  const thisMonth = today.slice(0, 7)
  alive(bookings).filter(b => mine(b.salesName, b)).forEach(b => {
    const dd0 = (b.deliveryDate || '').slice(0, 10)
    // รถพร้อมส่ง (รอส่งมอบ/ตัดตัวเลขแล้ว) แต่ยังไม่ได้นัดวันส่งมอบ หรือวันนัดผ่านไปแล้ว → ต้องโทรนัดลูกค้า
    if (UNSCHEDULED_STATUSES.includes(b.status) && !(/^\d{4}-\d{2}-\d{2}$/.test(dd0) && dd0 >= today)) {
      out.unscheduled.push({ ...b, missed: /^\d{4}-\d{2}-\d{2}$/.test(dd0) })
    }
    // นัดส่งมอบที่กำลังจะถึง — รวม "ตัดตัวเลขรอส่งมอบ" (ยังไม่ได้ส่งรถจริง) ด้วย
    const dd = (b.deliveryDate || '').slice(0, 10)
    if (b.status !== 'ส่งมอบแล้ว' && !CANCELLED.includes(b.status) && /^\d{4}-\d{2}-\d{2}$/.test(dd) && daysBetween(today, dd) >= 0 && daysBetween(today, dd) <= UPCOMING_DELIVERY_DAYS) {
      out.deliveries.push({ ...b, inDays: daysBetween(today, dd) })
    }
    if (DELIVERED_STATUSES.includes(b.status)) {
      if ((b.cutDate || b.actualDeliveryDate || '').startsWith(thisMonth) && needsIncome(b)) out.income.push(b)
      return
    }
    if (CANCELLED.includes(b.status)) return
    // ไฟแนนซ์: ยื่นแล้วรอผลเกิน FINANCE_WAIT_DAYS วัน (นับจากวันยื่น ถ้าไม่มีนับจากวันจอง) หรือไม่ผ่านแต่ยังไม่ถอนจอง
    const sent = /^\d{4}-\d{2}-\d{2}/.test(b.submitDate || '') ? b.submitDate.slice(0, 10) : (b.bookingDate || '').slice(0, 10)
    if (b.finStatus === 'ไม่ผ่าน') out.finance.push({ ...b, rejected: true, days: sent ? daysBetween(sent, today) : 0 })
    else if ((b.finStatus === 'รอผล' || b.status === 'รอผลไฟแนนซ์') && /^\d{4}-\d{2}-\d{2}$/.test(sent) && daysBetween(sent, today) >= FINANCE_WAIT_DAYS) {
      out.finance.push({ ...b, rejected: false, days: daysBetween(sent, today) })
    }
    const bd = (b.bookingDate || '').slice(0, 10)
    if (/^\d{4}-\d{2}-\d{2}$/.test(bd) && daysBetween(bd, today) >= STUCK_BOOKING_DAYS) out.stuck.push({ ...b, days: daysBetween(bd, today) })
  })

  // นัดทดลองขับวันนี้ที่ยังไม่จบ (ผู้ดูแล = staff ของนัด)
  alive(testDrives)
    .filter(t => (t.date || '').slice(0, 10) === today && ['scheduled', 'confirmed', 'in_progress'].includes(t.status || 'scheduled') && mine(t.staff, t))
    .forEach(t => out.testDrives.push(t))
  out.testDrives.sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')))

  // นัดพรุ่งนี้ (ไว้วางแผน ไม่นับเป็นงานค้าง)
  const tomorrow = new Date((dayNum(today) + 1) * 86400000).toISOString().slice(0, 10)
  out.tomorrow = alive(followups).filter(f => f.status === 'pending' && String(f.dueDate || '').slice(0, 10) === tomorrow && mine(f.salesperson, f)).length

  out.followups.sort((a, b) => b.late - a.late)
  out.stale.sort((a, b) => b.days - a.days)
  out.stuck.sort((a, b) => b.days - a.days)
  out.finance.sort((a, b) => Number(b.rejected) - Number(a.rejected) || b.days - a.days)
  out.deliveries.sort((a, b) => a.inDays - b.inDays)
  out.total = out.followups.length + out.stale.length + out.income.length + out.stuck.length + out.finance.length + out.unscheduled.length
  return out
}
