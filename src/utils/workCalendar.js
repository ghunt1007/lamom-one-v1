// (v1.0.965) ปฏิทินงานรวม — แปลงข้อมูลจริงทุกแหล่งในแอปเป็น "งานตามวัน" ชุดเดียว (ไม่มีการเขียนข้อมูลใหม่)
// นัดลูกค้า (โชว์รูม) · ทดลองขับ · นัดตามลูกค้า · ส่งมอบรถ · ตรวจรถก่อนส่งมอบ · ไฟแนนซ์ · นัดเข้าศูนย์ · งาน · นัดหมายทั่วไป
// ฟังก์ชันล้วน (pure) — หน้า /calendar เป็นคนดึงข้อมูลแล้วส่งเข้ามา มีเทสใน workCalendar.test.js
import { ymdBangkok, daysFromToday } from './format.js'
import { isCancelled, isDelivered } from './bookingStatus.js'
import { isFinancePassed, isCashBooking } from './finance.js'
import { FINANCE_WAIT_DAYS } from './myDay.js'

export const KINDS = {
  appt:      { icon: '🤝', label: 'นัดลูกค้า' },
  testdrive: { icon: '🚙', label: 'ทดลองขับ' },
  followup:  { icon: '📞', label: 'ตามลูกค้า' },
  delivery:  { icon: '🚗', label: 'ส่งมอบรถ' },
  pdi:       { icon: '🔍', label: 'ตรวจรถก่อนส่งมอบ' },
  finance:   { icon: '🏦', label: 'ไฟแนนซ์' },
  service:   { icon: '🔧', label: 'นัดเข้าศูนย์' },
  task:      { icon: '✅', label: 'งาน' },
  event:     { icon: '📌', label: 'นัดหมายอื่นๆ' },
}
export const KIND_ORDER = ['appt', 'testdrive', 'followup', 'delivery', 'pdi', 'finance', 'service', 'task', 'event']

// งานที่ค้างนานกว่านี้ไม่นับเป็น "เลยกำหนด" (ข้อมูลเก่าจาก Excel ที่ไม่มีใครอัปเดต จะท่วมรายการค้างจนดูไม่ออก)
export const OVERDUE_LOOKBACK_DAYS = 60
// ส่งเคสไฟแนนซ์ภายในกี่วันหลังจอง
export const FINANCE_SEND_DAYS = 2

const day = v => ymdBangkok(v)
function addDays(ymd, n) {
  if (!ymd) return ''
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}
const car = b => [b.model, b.variant].filter(Boolean).join(' ')
const custOf = b => b.custName || [b.firstName, b.lastName].filter(Boolean).join(' ') || 'ลูกค้า'
// '9:30' / '09.30' / '09:30:00' → '09:30' (เติม 0 ให้เรียงตามเวลาได้ถูก)
const hhmm = t => { const m = typeof t === 'string' && t.match(/^(\d{1,2})[:.](\d{2})/); return m ? `${m[1].padStart(2, '0')}:${m[2]}` : '' }

