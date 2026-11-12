// (v1.0.1079) คำถามงานประจำวันที่ LAMI เคยตอบไม่ได้ (ได้แต่ลิงก์เปล่า หรือดึงรายการใบจองที่ไม่เกี่ยวมาตอบ):
//   "นัดทดลองขับวันนี้มีใครบ้าง" · "พรุ่งนี้มีใครเข้าโชว์รูม" · "มีลูกค้าทัก LINE รอตอบไหม"
//   "เรื่องร้องเรียนค้างอยู่ไหม" · "ลูกค้าใหม่เดือนนี้กี่คน" · "ใครเกิดวันนี้ / ครบรอบซื้อรถสัปดาห์นี้"
// ฟังก์ชันล้วน ทดสอบได้ · ตัวโหลดข้อมูลอยู่ใน lamiCommandCard.js (loadOpsAnswer)
import { dmy } from './format.js'
import { nextAnniversary } from './anniversary.js'

const has = (s, re) => re.test(s)
// คำสั่งให้ทำ (นัด/บันทึก/สร้าง) ไม่ใช่คำถาม → ปล่อยให้ตัวสั่งงานจัดการ
const COMMAND = /^(นัด|บันทึก|สร้าง|เพิ่ม|ลบ|แก้|ย้าย|มอบ)(?!.*(มีใคร|กี่|ไหม|บ้าง|อะไร))/

export function parseOpsSpec(q) {
  const s = String(q || '').trim().replace(/[?？]+$/, '')
  if (s.length < 4 || s.length > 80 || COMMAND.test(s)) return null
  const day = /พรุ่งนี้/.test(s) ? 'tomorrow' : 'today'
  if (has(s, /ทดลองขับ|ลองขับ|test\s*drive/i)) return { kind: 'testdrive', day }
  if (has(s, /โชว์รูม|showroom/i) && has(s, /นัด|เข้า|มา/)) return { kind: 'showroom', day }
  if (has(s, /line|ไลน์|แชท|แชต|ทัก/i) && has(s, /รอ|ยังไม่ตอบ|ค้าง|ตอบ/)) return { kind: 'line' }
  if (has(s, /ร้องเรียน|complain/i)) return { kind: 'complaint' }
  if (has(s, /วันเกิด|เกิดวันนี้|เกิดเดือนนี้|ครบรอบ/)) return { kind: 'anniv', range: /เดือน/.test(s) ? 30 : /สัปดาห์|อาทิตย์|7 วัน/.test(s) ? 7 : 0 }
  if (has(s, /(ลูกค้า|ลีด|lead)\s*(ใหม่|เข้า)/i) && has(s, /เดือน|สัปดาห์|อาทิตย์/)) return { kind: 'newcust', period: /สัปดาห์|อาทิตย์/.test(s) ? 'week' : /เดือนก่อน|เดือนที่แล้ว/.test(s) ? 'prevmonth' : 'month' }
  return null
}

function addDays(iso, n) {
  const d = new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) + n * 86400000)
  return d.toISOString().slice(0, 10)
}
const ymd = v => {
  if (!v) return ''
  if (typeof v === 'string') return v.slice(0, 10)
  const ms = typeof v.toMillis === 'function' ? v.toMillis() : v.seconds ? v.seconds * 1000 : v instanceof Date ? v.getTime() : NaN
  return Number.isFinite(ms) ? new Date(ms + 7 * 3600e3).toISOString().slice(0, 10) : ''
}
const alive = rows => (rows || []).filter(r => r && !r.deleted)
const MAX = 8
const more = (n) => n > MAX ? [`…และอีก ${n - MAX} ราย`] : []
const nm = c => String(c?.name || [c?.firstName, c?.lastName].filter(Boolean).join(' ') || c?.customerName || c?.custName || 'ลูกค้า').trim()
const dayWord = day => day === 'tomorrow' ? 'พรุ่งนี้' : 'วันนี้'

export function testDriveAnswer(rows, { today, day = 'today' }) {
  const date = day === 'tomorrow' ? addDays(today, 1) : today
  const list = alive(rows).filter(t => ymd(t.date) === date && ['scheduled', 'confirmed', 'in_progress', ''].includes(t.status || ''))
    .sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')))
  if (!list.length) return { text: `🚗 ${dayWord(day)} (${dmy(date)}) ไม่มีนัดทดลองขับ`, n: 0 }
  return { n: list.length, text: [`🚗 นัดทดลองขับ${dayWord(day)} ${dmy(date)} — ${list.length} ราย`, ...list.slice(0, MAX).map(t => `• ${t.time ? t.time.slice(0, 5) + ' ' : ''}${nm(t)}${t.model ? ' · ' + t.model : ''}${t.staff ? ' · 👤 ' + t.staff : ''}`), ...more(list.length)].join('\n') }
}

