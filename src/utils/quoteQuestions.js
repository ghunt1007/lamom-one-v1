// (v1.0.1073) ถามเรื่องใบเสนอราคา: "ใบเสนอราคาค้างอยู่กี่ใบ" / "ใบเสนอราคาไหนใกล้หมดอายุ" / "ใบเสนอราคาที่ยังไม่ได้ส่ง"
// → LAMI สรุปทันทีว่าใบไหนต้องทำอะไรต่อ (ยังไม่ส่ง · ส่งแล้วรอคำตอบ · ใกล้หมดอายุ · ยอมรับแล้วแต่ยังไม่ทำใบจอง) · ฟังก์ชันล้วน ทดสอบได้
import { dmy } from './format.js'

const INTENT = /ใบเสนอ|ใบเสนอราคา|quotation|quote/i
// คำสั่งสร้างใบใหม่ ไม่ใช่คำถาม → ให้ตัวสั่งงานจัดการ
const COMMAND = /สร้าง|ออกใบ|ทำใบ|เปิดใบใหม่|ทำให้|ช่วยทำ|ส่งให้/

export function maybeQuoteQuestion(q) {
  const s = String(q || '').trim()
  return s.length >= 5 && s.length <= 80 && INTENT.test(s) && !COMMAND.test(s)
}

// 'expiring' = ถามเฉพาะใบใกล้หมดอายุ · 'unsent' = ยังไม่ส่ง · 'waiting' = รอคำตอบ · 'book' = ยอมรับแล้วรอจอง · 'all' = สรุปทั้งหมด
export function parseQuoteSpec(q) {
  if (!maybeQuoteQuestion(q)) return null
  const s = String(q)
  if (/ใกล้หมด|หมดอายุ|จะหมด|หมดเขต/.test(s)) return { focus: 'expiring' }
  if (/ยังไม่ส่ง|ยังไม่ได้ส่ง|ร่าง/.test(s)) return { focus: 'unsent' }
  if (/รอ(คำ)?ตอบ|ยังไม่ตอบ|ตามผล|ต้องตาม|ส่งแล้ว/.test(s)) return { focus: 'waiting' }
  if (/ยอมรับ|ตกลง|ทำใบจอง|ยังไม่จอง/.test(s)) return { focus: 'book' }
  return { focus: 'all' }
}

function dayDiff(a, b) {
  const t = d => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10))
  if (!/^\d{4}-\d{2}-\d{2}/.test(a || '') || !/^\d{4}-\d{2}-\d{2}/.test(b || '')) return null
  return Math.round((t(b) - t(a)) / 86400000)
}

const OPEN = ['draft', 'sent']

// แบ่งกลุ่มใบเสนอราคาที่ต้องทำต่อ (ใบที่ลบแล้ว/ปฏิเสธ/หมดอายุถูกข้าม)
export function quoteStats({ quotes = [], today }) {
  const live = quotes.filter(q => q && !q.deleted)
  const open = live.filter(q => OPEN.includes(q.status))
  const left = q => dayDiff(today, String(q.validUntil || '').slice(0, 10))
  const notExpired = q => { const d = left(q); return d == null || d >= 0 }
  const byOld = (a, b) => String(a.sentDate || a.createdDate || '').localeCompare(String(b.sentDate || b.createdDate || ''))
  const unsent = open.filter(q => q.status === 'draft' && notExpired(q)).sort(byOld)
  const waiting = open.filter(q => q.status === 'sent' && notExpired(q)).map(q => ({ ...q, _days: dayDiff(String(q.sentDate || q.createdDate || '').slice(0, 10), today) })).sort(byOld)
  const expiring = open.filter(q => { const d = left(q); return d != null && d >= 0 && d <= 7 }).map(q => ({ ...q, _left: left(q) })).sort((a, b) => a._left - b._left)
  const expired = open.filter(q => !notExpired(q))
  const toBook = live.filter(q => q.status === 'accepted' && !q.bookingId).sort(byOld)
  const openValue = [...unsent, ...waiting].reduce((s, q) => s + (Number(q.finalPrice) || 0), 0)
  return { total: live.length, unsent, waiting, expiring, expired, toBook, openValue }
}

const baht = n => Math.round(n).toLocaleString('en-US')
const who = q => [q.customerName || 'ลูกค้า', q.vehicleLabel ? String(q.vehicleLabel).trim() : ''].filter(Boolean).join(' · ')
const MAX = 5
function list(rows, fmt) {
  const out = rows.slice(0, MAX).map(q => '• ' + fmt(q))
  if (rows.length > MAX) out.push(`…และอีก ${rows.length - MAX} ใบ`)
  return out
}

