import { describe, it, expect, vi } from 'vitest'
vi.mock('../core/db.js', () => ({ updateDocData: vi.fn(), readDoc: vi.fn(async () => ({ id: 'c1' })) }))
const db = await import('../core/db.js')
const { touchCustomerContact } = await import('./customerContact.js')

describe('touchCustomerContact', () => {
  it('อัปเดต lastContactAt และบันทึก firstContactAt ครั้งแรก', async () => {
    expect(await touchCustomerContact('c1', 'T')).toBe(true)
    expect(db.updateDocData).toHaveBeenLastCalledWith('customers', 'c1', { lastContactAt: 'T', firstContactAt: 'T' })
  })
  it('ติดต่อครั้งต่อไปไม่ทับ firstContactAt', async () => {
    db.readDoc.mockResolvedValueOnce({ id: 'c1', firstContactAt: 'A' })
    await touchCustomerContact('c1', 'T2')
    expect(db.updateDocData).toHaveBeenLastCalledWith('customers', 'c1', { lastContactAt: 'T2' })
  })
  it('อ่านไม่ได้ → บันทึกแค่ lastContactAt', async () => {
    db.readDoc.mockRejectedValueOnce(new Error('denied'))
    await touchCustomerContact('c1', 'T3')
    expect(db.updateDocData).toHaveBeenLastCalledWith('customers', 'c1', { lastContactAt: 'T3' })
  })
  it('ไม่มี id / อัปเดตไม่ได้ → false ไม่ throw', async () => {
    expect(await touchCustomerContact('')).toBe(false)
    db.updateDocData.mockRejectedValueOnce(new Error('denied'))
    expect(await touchCustomerContact('c2')).toBe(false)
  })
})
