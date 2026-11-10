import { describe, it, expect } from 'vitest'
import {
  normalizeProgram, validateProgram, parseModels, isActiveOn, overlapsMonth, liveState, matchesCar,
  programsForCar, bestRates, carSummary, copyToNextMonth, monthlyInstallment, fromLegacyRateSheet,
  programFacts, shiftMonth, monthBounds, rangeLabel, nextMonthGap, supersededBy, dayBefore,
} from './salesPrograms.js'

const P = o => ({ id: Math.random().toString(36).slice(2), ...normalizeProgram(o) })

describe('normalizeProgram', () => {
  it('cleans numbers, models and swaps reversed dates', () => {
    const p = normalizeProgram({ type: 'brand', title: ' ลดพิเศษ ', models: 'S07, S05 , s07', amount: '20,000', dateFrom: '2026-11-30', dateTo: '2026-11-01' })
    expect(p.title).toBe('ลดพิเศษ')
    expect(p.models).toEqual(['S07', 'S05'])
    expect(p.amount).toBe(20000)
    expect([p.dateFrom, p.dateTo]).toEqual(['2026-11-01', '2026-11-30'])
  })
  it('keeps finance rate rows and unknown type falls back to showroom', () => {
    const f = normalizeProgram({ type: 'finance', financeCo: 'KK', rates: [{ down: '25', months: '60', rate: '2.49' }, { down: 0, months: 0, rate: 0 }] })
    expect(f.rates).toEqual([{ down: 25, months: 60, rate: 2.49 }])
    expect(normalizeProgram({ type: 'xx' }).type).toBe('showroom')
  })
  it('"ทุกรุ่น" means no model filter', () => { expect(parseModels('ทุกรุ่น')).toEqual([]) })
  it('validates required fields', () => {
    expect(validateProgram(normalizeProgram({ type: 'brand' }))).toMatch(/ชื่อ/)
    expect(validateProgram(normalizeProgram({ type: 'finance', title: 'a', dateFrom: '2026-11-01' }))).toMatch(/ไฟแนนซ์/)
    expect(validateProgram(normalizeProgram({ type: 'brand', title: 'a', dateFrom: '2026-11-01' }))).toBe('')
  })
})

describe('dates', () => {
  const p = P({ type: 'brand', title: 'a', dateFrom: '2026-11-05', dateTo: '2026-11-20' })
  it('active window', () => {
    expect(isActiveOn(p, '2026-11-04')).toBe(false)
    expect(isActiveOn(p, '2026-11-05')).toBe(true)
    expect(isActiveOn(p, '2026-11-20')).toBe(true)
    expect(isActiveOn(p, '2026-11-21')).toBe(false)
    expect(isActiveOn({ ...p, status: 'draft' }, '2026-11-10')).toBe(false)
  })
  it('open-ended program stays active and overlaps later months', () => {
    const o = P({ type: 'brand', title: 'a', dateFrom: '2026-10-01' })
    expect(isActiveOn(o, '2027-01-01')).toBe(true)
    expect(overlapsMonth(o, '2026-12')).toBe(true)
    expect(overlapsMonth(o, '2026-09')).toBe(false)
  })
  it('several campaigns in one month all overlap', () => {
    const a = P({ type: 'brand', title: 'a', dateFrom: '2026-11-01', dateTo: '2026-11-10' })
    const b = P({ type: 'brand', title: 'b', dateFrom: '2026-11-11', dateTo: '2026-11-30' })
    const c = P({ type: 'brand', title: 'c', dateFrom: '2026-10-25', dateTo: '2026-11-02' })
    expect([a, b, c].every(x => overlapsMonth(x, '2026-11'))).toBe(true)
  })
  it('live state', () => {
    expect(liveState(p, '2026-11-01')).toBe('soon')
    expect(liveState(p, '2026-11-10')).toBe('live')
    expect(liveState(p, '2026-11-18')).toBe('ending')
    expect(liveState(p, '2026-11-25')).toBe('ended')
  })
  it('month helpers', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(monthBounds('2028-02')).toEqual(['2028-02-01', '2028-02-29'])
    expect(rangeLabel(p)).toBe('05/11/2569 – 20/11/2569')
  })
  it('copy to next month keeps month-end', () => {
    const c = copyToNextMonth({ ...p, dateFrom: '2026-10-01', dateTo: '2026-10-31' })
    expect([c.dateFrom, c.dateTo]).toEqual(['2026-11-01', '2026-11-30'])
    expect(c.id).toBeUndefined()
    const j = copyToNextMonth({ ...p, dateFrom: '2027-01-15', dateTo: '2027-01-30' })
    expect([j.dateFrom, j.dateTo]).toEqual(['2027-02-15', '2027-02-28'])
  })
})

