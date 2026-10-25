// เดาวันนัดครั้งถัดไปจาก "ผลการติดต่อ" ที่เซลส์พิมพ์ (ไม่ใช้ AI — เร็ว ไม่เสียเงิน ไม่ส่งข้อมูลออก)
// คืน { skip: true } ถ้าลูกค้าไม่ไปต่อ (ไม่สนใจ/ซื้อที่อื่นแล้ว) มิฉะนั้น { dueDate: 'YYYY-MM-DD', why }
const DAY = 86400000
const iso = (today, n) => new Date(Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10)) + n * DAY).toISOString().slice(0, 10)
const WEEKDAYS = [['อาทิตย์', 0], ['จันทร์', 1], ['อังคาร', 2], ['พุธ', 3], ['พฤหัส', 4], ['ศุกร์', 5], ['เสาร์', 6]]

// วันที่ระบุตรงๆ: "วันที่ 5", "5 พ.ย.", "5/11", "สิ้นเดือน", "ต้นเดือนหน้า" → วันนั้นที่จะถึง (ไม่ย้อนอดีต)
const MONTHS = [/ม\.ค|มกรา/, /ก\.พ|กุมภา/, /มี\.ค|มีนา/, /เม\.ย|เมษา/, /พ\.ค|พฤษภา/, /มิ\.ย|มิถุนา/,
  /ก\.ค|กรกฎา/, /ส\.ค|สิงหา/, /ก\.ย|กันยา/, /ต\.ค|ตุลา/, /พ\.ย|พฤศจิกา/, /ธ\.ค|ธันวา/] // ตัวย่อต้องมีจุด กันคำอย่าง "พยายาม"
const lastDay = (y, m) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
const ymd = (y, m, d) => new Date(Date.UTC(y, m, Math.min(d, lastDay(y, m)))).toISOString().slice(0, 10)

function explicitDate(t, today) {
  const y = +today.slice(0, 4), m = +today.slice(5, 7) - 1, d = +today.slice(8, 10)
  if (/ต้นเดือนหน้า/.test(t)) return { dueDate: ymd(m === 11 ? y + 1 : y, (m + 1) % 12, 1), why: 'ต้นเดือนหน้า' }
  if (/สิ้นเดือน|ปลายเดือน/.test(t)) {
    const end = ymd(y, m, 31)
    return { dueDate: end > today ? end : ymd(m === 11 ? y + 1 : y, (m + 1) % 12, 31), why: 'สิ้นเดือน' }
  }
  const withMonth = (day, mon) => {
    if (day < 1 || day > 31 || mon < 0 || mon > 11) return null
    const due = ymd(y, mon, day)
    return { dueDate: due >= today ? due : ymd(y + 1, mon, day), why: `วันที่ ${day} ตามที่ลูกค้านัด` }
  }
  const slash = t.match(/(?<!\d)(\d{1,2})\s*\/\s*(\d{1,2})(?!\d)/)
  if (slash) { const r = withMonth(+slash[1], +slash[2] - 1); if (r) return r }
  const dm = t.match(/(?<!\d)(\d{1,2})\s*([ก-๙.]{2,9})/)
  if (dm) {
    const idx = MONTHS.findIndex(re => new RegExp('^(?:' + re.source + ')').test(dm[2]))
    if (idx >= 0) { const r = withMonth(+dm[1], idx); if (r) return r }
  }
  const only = t.match(/วันที่\s*(\d{1,2})(?!\d)/)
  if (only && +only[1] >= 1 && +only[1] <= 31) {
    const day = +only[1]
    const due = day > d ? ymd(y, m, day) : ymd(m === 11 ? y + 1 : y, (m + 1) % 12, day)
    return { dueDate: due, why: `วันที่ ${day} ตามที่ลูกค้านัด` }
  }
  return null
}

export function suggestNextDue(text, today) {
  const t = String(text || '')
  if (/ไม่สนใจ|ซื้อ(ที่|ร้าน|คัน)?อื่น|ซื้อไปแล้ว|ยกเลิก|ไม่ต้องติดต่อ|เลิกติดต่อ/.test(t)) return { skip: true }
  if (/วันนี้|เย็นนี้|บ่ายนี้/.test(t)) return { dueDate: today, why: 'ติดตามวันนี้' }
  if (/มะรืน/.test(t)) return { dueDate: iso(today, 2), why: 'ติดตามมะรืนนี้' }
  if (/พรุ่งนี้/.test(t)) return { dueDate: iso(today, 1), why: 'ติดตามพรุ่งนี้' }
  const dated = explicitDate(t, today)
  if (dated) return dated
  const n = t.match(/(\d{1,2})\s*วัน/)
  if (n && +n[1] > 0 && +n[1] <= 60) return { dueDate: iso(today, +n[1]), why: `อีก ${+n[1]} วันตามที่คุยไว้` }
  if (/(สัปดาห์|อาทิตย์|วีค)หน้า/.test(t)) return { dueDate: iso(today, 7), why: 'สัปดาห์หน้า' }
  if (/เดือนหน้า/.test(t)) return { dueDate: iso(today, 30), why: 'เดือนหน้า' }
  const dow = new Date(today + 'T00:00:00Z').getUTCDay()
  for (const [name, d] of WEEKDAYS) {
    if (t.includes(name) && !(name === 'อาทิตย์' && /อาทิตย์หน้า/.test(t))) {
      const diff = ((d - dow + 7) % 7) || 7
      return { dueDate: iso(today, diff), why: `วัน${name}ที่จะถึง` }
    }
  }
  return { dueDate: iso(today, 3), why: 'ติดตามต่อใน 3 วัน' }
}
