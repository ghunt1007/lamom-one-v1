import { describe, it, expect } from 'vitest'
import { cashierReceiptHtml, receiptNo } from './cashierReceipt.js'

describe('cashierReceiptHtml', () => {
  const p = { id: 'abcdef123456', customer: 'ลูกค้า <ทดสอบ>', desc: 'ค่าซ่อม', amount: 1500, method: 'transfer', time: '2026-11-22T03:05:00.000Z', cashier: 'แคชเชียร์', ref: 'MISC' }
  it('builds a real receipt with amount, baht text and escaped name', () => {
    const h = cashierReceiptHtml(p)
    expect(h).toContain('ใบเสร็จรับเงิน')
    expect(h).toContain('1,500')
    expect(h).toContain('หนึ่งพันห้าร้อยบาทถ้วน')
    expect(h).toContain('ลูกค้า &lt;ทดสอบ&gt;')
    expect(h).toContain('โอน/PromptPay')
    expect(h).toContain('22/11/')
    expect(h).toMatch(/10:05/)
    expect(h).not.toMatch(/\d\s?(AM|PM)/)
  })
  it('receipt number from id', () => {
    expect(receiptNo(p)).toBe('RC-EF123456')
    expect(receiptNo({})).toBe('')
  })
})
