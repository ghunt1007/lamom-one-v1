// ตัวเลขธุรกิจจากใบจอง/ลูกค้าจริง สำหรับให้ LAMI ตอบคำถามผู้จัดการ เช่น "ใครขายเก่งสุดเดือนนี้" "Lead จากไหนปิดได้ดีสุด"
// ฟังก์ชันล้วน ไม่แตะฐานข้อมูล · ไม่มีชื่อ/เบอร์ลูกค้า (มีแค่ชื่อเซลส์ ซึ่งเป็นข้อมูลภายในทีม)
import { DELIVERED_STATUSES } from './deliveryIncome.js'
import { bangkokDate } from './myDay.js'
import { classifyLostReason, LOST_REASON_LABELS } from './lostReason.js'
import { stockAgeDays } from './stockAge.js'

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
  // ใบจองที่ยังค้าง (ยังไม่ส่งมอบ/ไม่ถอน) แยกตามสถานะ + ค้างนานสุดกี่วัน — ให้ตอบ "ตอนนี้มีใบจองค้างอะไรบ้าง ติดตรงไหน"
  const DAY = 86400000, t0 = Date.parse(today + 'T00:00:00Z')
  const open = bk.filter(b => !CANCELLED.includes(b.status) && !DELIVERED_STATUSES.includes(b.status))
  const byStatus = {}
  open.forEach(b => {
    const k = b.status || 'ไม่ระบุสถานะ'
    const d = Date.parse(String(b.bookingDate || bangkokDate(b.createdAt) || '').slice(0, 10) + 'T00:00:00Z')
    const o = (byStatus[k] ||= { n: 0, max: 0 }); o.n++
    if (!isNaN(d)) o.max = Math.max(o.max, Math.round((t0 - d) / DAY))
  })
  const openLine = Object.entries(byStatus).sort((a, b) => b[1].n - a[1].n)
    .map(([k, v]) => `${k} ${v.n}${v.max ? ` (นานสุด ${v.max} วัน)` : ''}`).join(' · ')
  // แนวโน้ม 6 เดือน (จอง/ส่งมอบ) — ให้ตอบ "ยอดขายช่วงนี้ขึ้นหรือลง"
  const months = [ym]; for (let i = 0; i < 5; i++) months.unshift(prevMonth(months[0]))
  const trendLine = months.map(m => `${m} จอง ${booked(m).length}/ส่งมอบ ${delivered(m).length}`).join(' · ')
  // รุ่นที่ถูกจองมากสุด 90 วันล่าสุด — ให้ตอบ "รุ่นไหนขายดี ควรสั่งรถรุ่นไหนเพิ่ม"
  const byModel = {}
  bk.filter(b => !CANCELLED.includes(b.status) && String(b.bookingDate || bangkokDate(b.createdAt)).slice(0, 10) >= since).forEach(b => {
    const m = String(b.model || '').trim(); if (!m) return
    const k = b.brand && !m.toUpperCase().includes(String(b.brand).toUpperCase()) ? `${b.brand} ${m}` : m
    byModel[k] = (byModel[k] || 0) + 1
  })
  const modelLine = Object.entries(byModel).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, n]) => `${k} ${n}`).join(' · ')
  // กำหนดส่งมอบ: เลยกำหนดแล้วยังไม่ส่ง + ภายใน 7 วันข้างหน้า — ให้ตอบ "สัปดาห์นี้ต้องส่งรถกี่คัน มีคันไหนเลยกำหนด"
  const in7 = new Date(t0 + 7 * DAY).toISOString().slice(0, 10)
  const due = open.map(b => String(b.deliveryDate || '').slice(0, 10)).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))
  const late = due.filter(d => d < today).length, soon = due.filter(d => d >= today && d <= in7).length
  // จังหวะเดือนนี้ → คาดการณ์สิ้นเดือน + เป้าแนะนำ (เฉลี่ย 3 เดือนก่อน +10%) — ให้ตอบ "เดือนนี้จะได้กี่คัน ถึงเป้าไหม"
  const dayN = +today.slice(8, 10), dim = new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7), 0)).getUTCDate()
  const nowB = booked(ym).length, p3 = [pm, prevMonth(pm), prevMonth(prevMonth(pm))]
  const avg3 = p3.reduce((a, m) => a + booked(m).length, 0) / 3, goal = Math.max(1, Math.ceil(avg3 * 1.1))
  const paceLine = `ผ่านไป ${dayN}/${dim} วัน จองแล้ว ${nowB} ใบ → ถ้ารักษาจังหวะนี้ สิ้นเดือนน่าจะได้ราว ${Math.round(nowB / dayN * dim)} ใบ`
    + (avg3 > 0 ? ` · เป้าแนะนำ ${goal} ใบ (เฉลี่ย 3 เดือนก่อน ${avg3.toFixed(1)} +10%) ${nowB >= goal ? 'ถึงเป้าแล้ว' : `ขาดอีก ${goal - nowB} ใบ`}` : '')
  return {
    ...(late || soon ? { 'กำหนดส่งมอบ (ใบจองที่ยังไม่ส่ง)': `เลยกำหนดแล้ว ${late} คัน · ภายใน 7 วันข้างหน้า ${soon} คัน` } : {}),
    ...(modelLine ? { 'รุ่นที่ถูกจองมากสุด 90 วันล่าสุด': modelLine } : {}),
    'ใบจองเดือนนี้ (จากระบบจองรถ)': `จอง ${booked(ym).length} ใบ (เดือนก่อน ${booked(pm).length}) · ส่งมอบ/ตัดตัวเลข ${delivered(ym).length} คัน (เดือนก่อน ${delivered(pm).length})${cancelled ? ` · ถอนจองเดือนนี้ ${cancelled}` : ''}`,
    ...(perLine ? { 'ผลงานรายเซลส์เดือนนี้': perLine } : {}),
    ...(openLine ? { [`ใบจองที่ยังค้าง ${open.length} ใบ แยกตามสถานะ`]: openLine } : {}),
    'คาดการณ์ยอดจองสิ้นเดือน': paceLine,
    'แนวโน้ม 6 เดือน (จอง/ส่งมอบ)': trendLine,
    ...(srcLine ? { 'Lead 90 วันล่าสุดแยกตามที่มา': srcLine } : {}),
    ...(lostLine ? { 'เหตุผลเสียดีล 90 วันล่าสุด': lostLine } : {}),
    'ลูกค้าในแต่ละขั้น': `Lead ${stage('lead')} · Prospect ${stage('pp')} · จองแล้ว ${stage('booking')} · เสียดีล ${cs.filter(c => c.isLost).length}`,
  }
}

