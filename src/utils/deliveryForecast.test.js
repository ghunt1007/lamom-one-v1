import { describe, it, expect } from 'vitest'
import { monthBounds, shopHistory, timingChance, bookingChance, deliveryForecast, deliveryForecastText, dmyPlain, bookingOutlook, chanceTier, targetPath } from './deliveryForecast.js'

const T = '2026-11-20'

describe('monthBounds', () => {
  it('counts today as a remaining day', () => {
    expect(monthBounds(T)).toMatchObject({ ym: '2026-11', dim: 30, day: 20, daysLeft: 11, end: '2026-11-30' })
    expect(monthBounds('2026-02-28')).toMatchObject({ dim: 28, daysLeft: 1 })
  })
})

describe('dmyPlain', () => {
  it('formats DD/MM/YYYY', () => { expect(dmyPlain('2026-11-05')).toBe('05/11/2026'); expect(dmyPlain('')).toBe('') })
})

describe('shopHistory / timingChance', () => {
  const hist = [
    ...[10, 12, 15, 20, 25, 30, 40, 60].map((d, i) => ({ status: 'ส่งมอบแล้ว', bookingDate: '2026-08-01', cutDate: new Date(Date.UTC(2026, 7, 1 + d)).toISOString().slice(0, 10), id: 'd' + i })),
    { status: 'ถอนจอง', bookingDate: '2026-09-01', cancelDate: '2026-09-10' },
    { status: 'ถอนจอง', bookingDate: '2026-09-01' },
  ]
  it('collects booking→cut durations and cancel rate', () => {
    const h = shopHistory(hist, T)
    expect(h.durations).toEqual([10, 12, 15, 20, 25, 30, 40, 60])
    expect(h.cancelRate).toBeCloseTo(2 / 10)
    expect(h.medianDays).toBe(25)
  })
  it('no cancel rate with too few closed bookings', () => {
    expect(shopHistory(hist.slice(0, 3), T).cancelRate).toBeNull()
  })
  it('timing chance conditions on age', () => {
    const d = [10, 12, 15, 20, 25, 30, 40, 60]
    expect(timingChance(d, 0, 21)).toBeCloseTo(4 / 8) // ≤20 days
    expect(timingChance(d, 26, 10)).toBeNull() // only 4 samples ≥26
    expect(timingChance(d, 11, 10)).toBeCloseTo(3 / 7) // 12,15,20 of 7
  })
})

describe('bookingChance', () => {
  it('late stage with delivery date this month is high', () => {
    const c = bookingChance({ status: 'รอส่งมอบ', deliveryDate: '2026-11-25' }, { today: T })
    expect(c.p).toBeGreaterThanOrEqual(0.85)
    expect(c.risk).toBe('')
    expect(c.why.join(' ')).toContain('25/11/2026')
  })
  it('delivery date next month caps chance', () => {
    expect(bookingChance({ status: 'รอส่งมอบ', deliveryDate: '2026-12-05' }, { today: T }).p).toBe(0.12) // นัดเดือนหน้า ไม่ใช้พื้นของขั้นงาน
    expect(bookingChance({ status: 'รอรถ', deliveryDate: '2026-12-05' }, { today: T }).p).toBeLessThanOrEqual(0.12)
  })
  it('overdue delivery date is flagged as risk', () => {
    const c = bookingChance({ status: 'รอส่งมอบ', deliveryDate: '2026-11-10' }, { today: T })
    expect(c.risk).toContain('10/11/2026')
  })
  it('early stage with date this month is a risk', () => {
    const c = bookingChance({ status: 'รอผลไฟแนนซ์', deliveryDate: '2026-11-28' }, { today: T })
    expect(c.p).toBeLessThan(0.55)
    expect(c.risk).toContain('ยังไม่พร้อม')
  })
  it('supply only used when allowed', () => {
    const b = { status: 'รอรถ' }
    expect(bookingChance(b, { today: T, eta: { kind: 'none' }, useSupply: false }).p).toBeCloseTo(0.35)
    expect(bookingChance(b, { today: T, eta: { kind: 'none' }, useSupply: true }).p).toBeLessThanOrEqual(0.1)
    expect(bookingChance(b, { today: T, eta: { kind: 'ready' }, useSupply: true }).p).toBeGreaterThanOrEqual(0.55)
    expect(bookingChance(b, { today: T, eta: { kind: 'order', date: '2026-12-15' }, useSupply: true }).why.join()).toContain('15/12/2026')
  })
  it('cancel rate lowers early stages more', () => {
    const hist = { durations: [], cancelRate: 0.3 }
    const early = bookingChance({ status: 'รอรถ' }, { today: T, hist }).p
    const late = bookingChance({ status: 'รอส่งมอบ' }, { today: T, hist }).p
    expect(early).toBeCloseTo(0.35 * 0.7)
    expect(late).toBeCloseTo(0.9 * 0.9)
  })
})

