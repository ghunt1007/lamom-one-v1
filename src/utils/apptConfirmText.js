// (v1.0.1373) ข้อความยืนยันนัดเข้าศูนย์บริการที่พนักงานกดส่งเอง — วันนัดเป็น "พรุ่งนี้" ใช้ข้อความเดียวกับระบบเตือนอัตโนมัติ
// (workers/apptRemind.js remindText) ไม่งั้นบอกวันที่ตรงๆ (DD/MM/YYYY พ.ศ. · เวลา 24 ชม.)
import { remindText } from '../../workers/apptRemind.js'
import { carLabel } from './carLabel.js'

const dmyTh = d => d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${Number(d.slice(0, 4)) + 543}` : ''
const firstName = n => { const w = String(n || '').trim().replace(/^คุณ/, '').split(/\s+/)[0]; return w && !/^ลูกค้า/.test(w) ? w : '' }
const hhmm = v => /^\d{1,2}:\d{2}/.test(String(v || '')) ? String(v).slice(0, 5) : ''

export function addDaysYmd(ymd, n) {
  const d = new Date(ymd + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10)
}

const LABEL = { service: 'นัดเข้าศูนย์บริการ', testdrive: 'นัดทดลองขับ', showroom: 'นัดเข้าโชว์รูม', delivery: 'นัดรับรถ' }
const ICON = { service: ' 🔧', testdrive: ' 🚗', showroom: '', delivery: ' 🚗' }

// kind: service | testdrive | showroom · a: { date, time, name, what }
export function apptText(kind, { date = '', time = '', name = '', what = '' } = {}, today) {
  const d = String(date || '').slice(0, 10)
  const n = firstName(name), t = hhmm(time), w = String(what || '').trim()
  if (d && d === addDaysYmd(today, 1)) return remindText(kind, { name: n, date: d, time: t, what: w })
  const when = d === today ? `วันนี้ ${dmyTh(d)}` : `วันที่ ${dmyTh(d)}`
  return `${n ? `สวัสดีครับคุณ${n}` : 'สวัสดีครับ'} ขอยืนยัน${LABEL[kind] || 'นัดหมาย'}${w ? ` (${w})` : ''} ${when}${t ? ` เวลา ${t} น.` : ''} ครับ${ICON[kind] || ''}\nถ้าต้องการเลื่อนนัด ตอบกลับข้อความนี้ได้เลยครับ`
}

export function serviceApptText(a, today) {
  const what = [a?.type, a?.model, a?.plate].map(x => String(x || '').trim()).filter(Boolean).join(' · ')
  return apptText('service', { date: a?.date, time: a?.time, name: a?.custName, what }, today)
}

export const testDriveApptText = (t, today) => apptText('testdrive', { date: t?.date, time: t?.time, name: t?.customerName, what: t?.model }, today)

export const showroomApptText = (a, today) => apptText('showroom', { date: a?.date, time: a?.time, name: a?.custName, what: a?.purpose || a?.interestedIn }, today)

// (v1.0.1377) นัดรับรถ (ใบจอง deliveryDate/deliveryTime) — พรุ่งนี้ใช้ข้อความเดียวกับระบบเตือนอัตโนมัติ
export const deliveryApptText = (b, today) => apptText('delivery', { date: b?.deliveryDate, time: b?.deliveryTime, name: b?.custName || b?.customerName, what: carLabel(b?.brand, b?.model || b?.vehicleModel) }, today)
