// "งานของฉันวันนี้" — รวมงานที่เซลส์ต้องทำวันนี้ไว้หน้าเดียว (เกณฑ์เดียวกับข้อความเตือน 9 โมงเช้าใน
// workers/daily-report.js: Lead ไม่ได้ติดตามเกิน 3 วัน, Follow-up ถึงกำหนด/เลยกำหนด, ส่งมอบแล้วยังไม่กรอกรายได้,
// ใบจองค้างเกิน 14 วัน) + นัดส่งมอบ 7 วันข้างหน้า และ Lead ใหม่วันนี้ — ฟังก์ชันล้วน ไม่แตะฐานข้อมูล เทสได้
import { toDate } from './format.js'
import { DELIVERED_STATUSES, needsIncome } from './deliveryIncome.js'
import { classifyLostReason } from './lostReason.js'
import { isFinancePassed } from './finance.js'

export const STALE_LEAD_DAYS = 3
export const STUCK_BOOKING_DAYS = 14
export const UPCOMING_DELIVERY_DAYS = 7
export const FINANCE_WAIT_DAYS = 3
// ลูกค้าที่เสียดีลเพราะเหตุผลที่ "เปลี่ยนได้ตามเวลา" (ยังไม่พร้อม/ไฟแนนซ์/ราคา/ติดต่อไม่ได้) ครบ 30 วัน → ลองติดต่อใหม่
// ไม่รวมคนที่ซื้อคู่แข่งไปแล้ว ดูแค่ช่วง 30–120 วัน (เก่ากว่านั้นถือว่าหมดโอกาส) และยังไม่ได้ติดต่อหลังเสียดีล
export const REVISIT_MIN_DAYS = 30
export const REVISIT_MAX_DAYS = 120
const REVISIT_REASONS = ['timing', 'finance', 'price', 'no_contact']
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
    // รอรถ/รอส่งมอบ = ไฟแนนซ์ผ่านแล้วเสมอ (isFinancePassed) แม้ช่องสถานะไฟแนนซ์ยังค้าง "รอผล"
    const finBefore = out.finance.length
    if (!isFinancePassed(b)) {
      if (b.finStatus === 'ไม่ผ่าน') out.finance.push({ ...b, rejected: true, days: sent ? daysBetween(sent, today) : 0 })
      else if ((b.finStatus === 'รอผล' || b.status === 'รอผลไฟแนนซ์') && /^\d{4}-\d{2}-\d{2}$/.test(sent) && daysBetween(sent, today) >= FINANCE_WAIT_DAYS) {
        out.finance.push({ ...b, rejected: false, days: daysBetween(sent, today) })
      }
    }
    // ใบจองที่ขึ้นในหัวข้อไฟแนนซ์แล้ว ไม่ต้องขึ้นซ้ำใน "ใบจองค้าง" (เดิมคนเดียวนับ 2 ครั้ง)
    const bd = (b.bookingDate || '').slice(0, 10)
    if (out.finance.length === finBefore && /^\d{4}-\d{2}-\d{2}$/.test(bd) && daysBetween(bd, today) >= STUCK_BOOKING_DAYS) out.stuck.push({ ...b, days: daysBetween(bd, today) })
  })

  // นัดทดลองขับวันนี้ที่ยังไม่จบ (ผู้ดูแล = staff ของนัด)
  alive(testDrives)
    .filter(t => (t.date || '').slice(0, 10) === today && ['scheduled', 'confirmed', 'in_progress'].includes(t.status || 'scheduled') && mine(t.staff, t))
    .forEach(t => out.testDrives.push(t))
  out.testDrives.sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')))

  // นัดพรุ่งนี้ (ไว้วางแผน ไม่นับเป็นงานค้าง)
  const tomorrow = new Date((dayNum(today) + 1) * 86400000).toISOString().slice(0, 10)
  out.tomorrow = alive(followups).filter(f => f.status === 'pending' && String(f.dueDate || '').slice(0, 10) === tomorrow && mine(f.salesperson, f)).length

  // ลูกค้า Hot ที่ยังไม่มีนัดติดตามเลย — โอกาสปิดสูงแต่ไม่มีแผนต่อ (ไม่นับเป็นงานค้าง)
  const planned = new Set(alive(followups).filter(f => f.status === 'pending' && f.customerId).map(f => f.customerId))
  out.hotNoPlan = alive(customers).filter(c => c.temperature === 'hot' && !c.isLost && ['lead', 'pp'].includes(c.stage) && !planned.has(c.id) && mine(c.assignedTo, c))
    .map(c => ({ ...c, name: custName(c) }))

  // ลองติดต่อใหม่ (ไม่นับเป็นงานค้าง — เป็นโอกาสเพิ่ม)
  out.revisit = alive(customers).filter(c => c.isLost && mine(c.assignedTo, c)).map(c => {
    const lost = bangkokDate(c.lostAt)
    if (!lost) return null
    const days = daysBetween(lost, today)
    if (days < REVISIT_MIN_DAYS || days > REVISIT_MAX_DAYS) return null
    if (!REVISIT_REASONS.includes(classifyLostReason(c.lostReason))) return null
    if (bangkokDate(c.lastContactAt) > lost) return null
    return { ...c, name: custName(c), days }
  }).filter(Boolean).sort((a, b) => a.days - b.days)

  out.followups.sort((a, b) => b.late - a.late)
  // ลูกค้า Hot ขึ้นก่อน (โอกาสปิดสูงสุด) แล้วค่อยเรียงตามจำนวนวันที่เงียบ
  out.stale.sort((a, b) => Number(b.temperature === 'hot') - Number(a.temperature === 'hot') || b.days - a.days)
  out.stuck.sort((a, b) => b.days - a.days)
  out.finance.sort((a, b) => Number(b.rejected) - Number(a.rejected) || b.days - a.days)
  out.deliveries.sort((a, b) => a.inDays - b.inDays)
  // ลูกค้าของฉันที่ติดต่อแล้ววันนี้ (ทุกสถานะ) — ให้กำลังใจ/วัดกิจกรรมของวัน
  out.contactedToday = alive(customers).filter(c => bangkokDate(c.lastContactAt) === today && mine(c.assignedTo, c)).length
  out.total = out.followups.length + out.stale.length + out.income.length + out.stuck.length + out.finance.length + out.unscheduled.length
  return out
}

