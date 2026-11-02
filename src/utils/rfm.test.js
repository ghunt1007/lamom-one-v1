import { describe, it, expect } from 'vitest'
import { rfmSegments, rfmTierOf } from './rfm.js'

const now = Date.parse('2026-11-02')
const ago = d => new Date(now - d * 86400000).toISOString().slice(0, 10)

describe('rfm', () => {
  it('assigns each customer to exactly one tier', () => {
    const sales = [
      { custName: 'A', date: ago(10), salePrice: 1500000 }, { custName: 'A', date: ago(200), salePrice: 900000 },
      { custName: 'B', date: ago(30), salePrice: 700000 }, { custName: 'B', date: ago(40), salePrice: 700000 },
      { custName: 'C', date: ago(20), salePrice: 800000 },
      { custName: 'D', date: ago(150), salePrice: 800000 },
      { custName: 'E', date: ago(500), salePrice: 800000 },
      { custName: 'F', date: ago(900), salePrice: 800000 },
      { custName: '', date: ago(1), salePrice: 1 },
    ]
    const r = rfmSegments(sales, now)
    expect(r.champions.count).toBe(1)
    expect(r.champions.avgValue).toBe(2400000)
    expect(r.loyal.count).toBe(1)
    expect(r.new.count).toBe(1)
    expect(r.potential.count).toBe(1)
    expect(r.at_risk.count).toBe(1)
    expect(r.lost.count).toBe(1)
    const sum = Object.values(r).reduce((a, t) => a + t.count, 0)
    expect(sum).toBe(6)
  })
  it('groups by customerId or phone before name', () => {
    const r = rfmSegments([
      { customerId: 'x', custName: 'สมชาย', date: ago(5), salePrice: 1 },
      { customerId: 'y', custName: 'สมชาย', date: ago(5), salePrice: 1 },
    ], now)
    expect(r.new.count).toBe(2)
  })
  it('missing date counts as lost, empty input is all zero', () => {
    expect(rfmTierOf({ count: 1, total: 0, lastDate: '' }, now)).toBe('lost')
    const r = rfmSegments([], now)
    expect(Object.values(r).every(t => t.count === 0 && t.avgValue === 0)).toBe(true)
  })
})
