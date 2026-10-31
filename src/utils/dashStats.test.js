import { describe, it, expect } from 'vitest'
import { periodMonths, prevPeriodAnchor, periodLabel, statRows, rangeStats, monthStats, openBookings, monthSeries, stockSince, pctChange, sparkPath, shiftYm } from './dashStats.js'

const B = [
  { bookingDate: '2026-10-02', status: 'รอรถ', price: 1000000, margin: 50000 },
  { bookingDate: '2026-10-05', status: 'ถอนจอง', price: 900000, margin: 40000 },
  { bookingDate: '2026-09-20', status: 'ส่งมอบแล้ว', cutDate: '2026-10-10', price: 800000, margin: 30000 },
  { bookingDate: '2026-10-08', status: 'ตัดตัวเลขรอส่งมอบ', cutDate: '2026-10-25', price: 700000 },
  { bookingDate: '2026-09-01', status: 'ยกเลิก', price: 500000 },
]

describe('monthStats', () => {
  it('counts new bookings including withdrawn, but value/margin only for live ones', () => {
    const s = monthStats(B, '2026-10')
    expect(s.booked).toBe(3)
    expect(s.active).toBe(2)
    expect(s.withdrawn).toBe(1)
    expect(s.value).toBe(1700000)
    expect(s.margin).toBe(50000)
  })
  it('counts deliveries by cut date, not booking date', () => {
    expect(monthStats(B, '2026-10').delivered).toBe(2)
    expect(monthStats(B, '2026-09').delivered).toBe(0)
  })
})

describe('openBookings', () => {
  it('excludes delivered, cut and cancelled', () => {
    expect(openBookings(B).map(b => b.status)).toEqual(['รอรถ'])
  })
})

describe('helpers', () => {
  it('monthSeries goes oldest to newest', () => {
    expect(monthSeries(B, '2026-10', 2, 'booked')).toEqual([2, 3])
  })
  it('shiftYm crosses years', () => { expect(shiftYm('2026-01', -1)).toBe('2025-12') })
  it('stockSince prefers arrivedAt', () => {
    expect(stockSince({ arrivedAt: '2026-01-01', createdAt: 'x' })).toBe('2026-01-01')
    expect(stockSince({ createdAt: 'x' })).toBe('x')
    expect(stockSince({})).toBe(null)
  })
  it('pctChange is null when previous is zero', () => {
    expect(pctChange(5, 0)).toBe(null)
    expect(pctChange(6, 4)).toBe(50)
  })
  it('sparkPath empty for all-zero series', () => {
    expect(sparkPath([0, 0, 0])).toBe('')
    expect(sparkPath([1, 2, 3])).toMatch(/^M0\.0,/)
  })
})

describe('periods', () => {
  it('periodMonths covers quarter and year', () => {
    expect(periodMonths('2026-11', 'quarter')).toEqual(['2026-10', '2026-11', '2026-12'])
    expect(periodMonths('2026-02', 'year')).toHaveLength(12)
    expect(periodMonths('2026-02')).toEqual(['2026-02'])
  })
  it('prevPeriodAnchor and labels', () => {
    expect(prevPeriodAnchor('2026-10', 'quarter')).toBe('2026-07')
    expect(prevPeriodAnchor('2026-10', 'year')).toBe('2025-10')
    expect(periodLabel('2026-10', 'quarter')).toBe('ไตรมาส 4/2569')
    expect(periodLabel('2026-10', 'year')).toBe('ปี 2569')
    expect(periodLabel('2026-10')).toBe('ต.ค. 2569')
  })
  it('rangeStats over a quarter sums the months and statRows matches counts', () => {
    const q = periodMonths('2026-10', 'quarter')
    const s = rangeStats(B, ['2026-09', ...q])
    expect(s.booked).toBe(5)
    expect(s.delivered).toBe(2)
    expect(statRows(B, q, 'value').length).toBe(rangeStats(B, q).active)
    expect(statRows(B, q, 'withdrawn').map(b => b.status)).toEqual(['ถอนจอง'])
  })
})
