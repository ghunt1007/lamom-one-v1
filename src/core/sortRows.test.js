import { describe, it, expect } from 'vitest'
import { sortRows, isMissingIndexError } from './sortRows.js'

describe('sortRows', () => {
  it('sorts strings, numbers and timestamps; missing values last', () => {
    const rows = [{ id: 'a', d: '2026-01-02' }, { id: 'b' }, { id: 'c', d: '2026-03-01' }]
    expect(sortRows(rows, 'd', 'desc').map(r => r.id)).toEqual(['c', 'a', 'b'])
    expect(sortRows(rows, 'd', 'asc').map(r => r.id)).toEqual(['a', 'c', 'b'])
    const ts = [{ id: 1, t: { seconds: 10 } }, { id: 2, t: { toMillis: () => 99000 } }]
    expect(sortRows(ts, 't').map(r => r.id)).toEqual([2, 1])
  })
  it('recognises missing-index errors', () => {
    expect(isMissingIndexError({ code: 'failed-precondition' })).toBe(true)
    expect(isMissingIndexError({ message: 'The query requires an index. You can create it here' })).toBe(true)
    expect(isMissingIndexError({ code: 'permission-denied' })).toBe(false)
  })
})
