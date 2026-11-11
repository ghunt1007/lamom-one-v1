// (v1.0.1058) "ค่าคอมเดือนนี้เท่าไหร่" / "รายได้เดือนนี้" / "ค่าคอมเดือนก่อน" → LAMI รวมรายได้ที่กรอกจริงตอนส่งมอบให้ทันที (ไม่ต้องรอ AI)
// ใช้สูตรเดียวกับหน้ารายได้รายเซลส์ (summarizeSalesIncome) ตัวเลขจึงตรงกัน · ฟังก์ชันล้วน ทดสอบได้
import { summarizeSalesIncome } from './salesIncome.js'
import { shiftYm, periodLabel } from './dashStats.js'

const baht = n => '฿' + Math.round(n).toLocaleString('en-US')
const PREV = /เดือน(?:ก่อน|ที่แล้ว)/

export function isIncomeQuestion(q) {
  const s = String(q || '').trim().replace(/[?？]+$/, '').trim()
  if (!s || s.length > 60) return false
  if (!/ค่าคอม|คอมมิชชั่น|คอมมิชชัน|คอมมิสชั่น|รายได้/.test(s)) return false
  if (/โทร|นัด|ลูกค้า|ลีด|ทำไม|ยังไง|อย่างไร|เพราะ|กติกา|สูตร|คิดจาก|กรอก|บันทึก|จด |แก้|ยังไม่|ใครบ้าง|คันไหน|ปีนี้|ปีก่อน|ไตรมาส|วันนี้|พรุ่งนี้|เมื่อวาน|เดือนหน้า|ดาวน์|ผ่อน|ราคา|\d/.test(s)) return false
  return true
}

// bookings = ใบจองในขอบเขตที่ผู้ใช้มองเห็น · prev = ถามถึงเดือนก่อน
export function incomeStats({ bookings = [], today, prev = false }) {
  const ym = prev ? shiftYm(today.slice(0, 7), -1) : today.slice(0, 7)
  const cur = summarizeSalesIncome(bookings, ym), before = summarizeSalesIncome(bookings, shiftYm(ym, -1))
  return { ym, label: periodLabel(ym), isPrev: prev, total: cur.total, rows: cur.rows.filter(r => r.delivered), before: before.total }
}

export const wantsPrevMonth = q => PREV.test(String(q || ''))

export function incomeBriefText(s, { scope = '' } = {}) {
  const t = s.total
  const lines = [`💰 รายได้${s.isPrev ? 'เดือนก่อน' : 'เดือนนี้'} ${s.label}${scope ? ` — ${scope}` : ''}`]
  if (!t.delivered) {
    lines.push(`ยังไม่มีรถส่งมอบ${s.isPrev ? 'ในเดือนนั้น' : 'ในเดือนนี้'} จึงยังไม่มีรายได้`)
    if (s.before.delivered) lines.push(`เดือนก่อนหน้า: ส่งมอบ ${s.before.delivered} คัน · รายได้รวม ${baht(s.before.income)}`)
    if (!s.isPrev) lines.push('💡 รายได้นับเมื่อส่งมอบ/ตัดตัวเลขแล้ว — เร่งใบจองที่รถพร้อมให้ส่งมอบ')
    return lines.join('\n')
  }
  const d = t.income - s.before.income
  lines.push(`🚗 ส่งมอบ ${t.delivered} คัน · รายได้รวม ${baht(t.income)}`)
  lines.push(`• คอมเซลส์ ${baht(t.com70)} · คอมไฟแนนซ์ ${baht(t.comFinance)} · มาร์จิ้นคงเหลือ ${baht(t.marginLeft)}`)
  lines.push(`📅 เดือนก่อนหน้า ${s.before.delivered} คัน · ${baht(s.before.income)}${s.before.delivered ? ` (${d === 0 ? 'เท่าเดิม' : (d > 0 ? '▲' : '▼') + baht(Math.abs(d))})` : ''}`)
  if (t.missing) lines.push(`⚠️ ยังไม่กรอกรายได้ ${t.missing} คัน — ตัวเลขรวมยังไม่ครบ`)
  if (s.rows.length > 1) {
    lines.push('🏆 รายเซลส์')
    s.rows.slice(0, 8).forEach((r, i) => lines.push(`${i + 1}. ${r.name} — ${r.delivered} คัน · ${baht(r.income)}${r.missing ? ` (ยังไม่กรอก ${r.missing})` : ''}`))
    if (s.rows.length > 8) lines.push(`…และอีก ${s.rows.length - 8} คน`)
  }
  lines.push(t.missing ? '💡 กรอกรายได้คันที่ค้างในหน้ารายได้รายเซลส์ ตัวเลขจะครบทันที' : `💡 เฉลี่ยคันละ ${baht(t.income / t.delivered)}`)
  return lines.join('\n')
}

export function incomeFollowUps(s) {
  return [s.isPrev ? 'ค่าคอมเดือนนี้เท่าไหร่' : 'ค่าคอมเดือนก่อนเท่าไหร่', 'ยอดเดือนนี้เป็นไง', s.isPrev ? '' : 'ใครรอส่งมอบ'].filter(Boolean)
}
