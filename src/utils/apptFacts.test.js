import { describe, it, expect } from 'vitest'
import { showroomVisitLine, serviceTodayLines } from './apptFacts.js'

describe('apptFacts', () => {
  it('ignores deleted rows and other days', () => {
    expect(showroomVisitLine([{ date: '2026-11-10', status: 'arrived', deleted: true }, { date: '2026-11-09', status: 'arrived' }], '2026-11-10')).toBeNull()
    expect(serviceTodayLines([{ date: '2026-11-10', status: 'noshow' }], '2026-11-10')).toEqual([])
  })
  it('caps the service list', () => {
    const rows = Array.from({ length: 4 }, (_, i) => ({ date: '2026-11-10', time: `0${i + 8}:00`, custName: 'c' + i }))
    const out = serviceTodayLines(rows, '2026-11-10', 2)
    expect(out[0]).toContain('4 คัน')
    expect(out.at(-1)).toBe('  - …และอีก 2 คัน')
  })
})
