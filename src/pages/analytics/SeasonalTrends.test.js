import { describe, it, expect } from 'vitest'
import { seasonalData, monthStrength } from './SeasonalTrends.js'

describe('SeasonalTrends', () => {
  it('counts real bookings per BE year/month and per model', () => {
    const { years, models } = seasonalData([
      { bookingDate: '2026-03-05', brand: 'AION', model: 'AION V Luxury' },
      { bookingDate: '2026-03-20', brand: 'AION', model: 'AION V Premium' },
      { bookingDate: '2025-12-01', brand: 'MG', model: 'MG4' },
      { bookingDate: '' },
    ])
    expect(years[2569][2]).toBe(2)
    expect(years[2568][11]).toBe(1)
    expect(Object.keys(years)).toEqual(['2568', '2569'])
    expect(models[2569]['AION V'][2]).toBe(2)
  })
  it('month strength needs >= 6 completed months and ignores the current month', () => {
    expect(monthStrength({ 2569: [1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0] }, '2026-04-10')).toBeNull()
    const r = monthStrength({ 2569: [10, 5, 5, 5, 5, 5, 99, 0, 0, 0, 0, 0] }, '2026-07-15')
    expect(r.peak[0].month).toBe('ม.ค.')
    expect(r.peak[0].diff).toBe(71)
    expect(r.low.map(x => x.month)).not.toContain('ก.ค.')
  })
})

describe('SeasonalTrends start month', () => {
  it('ignores months before the first booking', () => {
    const r = monthStrength({ 2569: [0, 5, 6, 4, 3, 3, 3, 4, 6, 0, 0, 0] }, '2026-11-02')
    expect([...r.peak, ...r.low].map(x => x.month)).not.toContain('ม.ค.')
  })
})
