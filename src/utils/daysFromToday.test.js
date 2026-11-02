import { describe, it, expect } from 'vitest'
import { daysFromToday, ymdBangkok } from './format.js'

describe('daysFromToday', () => {
  it('counts calendar days in Thai time', () => {
    expect(daysFromToday('2026-11-03', '2026-11-03')).toBe(0)
    expect(daysFromToday('2026-11-04', '2026-11-03')).toBe(1)
    expect(daysFromToday('2026-11-01', '2026-11-03')).toBe(-2)
    expect(daysFromToday('2027-01-01', '2026-12-31')).toBe(1)
  })
  it('uses the Thai date of a timestamp', () => {
    // 2026-11-03 20:00 UTC = 2026-11-04 03:00 in Bangkok
    expect(ymdBangkok('2026-11-03T20:00:00Z')).toBe('2026-11-04')
    expect(daysFromToday('2026-11-03T20:00:00Z', '2026-11-03')).toBe(1)
  })
  it('returns NaN for missing or bad dates', () => {
    expect(daysFromToday('', '2026-11-03')).toBeNaN()
    expect(daysFromToday('abc', '2026-11-03')).toBeNaN()
  })
})
