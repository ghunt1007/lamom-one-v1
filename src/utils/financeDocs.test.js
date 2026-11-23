import { describe, it, expect } from 'vitest'
import { calcDoc, financeDocHtml, billingRunHtml } from './financeDocs.js'

const inv = { no: 'INV-1', custName: 'บริษัท <ทดสอบ>', date: '2026-11-05', dueDate: '2026-11-20', items: [{ desc: 'ค่าบริการ', qty: 2, price: 500, vat: 7 }] }

describe('financeDocs', () => {
  it('calcDoc sums subtotal, vat, total', () => {
    expect(calcDoc(inv)).toEqual({ subtotal: 1000, vat: 70, total: 1070 })
    expect(calcDoc({ items: [], grossTotal: 5 }).total).toBe(5)
  })
  it('financeDocHtml is a real document with DD/MM dates and escaped names', () => {
    const h = financeDocHtml(inv, 'ใบแจ้งหนี้')
    expect(h).toContain('ใบแจ้งหนี้')
    expect(h).toContain('1,070.00')
    expect(h).toContain('05/11/')
    expect(h).toContain('20/11/')
    expect(h).not.toContain('2026-11-05')
    expect(h).toContain('บริษัท &lt;ทดสอบ&gt;')
    expect(h).toContain('หนึ่งพันเจ็ดสิบบาทถ้วน')
  })
  it('billingRunHtml lists invoices with total', () => {
    const h = billingRunHtml({ runNo: 'BR-1', customerName: 'ก', totalAmount: 1070 }, [inv])
    expect(h).toContain('ใบวางบิล')
    expect(h).toContain('INV-1')
    expect(h).toContain('รวมทั้งสิ้น 1 ฉบับ')
    expect(h).toContain('1,070.00')
  })
})
