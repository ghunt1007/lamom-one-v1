import { describe, it, expect, vi } from 'vitest'
vi.mock('./firebase.js', () => ({ db: {} }))
import { salesRowsFromBookings } from './db.js'

describe('salesRowsFromBookings (v1.0.1159)', () => {
  const rows = salesRowsFromBookings([
    { id: 'a', status: 'ส่งมอบแล้ว', actualDeliveryDate: '2026-11-10', bookingDate: '2026-10-01' },
    { id: 'b', status: 'ตัดตัวเลขรอส่งมอบ', cutDate: '2026-11-12', bookingDate: '2026-10-05' },
    { id: 'c', status: 'รอรถ', bookingDate: '2026-11-01' },
    { id: 'd', status: 'ถอนจอง', bookingDate: '2026-11-02' },
    { id: 'e', status: 'ยกเลิก', bookingDate: '2026-11-03' },
    { id: 'f', status: 'ส่งมอบแล้ว', deleted: true },
  ])
  it('ตัดตัวเลขแล้ว = ขายแล้ว เหมือนรายงาน LINE และหน้ารายได้', () => {
    expect(rows.filter(r => r.delivered).map(r => r.id)).toEqual(['a', 'b'])
    expect(rows.find(r => r.id === 'b').date).toBe('2026-11-12')
  })
  it('ตัดใบที่ถอนจอง/ยกเลิก/ลบ ออก', () => {
    expect(rows.map(r => r.id)).toEqual(['a', 'b', 'c'])
  })
})
