// (v1.0.1079) คำถามงานประจำวันที่ LAMI เคยตอบไม่ได้ (ได้แต่ลิงก์เปล่า หรือดึงรายการใบจองที่ไม่เกี่ยวมาตอบ):
//   "นัดทดลองขับวันนี้มีใครบ้าง" · "พรุ่งนี้มีใครเข้าโชว์รูม" · "มีลูกค้าทัก LINE รอตอบไหม"
//   "เรื่องร้องเรียนค้างอยู่ไหม" · "ลูกค้าใหม่เดือนนี้กี่คน" · "ใครเกิดวันนี้ / ครบรอบซื้อรถสัปดาห์นี้"
// ฟังก์ชันล้วน ทดสอบได้ · ตัวโหลดข้อมูลอยู่ใน lamiCommandCard.js (loadOpsAnswer)
import { dmy } from './format.js'
import { nextAnniversary } from './anniversary.js'
import { lostBySeller, classifyLostReason, LOST_REASON_LABELS } from './lostReason.js'

const has = (s, re) => re.test(s)
// คำสั่งให้ทำ (นัด/บันทึก/สร้าง) ไม่ใช่คำถาม → ปล่อยให้ตัวสั่งงานจัดการ
const COMMAND = /^(นัด|บันทึก|สร้าง|เพิ่ม|ลบ|แก้|ย้าย|มอบ)(?!.*(มีใคร|กี่|ไหม|บ้าง|อะไร))/

