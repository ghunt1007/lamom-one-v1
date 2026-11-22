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

// (v1.0.1270) รถซ่อม/เช็กระยะเสร็จแล้วแต่ลูกค้ายังไม่มารับ (ใบงานสถานะ "เสร็จแล้ว" ตั้งแต่ก่อนวันนี้) — รายงาน LINE 09:00
// ใช้เวลาแก้ไขล่าสุดของใบงานแทนเวลาที่เสร็จ (ใบงานที่เสร็จแล้วมักไม่ถูกแก้อีก) · ไม่มีวันที่ = ไม่นับ (ไม่เดา)
const bkkDate = iso => { const t = Date.parse(iso || ''); return Number.isFinite(t) ? new Date(t + 7 * 3600e3).toISOString().slice(0, 10) : '' }
export function jobsAwaitingPickupLines(jobs = [], today, max = 5) {
  const dayN = d => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 864e5
  const w = (jobs || []).filter(j => j && !j.deleted && j.status === 'done')
    .map(j => ({ j, d: bkkDate(j.updatedAt) })).filter(x => x.d && x.d < today)
    .map(x => ({ ...x, days: dayN(today) - dayN(x.d) })).sort((a, b) => b.days - a.days)
  if (!w.length) return []
  const rows = w.slice(0, max).map(({ j, days }) => `  - ${String(j.custName || '').trim() || 'ลูกค้า'}${j.plate ? ` (${j.plate})` : ''} · เสร็จมา ${days} วัน${j.lineReadySent ? ' · แจ้ง LINE แล้ว' : ''}`)
  if (w.length > max) rows.push(`  - …และอีก ${w.length - max} คัน`)
  return [`🚗 รถซ่อมเสร็จรอลูกค้ามารับ: ${w.length} คัน — โทรแจ้งลูกค้า หรือกด "ส่งคืนแล้ว" ในหน้า Job Card ถ้ารับไปแล้ว`, ...rows]
}

// (v1.0.1279) คำสั่ง LINE "งานซ่อม" (ทีมงาน/เจ้าของ) — ใบงานที่ยังเปิดอยู่แยกตามสถานะ + รถที่เสร็จแล้วรอลูกค้ารับ (รวมวันนี้)
export const JOB_OPEN_STATUS = { waiting: '⏳ รอรับรถ', checkin: '🔑 รับรถแล้ว', diagnosing: '🔍 วินิจฉัย', inprogress: '🔧 กำลังซ่อม', waiting_parts: '📦 รออะไหล่', qc: '✅ QC' }
export function serviceJobsAnswer(jobs = [], today, max = 8) {
  const dayN = d => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 864e5
  const live = (jobs || []).filter(j => j && !j.deleted)
  const open = live.filter(j => JOB_OPEN_STATUS[j.status])
  const done = live.filter(j => j.status === 'done').map(j => ({ j, d: bkkDate(j.updatedAt) }))
    .map(x => ({ ...x, days: x.d ? dayN(today) - dayN(x.d) : null }))
    .sort((a, b) => (b.days ?? -1) - (a.days ?? -1))
  if (!open.length && !done.length) return '🔧 ตอนนี้ไม่มีใบงานซ่อมที่ค้างอยู่ครับ (ดูทั้งหมดที่ เมนูศูนย์บริการ › Job Card)'
  const lines = [`🔧 งานศูนย์บริการตอนนี้: กำลังทำ ${open.length} คัน · เสร็จรอรับ ${done.length} คัน`]
  const counts = Object.entries(JOB_OPEN_STATUS).map(([k, l]) => [l, open.filter(j => j.status === k).length]).filter(([, n]) => n)
  if (counts.length) lines.push('  ' + counts.map(([l, n]) => `${l} ${n}`).join(' · '))
  if (done.length) {
    lines.push('', '🚗 เสร็จแล้วรอลูกค้ามารับ:')
    done.slice(0, max).forEach(({ j, days }) => lines.push(`  - ${String(j.custName || '').trim() || 'ลูกค้า'}${j.plate ? ` (${j.plate})` : ''}${days == null ? '' : days <= 0 ? ' · เสร็จวันนี้' : ` · เสร็จมา ${days} วัน`}${j.lineReadySent ? ' · แจ้ง LINE แล้ว' : ''}`))
    if (done.length > max) lines.push(`  - …และอีก ${done.length - max} คัน`)
  }
  const parts = open.filter(j => j.status === 'waiting_parts')
  if (parts.length) {
    lines.push('', '📦 รออะไหล่:')
    parts.slice(0, max).forEach(j => lines.push(`  - ${String(j.custName || '').trim() || 'ลูกค้า'}${j.plate ? ` (${j.plate})` : ''}${j.techName ? ` · ช่าง ${j.techName}` : ''}`))
    if (parts.length > max) lines.push(`  - …และอีก ${parts.length - max} คัน`)
  }
  return lines.join('\n')
}
