// (v1.0.1449) ข้อมูลที่ทำให้ "คาดการณ์/ข้อมูลช่วยขาย" แม่นขึ้น — 90 วันล่าสุด กรอกครบกี่ % · ต่ำกว่า 5 รายการ = ไม่แสดงหัวข้อนั้น
// ไม่ใช่การจับผิดเซลส์ (ไม่มีชื่อ) — บอกเจ้าของว่าช่องไหนถ้ากรอกเพิ่ม การ์ดไหนจะคำนวณได้ · ฟังก์ชันล้วน
import { toDate } from './format.js'
import { isCancelled } from './bookingStatus.js'

const DAY = 86400000
const ANS = /^(?:คุยแล้ว|ขอคิด|ไม่สนใจ|ไม่รับสาย)/
const num = v => { const n = Number(String(v ?? '').replace(/[,฿\s]/g, '')); return Number.isFinite(n) && n > 0 }

export function dataReadiness({ customers = [], bookings = [], logs = [], testDrives = [], jobs = [], now = Date.now(), money = false, min = 5 } = {}) {
  const from = now - 90 * DAY
  const inWin = v => { const t = toDate(v)?.getTime(); return t != null && t >= from && t <= now }
  const items = []
  const add = (key, label, list, ok, helps, how) => {
    if (list.length < min) return
    const done = list.filter(ok).length
    items.push({ key, label, n: list.length, done, rate: done / list.length, helps, how })
  }
  const live = a => (a || []).filter(x => x && !x.deleted)
  add('model', 'ลูกค้าใหม่ที่ใส่ "รุ่นที่สนใจ"', live(customers).filter(c => inWin(c.createdAt)), c => String(c.interestedModel || '').trim(),
    'รุ่นที่คนสนใจแต่ปิดยาก · คาดการณ์สั่งรถ', 'ใส่รุ่นตอนเพิ่มลีด หรือพิมพ์ใน LAMI "สมชายสนใจ S07"')
  add('calls', 'การโทรที่บันทึกผล (ผ่านปุ่ม 📞)', live(logs).filter(l => l.type === 'call' && inWin(l.createdAt)), l => ANS.test(String(l.note || '').trim()),
    'โทรช่วงไหนลูกค้ารับสาย · ลูกค้าคนนี้รับสายช่วงไหน', 'กดโทรจากแอป วางสายแล้วเลือกผล (คุยแล้ว/ไม่รับสาย…)')
  add('td', 'ทดลองขับที่ปิดผลแล้ว', live(testDrives).filter(t => inWin(t.date) && toDate(t.date).getTime() < now - DAY && !/cancel/.test(String(t.status || ''))),
    t => ['done', 'completed', 'no_show', 'noshow'].includes(t.status), 'ทดลองขับแล้วจองจริงกี่ %', 'หลังลูกค้าขับเสร็จ กด "เสร็จแล้ว" ในหน้าทดลองขับ')
  add('jobs', 'งานซ่อมที่กดเสร็จในระบบ', live(jobs).filter(j => inWin(j.createdAt) && ['done', 'delivered'].includes(j.status)), j => !!j.doneAt,
    'งานซ่อมปกติเสร็จในกี่วัน · งานที่ค้างนานกว่าปกติ', 'เปลี่ยนสถานะงานเป็น "เสร็จ" ตอนซ่อมเสร็จจริง (ระบบจดเวลาให้)')
  // (v1.0.1461) ใบจองที่ถอน — ต้องมีวันถอน ถึงจะรู้ว่าใบจองค้างนานแค่ไหนแล้วมักถอน
  add('cancel', 'ใบจองที่ถอน และใส่ "วันที่ถอน"', live(bookings).filter(b => isCancelled(b) && inWin(b.cancelDate || b.updatedAt || b.bookingDate)), b => !!toDate(b.cancelDate),
    'ใบจองไหนเสี่ยงถอน (ค้างนานแค่ไหนแล้วมักถอน)', 'ตอนเปลี่ยนสถานะเป็น "ถอนจอง" ใส่วันที่ถอนในช่องวันถอนของ Sheet/ใบจอง')
  if (money) {
    const bk = live(bookings).filter(b => !isCancelled(b) && inWin(b.bookingDate || b.createdAt))
    add('price', 'ใบจองที่ใส่ "ราคารถ"', bk, b => num(b.price), 'ส่วนลดเพิ่มเติมเฉลี่ย/เกินปกติ', 'ใส่ราคารถและส่วนลดเพิ่มเติมใน Sheet/ใบจอง')
  }
  return items.sort((a, b) => a.rate - b.rate)
}
