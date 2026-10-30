import { describe, it, expect } from 'vitest'
import { stockAgeDays, stockAgeTone } from './stockAge.js'

describe('stockAgeDays', () => {
  it('counts whole days from arrival to today', () => {
    expect(stockAgeDays('2026-09-01', '2026-10-31')).toBe(60)
    expect(stockAgeDays('2026-10-31T09:00:00', '2026-10-31')).toBe(0)
  })
  it('returns null without a valid arrival date', () => {
    expect(stockAgeDays('', '2026-10-31')).toBe(null)
    expect(stockAgeDays('ไม่ทราบ', '2026-10-31')).toBe(null)
  })
  it('never goes negative for future dates', () => {
    expect(stockAgeDays('2026-11-05', '2026-10-31')).toBe(0)
  })
})

describe('stockAgeTone', () => {
  it('warns at 60 days and flags 90+', () => {
    expect(stockAgeTone(59)).toBe('muted')
    expect(stockAgeTone(60)).toBe('warning')
    expect(stockAgeTone(90)).toBe('danger')
    expect(stockAgeTone(null)).toBe('')
  })
})
