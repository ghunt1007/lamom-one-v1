import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./db.js', () => ({ listDocs: vi.fn() }))

import { listDocs } from './db.js'
import { getSegmentMembers, reachableMembers, getSegmentCount } from './segments.js'

function daysAgoIso(n) {
  return new Date(Date.now() - n * 86400000).toISOString()
}

describe('reachableMembers', () => {
  const members = [
    { id: 'a', phone: '0812345678', email: '', lineId: '' },
    { id: 'b', phone: '', email: 'x@y.com', lineId: '@line' },
    { id: 'c', phone: '', email: '', lineId: '' },
  ]

  it('keeps only members with a phone number for the sms channel', () => {
    expect(reachableMembers(members, 'sms').map(m => m.id)).toEqual(['a'])
  })

  it('keeps only members with an email address for the email channel', () => {
    expect(reachableMembers(members, 'email').map(m => m.id)).toEqual(['b'])
  })

  it('returns every member unchanged for the line channel (broadcast API, no per-contact filter)', () => {
    expect(reachableMembers(members, 'line')).toEqual(members)
  })

  it('returns an empty list for the push channel (no push token storage exists yet)', () => {
    expect(reachableMembers(members, 'push')).toEqual([])
  })

  it('returns every member unchanged for an unrecognized channel', () => {
    expect(reachableMembers(members, 'carrier_pigeon')).toEqual(members)
  })
})

describe('getSegmentMembers', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns every non-deleted customer for target "all"', async () => {
    listDocs.mockResolvedValue([
      { id: '1', firstName: 'A', lastName: 'One', stage: 'lead' },
      { id: '2', firstName: 'B', lastName: 'Two', stage: 'delivered', deleted: true },
    ])
    const members = await getSegmentMembers('all')
    expect(members.map(m => m.id)).toEqual(['1'])
    expect(members[0].name).toBe('A One')
  })

  it('keeps only booking/delivered customers for target "active"', async () => {
    listDocs.mockResolvedValue([
      { id: '1', stage: 'lead' },
      { id: '2', stage: 'booking' },
      { id: '3', stage: 'delivered' },
    ])
    const members = await getSegmentMembers('active')
    expect(members.map(m => m.id).sort()).toEqual(['2', '3'])
  })

  it('keeps only lead/prospect customers idle 90+ days for target "at_risk"', async () => {
    listDocs.mockResolvedValue([
      { id: 'stale-lead', stage: 'lead', updatedAt: daysAgoIso(100) },
      { id: 'fresh-lead', stage: 'lead', updatedAt: daysAgoIso(10) },
      { id: 'stale-booking', stage: 'booking', updatedAt: daysAgoIso(200) }, // wrong stage, excluded
    ])
    const members = await getSegmentMembers('at_risk')
    expect(members.map(m => m.id)).toEqual(['stale-lead'])
  })

  it('reads from warranty_expiry_vehicles and keeps only "expiring" status for target "expiring_warranty"', async () => {
    listDocs.mockResolvedValue([
      { id: 'v1', owner: 'สมชาย', phone: '0811111111', status: 'expiring' },
      { id: 'v2', owner: 'สมหญิง', phone: '0822222222', status: 'active' },
    ])
    const members = await getSegmentMembers('expiring_warranty')
    expect(members).toEqual([{ id: 'v1', name: 'สมชาย', phone: '0811111111', lineId: '', email: '' }])
  })

  it('falls back to an empty list if the underlying fetch throws', async () => {
    listDocs.mockRejectedValue(new Error('firestore down'))
    expect(await getSegmentMembers('all')).toEqual([])
  })
})

describe('getSegmentCount', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('counts only members reachable on the given channel', async () => {
    listDocs.mockResolvedValue([
      { id: '1', firstName: 'A', phone: '0811111111' },
      { id: '2', firstName: 'B', phone: '' },
    ])
    expect(await getSegmentCount('all', 'sms')).toBe(1)
  })
})
