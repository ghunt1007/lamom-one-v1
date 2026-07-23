import { describe, it, expect } from 'vitest'
import { formatDate, formatDateTime, timeAgo, formatPhone, formatCurrency, formatNumber, initials, fullName } from './format.js'

describe('formatDate', () => {
  it('returns "-" for empty input', () => {
    expect(formatDate(null)).toBe('-')
    expect(formatDate('')).toBe('-')
  })

  it('converts an ISO date string to Thai format with Buddhist year (+543)', () => {
    expect(formatDate('2026-07-23')).toBe('23 ก.ค. 2569')
  })

  it('handles ISO strings with time components (takes only the date part)', () => {
    expect(formatDate('2026-01-05T10:30:00.000Z')).toBe('5 ม.ค. 2569')
  })

  it('handles a Date object', () => {
    expect(formatDate(new Date(2026, 11, 31))).toBe('31 ธ.ค. 2569')
  })

  it('handles a Firestore-like Timestamp object with toDate()', () => {
    const fakeTimestamp = { toDate: () => new Date(2025, 5, 15) }
    expect(formatDate(fakeTimestamp)).toBe('15 มิ.ย. 2568')
  })

  it('returns "-" for an unparseable value', () => {
    expect(formatDate('not-a-date')).toBe('-')
  })
})

describe('formatDateTime', () => {
  it('returns "-" for empty input', () => {
    expect(formatDateTime(null)).toBe('-')
  })

  it('includes zero-padded hours and minutes', () => {
    const d = new Date(2026, 0, 1, 9, 5)
    expect(formatDateTime(d)).toBe('1 ม.ค. 2569 09:05')
  })
})

describe('timeAgo', () => {
  it('returns "-" for empty input', () => {
    expect(timeAgo(null)).toBe('-')
  })

  it('returns "เมื่อกี้" for a timestamp less than a minute ago', () => {
    expect(timeAgo(new Date(Date.now() - 10_000).toISOString())).toBe('เมื่อกี้')
  })

  it('returns minutes ago for under an hour', () => {
    expect(timeAgo(new Date(Date.now() - 5 * 60_000).toISOString())).toBe('5 นาทีที่แล้ว')
  })

  it('returns hours ago for under a day', () => {
    expect(timeAgo(new Date(Date.now() - 3 * 3600_000).toISOString())).toBe('3 ชั่วโมงที่แล้ว')
  })

  it('returns days ago for under a week', () => {
    expect(timeAgo(new Date(Date.now() - 2 * 86400_000).toISOString())).toBe('2 วันที่แล้ว')
  })

  it('falls back to formatDate for a week or more', () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 86400_000)
    expect(timeAgo(eightDaysAgo.toISOString())).toBe(formatDate(eightDaysAgo.toISOString()))
  })
})

describe('formatPhone', () => {
  it('returns "-" for empty input', () => {
    expect(formatPhone(null)).toBe('-')
    expect(formatPhone('')).toBe('-')
  })

  it('formats a 10-digit Thai phone number as XXX-XXX-XXXX', () => {
    expect(formatPhone('0812345678')).toBe('081-234-5678')
  })

  it('strips non-digit characters before formatting', () => {
    expect(formatPhone('081-234-5678')).toBe('081-234-5678')
  })

  it('returns the original string unmodified if not exactly 10 digits', () => {
    expect(formatPhone('12345')).toBe('12345')
  })
})

describe('formatCurrency', () => {
  it('returns "-" for null/empty input', () => {
    expect(formatCurrency(null)).toBe('-')
    expect(formatCurrency('')).toBe('-')
  })

  it('formats a number with a baht sign and thousands separators', () => {
    expect(formatCurrency(1234567)).toBe('฿1,234,567')
  })

  it('treats 0 as a real value, not empty', () => {
    expect(formatCurrency(0)).toBe('฿0')
  })

  it('coerces numeric strings', () => {
    expect(formatCurrency('50000')).toBe('฿50,000')
  })
})

describe('formatNumber', () => {
  it('returns "-" for null/empty input', () => {
    expect(formatNumber(null)).toBe('-')
  })

  it('adds thousands separators with no decimals by default', () => {
    expect(formatNumber(1234567)).toBe('1,234,567')
  })

  it('respects an explicit decimals argument', () => {
    expect(formatNumber(3.14159, 2)).toBe('3.14')
  })
})

describe('initials', () => {
  it('returns uppercase initials from first + last name', () => {
    expect(initials('สมชาย', 'ใจดี')).toBe('สม'.charAt(0).toUpperCase() + 'ใจ'.charAt(0).toUpperCase())
  })

  it('falls back to "U" when both names are missing', () => {
    expect(initials(undefined, undefined)).toBe('U')
  })

  it('handles a missing last name', () => {
    expect(initials('A', undefined)).toBe('A')
  })
})

describe('fullName', () => {
  it('joins firstName and lastName with a space', () => {
    expect(fullName({ firstName: 'สมชาย', lastName: 'ใจดี' })).toBe('สมชาย ใจดี')
  })

  it('returns "-" when both are missing', () => {
    expect(fullName({})).toBe('-')
  })

  it('handles a missing lastName gracefully', () => {
    expect(fullName({ firstName: 'สมชาย' })).toBe('สมชาย')
  })
})
