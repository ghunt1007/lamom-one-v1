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

describe('withdrawPatch (v1.0.1502)', async () => {
  const { withdrawPatch, withdrawCategoryLabel } = await import('./bookingWithdraw.js')
  it('net refund after deduct, category extras only when relevant', () => {
    const p = withdrawPatch({ cancelDate: '2026-11-28', reason: 'ไปซื้อยี่ห้ออื่น', category: 'competitor', competitor: 'BYD ATTO 3', newBookingNo: 'X', deposit: 5000, deduct: 1000, hasMoney: true, by: 'วิภา', now: 't' })
    expect(p).toMatchObject({ refundAmount: 4000, refundDeduct: 1000, refundStatus: 'รอคืนเงิน', depositRefunded: 'N', cancelCompetitor: 'BYD ATTO 3', newBookingNo: '', cancelledBy: 'วิภา' })
    const q = withdrawPatch({ cancelDate: '2026-11-28', reason: 'ย้าย', category: 'moved', newBookingNo: 'SK2511001', deposit: 4000, deduct: 9000, hasMoney: true })
    expect(q).toMatchObject({ refundAmount: 0, refundDeduct: 4000, refundStatus: 'ไม่ต้องคืน', newBookingNo: 'SK2511001', cancelCompetitor: '' })
    expect(withdrawCategoryLabel('moved')).toBe('ย้ายไปจองใบใหม่')
  })
})

describe('withdrawnAnswer categories (v1.0.1502)', async () => {
  const { withdrawnAnswer } = await import('./opsQuestions.js')
  it('groups by category', () => {
    const bs = [{ status: 'ถอนจอง', bookingDate: '2026-11-05', cancelCategory: 'finance' }, { status: 'ถอนจอง', bookingDate: '2026-11-06', cancelReason: 'ไฟแนนซ์ไม่ผ่าน - x' }, { status: 'ถอนจอง', bookingDate: '2026-11-07', cancelCategory: 'moved', newBookingNo: 'N1' }, { status: 'ส่งมอบแล้ว', bookingDate: '2026-11-08' }]
    const t = withdrawnAnswer(bs, { today: '2026-11-28' }).text
    expect(t).toContain('📊 เหตุผล: ไฟแนนซ์ไม่ผ่าน 2 · ย้ายไปจองใบใหม่ 1')
    expect(t).toContain('ย้ายไป N1')
    expect(withdrawnAnswer([{ status: 'ถอนจอง', bookingDate: '2026-11-05', cancelReason: 'other' }], { today: '2026-11-28' }).text).toContain('ยังไม่มีการระบุเหตุผล')
  })
})

describe('refund docs + wdcomp (v1.0.1503)', async () => {
  const oq = await import('./opsQuestions.js')
  const { financeQueue } = await import('./financeQueue.js')
  const bs = [
    { status: 'ถอนจอง', custName: 'ก', bookingDeposit: 4000, cancelDate: '2026-11-10', refundDocsSent: 'Y', cancelCategory: 'competitor', cancelCompetitor: 'BYD ATTO 3' },
    { status: 'ถอนจอง', custName: 'ข', bookingDeposit: 4000, refundAmount: 3000, cancelDate: '2026-11-12', cancelCategory: 'competitor', cancelCompetitor: 'byd atto 3' },
    { status: 'ถอนจอง', custName: 'ค', bookingDeposit: 4000, depositRefunded: 'Y', cancelDate: '2026-11-12', cancelCategory: 'finance' },
  ]
  it('refund docs list', () => {
    expect(oq.refundAnswer(bs).text).toContain('รอคืนเงินมัดจำ 2 ราย · รวม ฿7,000 · ยังไม่ส่งเอกสาร 1 ใบ')
    expect(oq.refundAnswer(bs, { docs: true }).text).toContain('📄 ยังไม่ส่งเอกสารคืนจอง 1 ใบ')
    expect(financeQueue(bs, '2026-11-28').noDocs).toBe(1)
  })
  it('competitor brands', () => {
    const t = oq.wdCompAnswer(bs, { today: '2026-11-28' }).text
    expect(t).toContain('ถอนจองไปซื้อที่อื่น 2 จาก 3 ใบ')
    expect(t).toContain('1. BYD ATTO 3 — 2 ใบ')
    expect(oq.parseOpsSpec('ลูกค้าถอนจองไปซื้อยี่ห้ออะไร')).toEqual({ kind: 'wdcomp' })
  })
})

describe('v1.0.1505 noSubmit + withdrawn by seller', async () => {
  const bq = await import('./bookingQuestions.js')
  const oq = await import('./opsQuestions.js')
  it('noSubmit list keeps only finance bookings without submitDate', () => {
    const spec = bq.parseBookingListSpec('ใบจองที่ยังไม่ได้ส่งเคสไฟแนนซ์')
    const cs = [{ id: 'c1', bookingId: 'b1' }, { id: 'c2', bookingId: 'b2' }, { id: 'c3', bookingId: 'b3' }]
    const bs = [{ id: 'b1', status: 'ยอดจองคงค้าง', financeCo: 'KBANK', bookingDate: '2026-11-01' }, { id: 'b2', status: 'ยอดจองคงค้าง', financeCo: 'ซื้อสด', bookingDate: '2026-11-01' }, { id: 'b3', status: 'รอผลไฟแนนซ์', financeCo: 'KBANK', submitDate: '2026-11-05', bookingDate: '2026-11-01' }]
    expect(bq.bookingTargets({ customers: cs, bookings: bs, today: '2026-11-28', spec }).list.map(x => x.b.id)).toEqual(['b1'])
  })
  it('by seller', () => {
    const t = oq.withdrawnBySellerAnswer([{ status: 'ถอนจอง', salesName: 'ก', bookingDate: '2026-11-01' }, { status: 'ส่งมอบแล้ว', salesName: 'ก', bookingDate: '2026-11-02' }], { today: '2026-11-28' }).text
    expect(t).toContain('1. ก — ถอน 1 จาก 2 ใบ (50%)')
  })
})