describe('matching cars', () => {
  it('brand + model match tolerant to spacing/case', () => {
    const p = P({ type: 'brand', title: 'a', brand: 'DEEPAL', models: 'S07' })
    expect(matchesCar(p, 'Deepal', 'S07 Long Range')).toBe(true)
    expect(matchesCar(p, 'DEEPAL', 's 07')).toBe(true)
    expect(matchesCar(p, 'DEEPAL', 'S05')).toBe(false)
    expect(matchesCar(p, 'AION', 'S07')).toBe(false)
  })
  it('no model list = every model of the brand; no brand = every car', () => {
    expect(matchesCar(P({ title: 'a', brand: 'AION' }), 'AION', 'V')).toBe(true)
    expect(matchesCar(P({ title: 'a' }), 'X', 'Y')).toBe(true)
  })
})

describe('programsForCar / summary', () => {
  const today = '2026-11-10'
  const list = [
    P({ type: 'brand', title: 'แบรนด์ลด', brand: 'DEEPAL', models: 'S07', amount: 30000, dateFrom: '2026-11-01', dateTo: '2026-11-30' }),
    P({ type: 'showroom', title: 'โชว์รูมแถม', brand: 'DEEPAL', amount: 10000, gift: 'ฟิล์ม', dateFrom: '2026-11-01' }),
    P({ type: 'finance', title: 'ดอกเบี้ยพิเศษ', financeCo: 'KK', brand: 'DEEPAL', rates: [{ down: 25, months: 60, rate: 2.49 }, { down: 15, months: 72, rate: 3.29 }], subsidy: 15000, dateFrom: '2026-11-01', dateTo: '2026-11-30' }),
    P({ type: 'finance', title: 'TISCO', financeCo: 'TISCO', rates: [{ down: 25, months: 60, rate: 1.99 }], dateFrom: '2026-11-01', dateTo: '2026-11-30' }),
    P({ type: 'margin', title: 'มาร์จิ้น', brand: 'DEEPAL', amount: 25000, percent: 2, dateFrom: '2026-11-01', dateTo: '2026-11-30' }),
    P({ type: 'mgmtfee', title: 'ค่าบริหาร', role: 'salesManager', amount: 1500, dateFrom: '2026-11-01', dateTo: '2026-11-30' }),
    P({ type: 'brand', title: 'หมดแล้ว', brand: 'DEEPAL', amount: 99999, dateFrom: '2026-10-01', dateTo: '2026-10-31' }),
  ]
  it('sales see customer campaigns only, managers see margin + fees', () => {
    const s = programsForCar(list, { brand: 'DEEPAL', model: 'S07', date: today })
    expect(s.map(p => p.title)).toEqual(['ดอกเบี้ยพิเศษ', 'TISCO', 'แบรนด์ลด', 'โชว์รูมแถม'])
    const m = programsForCar(list, { brand: 'DEEPAL', model: 'S07', date: today, isManager: true })
    expect(m.length).toBe(6)
  })
  it('summary adds customer cash, keeps best rate, internal income separate', () => {
    const sum = carSummary(programsForCar(list, { brand: 'DEEPAL', model: 'S07', date: today, isManager: true }))
    expect(sum.customerCash).toBe(40000)
    expect(sum.gifts).toEqual(['ฟิล์ม'])
    expect(sum.bestRate.rate).toBe(1.99)
    expect(sum.margin).toBe(25000)
    expect(sum.mgmt.salesManager).toBe(1500)
    expect(sum.subsidy).toBe(15000)
  })
  it('best rate respects down payment and term', () => {
    const r = bestRates(list, { down: 20, months: 72 })
    expect(r.map(x => x.rate)).toEqual([3.29])
    expect(bestRates(list, { down: 10 })).toEqual([])
  })
  it('facts for LAMI hide internal types from sales', () => {
    const f = programFacts(list, { today })
    expect(f.join('\n')).not.toMatch(/มาร์จิ้น|ค่าบริหาร/)
    expect(f[0]).toMatch(/ดอกเบี้ย 2.49% ดาวน์ 25% 60 งวด/)
    expect(programFacts(list, { today, isManager: true }).join('\n')).toMatch(/มาร์จิ้น/)
  })
})

