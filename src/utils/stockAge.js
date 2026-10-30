// อายุรถในสต็อก (วัน) นับจากวันรับรถถึงวันนี้ตามเวลาไทย — ใช้เตือนรถค้างนาน (ดอกเบี้ยฟลอร์แพลนเดินทุกวัน)
// คืน null ถ้าไม่มีวันรับรถหรือรูปแบบวันที่ไม่ถูกต้อง
export function stockAgeDays(arrivedAt, today) {
  const d = Date.parse(String(arrivedAt || '').slice(0, 10) + 'T00:00:00Z')
  const t = Date.parse(String(today || '').slice(0, 10) + 'T00:00:00Z')
  if (isNaN(d) || isNaN(t)) return null
  return Math.max(0, Math.round((t - d) / 86400000))
}

// สีตามอายุ: ไม่ถึง 60 วันปกติ · 60–89 วันเริ่มนาน · 90 วันขึ้นไปค้างนาน
export function stockAgeTone(days) {
  return days == null ? '' : days >= 90 ? 'danger' : days >= 60 ? 'warning' : 'muted'
}