// src = { appointments, testDrives, followups, bookings, serviceAppts, tasks, events } — ทุกช่องไม่บังคับ
export function buildWorkItems(src = {}, today) {
  const out = []
  const add = (it) => { if (it.date) out.push(it) }
  const live = arr => (arr || []).filter(r => r && !r.deleted)

  live(src.appointments).forEach(a => {
    if (['cancelled', 'noshow'].includes(a.status)) return
    add({ key: 'appt:' + a.id, kind: 'appt', date: day(a.date), time: hhmm(a.time),
      title: `${a.custName || 'ลูกค้า'} มาโชว์รูม`, sub: [a.purpose, a.interestedIn].filter(Boolean).join(' · '),
      owner: a.salesperson || '', phone: a.phone || '', done: a.status === 'done', nav: '/crm/showroom', rec: a })
  })

  live(src.testDrives).forEach(t => {
    if (['cancelled', 'no_show', 'noshow'].includes(t.status)) return
    add({ key: 'td:' + t.id, kind: 'testdrive', date: day(t.date), time: hhmm(t.time),
      title: `${t.customerName || 'ลูกค้า'} ทดลองขับ`, sub: t.model || '',
      owner: t.staff || '', phone: t.phone || '', done: t.status === 'completed' || t.status === 'done',
      nav: t.customerId ? `/crm/customers?id=${t.customerId}` : '/crm/testdrive', rec: t })
  })

  live(src.followups).forEach(f => {
    if (f.status !== 'pending') return
    add({ key: 'fu:' + f.id, kind: 'followup', date: day(f.dueDate), time: '',
      title: `ตาม ${f.customerName || 'ลูกค้า'}`, sub: [f.purpose, f.vehicleModel].filter(Boolean).join(' · '),
      owner: f.salesperson || '', phone: f.phone || '', done: false, canOverdue: true,
      nav: f.customerId ? `/crm/customers?id=${f.customerId}` : '/crm/followup', rec: f })
  })

  live(src.bookings).forEach(b => {
    if (isCancelled(b)) return
    const nav = `/crm/bookings?id=${b.id}`
    const who = custOf(b)
    const phone = b.phone || b.custPhone || ''
    const owner = b.salesName || ''
    const handed = b.status === 'ส่งมอบแล้ว'
    const dd = day(b.deliveryDate)
    // ส่งมอบ: "ตัดตัวเลขรอส่งมอบ" นับยอดขายแล้วแต่รถยังไม่ถึงมือลูกค้า → ยังเป็นงานที่ต้องทำ
    if (handed) {
      const ad = day(b.actualDeliveryDate) || dd
      if (ad) add({ key: 'dlv:' + b.id, kind: 'delivery', date: ad, time: '', title: `ส่งมอบ ${who}`, sub: car(b), owner, phone, done: true, nav, rec: b })
    } else if (dd) {
      add({ key: 'dlv:' + b.id, kind: 'delivery', date: dd, time: hhmm(b.deliveryTime), title: `ส่งมอบ ${who}`,
        sub: [car(b), b.deliveryPlace, b.pdReady ? '✅ ตรวจรถแล้ว' : ''].filter(Boolean).join(' · '),
        owner, phone, done: false, canOverdue: true, nav, rec: b })
      // ตรวจรถก่อนส่งมอบ 1 วัน (ถ้ายังไม่ได้ตรวจ) — นัดวันนี้ก็ต้องตรวจวันนี้
      if (!b.pdReady) {
        const pd = today && dd <= addDays(today, 1) && dd >= today ? today : addDays(dd, -1)
        add({ key: 'pdi:' + b.id, kind: 'pdi', date: pd, time: '', title: `ตรวจรถ ${who}`,
          sub: [car(b), b.vin ? 'VIN ' + String(b.vin).slice(-6) : '', 'ส่งมอบ ' + dd.slice(8) + '/' + dd.slice(5, 7)].filter(Boolean).join(' · '),
          owner, phone, done: false, canOverdue: true, nav: '/crm/predelivery', rec: b })
      }
    }
    if (handed || isDelivered(b)) return

    // ไฟแนนซ์ (เฉพาะใบจองที่ยังไม่ผ่านและไม่ใช่ซื้อสด)
    if (isCashBooking(b)) return
    const sign = day(b.signDate)
    if (sign && (b.finStatus === 'รอเซ็นสัญญา' || (today && sign >= today))) {
      add({ key: 'sign:' + b.id, kind: 'finance', date: sign, time: '', title: `นัดเซ็นสัญญา ${who}`,
        sub: [b.financeCo, car(b)].filter(Boolean).join(' · '), owner, phone,
        done: isFinancePassed(b), canOverdue: b.finStatus === 'รอเซ็นสัญญา', nav, rec: b })
    }
    if (isFinancePassed(b)) return
    const sent = day(b.submitDate)
    if (b.finStatus === 'ไม่ผ่าน') {
      add({ key: 'fin:' + b.id, kind: 'finance', date: day(b.approveDate) || sent || day(b.bookingDate), time: '',
        title: `หาไฟแนนซ์ใหม่ ${who}`, sub: [b.financeCo ? `${b.financeCo} ไม่ผ่าน` : 'ไฟแนนซ์ไม่ผ่าน', car(b)].filter(Boolean).join(' · '),
        owner, phone, done: false, canOverdue: true, nav, rec: b })
    } else if ((b.finStatus === 'รอผล' || b.status === 'รอผลไฟแนนซ์') && sent) {
      add({ key: 'fin:' + b.id, kind: 'finance', date: addDays(sent, FINANCE_WAIT_DAYS), time: '',
        title: `ตามผลไฟแนนซ์ ${who}`, sub: [b.financeCo, `ส่งเคส ${sent.slice(8)}/${sent.slice(5, 7)}`].filter(Boolean).join(' · '),
        owner, phone, done: false, canOverdue: true, nav, rec: b })
    } else if (b.finStatus === 'รอส่ง' && !sent && day(b.bookingDate)) {
      add({ key: 'fin:' + b.id, kind: 'finance', date: addDays(day(b.bookingDate), FINANCE_SEND_DAYS), time: '',
        title: `ส่งเคสไฟแนนซ์ ${who}`, sub: [b.financeCo, car(b)].filter(Boolean).join(' · '),
        owner, phone, done: false, canOverdue: true, nav, rec: b })
    }
  })

  live(src.serviceAppts).forEach(a => {
    if (['cancelled', 'noshow'].includes(a.status)) return
    add({ key: 'svc:' + a.id, kind: 'service', date: day(a.date), time: hhmm(a.time),
      title: `${a.custName || 'ลูกค้า'} เข้าศูนย์`, sub: [a.type, a.model, a.plate].filter(Boolean).join(' · '),
      owner: a.tech || '', phone: a.phone || '', done: a.status === 'done', nav: '/service/appointment', rec: a })
  })

  live(src.tasks).forEach(t => {
    if (t.status === 'cancelled') return
    add({ key: 'task:' + t.id, kind: 'task', date: day(t.dueDate), time: '', title: t.title || 'งาน',
      sub: t.priority === 'urgent' ? '🔴 เร่งด่วน' : '', owner: t.assignedTo || '', phone: '',
      done: t.status === 'done', canOverdue: true, nav: '/tasks', rec: t })
  })

  live(src.events).forEach(e => {
    add({ key: 'ev:' + e.id, kind: 'event', date: day(e.date), time: hhmm(e.time), title: e.title || 'นัดหมาย',
      sub: e.description || '', owner: e.assignee || '', phone: '', done: false, shared: true, nav: null, rec: e })
  })

  out.forEach(it => {
    const d = today ? daysFromToday(it.date, today) : 0
    it.overdue = !!(it.canOverdue && !it.done && today && d < 0 && d >= -OVERDUE_LOOKBACK_DAYS)
    delete it.canOverdue
  })
  return out.sort(compareItems)
}

// เรียงในวันเดียวกัน: มีเวลาก่อน (ตามเวลา) → ตามลำดับประเภท → ชื่อ
export function compareItems(a, b) {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1
  if (!!a.done !== !!b.done) return a.done ? 1 : -1
  if (a.time || b.time) { if (!a.time) return 1; if (!b.time) return -1; if (a.time !== b.time) return a.time < b.time ? -1 : 1 }
  const k = KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind)
  return k || String(a.title).localeCompare(String(b.title), 'th')
}

export function groupByDate(items) {
  const map = {}
  items.forEach(it => { (map[it.date] ||= []).push(it) })
  return map
}

// สรุปตัวเลขหัวหน้า: วันนี้ / 7 วันข้างหน้า / เลยกำหนด (ไม่นับที่ทำเสร็จแล้ว)
export function summarize(items, today) {
  const week = addDays(today, 6)
  let todayN = 0, weekN = 0, overdueN = 0
  items.forEach(it => {
    if (it.overdue) overdueN++
    if (it.done) return
    if (it.date === today) todayN++
    if (it.date >= today && it.date <= week) weekN++
  })
  return { today: todayN, week: weekN, overdue: overdueN }
}

export { addDays as addDaysYmd }