export function showroomAnswer(rows, { today, day = 'today' }) {
  const date = day === 'tomorrow' ? addDays(today, 1) : today
  const list = alive(rows).filter(a => ymd(a.date) === date && ['scheduled', 'confirmed', ''].includes(a.status || ''))
    .sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')))
  if (!list.length) return { text: `🏬 ${dayWord(day)} (${dmy(date)}) ไม่มีนัดลูกค้าเข้าโชว์รูม`, n: 0 }
  return { n: list.length, text: [`🏬 นัดเข้าโชว์รูม${dayWord(day)} ${dmy(date)} — ${list.length} ราย`, ...list.slice(0, MAX).map(a => `• ${a.time ? a.time.slice(0, 5) + ' ' : ''}${nm(a)}${a.purpose ? ' · ' + a.purpose : ''}${a.salesperson ? ' · 👤 ' + a.salesperson : ''}`), ...more(list.length)].join('\n') }
}

// ห้องแชต LINE ที่ลูกค้าทักมาล่าสุดและยังไม่มีใครอ่าน/ตอบ (เงื่อนไขเดียวกับหน้างานวันนี้)
export function lineWaitingAnswer(threads, customers) {
  const byLine = new Map(alive(customers).filter(c => c.lineUserId).map(c => [c.lineUserId, c]))
  const list = alive(threads).filter(t => t.platform === 'line' && t.unread && t.lastDirection === 'in')
    .map(t => ({ t, c: byLine.get(t.userId) }))
    .filter(({ c }) => !c || !c.isLost)
  if (!list.length) return { text: '💬 ไม่มีลูกค้าทัก LINE ค้างตอบ 👍', n: 0 }
  return { n: list.length, text: [`💬 ลูกค้าทัก LINE รอตอบ ${list.length} ราย`, ...list.slice(0, MAX).map(({ t, c }) => `• ${c ? nm(c) : (t.displayName || t.name || 'ลูกค้า (ยังไม่จับคู่)')}${t.lastText ? ': "' + String(t.lastText).slice(0, 40) + '"' : ''}${c?.assignedTo ? ' · 👤 ' + c.assignedTo : ''}`), ...more(list.length)].join('\n') }
}

const OPEN_COMPLAINT = ['open', 'investigating', 'escalated']
export function complaintAnswer(rows, { today }) {
  const list = alive(rows).filter(c => OPEN_COMPLAINT.includes(c.status || 'open'))
    .sort((a, b) => (a.priority === 'critical' ? 0 : 1) - (b.priority === 'critical' ? 0 : 1) || String(a.openDate || '').localeCompare(String(b.openDate || '')))
  if (!list.length) return { text: '✅ ไม่มีเรื่องร้องเรียนค้าง', n: 0 }
  const age = c => { const d = ymd(c.openDate || c.createdAt); if (!d) return ''; const n = Math.round((Date.parse(today) - Date.parse(d)) / 86400000); return n > 0 ? ` · ค้าง ${n} วัน` : ' · วันนี้' }
  const noOwner = list.filter(c => !String(c.assignedTo || '').trim()).length
  return { n: list.length, text: [`⚠️ เรื่องร้องเรียนค้าง ${list.length} เรื่อง${noOwner ? ` (ยังไม่มีผู้รับผิดชอบ ${noOwner})` : ''}`, ...list.slice(0, MAX).map(c => `• ${c.priority === 'critical' ? '🔴 ' : ''}${nm(c)} — ${c.subject || 'ไม่ระบุหัวข้อ'}${c.status === 'escalated' ? ' · Escalate' : ''}${age(c)}${c.assignedTo ? ' · 👤 ' + c.assignedTo : ''}`), ...more(list.length)].join('\n') }
}

