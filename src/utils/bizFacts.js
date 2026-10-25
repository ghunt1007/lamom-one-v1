// ตัวเลขธุรกิจจากใบจอง/ลูกค้าจริง สำหรับให้ LAMI ตอบคำถามผู้จัดการ เช่น "ใครขายเก่งสุดเดือนนี้" "Lead จากไหนปิดได้ดีสุด"
// ฟังก์ชันล้วน ไม่แตะฐานข้อมูล · ไม่มีชื่อ/เบอร์ลูกค้า (มีแค่ชื่อเซลส์ ซึ่งเป็นข้อมูลภายในทีม)
import { DELIVERED_STATUSES } from './deliveryIncome.js'
import { bangkokDate } from './myDay.js'

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
  return {
    'ใบจองเดือนนี้ (จากระบบจองรถ)': `จอง ${booked(ym).length} ใบ (เดือนก่อน ${booked(pm).length}) · ส่งมอบ/ตัดตัวเลข ${delivered(ym).length} คัน (เดือนก่อน ${delivered(pm).length})${cancelled ? ` · ถอนจองเดือนนี้ ${cancelled}` : ''}`,
    ...(perLine ? { 'ผลงานรายเซลส์เดือนนี้': perLine } : {}),
    ...(srcLine ? { 'Lead 90 วันล่าสุดแยกตามที่มา': srcLine } : {}),
    'ลูกค้าในแต่ละขั้น': `Lead ${stage('lead')} · Prospect ${stage('pp')} · จองแล้ว ${stage('booking')} · เสียดีล ${cs.filter(c => c.isLost).length}`,
  }
}
