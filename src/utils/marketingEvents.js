// (v1.0.972) ตารางออกบูธ / กิจกรรม / มอเตอร์โชว์ / Motor Expo / อีเวนต์ — ฟังก์ชันล้วน (pure)
// ใช้ร่วมกันระหว่างหน้า /marketing/events, ฟอร์มเพิ่ม Lead ด่วน (ติดป้ายว่าลูกค้ามาจากงานไหน) และปฏิทินงาน
// วัดผลจากข้อมูลจริง: ลูกค้าที่ติดป้าย eventId → ทดลองขับ → ใบจอง → ส่งมอบ (เดิมนับยอดขายทั้งโชว์รูมในช่วงวันงาน
// ว่าเป็นยอดของงาน ทำให้ทุกงานดูเหมือนขายได้เยอะเกินจริง)
import { ymdBangkok } from './format.js'

export const EVENT_TYPES = {
  booth:     { label: 'ออกบูธ', icon: '⛺' },
  motorshow: { label: 'มอเตอร์โชว์', icon: '🏁' },
  expo:      { label: 'Motor Expo', icon: '🏟' },
  activity:  { label: 'กิจกรรม', icon: '🎈' },
  launch:    { label: 'เปิดตัวรถ', icon: '🚀' },
  testdrive: { label: 'วันทดลองขับ', icon: '🚗' },
  vip:       { label: 'งานลูกค้า VIP', icon: '👑' },
  workshop:  { label: 'เวิร์กช็อป/อบรม', icon: '🔧' },
  online:    { label: 'ออนไลน์/ไลฟ์', icon: '💻' },
  community: { label: 'ชุมชน/คลับรถ', icon: '🤝' },
}
export const EVENT_TYPE_ORDER = ['booth', 'motorshow', 'expo', 'activity', 'launch', 'testdrive', 'vip', 'workshop', 'online', 'community']
export const typeOf = t => EVENT_TYPES[t] || { label: 'อีเวนต์', icon: '🎪' }

export const EVENT_STATUS = {
  planning:  { label: 'วางแผน', color: 'secondary' },
  confirmed: { label: 'ยืนยันแล้ว', color: 'primary' },
  ongoing:   { label: 'กำลังจัด', color: 'warning' },
  done:      { label: 'จบแล้ว', color: 'success' },
  cancelled: { label: 'ยกเลิก', color: 'danger' },
}

const DELIVERED = ['ส่งมอบแล้ว', 'ตัดตัวเลขรอส่งมอบ']
const CANCELLED = ['ถอนจอง', 'ยกเลิก']
const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
const endOf = e => e.endDate && e.endDate >= e.startDate ? e.endDate : e.startDate

// สถานะตามวันที่ (ถ้าไม่ได้ยกเลิก): ก่อนงาน / กำลังจัด / จบแล้ว — ไม่ต้องคอยเปลี่ยนเอง
export function autoStatus(e, today) {
  if (!e || e.status === 'cancelled') return 'cancelled'
  if (!e.startDate) return e.status || 'planning'
  if (today < e.startDate) return e.status === 'confirmed' ? 'confirmed' : 'planning'
  if (today > endOf(e)) return 'done'
  return 'ongoing'
}

export function isOngoing(e, today) {
  return !!e && !e.deleted && e.status !== 'cancelled' && !!e.startDate && e.startDate <= today && endOf(e) >= today
}
// งานที่กำลังจัดวันนี้ หรือจบไม่เกิน graceDays วันที่แล้ว (เซลส์มักกรอกลูกค้าจากบูธตอนเย็น/วันรุ่งขึ้น)
export function eventsForLeadTag(list, today, graceDays = 1) {
  const g = new Date(Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10) - graceDays)).toISOString().slice(0, 10)
  return (list || []).filter(e => e && !e.deleted && e.status !== 'cancelled' && e.startDate && e.startDate <= today && endOf(e) >= g)
    .sort((a, b) => (isOngoing(b, today) - isOngoing(a, today)) || String(b.startDate).localeCompare(String(a.startDate)))
}

// ทุกวันของงาน (สำหรับปฏิทิน) — งานยาวเกิน maxDays ตัดเหลือแค่ maxDays วันแรก
export function eventDays(e, maxDays = 31) {
  if (!e?.startDate) return []
  const out = []
  const [y, m, d] = e.startDate.split('-').map(Number)
  const end = endOf(e)
  for (let i = 0; i < maxDays; i++) {
    const ymd = new Date(Date.UTC(y, m - 1, d + i)).toISOString().slice(0, 10)
    if (ymd > end) break
    out.push(ymd)
  }
  return out
}

