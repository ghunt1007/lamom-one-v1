// (v1.0.1380) ต่ออายุประกัน — สถานะคำนวณจากวันหมดอายุจริง (เดิมใช้ค่าที่บันทึกไว้ตอนเพิ่ม = "ต่อแล้ว" ตลอดไป
// กรมธรรม์ใกล้หมด/หมดแล้วจึงไม่เคยขึ้นเตือน) · ยกเลิก = ยกเลิกเสมอ
export const RENEW_WARN_DAYS = 60

export function daysToExpiry(expiryDate, today) {
  const e = String(expiryDate || '').slice(0, 10), t = String(today || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e) || !/^\d{4}-\d{2}-\d{2}$/.test(t)) return null
  return Math.round((Date.parse(e + 'T00:00:00Z') - Date.parse(t + 'T00:00:00Z')) / 86400000)
}

export function renewalStatus(p, today) {
  if (p?.status === 'cancelled') return 'cancelled'
  const d = daysToExpiry(p?.expiryDate, today)
  if (d == null) return p?.status || 'renewed'
  if (d < 0) return 'expired'
  if (d <= RENEW_WARN_DAYS) return 'upcoming'
  return 'renewed'
}

const TYPE_TH = { class1: 'ชั้น 1', class2: 'ชั้น 2', class2plus: 'ชั้น 2+', class3: 'ชั้น 3', class3plus: 'ชั้น 3+', compulsory: 'พ.ร.บ.' }
const dmyTh = d => `${d.slice(8, 10)}/${d.slice(5, 7)}/${Number(d.slice(0, 4)) + 543}`
const firstName = n => { const w = String(n || '').trim().replace(/^คุณ/, '').split(/\s+/)[0]; return w && !/^ลูกค้า/.test(w) ? w : '' }

// ข้อความแจ้งลูกค้าว่าประกันใกล้หมด/หมดแล้ว — พนักงานกดส่งเอง
export function renewalNoticeText(p, today) {
  const n = firstName(p?.customerName)
  const d = daysToExpiry(p?.expiryDate, today)
  const car = [p?.vehicleModel, p?.vehiclePlate].map(x => String(x || '').trim()).filter(Boolean).join(' ')
  const kind = TYPE_TH[p?.type] ? `ประกัน${TYPE_TH[p.type]}` : 'ประกันรถ'
  const when = d == null ? '' : d < 0 ? `หมดอายุแล้วเมื่อ ${dmyTh(String(p.expiryDate).slice(0, 10))}` : `จะหมดอายุวันที่ ${dmyTh(String(p.expiryDate).slice(0, 10))}${d <= 30 ? ` (อีก ${d} วัน)` : ''}`
  return `${n ? `สวัสดีครับคุณ${n}` : 'สวัสดีครับ'} ${kind}${car ? ` ของรถ ${car}` : ''} ${when} ครับ\nถ้าต้องการให้เราเช็กเบี้ยและต่อประกันให้ ตอบกลับข้อความนี้ได้เลยครับ 🛡`
}

// (v1.0.1381) หน้ากรมธรรม์อื่น (active/expiring/expired) — สถานะจากวันสิ้นสุดจริงเสมอ · ยกเลิก = ยกเลิก · ไม่มีวันที่ = ค่าเดิม
export function policyStatusByDate(p, endField, today, warnDays = 30) {
  if (p?.status === 'cancelled') return 'cancelled'
  const d = daysToExpiry(p?.[endField], today)
  if (d == null) return p?.status || 'active'
  return d < 0 ? 'expired' : d <= warnDays ? 'expiring' : 'active'
}
