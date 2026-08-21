import { describe, it, expect } from 'vitest'
import { hasThreeWithinDays, ALL_BADGES } from './gamificationData.js'

describe('hasThreeWithinDays — Speed Closer badge condition (3 deliveries within N days)', () => {
  it('returns true when 3 dates fall within the window', () => {
    expect(hasThreeWithinDays(['2026-08-01', '2026-08-03', '2026-08-06'], 7)).toBe(true)
  })

  it('returns false when the 3 closest dates span more than the window', () => {
    expect(hasThreeWithinDays(['2026-08-01', '2026-08-05', '2026-08-10'], 7)).toBe(false)
  })

  it('returns false with fewer than 3 dates', () => {
    expect(hasThreeWithinDays(['2026-08-01', '2026-08-02'], 7)).toBe(false)
    expect(hasThreeWithinDays([], 7)).toBe(false)
  })

  it('finds a qualifying window anywhere in a longer unsorted list, not just the first 3', () => {
    const dates = ['2026-01-01', '2026-08-01', '2026-08-02', '2026-08-04', '2026-12-25']
    expect(hasThreeWithinDays(dates, 7)).toBe(true)
  })

  it('ignores null/undefined/unparseable entries instead of throwing', () => {
    expect(hasThreeWithinDays([null, undefined, '2026-08-01', 'not-a-date', '2026-08-02', '2026-08-03'], 7)).toBe(true)
  })

  it('treats exactly-on-the-boundary window as qualifying (<=, not <)', () => {
    expect(hasThreeWithinDays(['2026-08-01', '2026-08-04', '2026-08-08'], 7)).toBe(true)
  })
})

describe('ALL_BADGES — check functions only exist where the underlying data is reliably attributable', () => {
  it('Speed Closer (B005), Perfect Attendance (B011), and KPI Champion (B008) now have real check functions', () => {
    const b005 = ALL_BADGES.find(b => b.id === 'B005')
    const b011 = ALL_BADGES.find(b => b.id === 'B011')
    const b008 = ALL_BADGES.find(b => b.id === 'B008')
    expect(typeof b005.check).toBe('function')
    expect(typeof b011.check).toBe('function')
    expect(typeof b008.check).toBe('function')
  })

  it('KPI Champion requires 3 consecutive months hit, not just any 3 months ever (vacuously-true guard: 0 counts as not met)', () => {
    const b008 = ALL_BADGES.find(b => b.id === 'B008')
    expect(b008.check({ kpiChampionMonths: 0 })).toBe(false)
    expect(b008.check({ kpiChampionMonths: 2 })).toBe(false)
    expect(b008.check({ kpiChampionMonths: 3 })).toBe(true)
    expect(b008.check({ kpiChampionMonths: 5 })).toBe(true)
  })

  it('Perfect Attendance requires full 6-month coverage AND zero absences (not vacuously true for a brand-new record)', () => {
    const b011 = ALL_BADGES.find(b => b.id === 'B011')
    expect(b011.check({ attendanceMonthsCovered: 0, attendanceAbsences: 0 })).toBe(false)
    expect(b011.check({ attendanceMonthsCovered: 6, attendanceAbsences: 1 })).toBe(false)
    expect(b011.check({ attendanceMonthsCovered: 6, attendanceAbsences: 0 })).toBe(true)
  })

  it('badges lacking a reliable data source (EV Expert, Customer Whisperer, Top Revenue) stay explicitly untracked', () => {
    ;['B004', 'B006', 'B012'].forEach(id => {
      expect(ALL_BADGES.find(b => b.id === id).check).toBe(null)
    })
  })
})