// "ทำ 3 อย่างนี้ก่อน" — จัดลำดับงานทั้งหมดของวันจากผลของ buildMyDay ให้เหลือไม่กี่อย่างที่สำคัญที่สุด
// เกณฑ์: Lead ใหม่ (ยิ่งโทรเร็วยิ่งปิดได้) > ส่งมอบวันนี้ > ลูกค้า Hot > นัดที่เลยกำหนด > ไฟแนนซ์ไม่ผ่าน > ที่เหลือ
// คืน [{ key, icon, title, why, score, customerId?, bookingId?, phone? }] เรียงคะแนนมากไปน้อย ไม่ซ้ำลูกค้า
// short: true = ใช้ชื่อต้นอย่างเดียว (ไว้ส่งให้ AI ไม่ต้องรู้นามสกุล)
export function topPriorities(d, limit = 3, { short = false } = {}) {
  const items = []
  const add = (it) => items.push(it)
  const nm = r => {
    const n = String((short ? r.firstName : '') || r.name || r.customerName || r.custName || 'ลูกค้า').trim()
    return short ? n.split(/\s+/)[0] : n
  }
  const car = b => [b.brand, b.model].filter(Boolean).join(' ')
  ;(d.newLeads || []).forEach(c => add({ key: 'new:' + c.id, icon: '🧲', title: `โทรหา Lead ใหม่ ${nm(c)}`, why: `เข้ามาวันนี้${leadWait(c) ? ` (${leadWait(c).label})` : ''}${c.interestedModel ? ` สนใจ ${c.interestedModel}` : ''} · โทรภายในชั่วโมงแรกโอกาสปิดสูงสุด`, score: c.lastContactAt && bangkokDate(c.lastContactAt) === bangkokDate(c.createdAt) ? 20 : 100, customerId: c.id, phone: c.phone }))
  ;(d.deliveries || []).filter(b => b.inDays === 0).forEach(b => add({ key: 'dlv:' + b.id, icon: '🚗', title: `ส่งมอบรถ ${nm(b)} วันนี้`, why: `${car(b) || 'รถ'}${b.deliveryTime ? ` เวลา ${b.deliveryTime}` : ''} · เช็กรถและเอกสารให้พร้อม`, score: 95, bookingId: b.id, phone: b.phone || b.custPhone }))
  ;(d.hotNoPlan || []).forEach(c => add({ key: 'hot:' + c.id, icon: '🔴', title: `นัดลูกค้า Hot ${nm(c)}`, why: 'สนใจมากแต่ยังไม่มีนัดครั้งถัดไป', score: 90, customerId: c.id, phone: c.phone }))
  ;(d.followups || []).forEach(f => add({ key: 'fu:' + f.id, icon: '📞', title: `ติดต่อ ${nm(f)}`, why: `${f.purpose || 'นัดติดตาม'}${f.late > 0 ? ` · เลยกำหนด ${f.late} วัน` : ' · ครบกำหนดวันนี้'}`, score: 78 + Math.min(10, f.late || 0), customerId: f.customerId, phone: f.phone }))
  ;(d.finance || []).forEach(b => add({ key: 'fin:' + b.id, icon: '🏦', title: b.rejected ? `หาไฟแนนซ์ใหม่ให้ ${nm(b)}` : `ตามผลไฟแนนซ์ ${nm(b)}`, why: b.rejected ? 'ไฟแนนซ์ไม่ผ่าน ลูกค้ายังรอรถอยู่' : `รอผลมา ${b.days} วันแล้ว`, score: b.rejected ? 76 : 60 + Math.min(10, b.days || 0), bookingId: b.id, phone: b.phone || b.custPhone }))
  ;(d.unscheduled || []).forEach(b => add({ key: 'uns:' + b.id, icon: '📆', title: `โทรนัดวันส่งมอบ ${nm(b)}`, why: b.missed ? 'เลยวันนัดเดิมแล้ว' : 'รถพร้อมแต่ยังไม่มีวันนัด', score: b.missed ? 74 : 68, bookingId: b.id, phone: b.phone || b.custPhone }))
  ;(d.stale || []).forEach(c => add({ key: 'stl:' + c.id, icon: '⏰', title: c.temperature === 'hot' ? `ทักลูกค้า Hot ${nm(c)}` : `ทักลูกค้าที่เงียบไป ${nm(c)}`, why: `ไม่ได้คุยมา ${c.days} วัน${c.interestedModel ? ` · สนใจ ${c.interestedModel}` : ''}`, score: (c.temperature === 'hot' ? 85 : 40) + Math.min(10, c.days || 0), customerId: c.id, phone: c.phone }))
  ;(d.income || []).forEach(b => add({ key: 'inc:' + b.id, icon: '💰', title: `กรอกรายได้ ${nm(b)}`, why: 'ส่งมอบแล้วแต่รายงานรายได้ยังไม่ครบ', score: 45, bookingId: b.id }))
  ;(d.stuck || []).forEach(b => add({ key: 'stk:' + b.id, icon: '⏳', title: `เคลียร์ใบจอง ${nm(b)}`, why: `ค้างมา ${b.days} วัน · ${b.status || ''}`.trim(), score: 30 + Math.min(10, Math.floor((b.days || 0) / 7)), bookingId: b.id, phone: b.phone || b.custPhone }))
  items.sort((a, b) => b.score - a.score)
  const seen = new Set()
  const out = []
  for (const it of items) {
    const who = it.customerId || it.bookingId || it.key
    if (seen.has(who)) continue
    seen.add(who)
    out.push(it)
    if (out.length >= limit) break
  }
  return out
}

