import { describe, it, expect } from 'vitest'
import { modelFacts, buildCustomerBrief } from './salesAi.js'
import { VEHICLES } from '../data/vehicleDatabase.js'

const V = [
  { brand: 'Deepal', model: 'S05', variant: 'BEV LITE', price: 799000, range: 450, warranty: '5 ปี' },
  { brand: 'Deepal', model: 'S05', variant: 'BEV MAX', price: 899000, range: 500 },
  { brand: 'Deepal', model: 'S07 (2024)', variant: 'Standard Range', price: 1119000, range: 485, chargeDC: 92 },
  { brand: 'Other', model: 'S0', variant: 'X', price: 1 },
]

describe('modelFacts', () => {
  it('matches model with brand and lists variants cheapest first', () => {
    const f = modelFacts('Deepal S05', V)
    expect(f).toHaveLength(2)
    expect(f[0]).toContain('BEV LITE')
    expect(f[0]).toContain('799,000')
  })
  it('puts the named variant first', () => {
    expect(modelFacts('s05 max', V)[0]).toContain('BEV MAX')
  })
  it('ignores year in parentheses', () => {
    const f = modelFacts('S07', V)
    expect(f[0]).toContain('S07')
    expect(f[0]).toContain('DC 92 kW')
  })
  it('returns nothing for unknown or empty', () => {
    expect(modelFacts('', V)).toEqual([])
    expect(modelFacts('Tesla Model Y', V)).toEqual([])
  })
  it('works with the real catalog', () => {
    expect(modelFacts('Deepal S05', VEHICLES).length).toBeGreaterThan(0)
  })
  it('brief includes catalog facts', () => {
    const b = buildCustomerBrief({ stage: 'pp', interestedModel: 'Deepal S05' }, { today: '2026-10-26', vehicles: V })
    expect(b).toContain('ข้อมูลรถรุ่นที่สนใจ')
    expect(b).toContain('BEV LITE')
  })
})

import { catalogContext } from './salesAi.js'
describe('catalogContext', () => {
  it('gives model facts when a model is named', () => {
    expect(catalogContext('S05 max วิ่งได้กี่โล', V)).toContain('BEV MAX')
  })
  it('lists models with price range for brand-only questions', () => {
    const t = catalogContext('deepal มีรุ่นอะไรบ้าง', V)
    expect(t).toContain('Deepal S05 ราคา 799,000–899,000 บาท (2 รุ่นย่อย)')
    expect(t).toContain('S07 (2024)')
  })
  it('is empty for unrelated questions', () => {
    expect(catalogContext('ยอดขายเดือนนี้เท่าไหร่', V)).toBe('')
  })
})
