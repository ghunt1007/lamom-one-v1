import { describe, it, expect, vi } from 'vitest'
vi.mock('../core/db.js', () => ({ listAllDocs: vi.fn(), updateDocData: vi.fn() }))
vi.mock('../core/companyScope.js', () => ({ companyScopeFilters: () => [] }))
const db = await import('../core/db.js')
const { maybeMarkCustomerDelivered, syncStockForBookings, stockStatusForBooking } = await import('./bookingSync.js')

describe('bookingSync', () => {
  it('ลูกค้า → ส่งมอบแล้ว', async () => {
    await maybeMarkCustomerDelivered({ customerId: 'c1' })
    expect(db.updateDocData).toHaveBeenCalledWith('customers', 'c1', expect.objectContaining({ stage: 'delivered' }))
  })
  it('รถ VIN ตรงกัน → ขายแล้ว', async () => {
    db.listAllDocs.mockResolvedValueOnce([{ id: 'v1', vin: 'abc123', status: 'reserved' }])
    expect(await syncStockForBookings([{ vin: 'ABC123', status: 'ส่งมอบแล้ว' }])).toBe(1)
    expect(db.updateDocData).toHaveBeenCalledWith('vehicles', 'v1', { status: 'sold' })
    expect(stockStatusForBooking('ถอนจอง', 'reserved')).toBe('available')
  })
})

const { customerStageAfterSave } = await import('./bookingSync.js')
describe('booking → stock/customer sync (v1.0.911)', () => {
  it('a cancelled booking releases a reserved car and never reserves an available one', () => {
    expect(stockStatusForBooking('ยกเลิก', 'reserved')).toBe('available')
    expect(stockStatusForBooking('ยกเลิก', 'available')).toBe(null)
  })
  it('customer stage only changes when it should', () => {
    expect(customerStageAfterSave('รอรถ', undefined, true)).toBe('booking')
    expect(customerStageAfterSave('รอรถ', 'รอรถ', false)).toBe(null)
    expect(customerStageAfterSave('รอรถ', 'ถอนจอง', false)).toBe('booking')
    expect(customerStageAfterSave('ถอนจอง', 'รอรถ', false)).toBe(null)
    expect(customerStageAfterSave('ส่งมอบแล้ว', 'รอรถ', false)).toBe('delivered')
    expect(customerStageAfterSave('ส่งมอบแล้ว', 'ส่งมอบแล้ว', false)).toBe(null)
  })
})
