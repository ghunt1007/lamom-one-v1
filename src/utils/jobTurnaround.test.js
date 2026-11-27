import { describe, it, expect } from 'vitest'
import { statusStamp, jobTurnaround, slowJobs, daysText } from './jobTurnaround.js'

const T = '2026-11-28'
const job = (c, d, extra = {}) => ({ createdAt: c, doneAt: d, status: 'delivered', ...extra })

describe('jobTurnaround', () => {
  it('stamps done/delivered once', () => {
    expect(statusStamp({}, 'done', 'X')).toEqual({ doneAt: 'X' })
    expect(statusStamp({ doneAt: 'A' }, 'delivered', 'X')).toEqual({ deliveredAt: 'X' })
    expect(statusStamp({}, 'delivered', 'X')).toEqual({ doneAt: 'X', deliveredAt: 'X' })
    expect(statusStamp({}, 'qc', 'X')).toEqual({})
  })
  it('median/p80 of recent done jobs; null under 5', () => {
    const jobs = [1, 1, 2, 2, 3, 5].map(n => job('2026-11-01T00:00:00Z', new Date(Date.UTC(2026, 10, 1 + n)).toISOString()))
    const ta = jobTurnaround([...jobs, job('2026-05-01T00:00:00Z', '2026-05-02T00:00:00Z'), job('2026-11-02T00:00:00Z')], T)
    expect(ta).toMatchObject({ n: 6, median: 2, p80: 3 })
    expect(jobTurnaround(jobs.slice(0, 4), T)).toBeNull()
  })
  it('slow = active jobs older than p80', () => {
    const now = Date.parse('2026-11-28T00:00:00Z')
    const s = slowJobs([
      { id: 'a', status: 'inprogress', createdAt: '2026-11-20T00:00:00Z' },
      { id: 'b', status: 'inprogress', createdAt: '2026-11-26T00:00:00Z' },
      { id: 'c', status: 'done', createdAt: '2026-11-01T00:00:00Z' },
      { id: 'd', status: 'waiting_parts', createdAt: '2026-11-10T00:00:00Z' },
    ], { p80: 3 }, now)
    expect(s.map(x => x.j.id)).toEqual(['d', 'a'])
    expect(slowJobs([{ status: 'qc', createdAt: '2026-01-01' }], null)).toEqual([])
  })
  it('daysText', () => {
    expect(daysText(0.25)).toBe('6 ชม.')
    expect(daysText(2)).toBe('2 วัน')
    expect(daysText(2.46)).toBe('2.5 วัน')
  })
})