// ข้อความสั้นสำหรับอ่านออกเสียง (ปุ่ม 🔊 ฟังงานวันนี้) — ฟังตอนขับรถได้ ไม่ต้องดูจอ
export function spokenBriefing(d, name = '') {
  const top = topPriorities(d, 3, { short: true })
  const hi = `สวัสดีครับ${name ? 'คุณ' + name : ''}`
  if (!d.total) return `${hi} วันนี้ไม่มีงานค้างเลยครับ เยี่ยมมาก`
  const parts = [`${hi} วันนี้มีงานค้าง ${d.total} รายการ`]
  if (d.contactedToday) parts.push(`ติดต่อลูกค้าไปแล้ว ${d.contactedToday} ราย`)
  if (top.length) parts.push(`ควรเริ่มจาก ${top.map((t, i) => `ข้อ ${i + 1} ${t.title}`).join(' ')}`)
  if (d.tomorrow) parts.push(`พรุ่งนี้มีนัด ${d.tomorrow} ราย`)
  return parts.join(' ') + ' สู้ๆ ครับ'
}

// สรุปงานของวันเป็นข้อความสั้นๆ ให้ LAMI ใช้ตอบคำถาม "วันนี้ควรทำอะไร" — ใช้แค่ชื่อเล่น/ชื่อต้น ไม่มีเบอร์โทร
export function myDayDigest(d) {
  const lines = [
    `งานค้างทั้งหมด ${d.total || 0} รายการ · ติดต่อลูกค้าแล้ววันนี้ ${d.contactedToday || 0} ราย · พรุ่งนี้มีนัด ${d.tomorrow || 0} ราย`,
    `Lead ใหม่วันนี้ ${(d.newLeads || []).length} · นัดติดตามถึงกำหนด/เลยกำหนด ${(d.followups || []).length} · Lead เงียบเกิน ${STALE_LEAD_DAYS} วัน ${(d.stale || []).length} · ลูกค้า Hot ไม่มีนัด ${(d.hotNoPlan || []).length}`,
    `ไฟแนนซ์รอผล/ไม่ผ่าน ${(d.finance || []).length} · รถพร้อมส่งยังไม่นัด ${(d.unscheduled || []).length} · ส่งมอบ 7 วันข้างหน้า ${(d.deliveries || []).length} · ยังไม่กรอกรายได้ ${(d.income || []).length}`,
  ]
  const top = topPriorities(d, 5, { short: true })
  if (top.length) {
    lines.push('งานที่ควรทำก่อน (ระบบจัดลำดับแล้ว):')
    top.forEach((t, i) => lines.push(`${i + 1}. ${t.title} — ${t.why}`))
  }
  return lines.join('\n')
}

