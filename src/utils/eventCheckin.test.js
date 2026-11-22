import { describe, it, expect } from 'vitest'
import { checkinStaff, visitorsOf } from './marketingEvents.js'

describe('EventCheckin', () => {
  it('lists today shift, then event staff, then all sales — no duplicates', () => {
    const e = { staff: ['B', 'C'], shifts: { '2026-11-23': ['C', 'A'] } }
    const r = checkinStaff(e, '2026-11-23', ['A', 'D'], 'D')
    expect(r.list).toEqual(['C', 'A', 'B', 'D'])
    expect(r.def).toBe('D')
  })
  it('defaults to first name when logged-in user is not listed', () => {
    expect(checkinStaff({ staff: ['B'] }, '2026-11-23', [], 'X').def).toBe('B')
    expect(checkinStaff(null, '2026-11-23', [], 'X')).toEqual({ list: [], def: '' })
  })
  it('filters visitors by event; no event shows old untagged ones', () => {
    const v = [{ id: 1, eventId: 'e1' }, { id: 2 }, { id: 3, eventId: 'e2' }, { id: 4, eventId: 'e1', deleted: true }]
    expect(visitorsOf(v, 'e1').map(x => x.id)).toEqual([1])
    expect(visitorsOf(v, '').map(x => x.id)).toEqual([2])
  })
})

import { eventMetrics } from './marketingEvents.js'
describe('eventMetrics visitors (v1.0.1320)', () => {
  it('attendees = max(manual, checked-in visitors of this event)', () => {
    const e = { id: 'e1', attendees: 2 }
    const visitors = [{ eventId: 'e1' }, { eventId: 'e1' }, { eventId: 'e1' }, { eventId: 'e2' }, { eventId: 'e1', deleted: true }]
    const m = eventMetrics(e, { visitors })
    expect(m.checkedIn).toBe(3)
    expect(m.attendees).toBe(3)
    expect(eventMetrics({ id: 'e1', attendees: 10 }, { visitors }).attendees).toBe(10)
    expect(eventMetrics({ id: 'e1' }).attendees).toBe(0)
  })
})