export function quoteBriefText(st, spec = { focus: 'all' }) {
  const f = spec.focus || 'all'
  const lines = []
  const sec = (key, title, rows, fmt, empty) => {
    if (f !== 'all' && f !== key) return
    if (!rows.length) { if (f === key) lines.push(empty); return }
    if (lines.length) lines.push('')
    lines.push(`${title} (${rows.length} ใบ)`, ...list(rows, fmt))
  }
  if (!st.total) return '📄 ยังไม่มีใบเสนอราคาเลย — ถาม LAMI ราคารุ่นที่ลูกค้าสนใจ แล้วกด "📄 ทำใบเสนอราคารุ่นนี้" ได้ทันที'
  sec('book', '✅ ลูกค้ายอมรับแล้ว แต่ยังไม่ทำใบจอง', st.toBook, q => `${who(q)} — กด "📝 จองเลย" ไม่ต้องกรอกซ้ำ`, '✅ ใบที่ลูกค้ายอมรับ ทำใบจองครบแล้ว')
  sec('expiring', '⏳ ใกล้หมดอายุใน 7 วัน', st.expiring, q => `${who(q)} — ${q._left === 0 ? 'หมดวันนี้' : `เหลือ ${q._left} วัน`} (ถึง ${dmy(q.validUntil)})`, '⏳ ไม่มีใบเสนอราคาที่ใกล้หมดอายุใน 7 วัน')
  sec('waiting', '📞 ส่งแล้ว รอคำตอบ', st.waiting, q => `${who(q)}${q._days != null && q._days > 0 ? ` — ส่งไป ${q._days} วัน` : ''}`, '📞 ไม่มีใบที่ส่งแล้วรอคำตอบ')
  sec('unsent', '📝 ทำไว้แต่ยังไม่ได้ส่ง', st.unsent, q => `${who(q)} — กด "📤 ส่ง LINE"`, '📝 ส่งครบทุกใบแล้ว ไม่มีใบค้างส่ง')
  if (f === 'all') {
    if (!lines.length) lines.push('👍 ไม่มีใบเสนอราคาค้าง ทุกใบปิดหรือทำใบจองแล้ว')
    if (st.openValue) lines.push('', `💰 มูลค่าที่ยังเปิดอยู่ ${baht(st.openValue)} บาท`)
    if (st.expired.length) lines.push(`⌛ หมดอายุแล้ว ${st.expired.length} ใบ — ถ้าลูกค้ายังสนใจ ทำใบใหม่ด้วยราคา/โปรล่าสุด`)
  }
  return ['📄 ใบเสนอราคาที่ต้องทำต่อ', '', ...lines].join('\n')
}

export function quoteFollowUps(st, spec = { focus: 'all' }) {
  const out = []
  if (spec.focus !== 'expiring' && st.expiring.length) out.push('ใบเสนอราคาไหนใกล้หมดอายุ')
  if (spec.focus !== 'waiting' && st.waiting.length) out.push('ใบเสนอราคาที่ส่งแล้วรอคำตอบ')
  out.push('โปรเดือนนี้มีอะไรบ้าง')
  return out.slice(0, 3)
}

// ลิงก์ไปหน้าใบเสนอราคาพร้อมตัวกรองสถานะที่ตรงกับคำถาม
export function quotePageQuery(st, spec = { focus: 'all' }) {
  const m = { unsent: 'draft', waiting: 'sent', book: 'accepted', expiring: 'sent' }
  if (spec.focus !== 'all') return m[spec.focus] || ''
  if (st.toBook.length) return 'accepted'
  if (st.waiting.length) return 'sent'
  if (st.unsent.length) return 'draft'
  return ''
}

// (v1.0.1074) งานวันนี้: ลูกค้ายอมรับแล้วแต่ยังไม่ทำใบจอง + ใบที่เปิดอยู่และหมดอายุภายใน 3 วัน (ไม่ซ้ำกัน)
export function quoteDueToday(quotes = [], today, days = 3) {
  const st = quoteStats({ quotes, today })
  const book = st.toBook.map(q => ({ ...q, _why: 'book' }))
  const exp = st.expiring.filter(q => q._left <= days).map(q => ({ ...q, _why: 'expiring' }))
  return [...book, ...exp]
}
