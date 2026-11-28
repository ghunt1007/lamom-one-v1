// (v1.0.1557) ติดตามงานเตรียมส่งมอบแบบละเอียด — รถคันนี้ถึงขั้นไหนแล้ว แจ้งประกันหรือยัง ได้เลขรับแจ้งหรือยัง
// ใช้คอลัมน์จาก Google Sheet (ดู sheetColumns.js) · ใช้ร่วมกันทั้งเว็บ (LAMI) และ worker (LINE 09:00) — ห้าม import ไฟล์ที่ผูกกับเบราว์เซอร์
// ขั้นที่ไม่มีใบไหนเคยกรอกเลย (คอลัมน์ที่ร้านไม่ได้ใช้) จะไม่ถูกนับว่า "ขาด" เพื่อไม่ให้เตือนมั่ว
import { isCancelled } from './bookingStatus.js'
import { dmy } from './format.js'

const yes = v => { const s = String(v ?? '').trim().toUpperCase(); return s === 'Y' || s === 'YES' || s === '✓' || s === 'TRUE' }
const filled = v => { const s = String(v ?? '').trim(); return !!s && s !== '-' && s !== '—' && s.toUpperCase() !== 'N' }

// ขั้นก่อนส่งมอบ เรียงตามลำดับงานจริง
export const PREP_STEPS = [
  { f: 'allocated', label: 'Allocate', yn: true },
  { f: 'vin', label: 'เลขตัวถัง' },
  { f: 'insuranceNotified', label: 'แจ้งประกัน', yn: true },
  { f: 'noticeNo', label: 'เลขรับแจ้ง' },
  { f: 'redPlateDone', label: 'ทำป้ายแดง', yn: true },
  { f: 'chargerRequested', label: 'เบิกสายชาร์จ', yn: true },
  { f: 'salesKit', label: 'ชุดขาย', yn: true },
  { f: 'checklistDone', label: 'เช็ครายการ', yn: true },
]
// ขั้นหลังส่งมอบ (งานทะเบียน/ระบบ)
export const AFTER_STEPS = [
  { f: 'chargerGiven', label: 'ให้สายชาร์จ', yn: true },
  { f: 'dmsDelivered', label: 'ส่งมอบใน DMS', yn: true },
  { f: 'registration', label: 'จดทะเบียน' },
  { f: 'whitePlate', label: 'ป้ายขาว' },
  { f: 'customerNotified', label: 'แจ้งลูกค้ารับป้าย', yn: true },
  { f: 'whitePlateReceived', label: 'ลูกค้ารับป้ายขาว', yn: true },
]
const PREP_STATUSES = ['ได้รถแล้วรอสั่งแต่ง', 'รอส่งมอบ', 'ตัดตัวเลขรอส่งมอบ']

const stepDone = (b, s) => s.yn ? yes(b?.[s.f]) : filled(b?.[s.f])
// คอลัมน์ที่ร้านใช้จริง = มีอย่างน้อย 1 ใบที่กรอกแล้ว
export function usedSteps(bookings = [], steps = PREP_STEPS) {
  return steps.filter(s => (bookings || []).some(b => b && !b.deleted && stepDone(b, s)))
}
export function stepStatus(b, steps) {
  const done = [], missing = []
  steps.forEach(s => (stepDone(b, s) ? done : missing).push(s.label))
  return { done, missing, next: missing[0] || '', pct: steps.length ? Math.round(done.length / steps.length * 100) : 100 }
}
const dayNum = d => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 86400000
const isDate = d => /^\d{4}-\d{2}-\d{2}/.test(String(d || ''))
const name = b => String(b.custName || b.customerName || 'ลูกค้า').trim()
const car = b => [b.brand, b.model].filter(Boolean).join(' ').trim() || String(b.carModel || '').trim()

// รถที่กำลังเตรียมส่งมอบ: สถานะพร้อม/รอส่งมอบ หรือมีวันส่งมอบภายใน `ahead` วัน (รวมที่เลยวันแล้ว)
export function deliveryPrepRows(bookings = [], { today, ahead = 7, seller = '' } = {}) {
  const live = (bookings || []).filter(b => b && !b.deleted)
  const steps = usedSteps(live, PREP_STEPS)
  const t = dayNum(today)
  const rows = live.filter(b => !isCancelled(b) && b.status !== 'ส่งมอบแล้ว' && (!seller || String(b.salesName || '').trim() === seller)).map(b => {
    const dd = isDate(b.deliveryDate) ? String(b.deliveryDate).slice(0, 10) : ''
    const days = dd ? dayNum(dd) - t : null
    if (!(PREP_STATUSES.includes(b.status) || (days != null && days <= ahead))) return null
    return { b, dd, days, ...stepStatus(b, steps) }
  }).filter(Boolean)
  rows.sort((x, y) => (x.days ?? 999) - (y.days ?? 999) || y.missing.length - x.missing.length)
  return { steps, rows, incomplete: rows.filter(r => r.missing.length) }
}

