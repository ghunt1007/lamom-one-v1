// (v1.0.1381) คาดการณ์ "เดือนนี้จะส่งมอบ (ตัดตัวเลข) ได้กี่คัน" — ฟังก์ชันล้วน ไม่แตะฐานข้อมูล
// ใช้ร่วมกันทั้งหน้า /analytics/delivery-forecast, การ์ดบนหน้าภาพรวม และ LAMI
//
// วิธีคิด (อธิบายให้ทีมเข้าใจได้ ไม่ใช่กล่องดำ):
//  1) ส่งมอบแล้ว = ใบจองสถานะ ส่งมอบแล้ว/ตัดตัวเลขรอส่งมอบ ที่ cutDate อยู่ในเดือนนี้ (นิยามเดียวกับรายงาน LINE)
//  2) ทุกใบจองที่ยังเปิดอยู่ ได้ "โอกาสส่งมอบภายในสิ้นเดือน" (0–1) จาก
//     · ประวัติจริงของร้าน: ใบจองที่อายุเท่านี้ ในอดีตตัดตัวเลขภายในอีก N วัน (วันที่เหลือของเดือน) กี่ %
//     · ขั้นงานตอนนี้ (รถมาแล้ว/รอเบิก/รอรถ/รอไฟแนนซ์) — ขั้นท้ายๆ โอกาสสูง ขั้นต้นๆ โอกาสต่ำ
//     · วันนัดส่งมอบ (deliveryDate) — นัดไว้ในเดือนนี้ ดันโอกาสขึ้น นัดเดือนหน้า ลดลง เลยนัดแล้ว = เสี่ยง
//     · รถ (ถ้ามีข้อมูลสต็อก/ใบสั่งรถ): มีรถว่างแล้ว ดันขึ้น รถจะมาหลังสิ้นเดือน/ยังไม่มีรถ ลดลง
//     · อัตราถอนจองจริงของร้าน 6 เดือนล่าสุด
//  3) คาดการณ์ = ส่งมอบแล้ว + ผลรวมโอกาส · ช่วงแย่–ดี = ±1.28 ส่วนเบี่ยงเบน (ประมาณช่วง 80%)
import { isCancelled, isDelivered, isOpenBooking } from './bookingStatus.js'
import { carOf } from './carLabel.js'

const DAY = 86400000
const ymd = v => String(v || '').slice(0, 10)
const ms = v => { const t = Date.parse(ymd(v)); return Number.isFinite(t) ? t : null }
// วันที่ DD/MM/YYYY (หน้าเว็บส่ง formatDate ของแอปมาแทนได้)
export const dmyPlain = d => { const [y, m, dd] = ymd(d).split('-'); return dd ? `${dd}/${m}/${y}` : '' }
const cutOf = b => ymd(b?.cutDate || b?.actualDeliveryDate)

// โอกาสตั้งต้นตามขั้นงาน (ใช้เมื่อประวัติร้านยังน้อย) และ "พื้น/เพดาน" ของแต่ละขั้น
export const STAGE_RULES = {
  'รอส่งมอบ':            { base: 0.9,  floor: 0.75, cap: 0.97, group: 'car' },
  'ได้รถแล้วรอสั่งแต่ง': { base: 0.8,  floor: 0.6,  cap: 0.95, group: 'car' },
  'ผ่านไฟแนนซ์รอเบิก':   { base: 0.65, floor: 0.4,  cap: 0.92, group: 'release' },
  'ซื้อสดรอเบิกรถ':      { base: 0.65, floor: 0.4,  cap: 0.92, group: 'release' },
  'รอรถ':                { base: 0.35, floor: 0.08, cap: 0.85, group: 'wait' },
  'ยอดจองคงค้าง':        { base: 0.25, floor: 0.05, cap: 0.7,  group: 'wait' },
  'ผ่านไฟแนนซ์รอจอง':    { base: 0.25, floor: 0.05, cap: 0.6,  group: 'finance' },
  'รอผลไฟแนนซ์':         { base: 0.2,  floor: 0.03, cap: 0.5,  group: 'finance' },
  'จัดไฟแนนซ์ก่อนจอง':   { base: 0.1,  floor: 0.02, cap: 0.35, group: 'finance' },
}
const OTHER_RULE = { base: 0.2, floor: 0.03, cap: 0.6, group: 'wait' }
export const GROUP_LABEL = { car: '🚗 รถมาแล้ว', release: '🏦 รอเบิกรถ', wait: '⏳ รอรถ/คงค้าง', finance: '📄 รอไฟแนนซ์' }