// สรุปทีมวันนี้ (หัวหน้า/เจ้าของ) — ต่อคน: งานค้าง, ติดต่อลูกค้าแล้ววันนี้, Lead ใหม่ที่ยังไม่ได้ติดต่อ
// same(a, b) = เทียบชื่อแบบเดียวกับหน้าเพจ (normName) — เรียงคนที่งานค้างมากสุดก่อน
export function teamToday(data, { today, names = [], same = (a, b) => String(a || '').trim() === String(b || '').trim(), allowed = () => true }) {
  return names.map(name => {
    const d = buildMyDay(data, { today, mine: (n, rec) => allowed(n, rec) && same(n, name) })
    const newUntouched = d.newLeads.filter(c => bangkokDate(c.lastContactAt) !== today).length
    return { name, total: d.total, contacted: d.contactedToday, newUntouched }
  }).filter(r => r.total || r.contacted || r.newUntouched)
    .sort((a, b) => b.total + b.newUntouched - (a.total + a.newUntouched) || a.name.localeCompare(b.name, 'th'))
}

// Lead ใหม่วันนี้: รอมากี่นาทีแล้ว (ยิ่งโทรเร็วยิ่งปิดได้) — คืน null ถ้าติดต่อแล้วหรือไม่มีเวลาสร้าง
// level: ok (< 15 นาที) / warn (< 60 นาที) / late (ชั่วโมงขึ้นไป)
export function leadWait(c, now = Date.now()) {
  const created = toDate(c.createdAt)
  if (!created) return null
  const contacted = toDate(c.lastContactAt)
  if (contacted && contacted.getTime() > created.getTime() + 60000) return null
  const mins = Math.max(0, Math.floor((now - created.getTime()) / 60000))
  const label = mins < 1 ? 'เพิ่งเข้ามา' : mins < 60 ? `รอ ${mins} นาที` : `รอ ${Math.floor(mins / 60)} ชม.${mins % 60 ? ` ${mins % 60} นาที` : ''}`
  return { mins, label, level: mins < 15 ? 'ok' : mins < 60 ? 'warn' : 'late' }
}
