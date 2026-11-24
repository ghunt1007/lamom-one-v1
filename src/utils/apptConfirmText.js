// (v1.0.1373) ข้อความยืนยันนัดเข้าศูนย์บริการที่พนักงานกดส่งเอง — วันนัดเป็น "พรุ่งนี้" ใช้ข้อความเดียวกับระบบเตือนอัตโนมัติ
// (workers/apptRemind.js remindText) ไม่งั้นบอกวันที่ตรงๆ (DD/MM/YYYY พ.ศ. · เวลา 24 ชม.)
import { remindText } from '../../workers/apptRemind.js'

const dmyTh = d => d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${Number(d.slice(0, 4)) + 543}` : ''
const firstName = n => { const w = String(n || '').trim().replace(/^คุณ/, '').split(/\s+/)[0]; return w && !/^ลูกค้า/.test(w) ? w : '' }
const hhmm = v => /^\d{1,2}:\d{2}/.test(String(v || '')) ? String(v).slice(0, 5) : ''

export function addDaysYmd(ymd, n) {
  const d = new Date(ymd + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10)
}

export function serviceApptText(a, today) {
  const date = String(a?.date || '').slice(0, 10)
  const name = firstName(a?.custName), time = hhmm(a?.time)
  const what = [a?.type, a?.model, a?.plate].map(x => String(x || '').trim()).filter(Boolean).join(' · ')
  if (date && date === addDaysYmd(today, 1)) return remindText('service', { name, date, time, what })
  const when = date === today ? `วันนี้ ${dmyTh(date)}` : `วันที่ ${dmyTh(date)}`
  return `${name ? `สวัสดีครับคุณ${name}` : 'สวัสดีครับ'} ขอยืนยันนัดเข้าศูนย์บริการ${what ? ` (${what})` : ''} ${when}${time ? ` เวลา ${time} น.` : ''} ครับ 🔧\nถ้าต้องการเลื่อนนัด ตอบกลับข้อความนี้ได้เลยครับ`
}
