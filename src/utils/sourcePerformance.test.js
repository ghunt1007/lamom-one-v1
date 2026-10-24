import { describe, it, expect } from 'vitest'
import { summarizeSources, periodRange, normSource, inPeriod } from './sourcePerformance.js'

describe('periodRange', () => {
  it('builds date ranges in Thai calendar terms', () => {
    expect(periodRange('month', '2026-10-25')).toEqual({ from: '2026-10-01', to: '2026-10-25' })
    expect(periodRange('last-month', '2026-10-25')).toEqual({ from: '2026-09-01', to: '2026-09-30' })
    expect(periodRange('last-month', '2026-01-10')).toEqual({ from: '2025-12-01', to: '2025-12-31' })
    expect(periodRange('3m', '2026-02-10')).toEqual({ from: '2025-12-01', to: '2026-02-10' })
    expect(periodRange('year', '2026-10-25')).toEqual({ from: '2026-01-01', to: '2026-10-25' })
    expect(periodRange('all', '2026-10-25')).toEqual({})
  })
  it('inPeriod and normSource', () => {
    expect(inPeriod('2026-10-01', { from: '2026-10-01', to: '2026-10-31' })).toBe(true)
    expect(inPeriod('2026-09-30', { from: '2026-10-01' })).toBe(false)
    expect(inPeriod('', {})).toBe(false)
    expect(normSource('')).toBe('other')
    expect(normSource('Walkin')).toBe('walk-in')
    expect(normSource('Facebook')).toBe('facebook')
  })
})

describe('summarizeSources', () => {
  const T = d => `${d}T03:00:00.000Z`
  const customers = [
    { id: 'a1', source: 'facebook', createdAt: T('2026-10-01'), stage: 'delivered' },
    { id: 'a2', source: 'facebook', createdAt: T('2026-10-02'), stage: 'pp' },
    { id: 'a3', source: 'facebook', createdAt: T('2026-10-03'), stage: 'pp', isLost: true },
    { id: 'a4', source: 'facebook', createdAt: T('2026-10-04'), stage: 'pp' },
    { id: 'a5', source: 'facebook', createdAt: T('2026-10-05'), stage: 'booking' },
    { id: 'b1', source: 'walk-in', createdAt: T('2026-10-06'), stage: 'pp' },
    { id: 'b2', source: '', createdAt: T('2026-10-07'), stage: 'lead' },
    { id: 'old', source: 'facebook', createdAt: T('2026-08-01'), stage: 'delivered' },
    { id: 'del', source: 'facebook', createdAt: T('2026-10-01'), deleted: true },
  ]
  const bookings = [
    { id: 'k1', customerId: 'a1', status: 'ส่งมอบแล้ว', bookingDate: '2026-10-05', totalIncome: 20000 },
    { id: 'k2', customerId: 'a5', status: 'จองแล้ว', bookingDate: '2026-10-07' },
    { id: 'k3', customerId: 'b1', status: 'ถอนจอง', bookingDate: '2026-10-08', totalIncome: 999 },
  ]
  const campaigns = [{ channel: 'facebook', spent: 10000, startDate: '2026-10-01' }, { channel: 'facebook', spent: 5000, startDate: '2026-07-01' }]

  it('counts what really happened per source in the period', () => {
    const { rows, total, best } = summarizeSources({ customers, bookings, campaigns }, { from: '2026-10-01', to: '2026-10-31' })
    const fb = rows.find(r => r.source === 'facebook')
    expect(fb).toMatchObject({ leads: 5, booked: 2, delivered: 1, lost: 1, open: 2, income: 20000, spent: 10000, bookRate: 40, costPerSale: 10000, costPerLead: 2000 })
    expect(fb.avgDaysToBook).toBe(3) // a1: 4 วัน, a5: 2 วัน
    const wk = rows.find(r => r.source === 'walk-in')
    expect(wk).toMatchObject({ leads: 1, booked: 0, income: 0 }) // ใบจองถอนแล้วไม่นับ
    expect(rows.find(r => r.source === 'other').leads).toBe(1)
    expect(total.leads).toBe(7)
    expect(best.source).toBe('facebook')
  })

  it('all-time includes older customers and all campaign spend', () => {
    const { rows } = summarizeSources({ customers, bookings, campaigns }, {})
    const fb = rows.find(r => r.source === 'facebook')
    expect(fb.leads).toBe(6)
    expect(fb.spent).toBe(15000)
  })

  it('handles empty input', () => {
    expect(summarizeSources({}, {})).toEqual({ rows: [], total: { leads: 0, booked: 0, delivered: 0, lost: 0, open: 0, income: 0, spent: 0, bookRate: 0 }, best: null })
  })
})
