import { describe, it, expect } from 'vitest'
import { modelNames, modelOptionsHtml, modelStartPrice } from './modelOptions.js'

const V = [
  { brand: 'Toyota', model: 'Yaris', price: 600000 },
  { brand: 'Deepal', model: 'S07', price: 1200000 },
  { brand: 'Deepal', model: 'S07', price: 1100000 },
]

describe('modelOptions', () => {
  it('lists unique names', () => { expect(modelNames(V)).toEqual(['Toyota Yaris', 'Deepal S07']) })
  it('groups dealer brands first and keeps an old saved value', () => {
    const h = modelOptionsHtml('BYD Atto 3', { vehicles: V, extra: ['ยังไม่แน่ใจ'] })
    expect(h.indexOf('BYD Atto 3')).toBeLessThan(h.indexOf('Deepal S07'))
    expect(h.indexOf('Deepal S07')).toBeLessThan(h.indexOf('Toyota Yaris'))
    expect(h).toContain('รุ่นที่โชว์รูมขาย')
    expect(h.endsWith('<option value="ยังไม่แน่ใจ">ยังไม่แน่ใจ</option>')).toBe(true)
  })
  it('start price is the cheapest', () => { expect(modelStartPrice('Deepal S07', V)).toBe(1100000); expect(modelStartPrice('X', V)).toBe(0) })
})
