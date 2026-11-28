// (v1.0.1051) "ยอดเดือนนี้เป็นไง" / "ถึงเป้าหรือยัง" / "เดือนนี้ขายได้กี่คัน" / "ใครขายดีสุด" → LAMI สรุปยอดเดือนนี้จากใบจองจริงทันที (ไม่ต้องรอ AI)
// ใช้สูตรเดียวกับหน้าภาพรวม (dashStats) ตัวเลขจึงตรงกัน · เทียบช่วงเดียวกันของเดือนก่อน · ฟังก์ชันล้วน ทดสอบได้
import { rangeStats, shiftYm, periodLabel, openBookings, salesBoard, statRows, periodMonths, prevPeriodAnchor } from './dashStats.js'
import { carOf } from './carLabel.js'
import { bookingPace } from './bookingPace.js'
import { isCancelled } from './bookingStatus.js'

// (v1.0.1090) "รถรุ่นไหนขายดีสุดเดือนนี้" → เพิ่มอันดับรุ่นรถในสรุปยอด
export const isModelRankQuestion = q => /รุ่น|ยี่ห้อ|แบรนด์|รถอะไร|คันไหน|แบบไหน/.test(String(q || ''))
// (v1.0.1095) "เดือนนี้ขายสีอะไรดีสุด" → จัดอันดับตามสีแทนรุ่น
export const isColorRankQuestion = q => /สี\s*(?:อะไร|ไหน|ใด)|สี\s*(?:ขายดี|ยอดนิยม|ฮิต)|สีที่ขายดี/.test(String(q || ''))
const colorOf = b => String(b.color || '').trim() || 'ไม่ระบุสี'
export function modelBoard(rows, months, upToDay, keyOf = carOf) {
  const m = new Map()
  const add = (b, k) => { const n = keyOf(b) || 'ไม่ระบุรุ่น'; const r = m.get(n) || { name: n, booked: 0, delivered: 0 }; r[k]++; m.set(n, r) }
  statRows(rows, months, 'booked', upToDay).forEach(b => add(b, 'booked'))
  statRows(rows, months, 'delivered', upToDay).forEach(b => add(b, 'delivered'))
  return [...m.values()].sort((a, b) => (b.booked + b.delivered) - (a.booked + a.delivered) || b.delivered - a.delivered).slice(0, 5)
}

const FIN = ['รอผลไฟแนนซ์', 'จัดไฟแนนซ์ก่อนจอง']

