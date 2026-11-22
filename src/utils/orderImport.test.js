import { describe, it, expect } from 'vitest'
import { planOrderImport, parseOrderStatus } from './orderImport.js'

describe('planOrderImport', () => {
  it('maps export columns, skips duplicates and rows without model', () => {
    const rows = [
      { 'เลขที่': 'ORD-1', 'ยี่ห้อ': 'Deepal', 'รุ่น': 'S07', 'สี': 'ขาว', 'จำนวน': '3', 'ต้นทุน': '1,000,000', 'สถานะ': '🚢 กำลังขนส่ง', 'วันรับคาด': '15/12/2569', 'Supplier': 'X' },
      { 'เลขที่': 'ORD-OLD', 'รุ่น': 'S05' },
      { 'ยี่ห้อ': 'Deepal' },
      { 'รุ่น': 'L07', 'จำนวน': '' },
      { 'เลขที่': 'ord-1', 'รุ่น': 'S07' },
    ]
    const p = planOrderImport(rows, [{ orderNo: 'ORD-OLD' }], { today: '2026-11-23', newNo: () => 'NEW' })
    expect(p.creates).toHaveLength(2)
    expect(p.creates[0]).toMatchObject({ orderNo: 'ORD-1', brand: 'Deepal', model: 'S07', qty: 3, unitCost: 1000000, status: 'shipped', expectedDate: '2026-12-15', supplier: 'X', createdAt: '2026-11-23' })
    expect(p.creates[1]).toMatchObject({ orderNo: 'NEW', model: 'L07', qty: 1, status: 'ordered', expectedDate: '' })
    expect(p.skipped.map(s => s.row)).toEqual([3, 4, 6])
  })
  it('parses statuses', () => {
    expect(parseOrderStatus('ถึงแล้ว')).toBe('arrived')
    expect(parseOrderStatus('❌ ยกเลิก')).toBe('cancelled')
    expect(parseOrderStatus('')).toBe('ordered')
  })
})