export function parseOpsSpec(q) {
  const s = String(q || '').trim().replace(/[?？]+$/, '')
  if (s.length < 4 || s.length > 80 || COMMAND.test(s)) return null
  const day = /พรุ่งนี้/.test(s) ? 'tomorrow' : 'today'
  if (has(s, /เสียดีล|เสียลูกค้า|lost|ปิดไม่ได้|หลุด/i) && !has(s, /บันทึก/)) return { kind: 'lost', prev: /เดือนก่อน|เดือนที่แล้ว/.test(s) }
  if (has(s, /รายได้|ค่าคอม/) && has(s, /ยังไม่กรอก|ไม่ได้กรอก|ค้างกรอก|ยังไม่ใส่|ขาด/)) return { kind: 'income' }
  if (has(s, /ส่งมอบ/) && !has(s, /ยอด|เป้า|เดือน/) && has(s, /วันนี้|พรุ่งนี้|สัปดาห์|อาทิตย์|นัด|ใคร|กี่คัน|ไหม/)) return { kind: 'delivery', day: /พรุ่งนี้/.test(s) ? 'tomorrow' : /สัปดาห์|อาทิตย์|7 วัน/.test(s) ? 'week' : 'today' }
  if (has(s, /ช่องทาง|ที่มา|มาจาก/) && has(s, /ลูกค้า|ลีด|lead/i)) return { kind: 'newcust', period: /สัปดาห์|อาทิตย์/.test(s) ? 'week' : /เดือนก่อน|เดือนที่แล้ว/.test(s) ? 'prevmonth' : 'month' }
  // (v1.0.1082) งานศูนย์บริการ: "รถเข้าศูนย์วันนี้กี่คัน" / "งานซ่อมค้างอยู่กี่งาน" / "รถรออะไหล่มีคันไหน"
  if (has(s, /เข้าศูนย์|นัดซ่อม|นัดเซอร์วิส|นัดเช็คระยะ|เช็คระยะ|งานซ่อม|ใบสั่งซ่อม|job\s*card|รถซ่อม|ซ่อมค้าง|รออะไหล่|ซ่อมเสร็จ/i) && !has(s, /ราคา|ค่าซ่อม|กี่บาท|เท่าไหร่/)) return { kind: 'service', day }
  // (v1.0.1082) "ลูกค้าที่ยังไม่มีผู้ดูแลมีใครบ้าง"
  if (has(s, /(?:ยังไม่มี|ไม่มี|ไร้)\s*(?:ผู้ดูแล|คนดูแล|เซลส์ดูแล|เซลส์)|ยังไม่(?:ได้)?(?:มอบ|แจก|แบ่ง)|ยังไม่มีเจ้าของ/) && has(s, /ลูกค้า|ลีด|lead/i)) return { kind: 'unassigned' }
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

const DONE = ['ส่งมอบแล้ว', 'ถอนจอง', 'ยกเลิก']
// นัดส่งมอบ วันนี้/พรุ่งนี้/7 วัน (ยังไม่ได้ส่งจริง · ไม่นับใบที่ถอนจอง)
export function deliveryAnswer(bookings, { today, day = 'today' }) {
  const from = day === 'tomorrow' ? addDays(today, 1) : today
  const to = day === 'week' ? addDays(today, 6) : from
  const list = alive(bookings).filter(b => !DONE.includes(b.status) && ymd(b.deliveryDate) >= from && ymd(b.deliveryDate) <= to)
    .sort((a, b) => ymd(a.deliveryDate).localeCompare(ymd(b.deliveryDate)) || String(a.deliveryTime || '').localeCompare(String(b.deliveryTime || '')))
  const when = day === 'week' ? ` 7 วันนี้ (${dmy(from)}–${dmy(to)})` : `${dayWord(day)} ${dmy(from)}`
  if (!list.length) return { text: `🚗 ไม่มีนัดส่งมอบ${when}`, n: 0 }
  return { n: list.length, text: [`🚗 นัดส่งมอบ${when} — ${list.length} คัน`, ...list.slice(0, MAX).map(b => `• ${day === 'week' ? dmy(b.deliveryDate) + ' ' : ''}${b.deliveryTime ? String(b.deliveryTime).slice(0, 5) + ' ' : ''}${nm(b)}${b.model ? ' · ' + b.model : ''}${b.status ? ' · ' + b.status : ''}${b.salesName ? ' · 👤 ' + b.salesName : ''}`), ...more(list.length)].join('\n') }
}

// ส่งมอบแล้วเดือนนี้แต่ยังไม่กรอกรายได้ (นิยามเดียวกับหน้างานวันนี้/รายงาน 18:00)
export function incomeMissingAnswer(bookings, { today }) {
  const month = today.slice(0, 7)
  const list = alive(bookings).filter(b => ['ส่งมอบแล้ว', 'ตัดตัวเลขรอส่งมอบ'].includes(b.status) && !(Number(b.totalIncome) || 0) && String(b.cutDate || b.actualDeliveryDate || '').startsWith(month))
  if (!list.length) return { text: '💰 คันที่ส่งมอบเดือนนี้ กรอกรายได้ครบแล้ว 👍', n: 0 }
  const by = {}
  list.forEach(b => { const k = String(b.salesName || 'ไม่ระบุเซลส์').trim(); by[k] = (by[k] || 0) + 1 })
  return { n: list.length, text: [`💰 ส่งมอบเดือนนี้แต่ยังไม่กรอกรายได้ ${list.length} คัน`, ...Object.entries(by).sort((a, b) => b[1] - a[1]).map(([k, v]) => `• ${k} — ${v} คัน`), '', 'กรอกได้ที่หน้างานวันนี้ หมวด 💰 (แตะคันนั้นแล้วใส่ตัวเลข)'].join('\n') }
}

// เสียดีลเดือนนี้ (ตามวันที่กดเสียดีล) · เหตุผลรวม + รายเซลส์
export function lostAnswer(customers, { today, prev = false }) {
  const d = new Date(Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1 - (prev ? 1 : 0), 1))
  const month = d.toISOString().slice(0, 7)
  const rows = lostBySeller(customers, month)
  const total = rows.reduce((s, r) => s + r.total, 0)
  const label = prev ? 'เดือนก่อน' : 'เดือนนี้'
  if (!total) return { text: `📉 ${label}ยังไม่มีลูกค้าที่เสียดีล 👍`, n: 0 }
  const reasons = {}
  alive(customers).filter(c => c.isLost && ymd(c.lostAt).slice(0, 7) === month).forEach(c => { const k = classifyLostReason(c.lostReason); reasons[k] = (reasons[k] || 0) + 1 })
  return { n: total, text: [`📉 ${label}เสียดีล ${total} ราย`, '', '❓ เหตุผล', ...Object.entries(reasons).sort((a, b) => b[1] - a[1]).map(([k, v]) => `• ${LOST_REASON_LABELS[k] || k} ${v} ราย`), ...(rows.length > 1 ? ['', '👤 รายเซลส์', ...rows.slice(0, MAX).map(r => `• ${r.name} ${r.total} ราย${r.top[0] ? ' (ส่วนใหญ่: ' + r.top[0].label + ')' : ''}`)] : [])].join('\n') }
}

