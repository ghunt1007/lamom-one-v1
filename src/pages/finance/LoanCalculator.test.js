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

import { loanPreset } from './LoanCalculator.js'
import { loanCalcQuery, parsePaySpec } from '../../utils/payQuestions.js'
describe('loanPreset (v1.0.1062)', () => {
  it('reads valid values only', () => {
    expect(loanPreset(new URLSearchParams('price=899000&down=25&term=72'))).toEqual({ price: 899000, down: 25, term: 72 })
    expect(loanPreset(new URLSearchParams('price=5&down=90&term=36'))).toEqual({ price: null, down: null, term: null })
    expect(loanPreset(new URLSearchParams(''))).toEqual({ price: null, down: null, term: null })
    expect(loanPreset(new URLSearchParams('down=0'))).toMatchObject({ down: 0 })
  })
  it('round-trips a LAMI installment answer', () => {
    const spec = parsePaySpec('S07 ดาวน์ 20% ผ่อน 60 งวดเท่าไหร่', [{ brand: 'Deepal', model: 'S07', variant: 'L', price: 1329000, year: 2026 }])
    const qs = new URLSearchParams(loanCalcQuery(spec))
    expect(qs.get('model')).toContain('S07')
    expect(loanPreset(qs)).toEqual({ price: 1329000, down: 20, term: 60 })
    expect(loanCalcQuery({ price: 899000, car: '', months: null, downPct: null })).toBe('price=899000')
  })
})
