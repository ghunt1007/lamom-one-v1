// (v1.0.981) "X อยู่ตรงไหน / หาไม่เจอ" — ตอบทันทีจากเมนูจริงของแอป (ไม่ต้องรอ AI และไม่มีทางตอบผิดหน้า)
// พร้อมปุ่มเปิดหน้านั้น · ฟังก์ชันล้วน เทสได้
import { menuKeywords } from './menuSearch.js'
import { ESSENTIALS } from './navSimple.js'

const WHERE_RE = /อยู่ตรงไหน|อยู่ไหน|อยู่ที่ไหน|หาไม่เจอ|หาไม่พบ|ไม่เจอ|เมนูไหน|หน้าไหน|เข้ายังไง|เข้าตรงไหน|ดูได้ที่ไหน|ดูตรงไหน|ทำตรงไหน|กดตรงไหน|ไปที่ไหน|where/i
export const isWhereQuestion = q => WHERE_RE.test(String(q || ''))

// คำที่ทีมใช้จริง → หน้า (สำคัญกว่าคำค้นทั่วไป เพราะชื่อเมนูไม่ได้มีทุกคำ)
const ALIASES = [
  ['/crm/programs', 'โปร โปรโมชั่น แคมเปญ ดอกเบี้ย เรท เงินพิเศษ รางวัล โบนัส มาร์จิ้น ค่าบริหาร ซับซิดี้ ของแถม ส่วนลด'],
  ['/crm/my-day', 'งานวันนี้ งานของฉัน วันนี้ทำอะไร งานค้าง'],
  ['/calendar', 'ปฏิทิน นัด ตารางงาน'],
  ['/crm/customers', 'ลูกค้า ลีด lead รายชื่อลูกค้า'],
  ['/crm/bookings', 'ใบจอง จองรถ booking ถ่ายบัตร สแกนบัตร บัตรประชาชน'],
  ['/crm/quotation', 'ใบเสนอราคา เสนอราคา quotation'],
  ['/marketing/events', 'บูธ ออกบูธ อีเวนต์ มอเตอร์โชว์ motor expo งานแสดงรถ'],
  ['/marketing/channels', 'โซเชียล เฟซบุ๊ก facebook เพจ ไลน์ line oa ไอจี instagram tiktok ติ๊กต็อก แชต google maps รีวิว ค่าโฆษณา ยิงแอด บูสต์ บูสโพสต์ งบโฆษณา'],
  ['/analytics/sales-metrics', 'ตัวชี้วัด kpi เป้า quota forecast gp gmv conversion aov pipeline ltv churn cac ต้นทุนหาลูกค้า'],
  ['/crm/sales-income', 'รายได้เซลส์ ค่าคอม รายได้รายคน เป้าส่งมอบ'],
  ['/crm/showroom', 'นัดเข้าโชว์รูม นัดโชว์รูม ลูกค้านัดมาโชว์รูม'],
  ['/service/appointment', 'นัดเข้าศูนย์ นัดซ่อม เช็คระยะ เช็กระยะ นัดศูนย์บริการ'],
  ['/finance/refund', 'ยืนยันยอดโอน ยอดโอน ตรวจยอด สลิป คืนเงินจอง คืนมัดจำ ถอนจอง'],
  ['/finance/tracker', 'ติดตามไฟแนนซ์ ไฟแนนซ์อนุมัติ ผลไฟแนนซ์ ยื่นไฟแนนซ์'],
  ['/finance/loan-calc', 'คำนวณค่างวด ค่างวด ผ่อน'],
  ['/dms/stock', 'สต็อก รถในสต็อก รถเหลือ'],
  ['/dms/delivery-calendar', 'ส่งมอบ ปฏิทินส่งมอบ'],
  ['/settings/daily-report', 'รายงาน 18:00 รายงานไลน์ รายงานประจำวัน'],
]
const ESSENTIAL_PATHS = new Set(ESSENTIALS.flatMap(g => g.paths))
const norm = s => String(s || '').toLowerCase().replace(/\s+/g, '')

// nav = NAV จาก data/navMenu.js → [{ label, path, group }] หน้าที่ตรงที่สุดก่อน (หน้าเมนูหลักชนะเมื่อคะแนนเท่ากัน)
export function findPages(question, nav, max = 3) {
  const q = norm(question).replace(/อยู่ตรงไหน|อยู่ไหน|อยู่ที่ไหน|หาไม่เจอ|หาไม่พบ|ไม่เจอ|เมนูไหน|หน้าไหน|ครับ|ค่ะ|คะ|ฉัน|ผม|หน่อย|ของ|ได้/g, '')
  if (!q) return []
  const alias = new Map(ALIASES)
  const items = []
  ;(nav || []).forEach(g => (g.items || []).forEach(it => items.push({ ...it, group: g.group })))
  const scored = items.map(it => {
    const words = [...String(alias.get(it.path) || '').split(/\s+/), ...String(it.label || '').split(/[\s&/(),·]+/)]
      .map(norm).filter(w => w.length >= 2)
    let score = 0
    words.forEach(w => { if (q.includes(w)) score += w.length >= 4 ? 2 : 1 })
    if (!score) { const hay = norm(menuKeywords(it.labelEn || '', '')); if (hay && q.length >= 3 && hay.includes(q)) score = 1 }
    return { it, score: score + (score && ESSENTIAL_PATHS.has(it.path) ? 0.5 : 0) }
  }).filter(x => x.score > 0)
  const seen = new Set()
  return scored.sort((a, b) => b.score - a.score)
    .filter(x => !seen.has(x.it.path) && seen.add(x.it.path))
    .slice(0, max)
    .map(({ it }) => ({ label: `${it.icon || ''} ${it.label}`.trim(), path: it.path, group: it.group }))
}

export function whereAnswer(pages) {
  if (!pages.length) return ''
  const [p, ...rest] = pages
  return `อยู่ที่เมนู **${p.group} › ${p.label}** ครับ กดปุ่มด้านล่างเพื่อเปิดได้เลย` +
    (rest.length ? `\nหน้าที่เกี่ยวข้อง: ${rest.map(r => `${r.label} (${r.group})`).join(', ')}` : '') +
    '\n(ค้นหาเมนูเองได้ที่ช่อง 🔍 บนแถบเมนูซ้าย)'
}
