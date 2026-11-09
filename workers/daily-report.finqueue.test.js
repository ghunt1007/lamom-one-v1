import { describe, it, expect } from 'vitest'
import { financeQueueLine, buildMorningReminder } from './daily-report.js'

describe('financeQueueLine (v1.0.1009)', () => {
  const today = '2026-11-10'
  it('is null when finance has nothing waiting', () => {
    expect(financeQueueLine([{ status: 'จอง' }, { status: 'ถอนจอง', refundStatus: 'คืนเงินแล้ว', bookingDeposit: 5000 }], today)).toBe(null)
    expect(financeQueueLine([{ status: 'ถอนจอง', rightsOnly: true, bookingDeposit: 5000 }], today)).toBe(null)
  })
  it('counts transfers to verify (oldest wait) and deposits to refund', () => {
    const line = financeQueueLine([
      { paymentVerifyStatus: 'รอการเงินยืนยัน', paymentVerifyRequestedAt: '2026-11-07' },
      { paymentVerifyStatus: 'รอการเงินยืนยัน', paymentVerifyRequestedAt: '2026-11-09' },
      { paymentVerifyStatus: 'รอการเงินยืนยัน', deleted: true },
      { status: 'ถอนจอง', bookingDeposit: 5000 },
      { status: 'ถอนจอง', refundStatus: 'รอคืนเงิน', refundAmount: 3000 },
    ], today)
    expect(line).toBe('💸 งานการเงินค้าง: รอยืนยันยอดโอน 2 ใบ (นานสุด 3 วัน) · รอคืนเงินจอง 2 ใบ 8,000 บาท')
  })
  it('appears in the 09:00 reminder', () => {
    const text = buildMorningReminder({ bookings: [{ status: 'ถอนจอง', bookingDeposit: 1000 }], customers: [], followups: [], testDrives: [] }, { today })
    expect(text).toContain('รอคืนเงินจอง 1 ใบ')
  })
})