describe('misc', () => {
  it('installment flat rate', () => {
    // 1,000,000 ดาวน์ 25% = 750,000 · 2.49% x 5 ปี = 93,375 → (843,375)/60
    expect(monthlyInstallment(1000000, 25, 60, 2.49)).toBe(14056)
  })
  it('legacy rate sheet maps Thai month to dates', () => {
    const p = fromLegacyRateSheet({ id: 'x', bank: 'SCB', campaign: 'หน้าฝน', brand: 'DEEPAL', model: 'S07', year: 2026, month: 'กรกฎาคม', subsidy: 15000, status: 'confirmed' })
    expect([p.dateFrom, p.dateTo, p.financeCo, p.legacy]).toEqual(['2026-07-01', '2026-07-31', 'SCB', '/finance/rate-sheets'])
  })
})

import { programEarnings, bookingCountDay, countedBookings, myBonusProgress } from './salesPrograms.js'
describe('programEarnings (v1.0.976)', () => {
  const bk = (salesName, status, deliveryDate, model = 'S07', extra = {}) => ({ salesName, status, deliveryDate, bookingDate: '2026-11-02', brand: 'DEEPAL', model, price: 1000000, ...extra })
  const bookings = [
    bk('นายเอ', 'ส่งมอบแล้ว', '2026-11-03'), bk('เอ', 'ส่งมอบแล้ว', '2026-11-10'), bk('เอ', 'ส่งมอบแล้ว', '2026-11-11', 'L07'),
    bk('บี', 'ส่งมอบแล้ว', '2026-11-05'), bk('บี', 'ถอนจอง', '2026-11-05'), bk('บี', 'รอรถ', ''),
    bk('ซี', 'ส่งมอบแล้ว', '2026-10-30'),
  ]
  const base = { dateFrom: '2026-11-01', dateTo: '2026-11-30', brand: 'DEEPAL', models: ['S07'], status: 'active' }
  it('counts delivered units per person, skips cancelled and other models', () => {
    const e = programEarnings([{ ...base, type: 'bonus', title: 'ขาย 2 คันรับ 5,000', amount: 5000, targetUnits: 2, bonusFor: 'all' }], bookings, { month: '2026-11', staff: ['ดี'] })
    const rows = e.bonuses[0].rows
    expect(rows.find(r => r.key === 'เอ')).toMatchObject({ units: 2, earned: 5000, left: 0 })
    expect(rows.find(r => r.key === 'บี')).toMatchObject({ units: 1, earned: 0, left: 1, pct: 50 })
    expect(rows.find(r => r.key === 'ดี')).toMatchObject({ units: 0, earned: 0 })
    expect(e.bonuses[0].total).toBe(5000)
    expect(myBonusProgress(e, 'คุณเอ')[0].row.earned).toBe(5000)
  })
  it('no target = amount per unit; booked mode counts booking date', () => {
    const e = programEarnings([{ ...base, type: 'bonus', title: 'คันละ 1,000', amount: 1000, bonusFor: 'person', owner: 'บี', countBy: 'booked' }], bookings, { month: '2026-11' })
    expect(e.bonuses[0].rows).toEqual([expect.objectContaining({ key: 'บี', units: 2, earned: 2000 })])
  })
  it('margin and management fee from delivered units (managers only)', () => {
    const progs = [{ ...base, models: [], type: 'margin', title: 'm', amount: 10000, percent: 1 }, { ...base, models: [], type: 'mgmtfee', role: 'salesManager', title: 'f', amount: 2000 }]
    const e = programEarnings(progs, bookings, { month: '2026-11', isManager: true })
    expect(e.margin.units).toBe(4)
    expect(e.margin.amount).toBe(4 * 20000)
    expect(e.mgmt.salesManager).toEqual({ units: 4, amount: 8000 })
    expect(programEarnings(progs, bookings, { month: '2026-11', isManager: false }).margin.units).toBe(0)
  })
  it('bookingCountDay handles timestamps and status', () => {
    expect(bookingCountDay({ status: 'รอรถ', deliveryDate: '2026-11-01' })).toBe('')
    expect(bookingCountDay({ status: 'ส่งมอบแล้ว', deliveryDate: { seconds: Date.UTC(2026, 10, 1, 20) / 1000 } })).toBe('2026-11-02')
    expect(countedBookings({ ...base, models: [] }, bookings, { from: '2026-11-04', to: '2026-11-30' }).length).toBe(3)
  })
})

