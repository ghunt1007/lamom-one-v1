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

import { financeWaitAnswer } from './financeQueue.js'
describe('LINE "ไฟแนนซ์" (v1.0.1295)', () => {
  const rows = [
    { custName: 'เอ', model: 'ATTO 3', financeCo: 'KBank', finStatus: 'รอผล', submitDate: '2026-11-18', status: 'จอง', salesName: 'บี' },
    { custName: 'ซี', finStatus: 'รอเซ็นสัญญา', status: 'รอรถ', salesName: 'ดี' },
    { custName: 'อี', finStatus: 'รอผล', submitDate: '2026-11-10', status: 'จอง', salesName: 'บี' },
    { custName: 'ส่งแล้ว', finStatus: 'รอผล', status: 'ส่งมอบแล้ว' },
    { custName: 'ผ่าน', finStatus: 'ผ่าน', status: 'จอง' },
    { custName: 'ถอน', finStatus: 'รอผล', status: 'ถอนจอง' },
  ]
  it('lists open bookings waiting on finance, oldest submit first', () => {
    const t = financeWaitAnswer(rows, '2026-11-22')
    const l = t.split('\n')
    expect(l[0]).toBe('🏦 รอไฟแนนซ์ 3 ใบ — รอผล 2 · รอเซ็นสัญญา 1')
    expect(l[1]).toBe('• อี · รอผล · ยื่นมา 12 วัน')
    expect(l[2]).toBe('• เอ · ATTO 3 · KBank · รอผล · ยื่นมา 4 วัน')
    expect(l[3]).toBe('• ซี · รอเซ็นสัญญา')
    expect(financeWaitAnswer(rows, '2026-11-22', { mine: b => b.salesName === 'ดี' })).toContain('รอไฟแนนซ์ 1 ใบ')
    expect(financeWaitAnswer([], '2026-11-22')).toContain('✅')
  })
})
