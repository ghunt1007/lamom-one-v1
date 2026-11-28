import { describe, it, expect } from 'vitest'
import { parseLineCommand, LINE_HELP_TEXT, REFUND_BOOKING_FIELDS } from './daily-report.js'
import { refundAnswer } from '../src/utils/opsQuestions.js'

describe('LINE คืนเงิน (v1.0.1520)', () => {
  it('parses the command', () => {
    for (const t of ['คืนเงิน', 'รอคืนเงิน', 'คืนจอง', 'คืนเงินจอง']) expect(parseLineCommand(t)?.type).toBe('refund')
    expect(LINE_HELP_TEXT).toContain('คืนเงิน')
  })
  it('selects every field refundAnswer reads', () => {
    for (const f of ['status', 'refundStatus', 'depositRefunded', 'refundDocsSent', 'refundDocsDate', 'refundAmount', 'bookingDeposit', 'cancelDate', 'custName', 'salesName']) expect(REFUND_BOOKING_FIELDS).toContain(f)
    const r = refundAnswer([{ status: 'ถอนจอง', bookingDeposit: 4000, custName: 'ก' }])
    expect(r.n).toBe(1)
  })
})
