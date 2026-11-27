// (v1.0.1271) ส่งคืนรถงาน "เข้าศูนย์บริการ" แล้ว → ตั้งเตือนเช็คระยะครั้งถัดไปให้เอง (หน้าแจ้งเตือนเช็คระยะ)
// รายการนี้เป็นตัวที่สวิตช์ "เตือนรถใกล้ถึงกำหนดเข้าศูนย์ทาง LINE" ใช้ — ไม่ต้องมีใครมานั่งพิมพ์เพิ่มเอง
// ฟังก์ชันล้วน ไม่แตะฐานข้อมูล
export const NEXT_SERVICE_MONTHS = 6
export const NEXT_SERVICE_KM = 10000

export const plateKey = p => String(p || '').replace(/[\s\-.]/g, '').toLowerCase()

// วันเดียวกันของอีก n เดือน (31 ม.ค. + 1 เดือน = 28/29 ก.พ. ไม่ล้นไปเดือนถัดไป)
export function addMonthsYmd(ymd, n) {
  const [y, m, d] = String(ymd).slice(0, 10).split('-').map(Number)
  const first = new Date(Date.UTC(y, m - 1 + n, 1))
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate()
  return new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(d, last))).toISOString().slice(0, 10)
}

// คืนข้อมูลสำหรับสร้าง service_reminders หรือ null (ไม่ใช่งานเข้าศูนย์ / ไม่มีทะเบียน / มีเตือนที่ยังไม่ถึงกำหนดของคันนี้อยู่แล้ว / ใบงานนี้ตั้งไปแล้ว)
// (v1.0.1418) อัตราใช้รถจริงของคันนี้ (km/วัน) จากใบงานเก่าของทะเบียนเดียวกัน — ต้องห่างกัน ≥ 30 วันและไมล์เพิ่มขึ้น
// คืน null ถ้าข้อมูลไม่พอ หรืออัตราแปลก (เกิน 500 km/วัน)
export function mileageRate(job, history = []) {
  const key = plateKey(job?.plate)
  if (!key) return null
  const day = v => { const t = Date.parse(String(v || '').slice(0, 10)); return Number.isFinite(t) ? t / 86400000 : null }
  const pts = [job, ...(history || [])].filter(j => j && !j.deleted && plateKey(j.plate) === key && Number(j.mileage) > 0 && day(j.createdAt) != null)
    .map(j => ({ d: day(j.createdAt), km: Number(j.mileage) }))
    .sort((a, b) => a.d - b.d)
  if (pts.length < 2) return null
  const a = pts[0], b = pts[pts.length - 1]
  const days = b.d - a.d, km = b.km - a.km
  if (days < 30 || km <= 0) return null
  const rate = km / days
  return rate > 500 ? null : rate
}

export function nextServiceReminder(job, today, existing = [], history = []) {
  if (!job || job.type !== 'service' || !plateKey(job.plate) || job.nextReminderId) return null
  const key = plateKey(job.plate)
  const open = (existing || []).some(r => r && !r.deleted && plateKey(r.plate) === key && !r.booked && String(r.dueDate || '') >= today)
  if (open) return null
  const km = Number(job.mileage) || 0
  const nextKm = km > 0 ? Math.ceil((km + 1) / NEXT_SERVICE_KM) * NEXT_SERVICE_KM : 0
  // ถึงไมล์ถัดไปก่อนครบ 6 เดือน (ตามอัตราใช้รถจริง) → เตือนเร็วขึ้น แต่ไม่เร็วกว่า 1 เดือน
  const rate = nextKm ? mileageRate(job, history) : null
  let dueDate = addMonthsYmd(today, NEXT_SERVICE_MONTHS)
  if (rate) {
    const daysToKm = Math.ceil((nextKm - km) / rate)
    const t = Date.parse(today) + Math.max(30, daysToKm) * 86400000
    const byKm = new Date(t).toISOString().slice(0, 10)
    if (byKm < dueDate) dueDate = byKm
  }
  return {
    customer: String(job.custName || '').trim() || 'ลูกค้า',
    phone: String(job.phone || '').trim(),
    plate: String(job.plate).trim(),
    model: [job.brand, job.model].filter(Boolean).join(' ').trim(),
    type: 'mileage',
    detail: `เช็คระยะครั้งถัดไป${nextKm ? ` · ราว ${nextKm.toLocaleString('en-US')} km หรือครบ ${NEXT_SERVICE_MONTHS} เดือน แล้วแต่อย่างไหนถึงก่อน` : ` · ครบ ${NEXT_SERVICE_MONTHS} เดือน`}${rate ? ` · คันนี้ใช้รถเฉลี่ยราว ${Math.round(rate)} km/วัน` : ''}`,
    dueDate,
    contacted: false, booked: false, contactCount: 0,
    ...(job.customerId ? { customerId: job.customerId } : {}),
    fromJobId: job.id || '',
  }
}