const APPT_DONE = ['cancelled', 'noshow']
const JOB_OPEN = { waiting: '⏳ รอรับรถ', checkin: '🔑 รับรถแล้ว', diagnosing: '🔍 วินิจฉัย', inprogress: '🔧 กำลังซ่อม', waiting_parts: '📦 รออะไหล่', qc: '✅ QC', done: '🏁 เสร็จ รอส่งคืน' }
// นัดเข้าศูนย์ของวัน + งานซ่อม (Job Card) ที่ยังไม่ส่งคืนลูกค้า แยกตามสถานะ
export function serviceAnswer(appts, jobs, { today, day = 'today' }) {
  const date = day === 'tomorrow' ? addDays(today, 1) : today
  const ap = alive(appts).filter(a => ymd(a.date) === date && !APPT_DONE.includes(a.status || ''))
    .sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')))
  const open = alive(jobs).filter(j => JOB_OPEN[j.status || 'waiting'])
  const lines = []
  if (ap.length) lines.push(`🛠 นัดเข้าศูนย์${dayWord(day)} ${dmy(date)} — ${ap.length} คัน`, ...ap.slice(0, MAX).map(a => `• ${a.time ? String(a.time).slice(0, 5) + ' ' : ''}${nm(a)}${a.model ? ' · ' + a.model : ''}${a.plate ? ' · ' + a.plate : ''}${a.tech ? ' · 🔧 ' + a.tech : ''}`), ...more(ap.length))
  else lines.push(`🛠 ${dayWord(day)} (${dmy(date)}) ไม่มีนัดเข้าศูนย์`)
  lines.push('')
  if (!open.length) lines.push('🔧 ไม่มีงานซ่อมค้าง 👍')
  else {
    const by = {}
    open.forEach(j => { const k = j.status || 'waiting'; by[k] = (by[k] || 0) + 1 })
    lines.push(`🔧 งานซ่อมที่ยังไม่ส่งคืน ${open.length} งาน`, ...Object.keys(JOB_OPEN).filter(k => by[k]).map(k => `• ${JOB_OPEN[k]} ${by[k]} งาน`))
    const age = j => { const d = ymd(j.createdAt); return d ? Math.round((Date.parse(today) - Date.parse(d)) / 86400000) : 0 }
    const old = open.map(j => ({ j, n: age(j) })).filter(x => x.n >= 3 && x.j.status !== 'done').sort((a, b) => b.n - a.n)
    if (old.length) lines.push('', `⏰ ค้างนานเกิน 3 วัน ${old.length} งาน`, ...old.slice(0, 5).map(({ j, n }) => `• ${nm(j)}${j.plate ? ' · ' + j.plate : ''} — ${JOB_OPEN[j.status || 'waiting']} · ${n} วัน${j.techName ? ' · 🔧 ' + j.techName : ''}`))
  }
  return { n: ap.length + open.length, text: lines.join('\n') }
}

