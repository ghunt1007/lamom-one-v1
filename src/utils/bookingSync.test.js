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
