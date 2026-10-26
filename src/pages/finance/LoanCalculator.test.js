import { describe, it, expect } from 'vitest'
import { catalogPriceList, pickModel } from './LoanCalculator.js'

describe('LoanCalculator catalog', () => {
  const V = [
    { brand: 'BYD', model: 'Seal', variant: 'AWD', price: 1599000 },
    { brand: 'Deepal', model: 'S07 (2024)', variant: 'Standard', price: 1119000 },
    { brand: 'Deepal', model: 'S05', variant: 'BEV LITE', price: 799000 },
    { brand: 'X', model: 'Y', price: 0 },
  ]
  it('lists Deepal first, cheapest first, and skips priceless rows', () => {
    expect(Object.keys(catalogPriceList(V))).toEqual(['Deepal S05 BEV LITE', 'Deepal S07 (2024) Standard', 'BYD Seal AWD'])
    expect(catalogPriceList([])).toBeNull()
  })
  it('picks the model the customer is interested in', () => {
    const m = catalogPriceList(V)
    expect(pickModel(m, 'DEEPAL S07')).toBe('Deepal S07 (2024) Standard')
    expect(pickModel(m, 'seal')).toBe('BYD Seal AWD')
    expect(pickModel(m, '')).toBe('Deepal S05 BEV LITE')
  })
})
