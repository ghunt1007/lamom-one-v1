import { describe, it, expect } from 'vitest'
import { speedImpact, speedImpactText } from './speedImpact.js'
import { parseOpsSpec } from './opsQuestions.js'

const now = Date.parse('2026-11-28T00:00:00Z')
const lead = (i, gapH, won, src = 'Facebook') => {
  const t = Date.parse('2026-08-01T03:00:00Z') + i * 3600000
  return { createdAt: new Date(t).toISOString(), firstContactAt: gapH == null ? null : new Date(t + gapH * 3600000).toISOString(), stage: won ? 'booking' : 'lead', source: src }
}

describe('speedImpact (v1.0.1446)', () => {
  const fast = Array.from({ length: 12 }, (_, i) => lead(i, 0.5, i < 6))
  const slow = Array.from({ length: 12 }, (_, i) => lead(20 + i, i % 2 ? 48 : null, i < 2))
  const mid = Array.from({ length: 8 }, (_, i) => lead(40 + i, 5, i < 3))
  const walk = [lead(-2, 0.1, true, 'Walk-in'), ...Array.from({ length: 20 }, (_, i) => lead(60 + i, 0.1, true, 'Walk-in'))]
  it('buckets by first contact, skips walk-in and too-new leads', () => {
    const r = speedImpact([...fast, ...slow, ...mid, ...walk, { ...lead(99, 0.2, true), createdAt: '2026-11-20T00:00:00Z' }], now)
    expect(r).toMatchObject({ n: 32, fast: { n: 12, won: 6 }, mid: { n: 8, won: 3 }, slow: { n: 12, won: 2 } })
    const t = speedImpactText(r)
    expect(t).toContain('โทรภายใน 1 ชม. ปิดได้ 50% (6/12)')
    expect(t).toContain('มากกว่า 3.0 เท่า')
  })
  it('null when too few', () => {
    expect(speedImpact(fast, now)).toBeNull()
    expect(speedImpact([], now)).toBeNull()
    expect(speedImpactText(null)).toContain('ยังบอกไม่ได้')
  })
  it('routes', () => {
    for (const q of ['โทรเร็วช่วยปิดการขายไหม', 'ความเร็วในการโทรลีดมีผลไหม']) expect(parseOpsSpec(q)?.kind, q).toBe('speedimpact')
    expect(parseOpsSpec('ใครโทรลีดช้าสุด')?.kind).not.toBe('speedimpact')
  })
})