// วัดผลงานจากข้อมูลจริง
// customers: ลูกค้าที่ eventId ตรงกับงาน · bookings: ใบจองที่ eventId ตรง หรือ customerId เป็นลูกค้าจากงาน
// testDrives: นัดทดลองขับของลูกค้าจากงาน · manual: ตัวเลขที่กรอกเอง (ผู้เข้าชม/Lead ที่ไม่ได้บันทึกในระบบ)
export function eventMetrics(e, { customers = [], bookings = [], testDrives = [] } = {}) {
  const leadsList = customers.filter(c => c && !c.deleted && c.eventId === e.id)
  const ids = new Set(leadsList.map(c => c.id))
  const bk = bookings.filter(b => b && !b.deleted && !CANCELLED.includes(b.status) && (b.eventId === e.id || (b.customerId && ids.has(b.customerId))))
  const td = testDrives.filter(t => t && !t.deleted && t.customerId && ids.has(t.customerId) && !['cancelled', 'noshow', 'no_show'].includes(t.status))
  const leads = leadsList.length + num(e.extraLeads)
  const booked = bk.length + num(e.extraBookings)
  const delivered = bk.filter(b => DELIVERED.includes(b.status)).length
  const revenue = bk.reduce((s, b) => s + num(b.price), 0)
  const cost = num(e.spent) || num(e.budget)
  const pct = (a, b) => (b > 0 ? Math.round(a / b * 1000) / 10 : null)
  return {
    attendees: num(e.attendees),
    leads, leadsInSystem: leadsList.length,
    prospects: leadsList.filter(c => c.stage && c.stage !== 'lead').length,
    testDrives: new Set(td.map(t => t.customerId)).size,
    bookings: booked, delivered, revenue, cost,
    costPerLead: leads && cost ? Math.round(cost / leads) : null,
    costPerBooking: booked && cost ? Math.round(cost / booked) : null,
    leadToBooking: pct(booked, leads),
    attendeeToLead: pct(leads, num(e.attendees)),
    roi: cost && revenue ? Math.round(revenue / cost * 10) / 10 : null,
    leadTargetPct: num(e.targetLeads) ? Math.round(leads / num(e.targetLeads) * 100) : null,
    bookingTargetPct: num(e.targetBookings) ? Math.round(booked / num(e.targetBookings) * 100) : null,
    budgetPct: num(e.budget) ? Math.round(num(e.spent) / num(e.budget) * 100) : null,
  }
}

export function normalizeEvent(raw = {}) {
  const s = v => String(v ?? '').trim()
  let startDate = /^\d{4}-\d{2}-\d{2}$/.test(s(raw.startDate)) ? s(raw.startDate) : ''
  let endDate = /^\d{4}-\d{2}-\d{2}$/.test(s(raw.endDate)) ? s(raw.endDate) : startDate
  if (startDate && endDate < startDate) [startDate, endDate] = [endDate, startDate]
  const staff = (Array.isArray(raw.staff) ? raw.staff : s(raw.staff).split(/[,\n]+/)).map(s).filter(Boolean)
  return {
    title: s(raw.title),
    type: EVENT_TYPES[raw.type] ? raw.type : 'booth',
    status: EVENT_STATUS[raw.status] ? raw.status : 'planning',
    startDate, endDate,
    startTime: s(raw.startTime), endTime: s(raw.endTime),
    venue: s(raw.venue),
    staff: [...new Set(staff)],
    models: s(raw.models),
    budget: num(raw.budget), spent: num(raw.spent),
    targetLeads: Math.round(num(raw.targetLeads)), targetBookings: Math.round(num(raw.targetBookings)),
    attendees: Math.round(num(raw.attendees)), extraLeads: Math.round(num(raw.extraLeads)), extraBookings: Math.round(num(raw.extraBookings)),
    description: s(raw.description), lessons: s(raw.lessons),
  }
}

// งานตามวัน ใช้ในปฏิทินงาน — 1 รายการต่อ 1 วันของงาน
export function eventCalendarItems(list, today) {
  const out = []
  ;(list || []).filter(e => e && !e.deleted && e.status !== 'cancelled').forEach(e => {
    const days = eventDays(e)
    const t = typeOf(e.type)
    days.forEach((d, i) => out.push({
      key: `mev:${e.id}:${d}`, kind: 'booth', date: d, time: i === 0 ? (e.startTime || '') : '',
      title: `${t.icon} ${e.title || t.label}${days.length > 1 ? ` (วันที่ ${i + 1}/${days.length})` : ''}`,
      sub: [t.label, e.venue].filter(Boolean).join(' · '),
      owner: '', done: d < today, shared: true, nav: '/marketing/events?id=' + e.id, rec: e,
    }))
  })
  return out
}

export const dayOf = v => ymdBangkok(v)
