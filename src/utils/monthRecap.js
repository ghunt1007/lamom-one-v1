// (v1.0.1406) สรุปเดือนที่แล้ว "คาดไว้ vs ได้จริง" — ขึ้นในรายงาน LINE 18:00 วันที่ 1–2 ของเดือน
// ใช้ตัวเลขคาดการณ์ที่ระบบเก็บไว้ทุกวัน (delivery_forecast_log) เทียบยอดจริงจากใบจอง · ไม่มีตัวเลขที่เก็บไว้ = ไม่เดา บอกแค่ยอดจริง
import { isCancelled, isDelivered } from './bookingStatus.js'

const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
export const thMonthLabel = ym => `${TH_MONTHS[+ym.slice(5, 7) - 1]} ${+ym.slice(0, 4) + 543}`
const prevYm = ym => { const y = +ym.slice(0, 4), m = +ym.slice(5, 7); return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}` }
const ymd = v => String(v || '').slice(0, 10)

// ภาพถ่ายของเดือน ym ที่ใกล้วันที่ target ที่สุด (เฉพาะที่มี field ที่ต้องการ)
function nearest(logs, ym, target, field) {
  return (logs || []).filter(l => l && String(l.date || '').slice(0, 7) === ym && l[field] != null && l[field] !== '')
    .reduce((best, l) => { const d = +String(l.date).slice(8, 10); return !best || Math.abs(d - target) < Math.abs(+String(best.date).slice(8, 10) - target) ? l : best }, null)
}

export function monthRecap({ bookings = [], logs = [], today = '' } = {}) {
  const day = +String(today).slice(8, 10)
  if (!day || day > 2) return null
  const pm = prevYm(today.slice(0, 7))
  const live = (bookings || []).filter(b => b && !b.deleted)
  const delivered = live.filter(b => isDelivered(b) && ymd(b.cutDate || b.actualDeliveryDate).slice(0, 7) === pm).length
  const booked = live.filter(b => !isCancelled(b) && ymd(b.bookingDate).slice(0, 7) === pm).length
  const d = nearest(logs, pm, 20, 'expected'), k = nearest(logs, pm, 20, 'bk_exp')
  const verdict = (actual, exp, lo, hi) => {
    const err = actual ? Math.round(Math.abs(exp - actual) / actual * 100) : null
    return actual >= lo && actual <= hi ? `✅ อยู่ในช่วง${err != null ? ` (คลาด ${err}%)` : ''}` : `⚠️ ${actual > hi ? 'ได้มากกว่า' : 'ได้น้อยกว่า'}ที่คาด${err != null ? ` (คลาด ${err}%)` : ''}`
  }
  return {
    ym: pm, label: thMonthLabel(pm), delivered, booked,
    dlv: d ? { day: +String(d.date).slice(8, 10), expected: Math.round(+d.expected), worst: +d.worst || 0, best: +d.best || 0, verdict: verdict(delivered, +d.expected, +d.worst || 0, +d.best || 0) } : null,
    bk: k ? { day: +String(k.date).slice(8, 10), expected: +k.bk_exp, lo: +k.bk_lo || +k.bk_exp, hi: +k.bk_hi || +k.bk_exp, verdict: verdict(booked, +k.bk_exp, +k.bk_lo || +k.bk_exp, +k.bk_hi || +k.bk_exp) } : null,
  }
}

export function monthRecapLines(r) {
  if (!r) return []
  const out = [`📋 สรุปเดือน ${r.label}: ส่งมอบ ${r.delivered} คัน · จองใหม่ ${r.booked} ใบ`]
  if (r.dlv) out.push(`  • 🚚 ส่งมอบ: คาดไว้ (วันที่ ${r.dlv.day}) ≈ ${r.dlv.expected} คัน (${r.dlv.worst}–${r.dlv.best}) → ได้จริง ${r.delivered} ${r.dlv.verdict}`)
  if (r.bk) out.push(`  • 📝 จองใหม่: คาดไว้ (วันที่ ${r.bk.day}) ≈ ${r.bk.expected} ใบ${r.bk.hi > r.bk.lo ? ` (${r.bk.lo}–${r.bk.hi})` : ''} → ได้จริง ${r.booked} ${r.bk.verdict}`)
  return out
}
