// (v1.0.1051) "ยอดเดือนนี้เป็นไง" / "ถึงเป้าหรือยัง" / "เดือนนี้ขายได้กี่คัน" / "ใครขายดีสุด" → LAMI สรุปยอดเดือนนี้จากใบจองจริงทันที (ไม่ต้องรอ AI)
// ใช้สูตรเดียวกับหน้าภาพรวม (dashStats) ตัวเลขจึงตรงกัน · เทียบช่วงเดียวกันของเดือนก่อน · ฟังก์ชันล้วน ทดสอบได้
import { rangeStats, shiftYm, periodLabel, openBookings, salesBoard } from './dashStats.js'

const FIN = ['รอผลไฟแนนซ์', 'จัดไฟแนนซ์ก่อนจอง']

export function isMonthQuestion(q) {
  const s = String(q || '').trim().replace(/[?？]+$/, '').trim()
  if (!s || s.length > 60) return false
  if (/โทร|นัด|ดาวน์|ผ่อน|ราคา|ดอกเบี้ย|คงค้าง|วันนี้|พรุ่งนี้|ปีนี้|ไตรมาส|เดือน(?:ก่อน|ที่แล้ว|หน้า)|ทำไม|(?<!เป็น)ยังไง|อย่างไร|เพราะ|ค่าคอม|รายได้|กำไร|ค่าใช้จ่าย|สต็อก|สต๊อก/.test(s)) return false
  if (/ใครขายดี|ใครขายเก่ง|อันดับ\s*(?:เซลส์|ยอด|การขาย)|ยอดใคร(?:สูง|ดี|เยอะ)/.test(s)) return true
  if (/ใครบ้าง|มีใคร|คนไหน|รายชื่อ|^ใคร/.test(s)) return false
  if (/เดือนนี้/.test(s) && /ยอด|ขาย|ส่งมอบ|จอง|เป้า|สรุป/.test(s)) return true
  if (/(?:ถึง|ทะลุ|ขาด|เหลือ)[^\n]{0,12}เป้า|เป้า[^\n]{0,14}(?:เหลือ|ขาด|เท่าไ|กี่|หรือยัง|รึยัง|ยัง$)/.test(s)) return true
  return /^(?:สรุป|ดู|ขอดู|ขอ)?\s*ยอด\s*(?:ขาย|ส่งมอบ|จอง)?\s*(?:ของ)?(?:ฉัน|ผม|หนู|เรา)?\s*(?:ตอนนี้|ล่าสุด)?\s*(?:เป็นไง|เป็นยังไง|เท่าไหร่|เท่าไร|ถึงไหนแล้ว)?\s*(?:บ้าง|แล้ว)?$/.test(s)
}

// bookings = ใบจองในขอบเขตที่ผู้ใช้มองเห็น · target = เป้าส่งมอบ (คัน) ของขอบเขตนั้น (0 = ยังไม่ตั้ง)
export function monthStats({ bookings = [], today, target = 0 }) {
  const rows = bookings.filter(b => b && !b.deleted)
  const ym = today.slice(0, 7), day = Number(today.slice(8, 10))
  const cur = rangeStats(rows, [ym]), prev = rangeStats(rows, [shiftYm(ym, -1)], day)
  const open = openBookings(rows)
  const [y, m] = ym.split('-').map(Number)
  const board = salesBoard(rows, [ym]).filter(r => r.delivered || r.booked)
  return {
    ym, label: periodLabel(ym), day,
    delivered: cur.delivered, booked: cur.booked, withdrawn: cur.withdrawn,
    prevDelivered: prev.delivered, prevBooked: prev.booked,
    open: open.length,
    waitDeliv: open.filter(b => b.status === 'รอส่งมอบ').length,
    fin: open.filter(b => FIN.includes(b.status)).length,
    target: Number(target) || 0, left: Math.max(0, (Number(target) || 0) - cur.delivered),
    daysLeft: new Date(Date.UTC(y, m, 0)).getUTCDate() - day,
    board: board.length > 1 ? board.slice(0, 3) : [],
  }
}

const diff = (a, b) => a === b ? 'เท่าเดิม' : a > b ? `▲${a - b}` : `▼${b - a}`

export function monthBriefText(s, { scope = '' } = {}) {
  const lines = [`📊 ยอดเดือนนี้ ${s.label}${scope ? ` — ${scope}` : ''}`]
  lines.push(`🚗 ส่งมอบแล้ว ${s.delivered} คัน · เดือนก่อนช่วงเดียวกัน ${s.prevDelivered} คัน (${diff(s.delivered, s.prevDelivered)})`)
  lines.push(`📝 จองใหม่ ${s.booked} ใบ${s.withdrawn ? ` · ถอน ${s.withdrawn} ใบ` : ''} · เดือนก่อนช่วงเดียวกัน ${s.prevBooked} ใบ (${diff(s.booked, s.prevBooked)})`)
  if (s.open) lines.push(`📦 ใบจองที่ยังไม่ส่งมอบ ${s.open} ใบ${s.waitDeliv ? ` · รถพร้อมรอส่งมอบ ${s.waitDeliv} คัน` : ''}${s.fin ? ` · รอไฟแนนซ์ ${s.fin} ใบ` : ''}`)
  if (s.target) lines.push(`🎯 เป้าส่งมอบ ${s.target} คัน · ทำได้ ${Math.round(s.delivered / s.target * 100)}%${s.left ? ` · ขาดอีก ${s.left} คัน` : ' · ถึงเป้าแล้ว 🎉'} · เหลือ ${s.daysLeft} วัน`)
  else lines.push('🎯 ยังไม่ได้ตั้งเป้าส่งมอบเดือนนี้ (ตั้งได้ที่หน้ารายได้รายเซลส์)')
  if (s.board.length) lines.push('🏆 อันดับเดือนนี้', ...s.board.map((r, i) => `${i + 1}. ${r.name} — ส่งมอบ ${r.delivered} · จอง ${r.booked}`))
  const tip = s.target && !s.left ? 'ถึงเป้าแล้ว — ดันใบจองที่รอไฟแนนซ์/รอรถให้เป็นยอดเดือนหน้า'
    : s.target && s.waitDeliv >= s.left ? `รถพร้อมรอส่งมอบมี ${s.waitDeliv} คัน พอถึงเป้า — นัดวันส่งมอบให้ครบ`
    : s.target ? `ต้องส่งมอบอีก ${s.left} คันใน ${s.daysLeft} วัน${s.waitDeliv ? ` — มีรถพร้อมรอส่งมอบ ${s.waitDeliv} คัน` : ''}${s.fin ? ` · เร่งไฟแนนซ์ ${s.fin} ใบ` : ''}`
    : s.waitDeliv ? `นัดส่งมอบรถที่พร้อมแล้ว ${s.waitDeliv} คันให้ทันสิ้นเดือน`
    : s.fin ? `ตามผลไฟแนนซ์ ${s.fin} ใบ` : ''
  if (tip) lines.push(`💡 ${tip}`)
  return lines.join('\n')
}

// ปุ่มถามต่อ — เป็นประโยคที่ LAMI ตอบเป็นรายชื่อได้ทันที
export function monthFollowUps(s) {
  return [
    s.waitDeliv ? 'ใครรอส่งมอบ' : '',
    s.fin ? 'ใครรอไฟแนนซ์' : '',
    s.open ? 'ใบจองไหนค้างนานสุด' : '',
    'ลูกค้า hot มีใครบ้าง',
  ].filter(Boolean)
}
