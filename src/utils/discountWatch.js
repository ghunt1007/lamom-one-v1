// (v1.0.1443) ส่วนลดเพิ่มเติม (นอกแคมเปญ) — เฉลี่ยต่อรุ่น/ต่อเซลส์ 6 เดือนล่าสุด + ใบจองเดือนนี้ที่ให้ส่วนลดสูงกว่าปกติของรุ่นนั้น
// ช่วยเจ้าของเห็น "ส่วนลดรั่ว" ก่อนกลายเป็นมาร์จิ้นหาย · ตัวอย่างไม่พอ (รุ่นละ < 5 ใบ) = ไม่เทียบ ไม่เดา · ฟังก์ชันล้วน
import { modelKey } from './orderNeeds.js'
import { isCancelled } from './bookingStatus.js'

export const money = v => { const n = Number(String(v ?? '').replace(/[,฿\s]/g, '')); return Number.isFinite(n) && n > 0 ? n : 0 }
const shiftDays = (ymd, n) => new Date(Date.parse(ymd + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10)
const q = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]

export function discountWatch(bookings = [], today, { days = 183, min = 5 } = {}) {
  const from = shiftDays(today, -days), ym = String(today).slice(0, 7)
  const rows = (bookings || []).filter(b => b && !b.deleted && !isCancelled(b) && money(b.price) > 0)
    .map(b => ({ b, d: String(b.bookingDate || '').slice(0, 10), key: modelKey(b), extra: money(Math.abs(Number(String(b.extraDiscount ?? '').replace(/[,฿\s]/g, '')) || 0)) }))
    .filter(r => r.d >= from && r.d <= today && r.key)
  // ไม่มีใบไหนใส่ส่วนลดเลย = แยกไม่ออกว่า "ไม่ให้" หรือ "ไม่ได้กรอก" → ไม่สรุป (ไม่โชว์ ฿0 หลอกๆ)
  if (rows.length < min || !rows.some(r => r.extra > 0)) return null
  const byModel = new Map()
  for (const r of rows) (byModel.get(r.key) || byModel.set(r.key, []).get(r.key)).push(r)
  const models = [...byModel.entries()].filter(([, rs]) => rs.length >= min).map(([key, rs]) => {
    const v = rs.map(r => r.extra).sort((a, b) => a - b)
    return { key, label: String(rs[0].b.model || key).trim(), n: rs.length, avg: v.reduce((a, x) => a + x, 0) / v.length, median: q(v, 0.5), p80: q(v, 0.8), share: v.filter(x => x > 0).length / v.length }
  }).sort((a, b) => b.avg - a.avg)
  const stat = new Map(models.map(m => [m.key, m]))
  // เกินปกติ = มากกว่าทั้ง 80% ของรุ่นนั้น และ 1.5 เท่าของค่ากลาง (หรือรุ่นนั้นปกติไม่ให้เลย)
  const flags = rows.filter(r => r.d.startsWith(ym) && r.extra > 0 && stat.has(r.key)).filter(r => {
    const m = stat.get(r.key)
    return r.extra > m.p80 && r.extra > m.median * 1.5
  }).map(r => ({ b: r.b, extra: r.extra, typical: stat.get(r.key).median, label: stat.get(r.key).label })).sort((a, b) => (b.extra - b.typical) - (a.extra - a.typical))
  const sellers = new Map()
  for (const r of rows) { const k = String(r.b.salesName || '').trim(); if (!k) continue; const s = sellers.get(k) || { name: k, n: 0, sum: 0 }; s.n++; s.sum += r.extra; sellers.set(k, s) }
  const bySeller = [...sellers.values()].filter(s => s.n >= min).map(s => ({ ...s, avg: s.sum / s.n })).sort((a, b) => b.avg - a.avg)
  const all = rows.map(r => r.extra)
  return { n: rows.length, avg: all.reduce((a, x) => a + x, 0) / all.length, share: all.filter(x => x > 0).length / all.length, models, flags, bySeller }
}

const baht = v => '฿' + Math.round(v).toLocaleString('en-US')
export function discountAnswer(bookings, { today }) {
  const w = discountWatch(bookings, today)
  if (!w || !w.models.length) return { n: 0, text: '💸 ยังสรุปส่วนลดไม่ได้ — ต้องมีใบจองที่ใส่ "ราคารถ" และช่อง "ส่วนลดเพิ่มเติม" ใน 6 เดือนล่าสุด รุ่นละอย่างน้อย 5 ใบ' }
  const lines = [`💸 ส่วนลดเพิ่มเติม (นอกแคมเปญ) 6 เดือนล่าสุด — เฉลี่ย ${baht(w.avg)}/คัน · ให้ส่วนลด ${Math.round(w.share * 100)}% ของใบจอง (${w.n} ใบ)`,
    'รายรุ่น:', ...w.models.slice(0, 6).map(m => `• ${m.label} เฉลี่ย ${baht(m.avg)} · ปกติไม่เกิน ${baht(m.p80)} (${m.n} ใบ)`)]
  if (w.bySeller.length > 1) lines.push('รายเซลส์:', ...w.bySeller.slice(0, 6).map(s => `• ${s.name} เฉลี่ย ${baht(s.avg)}/คัน (${s.n} ใบ)`))
  if (w.flags.length) lines.push(`⚠️ เดือนนี้ให้ส่วนลดสูงกว่าปกติ ${w.flags.length} ใบ:`, ...w.flags.slice(0, 5).map(f => `• ${String(f.b.custName || 'ลูกค้า').trim()} · ${f.label} · ${baht(f.extra)} (ปกติ ${baht(f.typical)})${f.b.salesName ? ' · 👤 ' + f.b.salesName : ''}`))
  else lines.push('✅ เดือนนี้ยังไม่มีใบจองที่ให้ส่วนลดสูงกว่าปกติ')
  return { n: w.flags.length, text: lines.join('\n') }
}
