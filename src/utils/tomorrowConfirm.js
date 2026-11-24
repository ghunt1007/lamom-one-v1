// (v1.0.1379) ส่งยืนยันนัด "พรุ่งนี้" ทีเดียวทั้งหมด จากปฏิทินงาน — พนักงานกดเอง (ไม่ส่งอัตโนมัติ)
// ผูก LINE = LINE · ไม่ผูก = SMS · เบอร์เดียวมีหลายนัดวันเดียวกัน ส่งข้อความเดียว (นัดแรก) แต่จดทุกนัด
// จด lineRemindFor = วันนัด → ระบบเตือนอัตโนมัติ 17:00 (ถ้าเปิดสวิตช์) ไม่ส่งซ้ำ · จด confirmSentFor กันกดส่งซ้ำ
import { serviceApptText, testDriveApptText, showroomApptText, deliveryApptText, addDaysYmd } from './apptConfirmText.js'
import { phoneKey } from './marketingOptOut.js'

export const CONFIRM_KINDS = {
  appt:      { col: 'appointments',         label: 'นัดโชว์รูม',   text: showroomApptText, skip: ['cancelled', 'no_show', 'noshow', 'arrived', 'done', 'completed'] },
  testdrive: { col: 'test_drives',          label: 'ทดลองขับ',     text: testDriveApptText, skip: ['cancelled', 'no_show', 'noshow', 'in_progress', 'done', 'completed'] },
  service:   { col: 'service_appointments', label: 'เข้าศูนย์',     text: serviceApptText, skip: ['cancelled', 'noshow', 'no_show', 'inservice', 'done', 'completed'] },
  delivery:  { col: 'bookings',             label: 'รับรถ',        text: deliveryApptText, skip: ['ส่งมอบแล้ว', 'ถอนจอง', 'ยกเลิก'] },
}

// items = รายการจาก workCalendar.buildWorkItems · คืน [{ key, kind, col, id, phone, name, time, text, also:[{col,id}] }]
export function pickTomorrowConfirms(items = [], today) {
  const tomorrow = addDaysYmd(today, 1)
  const byPhone = new Map()
  const sorted = [...(items || [])].sort((a, b) => String(a.time || '99').localeCompare(String(b.time || '99')))
  for (const it of sorted) {
    const k = CONFIRM_KINDS[it?.kind]
    const r = it?.rec
    if (!k || !r || r.deleted || it.done || it.date !== tomorrow) continue
    if (k.skip.includes(r.status)) continue
    if (r.lineRemindFor === tomorrow || r.confirmSentFor === tomorrow) continue
    const pk = phoneKey(it.phone || r.phone)
    if (pk.length < 9) continue
    const ref = { col: k.col, id: r.id }
    if (byPhone.has(pk)) { byPhone.get(pk).also.push(ref); continue }
    byPhone.set(pk, {
      key: it.key, kind: it.kind, label: k.label, col: k.col, id: r.id, phone: it.phone || r.phone, time: it.time || '',
      name: r.custName || r.customerName || 'ลูกค้า', text: k.text(r, today), also: [],
    })
  }
  return [...byPhone.values()]
}

// ข้อมูลที่จดหลังส่งสำเร็จ — ใบจองใช้ชื่อฟิลด์ของปฏิทินส่งมอบ (deliveryConfirmSentAt/Via)
export function confirmPatch(col, via, tomorrow, nowIso = new Date().toISOString()) {
  const base = { lineRemindFor: tomorrow, confirmSentFor: tomorrow }
  return col === 'bookings'
    ? { ...base, deliveryConfirmSentAt: nowIso, deliveryConfirmVia: via }
    : { ...base, confirmSentAt: nowIso, confirmSentVia: via }
}
