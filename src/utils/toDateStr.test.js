import { describe, it, expect } from 'vitest'
import { toDateStr } from './format.js'

describe('toDateStr (Bangkok date)', () => {
  it('counts 06:30 Bangkok as the same Thai day, not yesterday', () => {
    expect(toDateStr(new Date('2026-11-08T23:30:00Z'))).toBe('2026-11-09')
    expect(toDateStr({ toDate: () => new Date('2026-11-08T23:30:00Z') })).toBe('2026-11-09')
    expect(toDateStr({ seconds: Date.parse('2026-11-08T23:30:00Z') / 1000 })).toBe('2026-11-09')
  })
  it('keeps a plain YYYY-MM-DD and returns empty for nothing', () => {
    expect(toDateStr('2026-11-09')).toBe('2026-11-09')
    expect(toDateStr('')).toBe('')
    expect(toDateStr(null)).toBe('')
  })
  it('late evening Bangkok stays on that day', () => {
    expect(toDateStr('2026-11-09T16:59:00Z')).toBe('2026-11-09')
    expect(toDateStr('2026-11-09T17:00:00Z')).toBe('2026-11-10')
  })
})