export function isMonthQuestion(q) {
  const s = String(q || '').trim().replace(/[?？]+$/, '').trim()
  if (!s || s.length > 60 || /^ลูกค้า/.test(s)) return false
  // (v1.0.1412) "คาดยอดจองสิ้นเดือน" / "สิ้นเดือนจะได้ยอดจองเท่าไหร่" / "จะจองได้กี่ใบ" → สรุปเดือนนี้ (มีบรรทัด 🔮 คาดจองสิ้นเดือน)
  if (/คาด\S{0,6}\s*ยอด\s*จอง|ยอด\s*จอง.{0,14}สิ้นเดือน|สิ้นเดือน.{0,14}ยอด\s*จอง|จะ\s*จอง\s*ได้\s*กี่/.test(s) && !/เดือน(?:ก่อน|ที่แล้ว|หน้า)|ปีนี้|ใคร/.test(s)) return true
  // (v1.0.1117) "เทียบยอดเดือนนี้กับเดือนที่แล้ว" → สรุปเดือนนี้ (มีเทียบเดือนก่อนช่วงเดียวกันอยู่แล้ว)
  // (v1.0.1480) "ฉันขายได้กี่คันแล้ว" / "ส่งมอบไปกี่คันแล้ว" (ไม่ระบุช่วง = เดือนนี้)
  if (/^(?:ฉัน|ผม|หนู|เรา|ร้าน(?:เรา)?|ทีม(?:เรา)?)?\s*(?:ขาย|ส่งมอบ|ปิด(?:การขาย)?|ออกรถ)\s*(?:ได้|ไป)\s*(?:กี่คัน|เท่าไหร่|เท่าไร)\s*(?:แล้ว)?\s*(?:ครับ|ค่ะ|คะ)?$/.test(s)) return true
  // (v1.0.1471) "สีไหนขายดี" / "รุ่นไหนขายดี" / "สีอะไรคนจองเยอะ" (ไม่ระบุช่วง) → สรุปเดือนนี้พร้อมอันดับสี/รุ่น
  if ((isColorRankQuestion(s) || /รุ่น\s*(?:ไหน|อะไร)/.test(s)) && /ขายดี|ขายเยอะ|ขายได้เยอะ|ยอดนิยม|ฮิต|จอง(?:กัน)?\s*เยอะ|คนจอง|นิยม/.test(s) && !/เดือน(?:ก่อน|ที่แล้ว|หน้า)|ปี|ไตรมาส|สต็อก|สต๊อก|เหลือ|สั่ง|สนใจ|ถาม/.test(s)) return true
  // (v1.0.1469) "เดือนนี้ดีกว่าเดือนที่แล้วไหม" / "ขายดีขึ้นไหม" / "ยอดตกไหม" → สรุปเดือนนี้ (มีเทียบเดือนก่อนช่วงเดียวกัน)
  if (/เดือนนี้/.test(s) && /เดือน(?:ก่อน|ที่แล้ว)/.test(s) && /ดีกว่า|แย่กว่า|มากกว่า|น้อยกว่า|เยอะกว่า|ดีขึ้น|แย่ลง/.test(s) && !/ทำไม|กำไร|ค่าคอม|รายได้|ค่าใช้จ่าย|ลูกค้าใหม่|ลีด/.test(s)) return true
  if (/^(?:ร้าน(?:เรา)?|โชว์รูม|เรา)?\s*(?:ขาย|ยอด(?:ขาย|จอง)?)\s*(?:ได้)?\s*(?:ดีขึ้น|ตก|ลดลง|เพิ่มขึ้น|แย่ลง)\s*(?:ไหม|มั้ย|หรือเปล่า|รึเปล่า|หรือยัง|บ้าง)?$/.test(s)) return true
  if (/เทียบ/.test(s) && /เดือนนี้/.test(s) && /เดือน(?:ก่อน|ที่แล้ว)/.test(s) && /ยอด|ขาย|ส่งมอบ|จอง/.test(s) && !/กำไร|ค่าคอม|รายได้|ค่าใช้จ่าย/.test(s)) return true
  if (/โทร|นัด|ดาวน์|ผ่อน|ราคา|ดอกเบี้ย|คงค้าง|วันนี้|พรุ่งนี้|ปีนี้|ไตรมาส|เดือน(?:ก่อน|ที่แล้ว|หน้า)|ทำไม|(?<!เป็น)ยังไง|อย่างไร|เพราะ|ค่าคอม|รายได้|กำไร|ภาษี|vat|ภ\.?พ\.?\s*30|ค่าใช้จ่าย|สต็อก|สต๊อก|ถอน|อุปกรณ์|แอคเซส|ของแถม|ประกัน|กรมธรรม์|ไฟแนนซ์|อัตรา|เฉลี่ย|conversion|เปอร์เซ็นต์|%/i.test(s)) return false
  if (/ใครขายดี|ใครขายเก่ง|(?:คนไหน|ใคร)\s*ขาย(?:ดี|เก่ง|เยอะ|ได้มาก)|(?:คนไหน|ใคร)\s*ปิด(?:การขาย|ดีล|งาน|ยอด)?\s*(?:ได้)?\s*(?:มาก|เยอะ|เก่ง)|ขายดีสุด|ขายดีที่สุด|อันดับ\s*(?:เซลส์|ยอด|การขาย)|ยอดใคร(?:สูง|ดี|เยอะ)|ใคร\s*(?:ขาย)?\s*(?:เก่ง|ท็อป|นำ)\s*(?:สุด|ที่สุด)|ใคร\s*(?:เป็น|ได้)?\s*(?:ท็อป|top|อันดับ\s*(?:1|หนึ่ง))/i.test(s)) return true
  if (/ใครบ้าง|มีใคร|คนไหน|รายชื่อ|^ใคร|ใคร\s*(?:ยัง)?\s*ไม่/.test(s)) return false
  if (/เดือนนี้/.test(s) && /ยอด|ขาย|ส่งมอบ|จอง|เป้า|สรุป|ปิด(?:ได้|การขาย|ดีล)/.test(s)) return true
  if (/(?:ถึง|ทะลุ|ขาด|เหลือ)[^\n]{0,12}เป้า|เป้า[^\n]{0,14}(?:เหลือ|ขาด|เท่าไ|กี่|หรือยัง|รึยัง|ยัง$)/.test(s)) return true
  return /^(?:สรุป|ดู|ขอดู|ขอ)?\s*ยอด\s*(?:ขาย|ส่งมอบ|จอง)?\s*(?:ของ)?(?:ฉัน|ผม|หนู|เรา)?\s*(?:ตอนนี้|ล่าสุด)?\s*(?:เป็นไง|เป็นยังไง|เท่าไหร่|เท่าไร|ถึงไหนแล้ว)?\s*(?:บ้าง|แล้ว)?$/.test(s)
}