describe('nextMonthGap', () => {
  const p = (dateFrom, dateTo) => ({ dateFrom, dateTo })
  it('เตือนเฉพาะ 7 วันสุดท้ายของเดือน เมื่อเดือนหน้ายังว่าง', () => {
    const progs = [p('2026-11-01', '2026-11-30')]
    expect(nextMonthGap(progs, '2026-11-20')).toBe(null)
    expect(nextMonthGap(progs, '2026-11-24')).toEqual({ month: '2026-12', carry: 1 })
    expect(nextMonthGap(progs, '2026-11-30')).toEqual({ month: '2026-12', carry: 1 })
  })
  it('ไม่เตือนถ้าเดือนหน้ามีแคมเปญแล้ว หรือเดือนนี้ไม่มีอะไรให้ใช้ต่อ', () => {
    expect(nextMonthGap([p('2026-11-01', '2026-11-30'), p('2026-12-01', '2026-12-31')], '2026-11-28')).toBe(null)
    expect(nextMonthGap([p('2026-11-01', '2026-12-15')], '2026-11-28')).toBe(null)
    expect(nextMonthGap([], '2026-11-28')).toBe(null)
    expect(nextMonthGap([{ ...p('2026-11-01', '2026-11-30'), deleted: true }], '2026-11-28')).toBe(null)
  })
})

describe('supersededBy', () => {
  const base = { type: 'finance', brand: 'DEEPAL', financeCo: 'KK', models: [], dateFrom: '2026-11-01', dateTo: '2026-11-30' }
  it('เจอแคมเปญไฟแนนซ์บริษัทเดียวกันที่ยังใช้อยู่', () => {
    const old = { ...base, id: 'a' }
    expect(supersededBy({ ...base, dateFrom: '2026-11-16' }, [old]).map(p => p.id)).toEqual(['a'])
    expect(dayBefore('2026-11-16')).toBe('2026-11-15')
    expect(dayBefore('2026-12-01')).toBe('2026-11-30')
  })
  it('ไม่นับคนละบริษัท/คนละรุ่น/จบไปแล้ว/มาร์จิ้น', () => {
    const list = [
      { ...base, id: 'b', financeCo: 'TISCO' },
      { ...base, id: 'c', dateTo: '2026-11-10' },
      { ...base, id: 'd', type: 'brand', financeCo: '', models: ['S05'] },
    ]
    expect(supersededBy({ ...base, dateFrom: '2026-11-16' }, list)).toEqual([])
    expect(supersededBy({ ...base, type: 'brand', financeCo: '', models: ['S07'], dateFrom: '2026-11-16' }, list)).toEqual([])
    expect(supersededBy({ ...base, type: 'brand', financeCo: '', models: ['S05'], dateFrom: '2026-11-16' }, list).map(p => p.id)).toEqual(['d'])
    expect(supersededBy({ ...base, type: 'margin', dateFrom: '2026-11-16' }, [{ ...base, type: 'margin', id: 'e' }])).toEqual([])
  })
})
