import { describe, it, expect } from 'vitest'
import { financeQueue } from './financeQueue.js'

describe('financeQueue', () => {
  it('counts verify + refund queues like /finance/refund', () => {
    const q = financeQueue([
      { paymentVerifyStatus: 'รอการเงินยืนยัน', paymentVerifyRequestedAt: '2026-11-01' },
      { paymentVerifyStatus: 'ยืนยันแล้ว' },
      { status: 'ถอนจอง', down: 2000 },
      { status: 'ถอนจอง', refundStatus: 'คืนเงินแล้ว', bookingDeposit: 9 },
      { status: 'ถอนจอง', bookingDeposit: 5000, deleted: true },
    ], '2026-11-10')
    expect(q.verify).toHaveLength(1)
    expect(q.refund).toHaveLength(1)
    expect(q.oldestDays).toBe(9)
    expect(q.refundAmt).toBe(2000)
    expect(q.total).toBe(2)
  })
  it('handles empty input', () => {
    expect(financeQueue(undefined, '2026-11-10').total).toBe(0)
  })
})