// (v1.0.1510) "สรุปยอดของสมชาย" / "ยอดขายกมล" (ไม่ระบุเดือน) → ตรวจชื่อเซลส์หลังโหลดใบจอง · ไม่เจอชื่อ = ไม่ตอบ
export function isSellerSummaryAsk(q) {
  const s = String(q || '').trim().replace(/[?？]+$/, '').trim()
  return s.length <= 40 && /^(?:สรุป|ดู|ขอดู|ขอ)?\s*ยอด\s*(?:ขาย|ส่งมอบ|จอง)?\s*(?:ของ)?\s*(?:คุณ|เซลส์|เซล|พี่|น้อง)?\s*[^\s\d]{2,}(?:\s+[^\s\d]{2,})?\s*(?:หน่อย|ที|ครับ|ค่ะ|คะ)?$/.test(s) && !/ฉัน|ผม|หนู|เรา|วันนี้|พรุ่งนี้|เมื่อวาน|ปี|ไตรมาส|สัปดาห์|อาทิตย์|รุ่น|สี|ถอน|ไฟแนนซ์/.test(s)
}

// (v1.0.1088) "ยอดเดือนนี้ของเซลส์หนึ่ง" / "สมชายขายได้กี่คันเดือนนี้" → หาชื่อเซลส์ในคำถาม (เทียบแบบไม่สนช่องว่าง)
// ชื่อเต็มตรงก่อน · ไม่เจอค่อยลองชื่อแรก (ต้องตรงคนเดียว ไม่งั้นไม่เดา)
const squash = v => String(v || '').toLowerCase().replace(/\s+/g, '')
const GENERIC_NAME = /^(?:เซลส์|เซล|คุณ|พี่|น้อง|นาย|นาง|นางสาว|sales)$/i
export function findSeller(q, names = []) {
  const s = squash(q)
  const uniq = [...new Set(names.map(n => String(n || '').trim()).filter(Boolean))]
  const full = uniq.filter(n => squash(n).length >= 3 && s.includes(squash(n))).sort((a, b) => squash(b).length - squash(a).length)
  if (full.length) return full[0]
  const first = uniq.filter(n => { const w = n.split(/\s+/)[0]; return w.length >= 2 && !GENERIC_NAME.test(w) && s.includes(squash(w)) })
  return first.length === 1 ? first[0] : ''
}

