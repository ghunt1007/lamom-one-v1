// (v1.0.1427) คาดรถเข้าศูนย์เดือนหน้า — จากรายการเตือนเช็คระยะที่ครบกำหนดเดือนหน้า × อัตรานัดได้จริง 6 เดือนก่อน
// และรายได้คาด = จำนวนคาด × ยอดเฉลี่ยต่อใบงานเช็คระยะ 3 เดือนก่อน · ข้อมูลไม่พอ (เตือนในอดีต < 10 รายการ) คืน null — ไม่เดา
import { shiftYm } from './dashStats.js'

const ymOf = v => String(v || '').slice(0, 7)

export function serviceForecast({ reminders = [], jobs = [], today, amountOf = null, jobMonthOf = null, minPast = 10 } = {}) {
  const ym = String(today || '').slice(0, 7)
  const next = shiftYm(ym, 1)
  const live = (reminders || []).filter(r => r && !r.deleted && /^\d{4}-\d{2}/.test(String(r.dueDate || '')))
  const past = new Set(Array.from({ length: 6 }, (_, i) => shiftYm(ym, -(i + 1))))
  const hist = live.filter(r => past.has(ymOf(r.dueDate)))
  if (hist.length < minPast) return null
  const rate = hist.filter(r => r.booked).length / hist.length
  const due = live.filter(r => ymOf(r.dueDate) === next)
  const expected = Math.round(due.length * rate)
  let avg = null, sample = 0
  if (amountOf && jobMonthOf) {
    const span = new Set([1, 2, 3].map(i => shiftYm(ym, -i)))
    const rows = (jobs || []).filter(j => j && !j.deleted && (j.type === 'service' || !j.type) && span.has(jobMonthOf(j)) && amountOf(j) > 0)
    sample = rows.length
    if (sample >= 5) avg = rows.reduce((a, j) => a + amountOf(j), 0) / sample
  }
  return { next, due: due.length, rate, expected, histN: hist.length, avg, sample, revenue: avg != null ? Math.round(expected * avg / 1000) * 1000 : null }
}
