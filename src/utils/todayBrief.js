// (v1.0.1049) "วันนี้มีอะไรบ้าง" / "สรุปวันนี้" / "วันนี้ต้องทำอะไร" → LAMI สรุปงานวันนี้จากข้อมูลจริงทันที (ไม่ต้องรอ AI)
// นับเฉพาะลูกค้า/นัด/ใบจองที่ผู้ใช้มองเห็น · ใต้สรุปมีปุ่มถามต่อเฉพาะหัวข้อที่มีงาน · ฟังก์ชันล้วน ทดสอบได้
import { isOpenBooking } from './bookingStatus.js'

const bkkDate = v => {
  const t = v?.toDate ? v.toDate() : v ? new Date(v) : null
  return t && !isNaN(t) ? new Date(t.getTime() + 7 * 3600e3).toISOString().slice(0, 10) : ''
}
const isDate = d => /^\d{4}-\d{2}-\d{2}/.test(d || '')

export function isTodayQuestion(q) {
  const s = String(q || '').trim().replace(/[?？]+$/, '')
  if (!s || s.length > 60) return false
  if (/โทร|ตาม(?!ที่)|ติดต่อ|ยอด|เป้า|ทีม|เซลส์/.test(s)) return false
  return /วันนี้\s*(?:มี|ต้อง|ควร)\s*(?:อะไร|งานอะไร|ทำอะไร)|(?:สรุป|งาน)\s*(?:ของ)?(?:ฉัน|ผม)?\s*วันนี้|วันนี้\s*(?:มี)?งานอะไร|มีอะไร(?:ต้อง|ให้)ทำ|เช้านี้(?:มี|ต้อง)/.test(s)
}

export function todayStats({ customers = [], followups = [], bookings = [], today, tomorrow }) {
  const vis = new Map(), byBooking = new Map()
  customers.forEach(c => { if (!c || c.deleted) return; vis.set(c.id, c); if (c.bookingId) byBooking.set(c.bookingId, c) })
  const pend = followups.filter(f => f && !f.deleted && f.status === 'pending' && vis.has(f.customerId) && isDate(f.dueDate))
  const pendIds = new Set(pend.map(f => f.customerId))
  const active = [...vis.values()].filter(c => !c.isLost && ['lead', 'pp'].includes(c.stage) && !c.bookingId)
  const bks = bookings.filter(b => b && !b.deleted && (byBooking.has(b.id) || vis.has(b.customerId)) && (isOpenBooking(b) || b.status === 'ตัดตัวเลขรอส่งมอบ'))
  const dd = b => String(b.deliveryDate || '').slice(0, 10)
  const names = list => list.slice(0, 3).map(b => b.custName || b.customerName || 'ลูกค้า').join(', ') + (list.length > 3 ? ` +${list.length - 3}` : '')
  const delivToday = bks.filter(b => dd(b) === today), delivTomorrow = bks.filter(b => dd(b) === tomorrow)
  return {
    dueToday: pend.filter(f => f.dueDate.slice(0, 10) === today).length,
    overdue: pend.filter(f => f.dueDate.slice(0, 10) < today).length,
    delivToday: delivToday.length, delivTodayNames: names(delivToday),
    delivTomorrow: delivTomorrow.length, delivTomorrowNames: names(delivTomorrow),
    newLeads: active.filter(c => bkkDate(c.createdAt) === today).length,
    hotNoFu: active.filter(c => c.temperature === 'hot' && !pendIds.has(c.id)).length,
    noDate: bks.filter(b => ['รอส่งมอบ', 'ตัดตัวเลขรอส่งมอบ'].includes(b.status) && !isDate(b.deliveryDate)).length,
  }
}

export function todayBriefText(s, dateLabel = '') {
  const lines = [`☀️ งานวันนี้${dateLabel ? ' ' + dateLabel : ''}`]
  lines.push(s.dueToday || s.overdue ? `📞 นัดติดตามวันนี้ ${s.dueToday} นัด${s.overdue ? ` · ⚠️ เลยกำหนด ${s.overdue} นัด` : ''}` : '📞 ไม่มีนัดติดตามค้าง')
  if (s.delivToday) lines.push(`🚗 ส่งมอบวันนี้ ${s.delivToday} คัน — ${s.delivTodayNames}`)
  if (s.delivTomorrow) lines.push(`🚗 ส่งมอบพรุ่งนี้ ${s.delivTomorrow} คัน — ${s.delivTomorrowNames}`)
  if (s.noDate) lines.push(`📭 รถพร้อมส่งยังไม่นัดวัน ${s.noDate} คัน`)
  if (s.newLeads) lines.push(`🧲 ลีดใหม่วันนี้ ${s.newLeads} คน`)
  if (s.hotNoFu) lines.push(`🔥 ลูกค้า HOT ที่ยังไม่มีนัด ${s.hotNoFu} คน`)
  const first = s.overdue ? 'เคลียร์นัดที่เลยกำหนดก่อน' : s.delivToday ? 'เตรียมส่งมอบวันนี้ให้พร้อม' : s.dueToday ? 'โทรตามนัดวันนี้' : s.hotNoFu ? 'นัดลูกค้า HOT ที่ยังไม่มีนัด' : s.noDate ? 'โทรนัดวันส่งมอบ' : ''
  lines.push(first ? `💡 เริ่มจาก: ${first}` : '✅ วันนี้ไม่มีงานค้าง — ใช้เวลาหาลีดใหม่ได้เลย')
  return lines.join('\n')
}

// ปุ่มถามต่อ (เฉพาะหัวข้อที่มีงาน) — เป็นประโยคที่ LAMI ตอบเป็นรายชื่อได้ทันที
export function todayFollowUps(s) {
  return [
    s.dueToday || s.overdue ? 'วันนี้ควรโทรหาใคร' : '',
    s.delivToday ? 'ส่งมอบวันนี้มีใครบ้าง' : '',
    s.delivTomorrow ? 'ส่งมอบพรุ่งนี้มีใครบ้าง' : '',
    s.noDate ? 'ใครยังไม่นัดส่งมอบ' : '',
    s.newLeads ? 'ลีดใหม่วันนี้มีใครบ้าง' : '',
    s.hotNoFu ? 'ลูกค้า hot ที่ยังไม่มีนัดมีใครบ้าง' : '',
  ].filter(Boolean)
}
