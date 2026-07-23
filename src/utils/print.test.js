import { describe, it, expect } from 'vitest'
import { bahtText, money, esc } from './print.js'

describe('bahtText', () => {
  it('handles zero', () => {
    expect(bahtText(0)).toBe('ศูนย์บาทถ้วน')
  })

  it('handles a simple whole number', () => {
    expect(bahtText(5)).toBe('ห้าบาทถ้วน')
  })

  it('uses เอ็ด instead of หนึ่ง for a trailing 1 in a multi-digit number', () => {
    expect(bahtText(21)).toBe('ยี่สิบเอ็ดบาทถ้วน')
    expect(bahtText(11)).toBe('สิบเอ็ดบาทถ้วน')
  })

  it('uses ยี่ instead of สอง for 2 in the tens place', () => {
    expect(bahtText(20)).toBe('ยี่สิบบาทถ้วน')
  })

  it('does not use เอ็ด for a standalone 1', () => {
    expect(bahtText(1)).toBe('หนึ่งบาทถ้วน')
  })

  it('handles hundreds, thousands, and ten-thousands places', () => {
    expect(bahtText(100)).toBe('หนึ่งร้อยบาทถ้วน')
    expect(bahtText(1000)).toBe('หนึ่งพันบาทถ้วน')
    expect(bahtText(10000)).toBe('หนึ่งหมื่นบาทถ้วน')
  })

  it('handles a realistic vehicle sale price', () => {
    expect(bahtText(1669000)).toBe('หนึ่งล้านหกแสนหกหมื่นเก้าพันบาทถ้วน')
  })

  it('handles millions with a remainder', () => {
    expect(bahtText(2500021)).toBe('สองล้านห้าแสนยี่สิบเอ็ดบาทถ้วน')
  })

  it('appends สตางค์ text for a decimal remainder instead of ถ้วน', () => {
    expect(bahtText(100.50)).toBe('หนึ่งร้อยบาทห้าสิบสตางค์')
  })

  it('rounds satang to the nearest whole unit', () => {
    expect(bahtText(1.01)).toBe('หนึ่งบาทหนึ่งสตางค์')
  })

  it('rounds 1.005 down to 0 satang — a known IEEE 754 quirk (1.005 is actually stored as ~1.00499999...), not a bug', () => {
    expect(bahtText(1.005)).toBe('หนึ่งบาทถ้วน')
  })

  it('treats a non-numeric input as zero', () => {
    expect(bahtText('abc')).toBe('ศูนย์บาทถ้วน')
    expect(bahtText(null)).toBe('ศูนย์บาทถ้วน')
  })
})

describe('money', () => {
  it('formats with thousands separators and no decimals', () => {
    expect(money(1234567)).toBe('1,234,567')
  })

  it('returns "0" for null/empty input', () => {
    expect(money(null)).toBe('0')
    expect(money('')).toBe('0')
  })

  it('treats 0 as a real value', () => {
    expect(money(0)).toBe('0')
  })
})

describe('esc (print.js — text-node escaping only, not attribute-safe)', () => {
  it('escapes &, <, > for safe text-node interpolation', () => {
    expect(esc('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;')
  })

  it('does not escape quotes — callers must never use this inside an HTML attribute', () => {
    expect(esc(`"onmouseover="x`)).toBe(`"onmouseover="x`)
  })

  it('coerces null/undefined to an empty string', () => {
    expect(esc(null)).toBe('')
    expect(esc(undefined)).toBe('')
  })
})
