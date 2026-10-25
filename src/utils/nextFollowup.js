// เดาวันนัดครั้งถัดไปจาก "ผลการติดต่อ" ที่เซลส์พิมพ์ (ไม่ใช้ AI — เร็ว ไม่เสียเงิน ไม่ส่งข้อมูลออก)
// คืน { skip: true } ถ้าลูกค้าไม่ไปต่อ (ไม่สนใจ/ซื้อที่อื่นแล้ว) มิฉะนั้น { dueDate: 'YYYY-MM-DD', why }
const DAY = 86400000
const iso = (today, n) => new Date(Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10)) + n * DAY).toISOString().slice(0, 10)
const WEEKDAYS = [['อาทิตย์', 0], ['จันทร์', 1], ['อังคาร', 2], ['พุธ', 3], ['พฤหัส', 4], ['ศุกร์', 5], ['เสาร์', 6]]

export function suggestNextDue(text, today) {
  const t = String(text || '')
  if (/ไม่สนใจ|ซื้อ(ที่|ร้าน|คัน)?อื่น|ซื้อไปแล้ว|ยกเลิก|ไม่ต้องติดต่อ|เลิกติดต่อ/.test(t)) return { skip: true }
  if (/วันนี้|เย็นนี้|บ่ายนี้/.test(t)) return { dueDate: today, why: 'ติดตามวันนี้' }
  if (/มะรืน/.test(t)) return { dueDate: iso(today, 2), why: 'ติดตามมะรืนนี้' }
  if (/พรุ่งนี้/.test(t)) return { dueDate: iso(today, 1), why: 'ติดตามพรุ่งนี้' }
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