// รถพร้อมขายในสต็อก แยกรุ่น/สี (ไม่มีเลขตัวถัง) — ให้ LAMI/AI ตอบได้ว่า "S07 สีขาวมีพร้อมส่งไหม"
// ส่ง today มาด้วย จะได้รายการรถที่ค้างสต็อก 60 วันขึ้นไปเพิ่ม — ให้ตอบ "คันไหนค้างนาน ควรเร่งขาย"
export function stockFacts(vehicles = [], today) {
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
  const out = { 'รถพร้อมขายในสต็อก (แยกรุ่น/สี)': `${ready.length} คัน${line ? ` — ${line}` : ''}${transit ? ` · กำลังขนส่งมา ${transit} คัน` : ''}` }
  if (today) {
    const aged = ready.map(v => ({ v, d: stockAgeDays(v.arrivedAt, today) })).filter(x => x.d >= 60).sort((a, b) => b.d - a.d)
    if (aged.length) out['รถพร้อมขายค้างสต็อก 60 วันขึ้นไป'] = `${aged.length} คัน — ` + aged.slice(0, 8)
      .map(({ v, d }) => `${[v.brand, v.model].filter(Boolean).join(' ')} ${v.color || ''} ${d} วัน`.replace(/\s+/g, ' ')).join(' · ')
  }
  return out
}

// นัดทดลองขับ 7 วันข้างหน้า + ลองขับแล้วจองกี่ % (90 วันล่าสุด) — ให้ LAMI ตอบ "สัปดาห์นี้มีใครมาลองขับ" ได้
// ใช้แค่ชื่อต้น ไม่ส่งเบอร์โทรออกไป
export function testDriveFacts(tds = [], today) {
  const DAY = 86400000
  const add = n => new Date(Date.parse(today + 'T00:00:00Z') + n * DAY).toISOString().slice(0, 10)
  const live = tds.filter(t => t && !t.deleted && t.date)
  const until = add(7), since = add(-90)
  const up = live.filter(t => t.date >= today && t.date <= until && !['done', 'cancelled', 'no_show'].includes(t.status))
    .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))
  const first = n => String(n || 'ลูกค้า').trim().split(/\s+/)[0]
  const list = up.slice(0, 10).map(t => `${t.date === today ? 'วันนี้' : t.date} ${t.time || ''} · ${first(t.customerName)} · ${t.model || 'ไม่ระบุรุ่น'}${t.staff ? ` · ${t.staff}` : ''}`.replace(/\s+·/g, ' ·')).join('\n')
  const done = live.filter(t => t.date >= since && t.date <= today && t.status === 'done')
  const booked = done.filter(t => t.result === 'booked').length
  const out = { 'นัดทดลองขับ 7 วันข้างหน้า': up.length ? `${up.length} นัด\n${list}` : 'ยังไม่มีนัด' }
  if (done.length) out['ทดลองขับแล้วจอง (90 วันล่าสุด)'] = `ลองขับ ${done.length} ครั้ง จองแล้ว ${booked} ครั้ง (${Math.round(booked / done.length * 100)}%)`
  return out
}
