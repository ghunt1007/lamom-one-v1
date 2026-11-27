// (v1.0.1427) คาดรถเข้าศูนย์เดือนหน้า — จากรายการเตือนเช็คระยะที่ครบกำหนดเดือนหน้า × อัตรานัดได้จริง 6 เดือนก่อน
// และรายได้คาด = จำนวนคาด × ยอดเฉลี่ยต่อใบงานเช็คระยะ 3 เดือนก่อน · ข้อมูลไม่พอ (เตือนในอดีต < 10 รายการ) คืน null — ไม่เดา
import { shiftYm } from './dashStats.js'
import { toDate } from './format.js'

// เดือน (เวลาไทย) ของใบงาน: jobDate ถ้ามี ไม่งั้น createdAt — ย้ายมาจากหน้าวิเคราะห์ศูนย์บริการ (ใช้ร่วมกับ LAMI)
export function jobMonth(j) {
  if (typeof j?.jobDate === 'string' && /^\d{4}-\d{2}/.test(j.jobDate)) return j.jobDate.slice(0, 7)
  const d = toDate(j?.createdAt)
  return d ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit' }).format(d).slice(0, 7) : ''
}
// ยอดเงินของใบงาน: total ถ้ามี ไม่งั้น ค่าแรง + อะไหล่
export function jobAmount(j) {
  if (Number(j?.total) > 0) return Number(j.total)
  const parts = Array.isArray(j?.parts) ? j.parts.reduce((a, p) => a + (Number(p?.qty) || 1) * (Number(p?.price) || 0), 0) : Number(j?.partsCost) || 0
  return (Number(j?.labor) || 0) + parts
}

const ymOf = v => String(v || '').slice(0, 7)

export function serviceForecast({ reminders = [], jobs = [], today, amountOf = jobAmount, jobMonthOf = jobMonth, minPast = 10 } = {}) {
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

const TH_M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
// LAMI "เดือนหน้ารถเข้าศูนย์กี่คัน" (v1.0.1428)
export function serviceForecastAnswer(reminders, jobs, { today }) {
  const f = serviceForecast({ reminders, jobs, today })
  if (!f) return { n: 0, text: '🔧 ยังคาดรถเข้าศูนย์เดือนหน้าไม่ได้ — ต้องมีประวัติการเตือนเช็คระยะอย่างน้อย 10 รายการใน 6 เดือนก่อน (เตือนจะตั้งให้เองเมื่อส่งคืนรถงานเข้าศูนย์)' }
  const m = TH_M[Number(f.next.slice(5, 7)) - 1] + ' ' + (Number(f.next.slice(0, 4)) + 543)
  const baht = v => '฿' + Math.round(v).toLocaleString('en-US')
  return { n: f.expected, text: [
    `🔮 คาดรถเข้าศูนย์เดือนหน้า (${m}) ≈ ${f.expected} คัน${f.revenue != null ? ` · รายได้ ≈ ${baht(f.revenue)}` : ''}`,
    `• ครบกำหนดเช็คระยะ ${f.due} คัน × นัดเข้าได้จริง ${Math.round(f.rate * 100)}% (จาก ${f.histN} รายการใน 6 เดือนก่อน)`,
    f.revenue != null ? `• เฉลี่ยใบงานละ ${baht(f.avg)} (${f.sample} งานใน 3 เดือนก่อน)` : null,
    '💡 โทรนัดล่วงหน้าจากหน้าเตือนเช็คระยะ จะได้มากกว่าที่คาด',
  ].filter(Boolean).join('\n') }
}
