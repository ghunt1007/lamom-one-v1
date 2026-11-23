import { describe, it, expect } from 'vitest'
import { isMonthBangkok } from './format.js'

describe('isMonthBangkok', () => {
  it('matches date strings, ISO (Bangkok day), timestamps and rejects empties', () => {
    expect(isMonthBangkok('2026-11-05', '2026-11')).toBe(true)
    expect(isMonthBangkok('2026-10-31', '2026-11')).toBe(false)
    expect(isMonthBangkok('2026-10-31T18:00:00Z', '2026-11')).toBe(true) // 01:00 1 พ.ย. เวลาไทย
    expect(isMonthBangkok({ seconds: Date.UTC(2026, 10, 10) / 1000 }, '2026-11')).toBe(true)
    expect(isMonthBangkok(null, '2026-11')).toBe(false)
    expect(isMonthBangkok('', '2026-11')).toBe(false)
  })
})
