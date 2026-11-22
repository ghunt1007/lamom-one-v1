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
export function nextServiceReminder(job, today, existing = []) {
  if (!job || job.type !== 'service' || !plateKey(job.plate) || job.nextReminderId) return null
  const key = plateKey(job.plate)
  const open = (existing || []).some(r => r && !r.deleted && plateKey(r.plate) === key && !r.booked && String(r.dueDate || '') >= today)
  if (open) return null
  const km = Number(job.mileage) || 0
  const nextKm = km > 0 ? Math.ceil((km + 1) / NEXT_SERVICE_KM) * NEXT_SERVICE_KM : 0
  return {
    customer: String(job.custName || '').trim() || 'ลูกค้า',
    phone: String(job.phone || '').trim(),
    plate: String(job.plate).trim(),
    model: [job.brand, job.model].filter(Boolean).join(' ').trim(),
    type: 'mileage',
    detail: `เช็คระยะครั้งถัดไป${nextKm ? ` · ราว ${nextKm.toLocaleString('en-US')} km หรือครบ ${NEXT_SERVICE_MONTHS} เดือน แล้วแต่อย่างไหนถึงก่อน` : ` · ครบ ${NEXT_SERVICE_MONTHS} เดือน`}`,
    dueDate: addMonthsYmd(today, NEXT_SERVICE_MONTHS),
    contacted: false, booked: false, contactCount: 0,
    ...(job.customerId ? { customerId: job.customerId } : {}),
    fromJobId: job.id || '',
  }
}