describe('deliveryForecast', () => {
  const bookings = [
    { id: 'a', status: 'ส่งมอบแล้ว', cutDate: '2026-11-03', model: 'S07', salesName: 'เอ' },
    { id: 'b', status: 'ตัดตัวเลขรอส่งมอบ', cutDate: '2026-11-15', model: 'S07', salesName: 'บี' },
    { id: 'c', status: 'ส่งมอบแล้ว', cutDate: '2026-10-30', model: 'S07' }, // last month
    { id: 'd', status: 'รอส่งมอบ', deliveryDate: '2026-11-25', model: 'L07', salesName: 'เอ', custName: 'ลูกค้า1' },
    { id: 'e', status: 'รอรถ', model: 'S07', salesName: 'บี' },
    { id: 'f', status: 'ถอนจอง', model: 'S07' },
    { id: 'g', status: 'รอส่งมอบ', deleted: true },
  ]
  const fc = deliveryForecast({ bookings, today: T })
  it('counts delivered this month by cut date', () => {
    expect(fc.delivered).toBe(2)
    expect(fc.open).toBe(2)
  })
  it('expected sits inside worst..best and above delivered', () => {
    expect(fc.worst).toBeGreaterThanOrEqual(2)
    expect(fc.worst).toBeLessThanOrEqual(fc.expected)
    expect(fc.best).toBeGreaterThanOrEqual(fc.expected)
    expect(fc.best).toBeLessThanOrEqual(4)
  })
  it('breakdowns include delivered + expected', () => {
    const s07 = fc.byCar.find(r => r.key === 'S07')
    expect(s07.delivered).toBe(2)
    expect(s07.open).toBe(1)
    expect(fc.bySales.find(r => r.key === 'เอ').delivered).toBe(1)
    expect(fc.byGroup.map(g => g.group)).toEqual(['car', 'wait'])
  })
  it('no target → no percent (no fake numbers)', () => {
    expect(fc.target).toBeNull()
    expect(fc.targetPct).toBeNull()
    const t = deliveryForecast({ bookings, today: T, target: 10 })
    expect(t.targetPct).toBe(Math.round(t.expectedRaw / 10 * 100))
    expect(t.needPerDay).toBeCloseTo(8 / 11)
  })
  it('pace uses finished days only', () => {
    expect(fc.pace).toBe(Math.round(2 / 19 * 30))
    expect(deliveryForecast({ bookings, today: '2026-11-01' }).pace).toBeNull()
  })
  it('supply ignored when no vehicles and no orders', () => {
    const eta = new Map([['e', { kind: 'none' }]])
    expect(deliveryForecast({ bookings, today: T, etaMap: eta }).usedSupply).toBe(false)
    expect(deliveryForecast({ bookings, today: T, etaMap: eta, vehicles: [{ id: 'v' }] }).usedSupply).toBe(true)
  })
  it('text summary has no customer names', () => {
    const txt = deliveryForecastText(fc, 'พ.ย. 2569')
    expect(txt).toContain('ส่งมอบแล้ว 2 คัน')
    expect(txt).not.toContain('ลูกค้า1')
  })
  it('empty data is safe', () => {
    const e = deliveryForecast({ bookings: [], today: T })
    expect(e).toMatchObject({ delivered: 0, expected: 0, worst: 0, best: 0, open: 0 })
  })
})

import { pickDeliveryTarget } from './deliveryForecast.js'
describe('pickDeliveryTarget', () => {
  const units = Array(12).fill(0); units[10] = 12
  it('budget first, then team targets, else null', () => {
    expect(pickDeliveryTarget({ budgetUnits: units, ym: '2026-11' })).toEqual({ target: 12, source: 'budget' })
    const tt = [{ metric: 'units', period: '2026-12', target: 5 }, { metric: 'units', period: '2026-12', target: 3 }, { metric: 'revenue', period: '2026-12', target: 9e6 }]
    expect(pickDeliveryTarget({ budgetUnits: units, teamTargets: tt, ym: '2026-12' })).toEqual({ target: 8, source: 'team' })
    expect(pickDeliveryTarget({ ym: '2026-12' })).toEqual({ target: null, source: '' })
  })
})