// ลูกค้า (ไม่นับเสียดีล/ลบ) ที่ยังไม่มีผู้ดูแล · ใหม่สุดก่อน
export function unassignedAnswer(customers) {
  const list = alive(customers).filter(c => !c.isLost && !String(c.assignedTo || '').trim())
    .sort((a, b) => ymd(b.createdAt).localeCompare(ymd(a.createdAt)))
  if (!list.length) return { text: '👤 ลูกค้าทุกคนมีผู้ดูแลแล้ว 👍', n: 0 }
  return { n: list.length, text: [`👤 ลูกค้าที่ยังไม่มีผู้ดูแล ${list.length} คน`, ...list.slice(0, MAX).map(c => `• ${nm(c)}${c.temperature === 'hot' ? ' 🔴' : ''}${c.interestedModel ? ' · ' + c.interestedModel : ''}${ymd(c.createdAt) ? ' · เข้ามา ' + dmy(ymd(c.createdAt)) : ''}`), ...more(list.length), '', 'มอบผู้ดูแลได้ที่หน้าลูกค้า (เลือกหลายคน → มอบหมาย)'].join('\n') }
}

export const OPS_LINKS = {
  service: { path: '/service/jobs', label: '🔧 เปิดหน้างานซ่อม' },
  unassigned: { path: '/crm/customers', label: '👥 เปิดหน้าลูกค้า' },
  testdrive: { path: '/crm/testdrive', label: '🚗 เปิดหน้าทดลองขับ' },
  showroom: { path: '/crm/showroom', label: '🏬 เปิดหน้านัดโชว์รูม' },
  line: { path: '/crm/my-day', label: '💬 ตอบในหน้างานวันนี้' },
  complaint: { path: '/crm/complaints', label: '⚠️ เปิดหน้าเรื่องร้องเรียน' },
  newcust: { path: '/crm/customers', label: '👥 เปิดหน้าลูกค้า' },
  anniv: { path: '/crm/birthdays', label: '🎉 ส่งคำอวยพร' },
  delivery: { path: '/crm/bookings', label: '📝 เปิดหน้าใบจอง' },
  lost: { path: '/crm/lostdeals', label: '📉 เปิดหน้าดีลที่หลุด' },
  income: { path: '/crm/my-day', label: '💰 กรอกในหน้างานวันนี้' },
}

export function opsFollowUps(spec) {
  const all = { testdrive: 'นัดทดลองขับพรุ่งนี้มีใครบ้าง', showroom: 'พรุ่งนี้มีใครนัดเข้าโชว์รูม', line: 'วันนี้มีอะไรบ้าง', complaint: 'มีลูกค้าทัก LINE รอตอบไหม', newcust: 'ลูกค้าใหม่สัปดาห์นี้กี่คน', anniv: 'ใครครบรอบซื้อรถเดือนนี้', delivery: 'นัดส่งมอบสัปดาห์นี้มีใครบ้าง', lost: 'ลูกค้า hot มีใครบ้าง', income: 'ค่าคอมเดือนนี้เท่าไหร่', service: 'พรุ่งนี้มีรถเข้าศูนย์กี่คัน', unassigned: 'ลูกค้าใหม่เดือนนี้กี่คน' }
  const out = [all[spec.kind]]
  if (spec.kind === 'testdrive' && spec.day === 'tomorrow') out[0] = 'พรุ่งนี้มีใครนัดเข้าโชว์รูม'
  if (spec.kind === 'delivery' && spec.day === 'week') out[0] = 'มีนัดส่งมอบพรุ่งนี้ไหม'
  if (spec.kind === 'service' && spec.day === 'tomorrow') out[0] = 'เรื่องร้องเรียนค้างอยู่ไหม'
  if (spec.kind === 'showroom' && spec.day === 'tomorrow') out[0] = 'นัดทดลองขับพรุ่งนี้มีใครบ้าง'
  out.push(spec.kind === 'newcust' ? 'ยอดเดือนนี้เป็นไง' : 'วันนี้ควรโทรหาใคร')
  return out
}
