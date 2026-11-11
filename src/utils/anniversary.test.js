import { describe, it, expect } from 'vitest'
import { nextAnniversary } from './anniversary.js'

describe('nextAnniversary', () => {
  it('gives this year when still ahead', () => {
    expect(nextAnniversary('2024-11-15', '2026-11-11')).toEqual({ date: '2026-11-15', years: 2 })
  })
  it('counts today as this year', () => {
    expect(nextAnniversary('2025-11-11', '2026-11-11')).toEqual({ date: '2026-11-11', years: 1 })
  })
  it('moves to next year when already passed', () => {
    expect(nextAnniversary('2024-11-03', '2026-11-11')).toEqual({ date: '2027-11-03', years: 3 })
  })
  it('never reports a zero-year anniversary', () => {
    expect(nextAnniversary('2026-11-05', '2026-11-11')).toEqual({ date: '2027-11-05', years: 1 })
    expect(nextAnniversary('2026-11-20', '2026-11-11')).toEqual({ date: '2027-11-20', years: 1 })
  })
  it('handles 29 Feb and bad input', () => {
    expect(nextAnniversary('2024-02-29', '2026-01-10')).toEqual({ date: '2026-02-28', years: 2 })
    expect(nextAnniversary('2024-02-29', '2027-12-01')).toEqual({ date: '2028-02-29', years: 4 })
    expect(nextAnniversary('', '2026-01-10')).toBeNull()
    expect(nextAnniversary('2027-01-01', '2026-01-10')).toBeNull()
  })
})
