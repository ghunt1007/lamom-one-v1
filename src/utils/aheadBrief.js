// (v1.0.1059) "พรุ่งนี้มีอะไรบ้าง" / "สัปดาห์นี้มีอะไรบ้าง" / "สรุปงาน 7 วันข้างหน้า" → LAMI สรุปนัดติดตามและนัดส่งมอบล่วงหน้ารายวันทันที
// นับเฉพาะลูกค้า/ใบจองที่ผู้ใช้มองเห็น (เหมือน "วันนี้มีอะไรบ้าง") · ฟังก์ชันล้วน ทดสอบได้
import { isOpenBooking } from './bookingStatus.js'
import { dmy } from './format.js'

const isDate = d => /^\d{4}-\d{2}-\d{2}/.test(d || '')
const DOW = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.']
const WHEN = '(พรุ่งนี้|สัปดาห์นี้|อาทิตย์นี้|7\\s*วัน(?:ข้างหน้า|นี้)?)'
const Q1 = new RegExp(WHEN + '\\s*(?:ฉัน|ผม|หนู|เรา)?\\s*(?:มี|ต้อง)\\s*(?:อะไร|งานอะไร|ทำอะไร|นัดอะไร|นัดกี่|นัดไหม|งานไหม)')
const Q2 = new RegExp('^(?:สรุป|ดู|ขอดู)?\\s*(?:งาน|ตาราง|ตารางงาน|นัดหมาย|คิว)?\\s*(?:ของ)?(?:ฉัน|ผม|หนู|เรา)?\\s*' + WHEN + '$')

export function addDays(ymd, n) {
  const d = new Date(ymd + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
const dm = ymd => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`
// (v1.0.1090) ปีตามที่ตั้งไว้ (พ.ศ./ค.ศ.) เหมือนคำตอบอื่นของ LAMI
const dmyOf = ymd => dmy(ymd)
const dow = ymd => DOW[new Date(ymd + 'T00:00:00Z').getUTCDay()]

// คืน null ถ้าไม่ใช่ · { mode: 'tomorrow' | 'week' }
export function parseAheadSpec(q) {
  const s = String(q || '').trim().replace(/[?？]+$/, '').replace(/\s*(?:บ้าง|ครับ|ค่ะ|คะ)+$/, '').trim()
  if (!s || s.length > 60) return null
  if (/โทร|ตาม(?!ที่)|ติดต่อ|ยอด|เป้า|ทีม|เซลส์|ใคร|ส่งมอบ|ลูกค้า|ลีด|สต็อก|ค่าคอม|รายได้/.test(s)) return null
  const m = s.match(Q1) || s.match(Q2)
  if (!m || s === m[1]) return null // พิมพ์แค่ "พรุ่งนี้" เฉยๆ ไม่นับเป็นคำถาม
  return { mode: m[1] === 'พรุ่งนี้' ? 'tomorrow' : 'week' }
}

export function aheadStats({ customers = [], followups = [], bookings = [], today, mode = 'week' }) {
  const vis = new Map(), byBooking = new Map()
  customers.forEach(c => { if (!c || c.deleted) return; vis.set(c.id, c); if (c.bookingId) byBooking.set(c.bookingId, c) })
  const from = mode === 'tomorrow' ? addDays(today, 1) : today, to = mode === 'tomorrow' ? from : addDays(today, 6)
  const pend = followups.filter(f => f && !f.deleted && f.status === 'pending' && vis.has(f.customerId) && isDate(f.dueDate))
  const bks = bookings.filter(b => b && !b.deleted && (byBooking.has(b.id) || vis.has(b.customerId)) && (isOpenBooking(b) || b.status === 'ตัดตัวเลขรอส่งมอบ') && isDate(b.deliveryDate))
  const custName = f => { const c = vis.get(f.customerId); return [c?.firstName, c?.lastName].filter(Boolean).join(' ') || f.customerName || 'ลูกค้า' }
  const days = []
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const fu = pend.filter(f => f.dueDate.slice(0, 10) === d), dl = bks.filter(b => String(b.deliveryDate).slice(0, 10) === d)
    days.push({ date: d, followups: fu.length, fuNames: fu.map(custName), deliveries: dl.length, delivNames: dl.map(b => b.custName || b.customerName || 'ลูกค้า') })
  }
  return {
    mode, from, to, days,
    followups: days.reduce((t, x) => t + x.followups, 0), deliveries: days.reduce((t, x) => t + x.deliveries, 0),
    overdue: pend.filter(f => f.dueDate.slice(0, 10) < today).length,
  }
}

const some = (list, n) => list.slice(0, n).join(', ') + (list.length > n ? ` +${list.length - n}` : '')

export function aheadBriefText(s) {
  const tm = s.mode === 'tomorrow'
  const lines = [tm ? `🗓️ งานพรุ่งนี้ ${dow(s.from)} ${dmyOf(s.from)}` : `🗓️ งาน 7 วันข้างหน้า ${dmyOf(s.from)} – ${dmyOf(s.to)}`]
  if (tm) {
    const d = s.days[0]
    lines.push(d.followups ? `📞 นัดติดตาม ${d.followups} นัด — ${some(d.fuNames, 6)}` : '📞 ยังไม่มีนัดติดตาม')
    if (d.deliveries) lines.push(`🚗 ส่งมอบ ${d.deliveries} คัน — ${some(d.delivNames, 6)}`)
  } else {
    lines.push(`รวม 📞 นัดติดตาม ${s.followups} นัด · 🚗 ส่งมอบ ${s.deliveries} คัน`)
    s.days.filter(d => d.followups || d.deliveries).forEach(d => {
      const parts = [d.followups ? `📞 ${d.followups} นัด (${some(d.fuNames, 3)})` : '', d.deliveries ? `🚗 ส่งมอบ ${d.deliveries} คัน (${some(d.delivNames, 3)})` : ''].filter(Boolean)
      lines.push(`• ${dow(d.date)} ${dm(d.date)} — ${parts.join(' · ')}`)
    })
    const free = s.days.filter(d => !d.followups && !d.deliveries)
    if (free.length && free.length < s.days.length) lines.push(`🟢 วันว่าง: ${free.map(d => `${dow(d.date)} ${dm(d.date)}`).join(', ')}`)
  }
  if (s.overdue) lines.push(`⚠️ ยังมีนัดเลยกำหนดค้างอยู่ ${s.overdue} นัด`)
  const tip = s.overdue ? 'เคลียร์นัดที่เลยกำหนดก่อน งานข้างหน้าจะไม่ทับกัน'
    : !s.followups && !s.deliveries ? (tm ? 'พรุ่งนี้ยังว่าง — นัดลูกค้า HOT หรือหาลีดใหม่ได้เลย' : 'สัปดาห์นี้ยังไม่มีนัด — เริ่มนัดลูกค้าที่ยังไม่มีนัด')
    : s.deliveries ? 'เช็กรถและเอกสารส่งมอบให้พร้อมล่วงหน้า 1 วัน' : ''
  if (tip) lines.push(`💡 ${tip}`)
  return lines.join('\n')
}

export function aheadFollowUps(s) {
  return [
    s.mode === 'tomorrow' ? 'สัปดาห์นี้มีอะไรบ้าง' : 'วันนี้มีอะไรบ้าง',
    s.overdue ? 'วันนี้ควรโทรหาใคร' : '',
    !s.followups ? 'ใครยังไม่มีนัด' : '',
    s.mode === 'tomorrow' && s.days[0].deliveries ? 'ส่งมอบพรุ่งนี้มีใครบ้าง' : '',
  ].filter(Boolean)
}
