import { describe, it, expect } from 'vitest'
import { newBookingNo } from './bookingNo.js'

describe('newBookingNo', () => {
  it('uses the Thai date and a 3-digit suffix', () => {
    expect(newBookingNo('2026-10-27', () => 0)).toBe('SK261027100')
    expect(newBookingNo('2026-10-27', () => 0.999)).toBe('SK261027999')
  })
})