import { forecastAccuracy } from './deliveryForecast.js'
describe('forecastAccuracy', () => {
  const logs = [
    { date: '2026-10-09', expected: 9, worst: 7, best: 11 },
    { date: '2026-10-21', expected: 12, worst: 11, best: 13 },
    { date: '2026-10-25', expected: 12.5, worst: 12, best: 13 },
    { date: '2026-11-03', expected: 10, worst: 8, best: 12 },
    { date: '2026-11-01', expected: 9, worst: 7, best: 11 },
    { date: 'bad' },
  ]
  const bookings = Array.from({ length: 12 }, (_, i) => ({ status: 'ส่งมอบแล้ว', cutDate: `2026-10-${String(i + 1).padStart(2, '0')}` }))
  const r = forecastAccuracy(logs, bookings, '2026-11-20')
  it('current month series sorted by day', () => { expect(r.current.map(c => c.day)).toEqual([1, 3]) })
  it('past month compares day≈10 and ≈20 snapshots with actual', () => {
    expect(r.months).toHaveLength(1)
    expect(r.months[0]).toMatchObject({ ym: '2026-10', actual: 12 })
    expect(r.months[0].snaps.map(s => s.day)).toEqual([9, 21])
    expect(r.months[0].snaps[0]).toMatchObject({ inRange: false, errPct: 25 })
    expect(r.months[0].snaps[1]).toMatchObject({ inRange: true, errPct: 0 })
    expect(r.mape).toBe(13)
    expect(r.since).toBe('2026-10-09')
  })
  it('empty logs', () => { expect(forecastAccuracy([], [], '2026-11-20')).toMatchObject({ current: [], months: [], mape: null, since: '' }) })
})

import { nextMonthOutlook } from './deliveryForecast.js'
describe('nextMonthOutlook', () => {
  const B = [
    { id: 'a', status: 'รอส่งมอบ', bookingDate: '2026-11-10', deliveryDate: '2026-11-25' }, // this month
    { id: 'b', status: 'รอส่งมอบ', bookingDate: '2026-11-10', deliveryDate: '2026-12-05' }, // next month
    { id: 'c', status: 'รอรถ', bookingDate: '2026-11-15', model: 'S07' },
    { id: 'd', status: 'ส่งมอบแล้ว', cutDate: '2026-11-03' },
  ]
  const o = nextMonthOutlook({ bookings: B, today: '2026-11-20' })
  it('labels next month and puts next-month appointments first', () => {
    expect(o.ym).toBe('2026-12')
    expect(o.items[0].id).toBe('b')
    expect(o.items[0].p).toBeGreaterThan(0.7)
  })
  it('this-month appointment adds little to next month', () => {
    const a = o.items.find(i => i.id === 'a')
    expect(a ? a.p : 0).toBeLessThan(0.2)
  })
  it('range and byCar', () => {
    expect(o.worst).toBeLessThanOrEqual(o.expected)
    expect(o.best).toBeGreaterThanOrEqual(o.expected)
    expect(o.byCar.some(r => r.key === 'S07')).toBe(true)
  })
  it('december rolls to january', () => {
    expect(nextMonthOutlook({ bookings: [], today: '2026-12-10' }).ym).toBe('2027-01')
  })
})

describe('bookingOutlook (single booking)', () => {
  it('null for closed bookings', () => {
    expect(bookingOutlook({ status: 'ส่งมอบแล้ว', cutDate: '2026-11-02' }, [], { today: T })).toBeNull()
    expect(bookingOutlook({ status: 'ถอนจอง' }, [], { today: T })).toBeNull()
    expect(bookingOutlook(null, [], { today: T })).toBeNull()
  })
  it('gives this-month chance, tier and a by-next-month chance that is not lower', () => {
    const o = bookingOutlook({ id: 'x', status: 'รอผลไฟแนนซ์', bookingDate: '2026-11-10' }, [], { today: T })
    expect(o.p).toBeGreaterThan(0)
    expect(o.pBy2).toBeGreaterThanOrEqual(o.p)
    expect(o.tier).toBe(chanceTier(o.p))
    expect(Array.isArray(o.why)).toBe(true)
  })
  it('chanceTier thresholds', () => {
    expect(chanceTier(0.8)).toBe('sure'); expect(chanceTier(0.5)).toBe('likely'); expect(chanceTier(0.2)).toBe('maybe'); expect(chanceTier(0.05)).toBe('unlikely')
  })
})

describe('targetPath', () => {
  const fc = { target: 5, delivered: 2, items: [{ p: 0.9 }, { p: 0.6 }, { p: 0.3 }, { p: 0.1 }] }
  it('null without target or when reached', () => {
    expect(targetPath({ ...fc, target: null })).toBeNull()
    expect(targetPath({ ...fc, delivered: 5 })).toBeNull()
  })
  it('picks the most likely bookings to fill the gap and flags weak ones', () => {
    const t = targetPath(fc)
    expect(t.need).toBe(3)
    expect(t.picks.map(i => i.p)).toEqual([0.9, 0.6, 0.3])
    expect(t.push.map(i => i.p)).toEqual([0.3])
    expect(t.minP).toBe(0.3)
    expect(t.short).toBe(0)
    expect(t.chance).toBeCloseTo(0.9 * 0.6 * 0.3)
  })
  it('reports shortfall when not enough open bookings', () => {
    const t = targetPath({ ...fc, target: 10 })
    expect(t.short).toBe(4)
    expect(t.chance).toBe(0)
  })
})
