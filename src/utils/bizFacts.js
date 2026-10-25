// ตัวเลขธุรกิจจากใบจอง/ลูกค้าจริง สำหรับให้ LAMI ตอบคำถามผู้จัดการ เช่น "ใครขายเก่งสุดเดือนนี้" "Lead จากไหนปิดได้ดีสุด"
// ฟังก์ชันล้วน ไม่แตะฐานข้อมูล · ไม่มีชื่อ/เบอร์ลูกค้า (มีแค่ชื่อเซลส์ ซึ่งเป็นข้อมูลภายในทีม)
import { DELIVERED_STATUSES } from './deliveryIncome.js'
import { bangkokDate } from './myDay.js'
import { classifyLostReason, LOST_REASON_LABELS } from './lostReason.js'

const CANCELLED = ['ถอนจอง', 'ยกเลิก']
const SOURCE_TH = { facebook: 'Facebook', line: 'LINE', tiktok: 'TikTok', 'walk-in': 'Walk-in', referral: 'แนะนำ', google: 'Google', website: 'เว็บไซต์', phone: 'โทรเข้า', other: 'อื่นๆ' }

const prevMonth = ym => { const [y, m] = ym.split('-').map(Number); return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}` }
const deliveredMonth = b => DELIVERED_STATUSES.includes(b.status) ? String(b.actualDeliveryDate || b.cutDate || b.deliveryDate || '').slice(0, 7) : ''

export function businessFacts({ customers = [], bookings = [] }, today) {
  const ym = today.slice(0, 7), pm = prevMonth(ym)
  const bk = bookings.filter(b => b && !b.deleted)
  const booked = m => bk.filter(b => String(b.bookingDate || bangkokDate(b.createdAt)).slice(0, 7) === m && !CANCELLED.includes(b.status))
  const delivered = m => bk.filter(b => deliveredMonth(b) === m)
  const cancelled = bk.filter(b => CANCELLED.includes(b.status) && String(b.cancelDate || b.updatedAt || '').slice(0, 7) === ym).length

  // รายเซลส์เดือนนี้: จอง/ส่งมอบ
  const per = {}
  booked(ym).forEach(b => { const n = (b.salesName || 'ไม่ระบุ').trim(); (per[n] ||= { b: 0, d: 0 }).b++ })
  delivered(ym).forEach(b => { const n = (b.salesName || 'ไม่ระบุ').trim(); (per[n] ||= { b: 0, d: 0 }).d++ })
  const perLine = Object.entries(per).sort((a, b) => (b[1].d - a[1].d) || (b[1].b - a[1].b)).slice(0, 12)
    .map(([n, v]) => `${n} จอง ${v.b} ส่งมอบ ${v.d}`).join(' · ')

  // Lead เดือนนี้ตามที่มา และอัตราที่กลายเป็นใบจอง (นับจากลูกค้าที่เข้ามา 90 วันล่าสุด)
  const cs = customers.filter(c => c && !c.deleted)
  const since = new Date(Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10) - 90)).toISOString().slice(0, 10)
  const src = {}
  cs.filter(c => bangkokDate(c.createdAt) >= since).forEach(c => {
    const k = SOURCE_TH[c.source] || c.source || 'ไม่ระบุ'
    const o = (src[k] ||= { n: 0, won: 0 }); o.n++
    if (['booking', 'delivered'].includes(c.stage)) o.won++
  })
  const srcLine = Object.entries(src).sort((a, b) => b[1].n - a[1].n).slice(0, 8)
    .map(([k, v]) => `${k} ${v.n} ราย ปิดเป็นใบจอง ${v.won} (${Math.round(v.won / v.n * 100)}%)`).join(' · ')

  const stage = s => cs.filter(c => c.stage === s && !c.isLost).length
  // เหตุผลเสียดีล 90 วันล่าสุด (ตามวันที่กดเสียดีล) — ให้ LAMI ตอบได้ว่า "ทำไมเสียดีล ควรแก้อะไร"
  const lostWhy = {}
  cs.filter(c => c.isLost && (bangkokDate(c.lostAt) || bangkokDate(c.updatedAt)) >= since).forEach(c => {
    const k = LOST_REASON_LABELS[classifyLostReason(c.lostReason)] || 'อื่นๆ'
    lostWhy[k] = (lostWhy[k] || 0) + 1
  })
  const lostLine = Object.entries(lostWhy).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(' · ')
  return {
    'ใบจองเดือนนี้ (จากระบบจองรถ)': `จอง ${booked(ym).length} ใบ (เดือนก่อน ${booked(pm).length}) · ส่งมอบ/ตัดตัวเลข ${delivered(ym).length} คัน (เดือนก่อน ${delivered(pm).length})${cancelled ? ` · ถอนจองเดือนนี้ ${cancelled}` : ''}`,
    ...(perLine ? { 'ผลงานรายเซลส์เดือนนี้': perLine } : {}),
    ...(srcLine ? { 'Lead 90 วันล่าสุดแยกตามที่มา': srcLine } : {}),
    ...(lostLine ? { 'เหตุผลเสียดีล 90 วันล่าสุด': lostLine } : {}),
    'ลูกค้าในแต่ละขั้น': `Lead ${stage('lead')} · Prospect ${stage('pp')} · จองแล้ว ${stage('booking')} · เสียดีล ${cs.filter(c => c.isLost).length}`,
  }
}

// รถพร้อมขายในสต็อก แยกรุ่น/สี (ไม่มีเลขตัวถัง) — ให้ LAMI/AI ตอบได้ว่า "S07 สีขาวมีพร้อมส่งไหม"
export function stockFacts(vehicles = []) {
  const live = vehicles.filter(v => v && !v.deleted)
  const ready = live.filter(v => v.status === 'available')
  const transit = live.filter(v => v.status === 'transit').length
  const by = {}
  ready.forEach(v => {
    const m = [v.brand && !String(v.model || '').toLowerCase().includes(String(v.brand).toLowerCase()) ? v.brand : '', v.model, v.variant].filter(Boolean).join(' ').trim() || 'ไม่ระบุรุ่น'
    const c = String(v.color || '').trim() || 'ไม่ระบุสี'
    ;((by[m] ||= {})[c] = (by[m][c] || 0) + 1)
  })
  const line = Object.entries(by).sort((a, b) => a[0].localeCompare(b[0])).slice(0, 20)
    .map(([m, cs]) => `${m}: ${Object.entries(cs).map(([c, n]) => `${c} ${n}`).join(', ')}`).join(' · ')
  return { 'รถพร้อมขายในสต็อก (แยกรุ่น/สี)': `${ready.length} คัน${line ? ` — ${line}` : ''}${transit ? ` · กำลังขนส่งมา ${transit} คัน` : ''}` }
}