// (v1.0.1479) "S07 ขายได้กี่คันเดือนนี้" / "ยอดจอง AION V" → หารุ่นจากชื่อรุ่นในใบจองจริง (เต็ม/คำที่มีตัวเลข) · ไม่เจอ = ''
export function findModel(q, bookings = []) {
  const s = squash(q)
  const names = [...new Set(bookings.map(b => String(b?.model || '').trim()).filter(Boolean))].sort((a, b) => b.length - a.length)
  const full = names.find(m => squash(m).length >= 2 && s.includes(squash(m)))
  if (full) return full
  const part = names.find(m => m.split(/\s+/).some(w => w.length >= 2 && /\d/.test(w) && s.includes(squash(w))))
  return part ? part.split(/\s+/).find(w => w.length >= 2 && /\d/.test(w) && s.includes(squash(w))) : ''
}
export const sameModel = (b, m) => !!m && squash([b?.brand, b?.model].join(' ')).includes(squash(m))

// (v1.0.1086) "ยอดเดือนก่อนเป็นไง" / "เดือนที่แล้วขายได้กี่คัน" → สรุปเดือนก่อนทั้งเดือน (เทียบกับเดือนก่อนหน้านั้น)
const PREV = /เดือน(?:ก่อน|ที่แล้ว)/
export function isPrevMonthQuestion(q) {
  const s = String(q || '')
  return PREV.test(s) && !/เดือนนี้/.test(s) && isMonthQuestion(s.replace(new RegExp(PREV.source, 'g'), 'เดือนนี้'))
}
// วันสุดท้ายของเดือนก่อน (ใช้เป็น "วันนี้" ของการสรุปเดือนก่อน → นับครบทั้งเดือน)
export function prevMonthEnd(today) {
  return new Date(Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, 0)).toISOString().slice(0, 10)
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
    // (v1.0.1119) "ยอดขายเป็นเงิน" = ราคารถในใบจองที่ส่งมอบเดือนนี้ (ใบที่ไม่ได้ใส่ราคาแจ้งแยก ไม่เดา)
    ...(() => { const d = statRows(rows, [ym], 'delivered', day); return { deliveredValue: d.reduce((a, b) => a + (Number(b.price) || 0), 0), deliveredNoPrice: d.filter(b => !(Number(b.price) > 0)).length, bookedValue: cur.value } })(),
    waitDeliv: open.filter(b => b.status === 'รอส่งมอบ').length,
    fin: open.filter(b => FIN.includes(b.status)).length,
    target: Number(target) || 0, left: Math.max(0, (Number(target) || 0) - cur.delivered),
    daysLeft: new Date(Date.UTC(y, m, 0)).getUTCDate() - day,
    board: board.length > 1 ? board.slice(0, 3) : [],
    models: modelBoard(rows, [ym]),
    colors: modelBoard(rows, [ym], undefined, colorOf),
    // (v1.0.1110) เดือนนี้ยังไม่มีสี → ใช้ 3 เดือนล่าสุดแทน
    colors3: modelBoard(rows, [shiftYm(ym, -2), shiftYm(ym, -1), ym], undefined, colorOf),
    // (v1.0.1403) คาดจองสิ้นเดือนจากรูปแบบ 6 เดือนก่อน — ใช้เฉพาะเมื่อประวัติพอ
    pace: (() => { const p = bookingPace(rows.filter(b => !isCancelled(b)).map(b => String(b.bookingDate || '').slice(0, 10)), today); return p?.method === 'history' ? p : null })(),
  }
}

const diff = (a, b) => a === b ? 'เท่าเดิม' : a > b ? `▲${a - b}` : `▼${b - a}`