export function monthBounds(today) {
  const [y, m] = ymd(today).split('-').map(Number)
  const dim = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const ym = `${y}-${String(m).padStart(2, '0')}`
  const day = Number(ymd(today).slice(8, 10)) || 1
  return { ym, dim, day, daysLeft: Math.max(0, dim - day + 1), end: `${ym}-${String(dim).padStart(2, '0')}` }
}

// ประวัติร้าน: ระยะวันจอง → วันตัดตัวเลข ของใบที่ส่งมอบแล้วใน 12 เดือนล่าสุด + อัตราถอนจอง 6 เดือน
export function shopHistory(bookings = [], today) {
  const t = ms(today) ?? Date.now()
  const since12 = t - 365 * DAY, since6 = t - 183 * DAY
  const durations = []
  let del6 = 0, can6 = 0
  for (const b of bookings) {
    if (!b || b.deleted) continue
    const bd = ms(b.bookingDate)
    if (isDelivered(b)) {
      const cd = ms(cutOf(b))
      if (bd != null && cd != null && cd >= since12 && cd <= t && cd >= bd) durations.push(Math.round((cd - bd) / DAY))
      if (cd != null && cd >= since6 && cd <= t) del6++
    } else if (isCancelled(b)) {
      const xd = ms(b.cancelDate) ?? bd
      if (xd != null && xd >= since6 && xd <= t) can6++
    }
  }
  durations.sort((a, b) => a - b)
  const closed = del6 + can6
  return {
    durations,
    cancelRate: closed >= 5 ? can6 / closed : null,
    medianDays: durations.length ? durations[Math.floor(durations.length / 2)] : null,
  }
}

