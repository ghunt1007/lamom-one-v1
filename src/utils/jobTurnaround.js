// (v1.0.1433) เวลาซ่อมจริงของศูนย์ — บันทึกเวลาที่งานเสร็จ (doneAt) / ส่งคืน (deliveredAt) ตอนเปลี่ยนสถานะ
// แล้วใช้เป็น "ปกติเสร็จในกี่วัน" ของร้านเอง เพื่อชี้งานที่ค้างนานกว่าปกติ · ประวัติไม่พอ (< 5 งาน) = ไม่ชี้ ไม่เดา
import { toDate } from './format.js'

const DAY = 86400000
export const ACTIVE_JOB = ['checkin', 'diagnosing', 'inprogress', 'waiting_parts', 'qc']

// ช่องเวลาที่ต้องเติมเมื่อเปลี่ยนเป็นสถานะ next (ไม่ทับค่าที่มีอยู่แล้ว)
export function statusStamp(job, next, nowIso = new Date().toISOString()) {
  const out = {}
  if ((next === 'done' || next === 'delivered') && !job?.doneAt) out.doneAt = nowIso
  if (next === 'delivered' && !job?.deliveredAt) out.deliveredAt = nowIso
  return out
}

const quantile = (sorted, q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]

// ระยะเวลา เปิดงาน → เสร็จ (วัน) ของงานที่เสร็จใน `days` วันล่าสุด
export function jobTurnaround(jobs = [], today, { days = 90, min = 5 } = {}) {
  const t = Date.parse(String(today || '').slice(0, 10) + 'T23:59:59+07:00')
  if (!Number.isFinite(t)) return null
  const d = []
  for (const j of jobs || []) {
    if (!j || j.deleted) continue
    const a = toDate(j.createdAt), b = toDate(j.doneAt)
    if (!a || !b || b < a || t - b.getTime() > days * DAY || b.getTime() > t) continue
    d.push((b - a) / DAY)
  }
  if (d.length < min) return null
  d.sort((x, y) => x - y)
  return { n: d.length, median: quantile(d, 0.5), p80: quantile(d, 0.8) }
}

// งานที่ยังทำอยู่และเปิดมานานกว่า 80% ของงานที่เคยเสร็จ (อย่างน้อย 1 วัน) — เรียงนานสุดก่อน
export function slowJobs(jobs = [], ta, now = Date.now()) {
  if (!ta) return []
  const limit = Math.max(1, ta.p80)
  return (jobs || []).filter(j => j && !j.deleted && ACTIVE_JOB.includes(j.status))
    .map(j => { const a = toDate(j.createdAt); return { j, age: a ? (now - a.getTime()) / DAY : null } })
    .filter(x => x.age != null && x.age > limit)
    .sort((x, y) => y.age - x.age)
}

export const daysText = v => v < 1 ? `${Math.max(1, Math.round(v * 24))} ชม.` : `${Math.round(v * 10) / 10} วัน`.replace('.0 ', ' ')
