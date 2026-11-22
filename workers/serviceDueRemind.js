// (v1.0.1260) เตือนลูกค้าทาง LINE เมื่อรถใกล้ถึงกำหนดเข้าศูนย์ (รายการในหน้า "แจ้งเตือนเช็คระยะ" — service_reminders)
// ส่งล่วงหน้าไม่เกิน 7 วันก่อนวันครบกำหนด (และวันครบกำหนดเอง) เฉพาะรายการที่ยังไม่จองคิว
// จับคู่ลูกค้าด้วยเบอร์โทร → ต้องผูก LINE แล้ว ไม่เลิกรับ/ไม่บล็อก · เปิดสวิตช์ inbox_auto.serviceDueLine ก่อน (ปิดไว้เป็นค่าเริ่มต้น)
// ทำงานช่วง 10:00–10:59 น. (cron ทุก 10 นาที) · จด lineDueSent = วันครบกำหนด ก่อนส่ง → รายการเดียวกันส่งครั้งเดียว
export const SERVICE_DUE_HOUR = 10
export const SERVICE_DUE_DAYS = 7
export const SERVICE_DUE_MAX = 40
const UID = /^U[0-9a-f]{10,40}$/i
const digits = s => String(s || '').replace(/\D/g, '').replace(/^66/, '0')
const day = v => String(v || '').slice(0, 10)
const dmy = d => d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${Number(d.slice(0, 4)) + 543}` : ''
const first = n => { const w = String(n || '').trim().replace(/^คุณ/, '').split(/\s+/)[0]; return w && !/^ลูกค้า/.test(w) ? w : '' }
const dayNum = iso => { const [y, m, d] = String(iso).split('-').map(Number); return Date.UTC(y, m - 1, d) / 864e5 }

export const DUE_REMINDER_FIELDS = ['customer', 'phone', 'plate', 'model', 'type', 'detail', 'dueDate', 'booked', 'lineDueSent', 'deleted']
export const DUE_CUSTOMER_FIELDS = ['firstName', 'phone', 'lineUserId', 'lineOptOut', 'lineBlockedAt', 'deleted']

export function serviceDueText({ name = '', plate = '', model = '', detail = '', dueDate = '', today = '' } = {}) {
  const hi = name ? `สวัสดีครับคุณ${name}` : 'สวัสดีครับ'
  const car = [String(model || '').trim(), String(plate || '').trim()].filter(Boolean).join(' ทะเบียน ')
  const when = dueDate === today ? 'วันนี้' : `วันที่ ${dmy(dueDate)}`
  return `${hi} รถ${car ? ` ${car}` : 'ของคุณ'} ถึงกำหนดเข้าศูนย์${detail ? ` (${String(detail).trim()})` : ''} ${when} ครับ 🔧\nต้องการนัดวันเวลาเข้าศูนย์ ตอบกลับข้อความนี้ได้เลย ทีมงานจะจองคิวให้ครับ`
}

/** เลือกรายการที่ต้องเตือน (ฟังก์ชันล้วน) — คืน [{ id, to, text, dueDate }] ไม่เกิน max · คนเดียวหลายคันวันเดียวกัน ส่งข้อความเดียว */
export function pickServiceDue({ reminders = [], customers = [], today, days = SERVICE_DUE_DAYS, max = SERVICE_DUE_MAX } = {}) {
  const byPhone = new Map()
  for (const c of customers) {
    if (!c || c.deleted) continue
    const p = digits(c.phone)
    if (p.length >= 9 && !byPhone.has(p)) byPhone.set(p, c)
  }
  const t = dayNum(today)
  const out = [], seen = new Set()
  const rows = reminders.filter(r => r && !r.deleted && r.id && !r.booked && /^\d{4}-\d{2}-\d{2}$/.test(day(r.dueDate)))
    .sort((a, b) => day(a.dueDate).localeCompare(day(b.dueDate)))
  for (const r of rows) {
    const due = day(r.dueDate)
    const left = dayNum(due) - t
    if (left < 0 || left > days || r.lineDueSent === due) continue
    const c = byPhone.get(digits(r.phone))
    if (!c || !UID.test(c.lineUserId || '') || c.lineOptOut === true || c.lineBlockedAt) continue
    if (seen.has(c.lineUserId) || out.length >= max) continue
    seen.add(c.lineUserId)
    out.push({ id: r.id, to: c.lineUserId, dueDate: due, text: serviceDueText({ name: first(c.firstName || r.customer), plate: r.plate, model: r.model, detail: r.detail, dueDate: due, today }) })
  }
  return out
}

/** deps: { enabled, hour, today, list(col, fields)→rows, pushLine(to,text)→bool, mark(col,id,fields)→bool } */
export async function runServiceDue(deps) {
  if (!deps?.enabled || !deps.pushLine) return { sent: 0, skipped: 'off' }
  if (deps.hour !== SERVICE_DUE_HOUR) return { sent: 0, skipped: 'hour' }
  const [reminders, customers] = await Promise.all([deps.list('service_reminders', DUE_REMINDER_FIELDS), deps.list('customers', DUE_CUSTOMER_FIELDS)])
  let sent = 0, failed = 0
  for (const s of pickServiceDue({ reminders: reminders || [], customers: customers || [], today: deps.today })) {
    if (!(await deps.mark('service_reminders', s.id, { lineDueSent: { stringValue: s.dueDate } }))) continue // จดก่อนส่ง กันส่งซ้ำ
    if (await deps.pushLine(s.to, s.text)) sent++
    else failed++
  }
  return { sent, failed }
}

// (v1.0.1291) คำสั่ง LINE "ครบระยะ" สำหรับทีมงาน — รถที่ถึงกำหนดเช็คระยะ (เลยกำหนดไม่เกิน 30 วัน ถึงอีก 7 วัน) และยังไม่ได้นัด
// เลยกำหนดก่อน แล้วตามวันครบกำหนด · บอกว่าระบบส่ง LINE เตือนลูกค้าไปแล้วหรือยัง (lineDueSent)
export function dueListAnswer(reminders = [], today, { ahead = SERVICE_DUE_DAYS, overdue = 30, max = 10 } = {}) {
  const t = dayNum(today)
  const rows = (reminders || []).filter(r => r && !r.deleted && !r.booked && /^\d{4}-\d{2}-\d{2}$/.test(day(r.dueDate)))
    .map(r => ({ r, left: dayNum(day(r.dueDate)) - t }))
    .filter(x => x.left <= ahead && x.left >= -overdue)
    .sort((a, b) => a.left - b.left)
  if (!rows.length) return `✅ ไม่มีรถครบระยะที่ยังไม่ได้นัด (เลยกำหนด ${overdue} วัน ถึงอีก ${ahead} วัน)`
  const late = rows.filter(x => x.left < 0).length
  const lines = [`🔧 รถครบระยะที่ยังไม่ได้นัด ${rows.length} คัน${late ? ` (เลยกำหนด ${late})` : ''}`]
  for (const { r, left } of rows.slice(0, max)) {
    const when = left < 0 ? `เลย ${-left} วัน` : left === 0 ? 'วันนี้' : `อีก ${left} วัน`
    const car = [String(r.model || '').trim(), String(r.plate || '').trim()].filter(Boolean).join(' ')
    const p = digits(r.phone)
    lines.push([`• ${String(r.customer || '').trim() || 'ไม่ระบุชื่อ'}`, car, p.length === 10 ? `${p.slice(0, 3)}-${p.slice(3, 6)}-${p.slice(6)}` : p, `${dmy(day(r.dueDate))} (${when})`, r.lineDueSent === day(r.dueDate) ? '💬 เตือนทาง LINE แล้ว' : ''].filter(Boolean).join(' · '))
  }
  if (rows.length > max) lines.push(`…และอีก ${rows.length - max} คัน ดูทั้งหมดในหน้าแจ้งเตือนเช็คระยะ`)
  return lines.join('\n')
}

// (v1.0.1292) บรรทัดในรายงาน 09:00 — จำนวนรถครบระยะที่ยังไม่ได้นัด (ช่วงเดียวกับคำสั่ง "ครบระยะ") · ไม่มี = ''
export function serviceDueMorningLine(reminders = [], today, { ahead = SERVICE_DUE_DAYS, overdue = 30 } = {}) {
  const t = dayNum(today)
  const left = (reminders || []).filter(r => r && !r.deleted && !r.booked && /^\d{4}-\d{2}-\d{2}$/.test(day(r.dueDate)))
    .map(r => dayNum(day(r.dueDate)) - t).filter(n => n <= ahead && n >= -overdue)
  if (!left.length) return ''
  const late = left.filter(n => n < 0).length
  return `📅 รถครบระยะยังไม่ได้นัด: ${left.length} คัน${late ? ` (เลยกำหนด ${late})` : ''} — โทรนัดลูกค้า หรือพิมพ์ "ครบระยะ" ใน LINE ดูรายชื่อ`
}
