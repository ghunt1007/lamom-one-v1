import { describe, it, expect } from 'vitest'
import { validateThaiId, formatThaiId, validateTaxId } from './thaiId.js'

// Known-valid 13-digit ID computed by hand against the MOD-11 checksum used by
// both validateThaiId and validateTaxId: digits 3,1,0,2,0,0,1,2,3,4,5,6 weighted
// 13..2 sum to 148 → (11 - 148%11) % 10 = (11-5)%10 = 6 → check digit 6.
const VALID_ID = '3102001234566'
const INVALID_CHECKSUM_ID = '3102001234567' // last digit off by one

describe('validateThaiId', () => {
  it('rejects empty input', () => {
    expect(validateThaiId('').valid).toBe(false)
    expect(validateThaiId(null).valid).toBe(false)
  })

  it('rejects anything that is not exactly 13 digits', () => {
    expect(validateThaiId('123').valid).toBe(false)
    expect(validateThaiId('12345678901234').valid).toBe(false)
    expect(validateThaiId('310200123456A').valid).toBe(false)
  })

  it('rejects an ID starting with 0', () => {
    const zeroLed = '0' + VALID_ID.slice(1)
    expect(validateThaiId(zeroLed).valid).toBe(false)
  })

  it('accepts a correctly-formatted valid ID with the right checksum', () => {
    expect(validateThaiId(VALID_ID)).toEqual({ valid: true })
  })

  it('accepts the same ID with dashes/spaces, ignoring them for validation', () => {
    expect(validateThaiId('3-1020-01234-56-6').valid).toBe(true)
    expect(validateThaiId('3 1020 01234 56 6').valid).toBe(true)
  })

  it('rejects an ID with an incorrect checksum digit', () => {
    expect(validateThaiId(INVALID_CHECKSUM_ID).valid).toBe(false)
  })
})

describe('formatThaiId', () => {
  it('progressively groups digits as 1-4-5-2-1 while typing', () => {
    expect(formatThaiId('3')).toBe('3')
    expect(formatThaiId('31')).toBe('3-1')
    expect(formatThaiId('31020')).toBe('3-1020')
    expect(formatThaiId('310200')).toBe('3-1020-0')
    expect(formatThaiId('3102001234')).toBe('3-1020-01234')
    expect(formatThaiId('31020012345')).toBe('3-1020-01234-5')
    expect(formatThaiId('310200123456')).toBe('3-1020-01234-56')
    expect(formatThaiId(VALID_ID)).toBe('3-1020-01234-56-6')
  })

  it('strips non-digit characters before formatting', () => {
    expect(formatThaiId('3-1020-01234-56-6')).toBe('3-1020-01234-56-6')
  })

  it('truncates to 13 digits, ignoring anything beyond', () => {
    expect(formatThaiId(VALID_ID + '999')).toBe('3-1020-01234-56-6')
  })

  it('returns an empty string for empty input', () => {
    expect(formatThaiId('')).toBe('')
    expect(formatThaiId(null)).toBe('')
  })
})

describe('validateTaxId', () => {
  it('rejects empty input', () => {
    expect(validateTaxId('').valid).toBe(false)
  })

  it('rejects anything that is not exactly 13 digits', () => {
    expect(validateTaxId('123').valid).toBe(false)
  })

  it('accepts a tax ID starting with 0 (juristic-person IDs routinely do)', () => {
    // Recompute a valid checksum for a 0-led 13-digit number: digits
    // 0,1,0,2,0,0,1,2,3,4,5,6 weighted 13..2: 0+12+0+20+0+0+7+12+15+16+15+12=109
    // (11 - 109%11) % 10 = (11-10)%10 = 1
    const zeroLedValid = '0102001234561'
    expect(validateTaxId(zeroLedValid)).toEqual({ valid: true })
  })

  it('accepts the same checksum algorithm as validateThaiId for a non-zero-led number', () => {
    expect(validateTaxId(VALID_ID)).toEqual({ valid: true })
  })

  it('rejects an incorrect checksum digit', () => {
    expect(validateTaxId(INVALID_CHECKSUM_ID).valid).toBe(false)
  })
})