const colorLines = (s, word) => {
  const named = (s.colors || []).filter(r => r.name !== 'ไม่ระบุสี')
  const named3 = (s.colors3 || []).filter(r => r.name !== 'ไม่ระบุสี')
  if (!named.length && named3.length) return colorLinesRaw({ colors: named3 }, ' 3 เดือนล่าสุด')
  if (s.colors?.length && !named.length) return [`🎨 ใบจอง${word}ยังไม่ได้ระบุสีรถ — ใส่สีในใบจองแล้ว LAMI จะบอกสีขายดีได้`]
  return colorLinesRaw({ colors: named }, word)
}
const colorLinesRaw = (s, word) => s.colors?.length ? [`🎨 สีขายดี${word}`, ...s.colors.map((r, i) => `${i + 1}. ${r.name} — จอง ${r.booked} · ส่งมอบ ${r.delivered}`)] : [`🎨 ${word}ยังไม่มีใบจองหรือส่งมอบ`]
const modelLines = (s, word) => s.models?.length ? [`🚘 รุ่นขายดี${word}`, ...s.models.map((r, i) => `${i + 1}. ${r.name} — จอง ${r.booked} · ส่งมอบ ${r.delivered}`)] : [`🚘 ${word}ยังไม่มีใบจองหรือส่งมอบ`]

const bahtM = n => '฿' + Math.round(n).toLocaleString('en-US')
const valueLines = (s, word) => [`💵 มูลค่ารถที่ส่งมอบ${word} ${bahtM(s.deliveredValue || 0)}${s.deliveredNoPrice ? ` (ไม่นับ ${s.deliveredNoPrice} คันที่ใบจองยังไม่ใส่ราคา)` : ''}`,
  ...(s.bookedValue ? [`📝 มูลค่าใบจองใหม่${word} ${bahtM(s.bookedValue)} (ไม่รวมใบที่ถอน)`] : [])]
