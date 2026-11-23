import { describe, it, expect } from 'vitest'
import { stockAnalysis } from './stockAnalysis.js'

const T = '2026-11-23'
describe('stockAnalysis', () => {
  it('groups unsold stock by model and counts real 30-day deliveries', () => {
    const vehicles = [
      { brand: 'DEEPAL', model: 'S07', status: 'available', arrivedAt: '2026-11-20', listPrice: 1199000 },
      { brand: 'DEEPAL', model: 'S07', status: 'reserved', arrivedAt: '2026-08-01' },
      { brand: 'DEEPAL', model: 'S07', status: 'sold', arrivedAt: '2026-07-01' },
      { brand: 'DEEPAL', model: 'L07', status: 'available', arrivedAt: '' },
      { brand: 'DEEPAL', model: 'L07', status: 'available', deleted: true },
      { brand: 'DEEPAL', model: 'L07', status: 'transit', arrivedAt: '2026-05-01' }, // ยังไม่ถึง — ไม่นับอายุ
    ]
    const bookings = [
      { model: 'Deepal S07', status: 'ส่งมอบแล้ว', cutDate: '2026-11-10' },
      { model: 'S07', status: 'ตัดตัวเลขรอส่งมอบ', actualDeliveryDate: '2026-11-01' },
      { model: 'S07', status: 'ส่งมอบแล้ว', cutDate: '2026-10-01' }, // > 30 days
      { model: 'S07', status: 'รอรถ' },
    ]
    const { models, aging, noDate } = stockAnalysis({ vehicles, bookings, today: T })
    const s07 = models.find(m => m.name === 'DEEPAL S07')
    expect(s07).toMatchObject({ stock: 2, reserved: 1, avail: 1, sold30: 2, price: 1199000, dos: 15 })
    expect(s07.status.label).toBe('ปกติ')
    const l07 = models.find(m => m.name === 'DEEPAL L07')
    expect(l07).toMatchObject({ stock: 2, sold30: 0, dos: null })
    expect(l07.status.label).toBe('ไม่มีขาย 30 วัน')
    expect(aging.map(a => a.count)).toEqual([1, 0, 0, 1, 0]) // 20/11 → 3 วัน, 01/08 → 114 วัน
    expect(aging[0].pct).toBe(50)
    expect(noDate).toBe(1)
  })
  it('empty input → no models, zero aging', () => {
    const r = stockAnalysis({ today: T })
    expect(r.models).toEqual([])
    expect(r.aging.every(a => a.count === 0 && a.pct === 0)).toBe(true)
  })
})

import { inStockByModel } from './stockAnalysis.js'
import { modelKey } from './orderNeeds.js'
describe('inStockByModel', () => {
  it('counts unsold vehicles per model key', () => {
    const m = inStockByModel([
      { brand: 'DEEPAL', model: 'S07', status: 'available' },
      { brand: 'Deepal', model: 'Deepal S07', status: 'reserved' },
      { brand: 'DEEPAL', model: 'S07', status: 'sold' },
      { brand: 'DEEPAL', model: 'S07', deleted: true },
      { brand: 'AION', model: 'V', status: 'transit' },
      null,
    ])
    expect(m.get(modelKey({ brand: 'Deepal', model: 'S07' }))).toBe(2)
    expect(m.get(modelKey({ brand: 'AION', model: 'AION V' }))).toBe(1)
    expect(m.get('x')).toBeUndefined()
  })
})
