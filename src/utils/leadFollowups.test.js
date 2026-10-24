import { describe, it, expect, vi } from 'vitest'
vi.mock('../core/db.js', () => ({ createDoc: vi.fn() }))
vi.mock('../core/companyScope.js', () => ({ myEffectiveCompanyId: () => null }))
const { buildLeadFollowups, addDaysTo } = await import('./leadFollowups.js')

describe('buildLeadFollowups', () => {
  const lead = { firstName: 'สมชาย', lastName: 'ใจดี', phone: '0812345678', interestedModel: 'BYD Seal', assignedTo: 'วิชัย', stage: 'pp' }

  it('plans calls on day 1, 3 and 7 for the person looking after the lead', () => {
    const f = buildLeadFollowups(lead, 'c1', '2026-10-30')
    expect(f.map(x => x.dueDate)).toEqual(['2026-10-31', '2026-11-02', '2026-11-06'])
    expect(f.map(x => x.type)).toEqual(['call', 'line', 'call'])
    expect(f[0]).toMatchObject({ customerId: 'c1', customerName: 'สมชาย ใจดี', phone: '0812345678', vehicleModel: 'BYD Seal', salesperson: 'วิชัย', status: 'pending', autoLead: true })
  })

  it('does nothing for customers who already booked, were delivered, or were lost', () => {
    expect(buildLeadFollowups({ ...lead, stage: 'booking' }, 'c1')).toEqual([])
    expect(buildLeadFollowups({ ...lead, isLost: true }, 'c1')).toEqual([])
    expect(buildLeadFollowups(null, 'c1')).toEqual([])
  })

  it('adds days across month and year ends', () => {
    expect(addDaysTo('2026-12-30', 7)).toBe('2027-01-06')
  })
})
