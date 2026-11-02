import { describe, it, expect } from 'vitest'
import { realFunnel, stepRate, repeatBuyers } from './realFunnel.js'

describe('realFunnel', () => {
  it('counts only recorded steps', () => {
    const f = realFunnel({
      customers: [{ id: 'a' }, { id: 'b', testDriveDate: '2026-10-01' }, { id: 'c' }, { id: 'x', deleted: true }],
      testDrives: [{ customerId: 'a' }, { customerId: 'a' }, { customerId: 'z', deleted: true }],
      quotations: [{ customerId: 'a' }],
      sales: [{ delivered: true }, { delivered: false }],
    })
    expect(f.map(s => [s.key, s.count])).toEqual([['lead', 3], ['td', 2], ['quote', 1], ['booked', 2], ['delivered', 1]])
  })
  it('is all zero with no data and never invents numbers', () => {
    expect(realFunnel().every(s => s.count === 0)).toBe(true)
  })
  it('caps step rate and handles zero', () => {
    expect(stepRate(5, 0)).toBe(0)
    expect(stepRate(5, 2)).toBe(100)
    expect(stepRate(1, 4)).toBe(25)
  })
  it('finds repeat buyers by phone or name', () => {
    expect(repeatBuyers([{ phone: '081-111-1111' }, { phone: '0811111111' }, { custName: 'ก' }, { custName: 'ข' }])).toBe(1)
  })
})
