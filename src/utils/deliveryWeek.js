import { CANCELLED_STATUSES } from './bookingStatus.js'
// (v1.0.1302) คำสั่ง LINE "ส่งมอบ" — นัดส่งมอบรถ 7 วันข้างหน้า (วันนี้ถึงอีก 7 วัน) เรียงตามวัน/เวลา
// + ใบจองที่เลยวันนัดส่งมอบแล้วแต่ยังไม่ส่งมอบ (ย้อนหลังไม่เกิน 14 วัน) ให้ตามต่อ
// mine(b) = ใบจองของคนถาม (เซลส์: ของตัวเอง / เจ้าของ: ทั้งหมด) · ใบจองที่ไม่มีวันนัดส่งมอบ = ไม่นับ (ไม่เดา)
const DAY = 86400000
const iso = ms => new Date(ms).toISOString().slice(0, 10)
const ddmm = s => { const [y, m, d] = s.split('-').map(Number); return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y + 543}` }
const WD = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.']

export function deliveryWeekList(bookings = [], today, mine = () => true, { ahead = 7, back = 14 } = {}) {
  const t0 = Date.parse(today + 'T00:00:00Z')
  const end = iso(t0 + ahead * DAY), from = iso(t0 - back * DAY)
  const open = (bookings || []).filter(b => b && !b.deleted && b.status !== 'ส่งมอบแล้ว' && !CANCELLED_STATUSES.includes(b.status) && mine(b))
    .map(b => ({ b, d: String(b.deliveryDate || '').slice(0, 10) }))
    .filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x.d))
  const byTime = (x, y) => x.d.localeCompare(y.d) || String(x.b.deliveryTime || '').localeCompare(String(y.b.deliveryTime || ''))
  return {
    upcoming: open.filter(x => x.d >= today && x.d <= end).sort(byTime),
    overdue: open.filter(x => x.d < today && x.d >= from).sort(byTime),
  }
}

export function deliveryWeekAnswer(bookings = [], today, { mine = () => true, max = 12 } = {}) {
  const { upcoming, overdue } = deliveryWeekList(bookings, today, mine)
  if (!upcoming.length && !overdue.length) return '📭 ไม่มีนัดส่งมอบรถใน 7 วันข้างหน้าครับ'
  const t0 = Date.parse(today + 'T00:00:00Z')
  const who = b => [String(b.custName || '').trim() || 'ลูกค้า', String(b.model || '').trim()].filter(Boolean).join(' · ')
  const lines = []
  if (upcoming.length) {
    lines.push(`🚗 นัดส่งมอบ 7 วันข้างหน้า ${upcoming.length} คัน`)
    let day = '', n = 0
    for (const { b, d } of upcoming) {
      if (n >= max) break
      if (d !== day) {
        day = d
        const label = d === today ? 'วันนี้' : d === iso(t0 + DAY) ? 'พรุ่งนี้' : WD[new Date(d + 'T00:00:00Z').getUTCDay()]
        lines.push(`📅 ${label} ${ddmm(d)}`)
      }
      lines.push(`  - ${b.deliveryTime ? String(b.deliveryTime).slice(0, 5) + ' ' : ''}${who(b)}${b.status ? ` (${b.status})` : ''}`)
      n++
    }
    if (upcoming.length > max) lines.push(`  …และอีก ${upcoming.length - max} คัน ดูทั้งหมดในหน้าใบจอง`)
  }
  if (overdue.length) {
    if (lines.length) lines.push('')
    lines.push(`⏰ เลยวันนัดส่งมอบ ยังไม่ส่ง ${overdue.length} คัน`)
    for (const { b, d } of overdue.slice(0, 5)) lines.push(`  - ${who(b)} · นัด ${ddmm(d)} (เลยมา ${Math.round((t0 - Date.parse(d + 'T00:00:00Z')) / DAY)} วัน)`)
    if (overdue.length > 5) lines.push(`  …และอีก ${overdue.length - 5} คัน`)
  }
  return lines.join('\n')
}
