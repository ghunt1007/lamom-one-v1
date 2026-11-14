import { describe, it, expect } from 'vitest'
import { buildShowroomInfo, modelLines } from './showroomInfo.js'

const V = [
  { brand: 'Deepal', model: 'S07', variant: 'Plus', price: 1399000, priceMin: 1329000, fuel: 'EV', type: 'SUV' },
  { brand: 'Deepal', model: 'S07', variant: 'Base', price: 1299000, fuel: 'EV', type: 'SUV' },
  { brand: 'Toyota', model: 'Camry', price: 1669000, fuel: 'Hybrid', type: 'Sedan' },
  { brand: 'Suzuki', model: 'Swift', price: 0 },
  null, { brand: 'X' },
]

describe('modelLines', () => {
  it('one line per model with the lowest price, dealer brands only', () => {
    expect(modelLines(V, { dealerBrands: ['deepal', 'suzuki'] })).toEqual(['- Deepal S07 (EV, SUV): เริ่มต้น 1,299,000 บาท', '- Suzuki Swift'])
  })
  it('all brands when no dealer list, capped', () => {
    expect(modelLines(V).length).toBe(3)
    expect(modelLines(V, { maxLines: 1 }).length).toBe(1)
  })
})

describe('buildShowroomInfo', () => {
  it('uses company details and asks for opening hours', () => {
    const t = buildShowroomInfo({ company: { nameTh: 'บริษัท ทดสอบ จำกัด', address: 'บางบัวทอง', phone: '02-000-0000', lineOA: '@test' }, vehicles: V, dealerBrands: ['deepal'] })
    expect(t).toContain('ชื่อโชว์รูม: บริษัท ทดสอบ จำกัด'); expect(t).toContain('ที่อยู่: บางบัวทอง'); expect(t).toContain('LINE: @test')
    expect(t).toContain('เวลาเปิดทำการ'); expect(t).toContain('Deepal S07'); expect(t).not.toContain('Camry')
  })
  it('works with nothing and never exceeds the limit or cuts a line in half', () => {
    expect(buildShowroomInfo()).toContain('เวลาเปิดทำการ')
    const many = Array.from({ length: 30 }, (_, i) => ({ brand: 'Deepal', model: 'รุ่นยาวมาก'.repeat(8) + i, price: 1000000 + i }))
    const t = buildShowroomInfo({ vehicles: many, max: 600 })
    expect(t.length).toBeLessThanOrEqual(600)
    expect(t.split('\n').pop()).toMatch(/บาท$|:$/)
  })
})
