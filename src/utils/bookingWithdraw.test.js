import { describe, it, expect, vi } from 'vitest'
vi.mock('../core/db.js', () => ({ readDoc: vi.fn(), updateDocData: vi.fn(), createDoc: vi.fn() }))
vi.mock('../core/companyScope.js', () => ({ myEffectiveCompanyId: () => null }))
const { withdrawCustomerPatch, buildWinBackFollowup } = await import('./bookingWithdraw.js')

describe('withdrawCustomerPatch', () => {
  it('ลูกค้าที่ผูกกับใบนี้ → กลับเป็น Prospect', () => {
    expect(withdrawCustomerPatch({ stage: 'booking', bookingId: 'b1' }, 'b1', 'T')).toEqual({ stage: 'pp', stageChangedAt: 'T', bookingId: null })
    expect(withdrawCustomerPatch({ stage: 'booking' }, 'b1', 'T')).toEqual({ stage: 'pp', stageChangedAt: 'T', bookingId: null })
  })
  it('ผูกใบอื่น / ส่งมอบแล้ว / ไม่มีลูกค้า → ไม่แตะ', () => {
    expect(withdrawCustomerPatch({ stage: 'booking', bookingId: 'b2' }, 'b1')).toBeNull()
    expect(withdrawCustomerPatch({ stage: 'delivered', bookingId: 'b1' }, 'b1')).toBeNull()
    expect(withdrawCustomerPatch(null, 'b1')).toBeNull()
  })
})

describe('buildWinBackFollowup', () => {
  it('นัดโทรกลับ +3 วัน ผู้ติดตาม = เซลส์ของใบจอง', () => {
    const f = buildWinBackFollowup({ customerId: 'c1', custName: 'ลูกค้า ก', phone: '0800000000', brand: 'BYD', model: 'Seal', salesName: 'เซลส์ A' }, ' ไฟแนนซ์ไม่ผ่าน ', '2026-10-30')
    expect(f).toMatchObject({ customerId: 'c1', salesperson: 'เซลส์ A', dueDate: '2026-11-02', vehicleModel: 'BYD Seal', status: 'pending', type: 'call' })
    expect(f.note).toContain('(ไฟแนนซ์ไม่ผ่าน)')
  })
})

describe('afterWithdraw', () => {
  it('พาลูกค้ากลับเป็น Prospect + สร้างนัดโทรกลับ', async () => {
    const db = await import('../core/db.js')
    const { afterWithdraw } = await import('./bookingWithdraw.js')
    db.readDoc.mockResolvedValue({ id: 'c1', stage: 'booking', bookingId: 'b1' })
    const r = await afterWithdraw({ id: 'b1', customerId: 'c1', custName: 'ก', salesName: 'เซลส์ A' }, 'เปลี่ยนใจ')
    expect(r).toEqual({ reverted: true, followup: true })
    expect(db.updateDocData).toHaveBeenCalledWith('customers', 'c1', expect.objectContaining({ stage: 'pp', bookingId: null }))
    expect(db.createDoc).toHaveBeenCalledWith('followups', expect.objectContaining({ customerId: 'c1', winBack: true, companyId: null }))
  })
  it('ไม่มี customerId → ไม่ทำอะไร', async () => {
    const { afterWithdraw } = await import('./bookingWithdraw.js')
    expect(await afterWithdraw({ id: 'b1' }, 'x')).toEqual({ reverted: false, followup: false })
  })
})
