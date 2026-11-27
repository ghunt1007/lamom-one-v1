import { describe, it, expect } from 'vitest'
import { testDriveConversion } from './testDriveConversion.js'

const T = '2026-11-28'
const td = (id, date, extra = {}) => ({ id, customerId: 'c' + id, phone: '08100000' + String(id).padStart(2, '0'), date, status: 'done', model: 'S07', ...extra })

describe('testDriveConversion', () => {
  it('real booking rate from bookings within 45 days, settled sample only', () => {
    const tds = Array.from({ length: 10 }, (_, i) => td(i, '2026-08-01'))
    const bookings = [
      { customerId: 'c0', bookingDate: '2026-08-10' },
      { phone: '081-000-0001', bookingDate: '2026-09-05' }, // ตามเบอร์
      { customerId: 'c2', bookingDate: '2026-11-01' }, // เกิน 45 วัน ไม่นับ
    ]
    const r = testDriveConversion({ testDrives: [...tds, td(50, '2026-11-20')], bookings, today: T })
    expect(r.n).toBe(10)
    expect(r.booked).toBe(2)
    expect(r.rate).toBeCloseTo(0.2)
    expect(r.byModel[0]).toMatchObject({ model: 'S07', n: 10, booked: 2 })
  })
  it('rate null with too few settled', () => {
    expect(testDriveConversion({ testDrives: [td(1, '2026-08-01')], today: T }).rate).toBeNull()
  })
  it('chase list: done 2–30 days ago, not booked, not lost/notinterested, newest first, one per customer', () => {
    const tds = [
      td(1, '2026-11-20'), td(1, '2026-11-15'), td(2, '2026-11-27'), td(3, '2026-11-10', { result: 'notinterested' }),
      td(4, '2026-11-18'), td(5, '2026-10-01'), td(6, '2026-11-22', { status: 'scheduled' }), td(7, '2026-11-19'),
    ]
    const r = testDriveConversion({ testDrives: tds, bookings: [{ customerId: 'c4', bookingDate: '2026-11-21' }], customers: [{ id: 'c7', isLost: true }], today: T })
    expect(r.chase.map(x => x.td.id)).toEqual([1])
    expect(r.chase[0].days).toBe(8)
  })
})
