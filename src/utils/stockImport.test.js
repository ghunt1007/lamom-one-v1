import { describe, it, expect } from 'vitest'
import { planStockImport, parseStockDate, parseStockStatus } from './stockImport.js'

describe('planStockImport', () => {
  it('reads the stock export headers and skips VINs already in stock or repeated in the file', () => {
    const rows = [
      { ยี่ห้อ: 'BYD', รุ่น: 'Seal', VIN: 'abc1', ราคา: '1,325,000', สถานะ: '✅ พร้อมขาย', รับมา: '30/10/2569', ปี: '2569' },
      { ยี่ห้อ: 'BYD', รุ่น: 'Seal', VIN: 'ABC1' },
      { ยี่ห้อ: 'MG', รุ่น: 'MG4', VIN: 'OLD9' },
      { ยี่ห้อ: '', รุ่น: 'X' },
      { Brand: 'Deepal', Model: 'S07', Status: 'in transit' },
    ]
    const { creates, skipped } = planStockImport(rows, [{ vin: 'old9' }], { today: '2026-10-31', defaultLocation: 'โชว์รูม' })
    expect(creates.map(c => c.model)).toEqual(['Seal', 'S07'])
    expect(creates[0]).toMatchObject({ vin: 'ABC1', price: 1325000, status: 'available', arrivedAt: '2026-10-30', year: 2026, location: 'โชว์รูม' })
    expect(creates[1]).toMatchObject({ status: 'transit', arrivedAt: '2026-10-31', vin: '' })
    expect(skipped.map(s => s.row)).toEqual([3, 4, 5])
  })
  it('parses dates and statuses', () => {
    expect(parseStockDate('2026-1-5', 'x')).toBe('2026-01-05')
    expect(parseStockDate('', '2026-10-31')).toBe('2026-10-31')
    expect(parseStockStatus('🏁 ขายแล้ว')).toBe('sold')
    expect(parseStockStatus('')).toBe('available')
  })
})