// ลูกค้าใหม่ในช่วงเวลา แยกตามที่มา · ไม่นับลูกค้าที่ลบแล้ว
export function newCustomerAnswer(customers, { today, period = 'month', sourceLabel = {} }) {
  let from, to = today, label
  if (period === 'week') { from = addDays(today, -6); label = '7 วันล่าสุด' }
  else if (period === 'prevmonth') { const d = new Date(Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 2, 1)); from = d.toISOString().slice(0, 10); to = addDays(today.slice(0, 7) + '-01', -1); label = 'เดือนก่อน' }
  else { from = today.slice(0, 7) + '-01'; label = 'เดือนนี้' }
  const list = alive(customers).filter(c => { const d = ymd(c.createdAt); return d && d >= from && d <= to })
  if (!list.length) return { text: `👥 ลูกค้าใหม่${label}: ยังไม่มี`, n: 0 }
  const src = {}
  list.forEach(c => { const raw = String(c.source || '').trim(); const k = sourceLabel[raw] || raw || 'ไม่ระบุ'; src[k] = (src[k] || 0) + 1 })
  const hot = list.filter(c => c.temperature === 'hot').length
  const booked = list.filter(c => c.bookingId || ['booking', 'booked', 'delivered'].includes(c.stage)).length
  return { n: list.length, text: [`👥 ลูกค้าใหม่${label} ${list.length} คน (${dmy(from)}–${dmy(to)})`, `🔴 Hot ${hot} · 📝 จองแล้ว ${booked}`, '', '📍 มาจาก', ...Object.entries(src).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `• ${k} ${v} คน`)].join('\n') }
}

// ระบบยังไม่มีวันเกิดลูกค้า → บอกตรงๆ แล้วให้วันครบรอบซื้อรถแทน (จากใบจองที่ส่งมอบแล้ว)
export function annivAnswer(bookings, { today, range = 0, asked = '' }) {
  const end = addDays(today, range)
  const list = alive(bookings).filter(b => b.status === 'ส่งมอบแล้ว' || b.status === 'delivered')
    .map(b => ({ b, nx: nextAnniversary(b.deliveryDate || b.bookingDate || '', today) }))
    .filter(x => x.nx && x.nx.date >= today && x.nx.date <= end)
    .sort((a, b) => a.nx.date.localeCompare(b.nx.date))
  const head = /เกิด/.test(asked) ? 'ℹ️ ระบบยังไม่ได้เก็บวันเกิดลูกค้า — ดูวันครบรอบซื้อรถแทนได้\n\n' : ''
  const when = range ? `${dmy(today)}–${dmy(end)}` : `วันนี้ ${dmy(today)}`
  if (!list.length) return { text: `${head}🎉 ไม่มีลูกค้าครบรอบซื้อรถ (${when})`, n: 0 }
  return { n: list.length, text: [`${head}🎉 ลูกค้าครบรอบซื้อรถ (${when}) ${list.length} ราย`, ...list.slice(0, MAX).map(({ b, nx }) => `• ${dmy(nx.date)} ${nm(b)}${b.model ? ' · ' + b.model : ''} · ครบ ${nx.years} ปี`), ...more(list.length)].join('\n') }
}

export const OPS_LINKS = {
  testdrive: { path: '/crm/testdrive', label: '🚗 เปิดหน้าทดลองขับ' },
  showroom: { path: '/crm/showroom', label: '🏬 เปิดหน้านัดโชว์รูม' },
  line: { path: '/crm/my-day', label: '💬 ตอบในหน้างานวันนี้' },
  complaint: { path: '/crm/complaints', label: '⚠️ เปิดหน้าเรื่องร้องเรียน' },
  newcust: { path: '/crm/customers', label: '👥 เปิดหน้าลูกค้า' },
  anniv: { path: '/crm/birthdays', label: '🎉 ส่งคำอวยพร' },
}

export function opsFollowUps(spec) {
  const all = { testdrive: 'นัดทดลองขับพรุ่งนี้มีใครบ้าง', showroom: 'พรุ่งนี้มีใครนัดเข้าโชว์รูม', line: 'วันนี้มีอะไรบ้าง', complaint: 'มีลูกค้าทัก LINE รอตอบไหม', newcust: 'ลูกค้าใหม่สัปดาห์นี้กี่คน', anniv: 'ใครครบรอบซื้อรถเดือนนี้' }
  const out = [all[spec.kind]]
  if (spec.kind === 'testdrive' && spec.day === 'tomorrow') out[0] = 'พรุ่งนี้มีใครนัดเข้าโชว์รูม'
  if (spec.kind === 'showroom' && spec.day === 'tomorrow') out[0] = 'นัดทดลองขับพรุ่งนี้มีใครบ้าง'
  out.push(spec.kind === 'newcust' ? 'ยอดเดือนนี้เป็นไง' : 'วันนี้ควรโทรหาใคร')
  return out
}
