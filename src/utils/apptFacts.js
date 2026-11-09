// นัดหมายวันนี้ (โชว์รูม + ศูนย์บริการ) — ใช้ร่วมกันระหว่างรายงาน LINE 09:00/18:00 (workers/daily-report.js) และ LAMI
// ฟังก์ชันล้วน ไม่แตะฐานข้อมูล

// (v1.0.1014) รายงาน 18:00: นัดเข้าโชว์รูมวันนี้ มาแล้วกี่ราย ไม่มากี่ราย — null ถ้าวันนี้ไม่มีนัด
export function showroomVisitLine(appointments, today) {
  const t = (appointments || []).filter(a => a && !a.deleted && (a.date || '').slice(0, 10) === today && a.status !== 'cancelled')
  if (!t.length) return null
  const came = t.filter(a => a.status === 'arrived' || a.status === 'done').length
  const noshow = t.filter(a => a.status === 'noshow').length
  const open = t.length - came - noshow
  return `  • นัดเข้าโชว์รูมวันนี้: ${t.length} ราย · มาแล้ว ${came}${noshow ? ` · ไม่มา ${noshow}` : ''}${open ? ` · ยังไม่อัปเดต ${open}` : ''}`
}

// (v1.0.1015) งานศูนย์บริการวันนี้ (หน้านัดหมาย & เตือนเข้าศูนย์) — นัดที่ยังไม่ยกเลิก/ไม่ใช่ไม่มา เรียงตามเวลา
export function serviceTodayLines(serviceAppts = [], today, max = 6) {
  const t = (serviceAppts || []).filter(a => a && !a.deleted && (a.date || '').slice(0, 10) === today && !['cancelled', 'noshow'].includes(a.status))
    .sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')))
  if (!t.length) return []
  const rows = t.slice(0, max).map(a => `  - ${a.time ? a.time + ' · ' : ''}${a.custName || 'ลูกค้า'}${a.model ? ` (${a.model}${a.plate ? ' ' + a.plate : ''})` : a.plate ? ` (${a.plate})` : ''}${a.type ? ` · ${a.type}` : ''}${a.tech ? ` · ช่าง ${a.tech}` : ''}`)
  if (t.length > max) rows.push(`  - …และอีก ${t.length - max} คัน`)
  return [`🔧 นัดเข้าศูนย์บริการวันนี้: ${t.length} คัน`, ...rows]
}
