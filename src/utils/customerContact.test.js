import { describe, it, expect, vi } from 'vitest'
vi.mock('../core/db.js', () => ({ updateDocData: vi.fn() }))
const db = await import('../core/db.js')
const { touchCustomerContact } = await import('./customerContact.js')

describe('touchCustomerContact', () => {
  it('อัปเดต lastContactAt ของลูกค้า', async () => {
    expect(await touchCustomerContact('c1', 'T')).toBe(true)
    expect(db.updateDocData).toHaveBeenCalledWith('customers', 'c1', { lastContactAt: 'T' })
  })
  it('ไม่มี id / อัปเดตไม่ได้ → false ไม่ throw', async () => {
    expect(await touchCustomerContact('')).toBe(false)
    db.updateDocData.mockRejectedValueOnce(new Error('denied'))
    expect(await touchCustomerContact('c2')).toBe(false)
  })
})