// ส่งมอบแล้วแต่งานทะเบียน/ระบบยังไม่ครบ (ย้อนหลัง `within` วัน)
export function afterDeliveryRows(bookings = [], { today, within = 60, seller = '' } = {}) {
  const live = (bookings || []).filter(b => b && !b.deleted)
  const steps = usedSteps(live, AFTER_STEPS)
  const t = dayNum(today)
  const rows = live.filter(b => b.status === 'ส่งมอบแล้ว' && (!seller || String(b.salesName || '').trim() === seller)).map(b => {
    const d = [b.actualDeliveryDate, b.cutDate, b.deliveryDate].find(isDate)
    if (!d || t - dayNum(String(d).slice(0, 10)) > within || dayNum(String(d).slice(0, 10)) > t) return null
    return { b, dd: String(d).slice(0, 10), days: t - dayNum(String(d).slice(0, 10)), ...stepStatus(b, steps) }
  }).filter(r => r && r.missing.length)
  rows.sort((x, y) => y.days - x.days)
  return { steps, rows }
}

const whenText = r => r.days == null ? 'ยังไม่นัดวันส่ง' : r.days < 0 ? `⚠️ เลยวันส่ง ${-r.days} วัน (${dmy(r.dd)})` : r.days === 0 ? 'ส่งวันนี้' : r.days === 1 ? 'ส่งพรุ่งนี้' : `ส่ง ${dmy(r.dd)}`

// ข้อความตอบ LAMI / LINE: ถึงขั้นไหนแล้ว ขาดอะไร
export function deliveryPrepText(bookings = [], { today, ahead = 7, seller = '', max = 10, focus = '' } = {}) {
  const { steps, rows, incomplete } = deliveryPrepRows(bookings, { today, ahead, seller })
  if (!steps.length) return { n: 0, text: '🚗 ยังไม่มีข้อมูลขั้นเตรียมส่งมอบในใบจอง (คอลัมน์ Allocate / แจ้งประกัน / เลขรับแจ้ง ฯลฯ ใน Sheet ยังว่างทุกใบ) — กรอกใน Sheet แล้วกด 🔄 ซิงก์ Sheet' }
  if (!rows.length) return { n: 0, text: `🚗 ไม่มีรถที่กำลังเตรียมส่งมอบใน ${ahead} วันนี้` }
  // focus = เจาะขั้นเดียว เช่น "แจ้งประกันหรือยัง" / "ได้เลขรับแจ้งหรือยัง"
  if (focus) {
    const lack = rows.filter(r => r.missing.includes(focus))
    if (!steps.some(s => s.label === focus)) return { n: 0, text: `🚗 ยังไม่มีใบไหนกรอกช่อง ${focus} ใน Sheet เลย จึงตรวจไม่ได้` }
    if (!lack.length) return { n: 0, text: `✅ รถที่เตรียมส่งมอบ ${rows.length} คัน ${focus}ครบทุกคันแล้ว` }
    return { n: lack.length, text: [`🚗 ยังไม่ได้${focus} ${lack.length} จาก ${rows.length} คันที่เตรียมส่งมอบ`,
      ...lack.slice(0, max).map(r => `• ${name(r.b)}${car(r.b) ? ' · ' + car(r.b) : ''} · ${whenText(r)}${r.b.salesName ? ' · ' + r.b.salesName : ''}`),
      ...(lack.length > max ? [`…และอีก ${lack.length - max} คัน`] : [])].join('\n') }
  }
  const ok = rows.length - incomplete.length
  return { n: rows.length, text: [`🚗 รถเตรียมส่งมอบ ${rows.length} คัน — ครบทุกขั้น ${ok} · ยังขาด ${incomplete.length}`,
    ...rows.slice(0, max).map(r => `• ${name(r.b)}${car(r.b) ? ' · ' + car(r.b) : ''} · ${whenText(r)}\n   ${r.missing.length ? `ถึงขั้น ${r.done.length}/${r.done.length + r.missing.length} · ขาด: ${r.missing.join(', ')}` : '✅ ครบทุกขั้น'}`),
    ...(rows.length > max ? [`…และอีก ${rows.length - max} คัน`] : []),
    `ℹ️ ขั้นที่ตรวจ: ${steps.map(s => s.label).join(' → ')} (ตามช่องใน Sheet)`].join('\n') }
}

// บรรทัดสำหรับ LINE 09:00 — เฉพาะคันที่ยังขาดขั้น (ส่งภายใน 3 วัน/เลยวันส่ง ขึ้นก่อน) + งานหลังส่งมอบที่ค้าง
export function deliveryPrepMorningLines(bookings = [], today, { max = 6 } = {}) {
  const { steps, incomplete } = deliveryPrepRows(bookings, { today, ahead: 7 })
  const out = []
  if (steps.length && incomplete.length) {
    out.push(`🚗 เตรียมส่งมอบยังไม่ครบ ${incomplete.length} คัน`)
    incomplete.slice(0, max).forEach(r => out.push(`• ${name(r.b)}${car(r.b) ? ' ' + car(r.b) : ''} · ${whenText(r)}${r.b.salesName ? ' · ' + r.b.salesName : ''}\n   ขาด: ${r.missing.join(', ')}`))
    if (incomplete.length > max) out.push(`…และอีก ${incomplete.length - max} คัน`)
  }
  const after = afterDeliveryRows(bookings, { today })
  if (after.steps.length && after.rows.length) {
    const cnt = {}
    after.rows.forEach(r => r.missing.forEach(m => { cnt[m] = (cnt[m] || 0) + 1 }))
    out.push(`📄 ส่งมอบแล้วงานทะเบียนยังค้าง ${after.rows.length} คัน: ${Object.entries(cnt).map(([k, v]) => `${k} ${v}`).join(' · ')}`)
  }
  return out
}
