import { describe, it, expect } from 'vitest'
import { saleCost, isCostEstimated, costEstimateNote } from './saleCost.js'

describe('saleCost', () => {
  it('uses real cost when present', () => {
    expect(saleCost({ cost: 700000, salePrice: 1000000 })).toBe(700000)
    expect(isCostEstimated({ cost: 700000, salePrice: 1000000 })).toBe(false)
  })
  it('estimates 82% when missing', () => {
    expect(saleCost({ salePrice: 1000000 })).toBe(820000)
    expect(saleCost({ cost: '', salePrice: '500000' })).toBe(410000)
    expect(isCostEstimated({ salePrice: 1000000 })).toBe(true)
  })
  it('handles empty', () => {
    expect(saleCost({})).toBe(0)
    expect(saleCost(null)).toBe(0)
    expect(isCostEstimated({})).toBe(false)
  })
  it('note counts estimated rows only', () => {
    expect(costEstimateNote([{ cost: 1, salePrice: 2 }])).toBe('')
    expect(costEstimateNote([{ salePrice: 2 }, { salePrice: 3 }, { cost: 1, salePrice: 2 }])).toContain('2 คัน')
  })
})