// ในอดีต ใบจองที่อายุ age วันและยังไม่ตัดตัวเลข → ตัดตัวเลขภายในอีก left วัน กี่ % (ต้องมีตัวอย่าง ≥ 5)
export function timingChance(durations = [], age, left) {
  const still = durations.filter(d => d >= age)
  if (still.length < 5) return null
  return still.filter(d => d <= age + left - 1).length / still.length
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

// โอกาสของใบจองหนึ่งใบ + เหตุผลภาษาไทยสั้นๆ (แสดงให้ทีมเห็นว่าทำไม)
export function bookingChance(b, { today, hist, eta, useSupply = false, fmt = dmyPlain } = {}) {
  const { end, daysLeft } = monthBounds(today)
  const rule = STAGE_RULES[b.status] || OTHER_RULE
  const why = []
  const t = ms(today)
  const bd = ms(b.bookingDate)
  const age = bd != null && t != null ? Math.max(0, Math.round((t - bd) / DAY)) : null
  let p = rule.base
  const tc = age != null ? timingChance(hist?.durations, age, daysLeft) : null
  if (tc != null) { p = (rule.base + tc) / 2; why.push(`ประวัติร้าน: ใบที่จองมา ${age} วัน ตัดตัวเลขในอีก ${daysLeft} วัน ${Math.round(tc * 100)}%`) }
  let risk = ''
  const dd = ymd(b.deliveryDate)
  if (dd) {
    if (dd < ymd(today)) { p *= 0.8; risk = `เลยวันนัดส่งมอบ ${fmt(dd)}`; why.push('เลยวันนัดส่งมอบแล้ว') }
    else if (dd <= end) { p = Math.max(p, rule.group === 'car' || rule.group === 'release' ? 0.85 : 0.5); why.push(`นัดส่งมอบ ${fmt(dd)}`) }
    else { p = Math.min(p, 0.12); why.push(`นัดส่งมอบเดือนหน้า (${fmt(dd)})`) }
  }
  if (useSupply && eta && (rule.group === 'wait' || rule.group === 'finance')) {
    if (eta.kind === 'ready') { p = Math.max(p, rule.group === 'wait' ? 0.55 : p); why.push('มีรถว่างในสต็อกแล้ว') }
    else if ((eta.kind === 'transit' || eta.kind === 'order') && eta.date && eta.date > end) { p = Math.min(p, 0.1); why.push(`รถคาดว่าถึง ${fmt(eta.date)} (หลังสิ้นเดือน)`) }
    else if (eta.kind === 'none') { p = Math.min(p, 0.1); if (rule.group === 'wait') risk = risk || 'ยังไม่มีรถรุ่น/สีนี้'; why.push('ยังไม่มีรถรุ่น/สีนี้') }
  }
  const cr = hist?.cancelRate
  if (cr != null) p *= 1 - (rule.group === 'car' ? cr / 3 : rule.group === 'release' ? cr / 2 : cr)
  p = daysLeft <= 0 ? 0 : clamp(p, rule.floor, rule.cap)
  if (!risk && dd && dd <= end && (rule.group === 'finance' || p < 0.5)) risk = 'นัดส่งเดือนนี้ แต่ขั้นงานยังไม่พร้อม'
  return { p, group: rule.group, why, risk, age }
}

// ผลรวมทั้งเดือน — target = เป้าส่งมอบ (คัน) ถ้ามี ไม่มีให้ส่ง null (ไม่เดาเป้า)
export function deliveryForecast({ bookings = [], vehicles = [], orders = [], etaMap = null, today, target = null, fmt = dmyPlain } = {}) {
  const { ym, dim, day, daysLeft, end } = monthBounds(today)
  const live = bookings.filter(b => b && !b.deleted)
  const hist = shopHistory(live, today)
  const useSupply = !!etaMap && (vehicles.some(v => v && !v.deleted) || orders.some(o => o && !o.deleted))
  const deliveredRows = live.filter(b => isDelivered(b) && cutOf(b).slice(0, 7) === ym)
  const open = live.filter(isOpenBooking)
  const items = open.map(b => {
    const c = bookingChance(b, { today, hist, eta: etaMap?.get?.(b.id), useSupply, fmt })
    return {
      id: b.id || '', name: String(b.custName || '').trim() || '—', car: carOf(b) || String(b.model || '').trim() || 'ไม่ระบุรุ่น',
      sales: String(b.salesName || '').trim() || 'ไม่ระบุ', status: b.status || '', deliveryDate: ymd(b.deliveryDate),
      price: Number(b.price) || 0, ...c,
    }
  }).sort((a, b) => b.p - a.p)
  const expectedMore = items.reduce((s, i) => s + i.p, 0)
  const sd = Math.sqrt(items.reduce((s, i) => s + i.p * (1 - i.p), 0))
  const delivered = deliveredRows.length
  const expected = delivered + expectedMore
  const worst = delivered + Math.max(0, Math.floor(expectedMore - 1.28 * sd))
  const best = delivered + Math.min(items.length, Math.ceil(expectedMore + 1.28 * sd))
  const tier = p => p >= 0.75 ? 'sure' : p >= 0.4 ? 'likely' : p >= 0.15 ? 'maybe' : 'unlikely'
  const tiers = { sure: 0, likely: 0, maybe: 0, unlikely: 0 }
  items.forEach(i => { i.tier = tier(i.p); tiers[i.tier]++ })
  const pace = day > 1 ? Math.round(delivered / (day - 1) * dim) : null

  const group = (key) => {
    const m = new Map()
    const row = k => { if (!m.has(k)) m.set(k, { key: k, delivered: 0, expected: 0, open: 0 }); return m.get(k) }
    deliveredRows.forEach(b => { const r = row(key === 'car' ? (carOf(b) || String(b.model || '').trim() || 'ไม่ระบุรุ่น') : (String(b.salesName || '').trim() || 'ไม่ระบุ')); r.delivered++; r.expected++ })
    items.forEach(i => { const r = row(i[key]); r.expected += i.p; r.open++ })
    return [...m.values()].map(r => ({ ...r, expected: Math.round(r.expected * 10) / 10 })).sort((a, b) => b.expected - a.expected || b.delivered - a.delivered)
  }
  const byGroup = Object.keys(GROUP_LABEL).map(g => {
    const rows = items.filter(i => i.group === g)
    return { group: g, label: GROUP_LABEL[g], count: rows.length, expected: Math.round(rows.reduce((s, i) => s + i.p, 0) * 10) / 10 }
  }).filter(g => g.count)
  const atRisk = items.filter(i => i.risk).sort((a, b) => (a.deliveryDate || '9').localeCompare(b.deliveryDate || '9'))
  const tgt = Number(target) > 0 ? Number(target) : null
  return {
    ym, day, dim, daysLeft, delivered, deliveredRows, open: items.length, items,
    expected: Math.round(expected), expectedRaw: expected, worst, best, tiers, pace,
    byCar: group('car'), bySales: group('sales'), byGroup, atRisk,
    target: tgt, targetPct: tgt ? Math.round(expected / tgt * 100) : null,
    needPerDay: tgt && daysLeft ? Math.max(0, (tgt - delivered) / daysLeft) : null,
    history: { samples: hist.durations.length, cancelRate: hist.cancelRate, medianDays: hist.medianDays },
    usedSupply: useSupply,
  }
}

// สรุปเป็นข้อความสั้น (LAMI / คัดลอกส่ง LINE ทีม) — ไม่มีชื่อลูกค้า
export function deliveryForecastText(fc, monthLabel = '') {
  if (!fc) return ''
  const lines = [`🚚 คาดการณ์ส่งมอบ ${monthLabel || fc.ym}`,
    `✅ ส่งมอบแล้ว ${fc.delivered} คัน · เหลือ ${fc.daysLeft} วัน`,
    `🎯 คาดว่าจะได้ ≈ ${fc.expected} คัน (แย่สุด ${fc.worst} · ดีสุด ${fc.best})`]
  if (fc.target) lines.push(`📌 เป้า ${fc.target} คัน → คาด ${fc.targetPct}%${fc.expected < fc.target && fc.needPerDay != null ? ` · ต้องส่งอีกวันละ ${fc.needPerDay.toFixed(1)} คัน` : ' · ทันเป้า'}`)
  if (fc.tiers.sure || fc.tiers.likely) lines.push(`🟢 ค่อนข้างแน่ ${fc.tiers.sure} · 🔵 น่าจะได้ ${fc.tiers.likely} · 🟡 ลุ้น ${fc.tiers.maybe}`)
  if (fc.atRisk.length) lines.push(`⚠️ เสี่ยงหลุดเดือนนี้ ${fc.atRisk.length} ใบ`)
  const top = fc.byCar.slice(0, 3).map(r => `${r.key} ${r.expected}`).join(' · ')
  if (top) lines.push(`🚗 รุ่นหลัก: ${top}`)
  return lines.join('\n')
}

// เป้าส่งมอบของเดือน: 1) Sales Budget ช่อง "คัน" ของเดือนนั้น 2) เป้าทีม (team_targets metric=units) ของเดือนนั้นรวมกัน
// ไม่มีทั้งคู่ → null (หน้าแสดง "ยังไม่ได้ตั้งเป้า" ไม่เดาเป้าให้)
export function pickDeliveryTarget({ budgetUnits = null, teamTargets = [], ym } = {}) {
  const m = Number(String(ym || '').slice(5, 7))
  const b = Array.isArray(budgetUnits) ? Number(budgetUnits[m - 1]) || 0 : 0
  if (b > 0) return { target: b, source: 'budget' }
  const t = (teamTargets || []).filter(x => x && !x.deleted && x.metric === 'units' && x.period === ym).reduce((s, x) => s + (Number(x.target) || 0), 0)
  return t > 0 ? { target: t, source: 'team' } : { target: null, source: '' }
}

// (v1.0.1386) ความแม่นยำ: เทียบตัวเลขที่ระบบคาดไว้ (delivery_forecast_log ที่รายงาน 18:00 เก็บทุกวัน) กับยอดจริงตอนจบเดือน
// logs = [{ date, ym, day, expected, worst, best, delivered }] · คืน { current: [...วันของเดือนนี้], months: [...เดือนที่จบแล้ว ใหม่ก่อน], mape }
export function forecastAccuracy(logs = [], bookings = [], today) {
  const ym = String(today || '').slice(0, 7)
  const clean = (logs || []).filter(l => l && /^\d{4}-\d{2}-\d{2}$/.test(String(l.date || ''))).map(l => ({ ...l, ym: String(l.date).slice(0, 7), day: Number(String(l.date).slice(8, 10)), expected: Number(l.expected) || 0, worst: Number(l.worst) || 0, best: Number(l.best) || 0 }))
  const current = clean.filter(l => l.ym === ym).sort((a, b) => a.day - b.day)
  const actualOf = m => bookings.filter(b => b && !b.deleted && isDelivered(b) && cutOf(b).slice(0, 7) === m).length
  const pick = (rows, target) => rows.reduce((best, r) => (!best || Math.abs(r.day - target) < Math.abs(best.day - target) ? r : best), null)
  const months = [...new Set(clean.map(l => l.ym).filter(m => m < ym))].sort().reverse().map(m => {
    const rows = clean.filter(l => l.ym === m)
    const actual = actualOf(m)
    const snaps = [pick(rows, 10), pick(rows, 20)].filter((s, i, a) => s && a.indexOf(s) === i)
    return {
      ym: m, actual,
      snaps: snaps.map(s => ({ day: s.day, expected: s.expected, worst: s.worst, best: s.best, inRange: actual >= s.worst && actual <= s.best, errPct: actual ? Math.round(Math.abs(s.expected - actual) / actual * 100) : null })),
    }
  })
  const errs = months.flatMap(m => m.snaps.map(s => s.errPct)).filter(v => v != null)
  return { current, months, mape: errs.length ? Math.round(errs.reduce((a, b) => a + b, 0) / errs.length) : null, since: clean.map(l => l.date).sort()[0] || '' }
}