export function isValueQuestion(q) { return /เป็นเงิน|มูลค่า|กี่บาท|เป็นบาท|เท่าไหร่บาท/.test(String(q || '')) }
export function monthBriefText(s, { scope = '', past = false, models = false, colors = false, value = false, noTarget = false } = {}) {
  if (past) {
    const out = [`📊 ยอดเดือนก่อน ${s.label}${scope ? ` — ${scope}` : ''} (ทั้งเดือน)`,
      `🚗 ส่งมอบ ${s.delivered} คัน · เดือนก่อนหน้านั้น ${s.prevDelivered} คัน (${diff(s.delivered, s.prevDelivered)})`,
      `📝 จองใหม่ ${s.booked} ใบ${s.withdrawn ? ` · ถอน ${s.withdrawn} ใบ` : ''} · เดือนก่อนหน้านั้น ${s.prevBooked} ใบ (${diff(s.booked, s.prevBooked)})`]
    if (s.target) out.push(`🎯 เป้าส่งมอบ ${s.target} คัน · ทำได้ ${Math.round(s.delivered / s.target * 100)}%${s.left ? ` · ขาด ${s.left} คัน` : ' · ✅ ถึงเป้า'}`)
    if (value) out.push(...valueLines(s, 'เดือนนั้น'))
    if (models) out.push(...modelLines(s, 'เดือนนั้น'))
    if (colors) out.push(...colorLines(s, 'เดือนนั้น'))
    if (s.board.length) out.push('🏆 อันดับเดือนนั้น', ...s.board.map((r, i) => `${i + 1}. ${r.name} — ส่งมอบ ${r.delivered} · จอง ${r.booked}`))
    return out.join('\n')
  }
  const lines = [`📊 ยอดเดือนนี้ ${s.label}${scope ? ` — ${scope}` : ''}`]
  lines.push(`🚗 ส่งมอบแล้ว ${s.delivered} คัน · เดือนก่อนช่วงเดียวกัน ${s.prevDelivered} คัน (${diff(s.delivered, s.prevDelivered)})`)
  lines.push(`📝 จองใหม่ ${s.booked} ใบ${s.withdrawn ? ` · ถอน ${s.withdrawn} ใบ` : ''} · เดือนก่อนช่วงเดียวกัน ${s.prevBooked} ใบ (${diff(s.booked, s.prevBooked)})`)
  if (s.pace && s.daysLeft >= 2) { const e = Math.max(s.booked, s.pace.expected), hi = Math.max(e, s.pace.high), lo = Math.max(s.booked, Math.min(e, s.pace.low)); lines.push(`🔮 คาดจองสิ้นเดือน ≈ ${e} ใบ${hi > lo ? ` (${lo}–${hi})` : ''} — เดือนก่อนๆ ถึงวันนี้จองได้ราว ${Math.round(s.pace.share * 100)}% ของทั้งเดือน`) }
  if (value) lines.push(...valueLines(s, 'เดือนนี้'))
  if (s.open) lines.push(`📦 ใบจองที่ยังไม่ส่งมอบ ${s.open} ใบ${s.waitDeliv ? ` · รถพร้อมรอส่งมอบ ${s.waitDeliv} คัน` : ''}${s.fin ? ` · รอไฟแนนซ์ ${s.fin} ใบ` : ''}`)
  if (s.target) lines.push(`🎯 เป้าส่งมอบ ${s.target} คัน · ทำได้ ${Math.round(s.delivered / s.target * 100)}%${s.left ? ` · ขาดอีก ${s.left} คัน` : ' · ถึงเป้าแล้ว 🎉'} · เหลือ ${s.daysLeft} วัน`)
  else if (!noTarget) lines.push('🎯 ยังไม่ได้ตั้งเป้าส่งมอบเดือนนี้ (ตั้งได้ที่หน้ารายได้รายเซลส์)')
  if (models) lines.push(...modelLines(s, 'เดือนนี้'))
  if (colors) lines.push(...colorLines(s, 'เดือนนี้'))
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

// (v1.0.1091) "ปีนี้ขายได้กี่คัน" / "ยอดไตรมาสนี้" / "สรุปยอดปีที่แล้ว" → สรุปทั้งช่วง + รายเดือน + อันดับเซลส์/รุ่น
export function periodSpec(q) {
  const s = String(q || '').trim().replace(/[?？]+$/, '').trim()
  if (!s || s.length > 60) return null
  if (!/ยอด|ขาย|ส่งมอบ|จอง|สรุป|กี่คัน|เป้า/.test(s) || /โทร|นัด|ค่าคอม|รายได้|กำไร|ค่าใช้จ่าย|ภาษี|ผ่อน|ดาวน์/.test(s)) return null
  // (v1.0.1506) "เดือนไหนขายดีที่สุด(ปีนี้)" → สรุปทั้งปี + บอกเดือนที่ดีที่สุด
  const best = /เดือน\s*(?:ไหน|อะไร)/.test(s) && /ดี|เยอะ|มาก|สูง|สุด/.test(s)
  const period = /ไตรมาส|quarter|\bQ[1-4]\b/i.test(s) ? 'quarter' : /ปี(?:นี้|ที่แล้ว|ก่อน|\s*25\d\d|\s*20\d\d)/.test(s) || best ? 'year' : null
  if (!period) return null
  return { period, prev: new RegExp((period === 'year' ? 'ปี' : 'ไตรมาส') + '\\s*(?:ที่แล้ว|ก่อน)').test(s), ...(best ? { best: true } : {}) }
}

const TH_M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
export function periodStats({ bookings = [], today, period, prev = false }) {
  const rows = bookings.filter(b => b && !b.deleted)
  const ym = today.slice(0, 7)
  const anchor = prev ? prevPeriodAnchor(ym, period) : ym
  const months = periodMonths(anchor, period).filter(m => m <= ym)
  const before = periodMonths(prevPeriodAnchor(anchor, period), period)
  const cur = rangeStats(rows, months), old = rangeStats(rows, before)
  return {
    label: periodLabel(anchor, period), prevLabel: periodLabel(prevPeriodAnchor(anchor, period), period), partial: !prev,
    delivered: cur.delivered, booked: cur.booked, withdrawn: cur.withdrawn, prevDelivered: old.delivered, prevBooked: old.booked,
    perMonth: months.map(m => ({ m, ...rangeStats(rows, [m]) })),
    board: salesBoard(rows, months).filter(r => r.delivered || r.booked).slice(0, 3),
    models: modelBoard(rows, months).slice(0, 3),
    colors: modelBoard(rows, months, undefined, colorOf),
  }
}
export function periodBriefText(s, { scope = '', colors = false, best = false } = {}) {
  const top = best ? s.perMonth.filter(r => r.delivered || r.booked).sort((a, b) => b.delivered - a.delivered || b.booked - a.booked)[0] : null
  const lines = [`📊 ยอด${s.label}${scope ? ` — ${scope}` : ''}${s.partial ? ' (ถึงวันนี้)' : ''}`,
    ...(best ? [top ? `🏅 เดือนที่ขายดีสุด: ${TH_M[+top.m.slice(5, 7) - 1]} — ส่งมอบ ${top.delivered} คัน · จอง ${top.booked} ใบ` : `ℹ️ ${s.label} ยังไม่มีใบจองหรือการส่งมอบในระบบ จึงยังบอกเดือนที่ขายดีสุดไม่ได้`] : []),
    // (v1.0.1489) ช่วงก่อนหน้าไม่มีข้อมูลเลย (ยังไม่ได้ใช้ระบบ) → ไม่เทียบกับ 0
    ...(s.prevDelivered || s.prevBooked ? [`🚗 ส่งมอบ ${s.delivered} คัน · ${s.prevLabel} ${s.prevDelivered} คัน${s.partial ? '' : ` (${diff(s.delivered, s.prevDelivered)})`}`,
      `📝 จองใหม่ ${s.booked} ใบ${s.withdrawn ? ` · ถอน ${s.withdrawn} ใบ` : ''} · ${s.prevLabel} ${s.prevBooked} ใบ`]
      : [`🚗 ส่งมอบ ${s.delivered} คัน · 📝 จองใหม่ ${s.booked} ใบ${s.withdrawn ? ` · ถอน ${s.withdrawn} ใบ` : ''}`, `ℹ️ ${s.prevLabel} ยังไม่มีข้อมูลในระบบ จึงยังไม่เทียบ`])]
  const shown = s.perMonth.filter(r => r.delivered || r.booked)
  if (shown.length) lines.push('📅 รายเดือน', ...shown.map(r => `• ${TH_M[+r.m.slice(5, 7) - 1]} — ส่งมอบ ${r.delivered} · จอง ${r.booked}`))
  if (s.board.length) lines.push('🏆 เซลส์', ...s.board.map((r, i) => `${i + 1}. ${r.name} — ส่งมอบ ${r.delivered} · จอง ${r.booked}`))
  if (colors) lines.push(...colorLines(s, ''))
  if (s.models.length && !colors) lines.push('🚘 รุ่นขายดี', ...s.models.map((r, i) => `${i + 1}. ${r.name} — จอง ${r.booked} · ส่งมอบ ${r.delivered}`))
  if (s.partial && s.perMonth.length > 1) {
    // (v1.0.1489) เฉลี่ยเฉพาะเดือนตั้งแต่เริ่มมีข้อมูล (ไม่เอาเดือนก่อนเริ่มใช้ระบบมาหาร)
    const first = s.perMonth.findIndex(r => r.delivered || r.booked)
    const done = s.perMonth.slice(Math.max(0, first), -1), avg = done.length ? done.reduce((a, r) => a + r.delivered, 0) / done.length : 0
    if (first >= 0 && done.length && avg > 0) lines.push(`💡 เฉลี่ยส่งมอบเดือนละ ${Math.round(avg * 10) / 10} คัน${s.perMonth.at(-1).delivered < avg ? ' — เดือนนี้ยังต่ำกว่าค่าเฉลี่ย เร่งรถที่พร้อมส่ง' : ''}`)
  }
  return lines.join('\n')
}
