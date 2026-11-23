import { describe, it, expect } from 'vitest'
import { vehicleQuoteHtml } from './vehicleQuoteDoc.js'

describe('vehicleQuoteHtml', () => {
  const q = { customerName: 'สมชาย <x>', brand: 'DEEPAL', model: 'S07', color: 'ขาว', basePrice: 1199000, regFee: 5000, discount: 30000, tradeIn: 0, finalPrice: 1174000, downPayment: 200000, monthlyPayment: 15990, term: 72, rate: 2.49, createdDate: '2026-11-23', validUntil: '2026-11-30', salesperson: 'เอ' }
  it('lists price lines, net, finance and DD/MM dates, escaped', () => {
    const h = vehicleQuoteHtml(q, [{ name: 'ฟิล์ม', price: 0, free: true }, { name: 'กล้อง', price: 9000 }])
    expect(h).toContain('ใบเสนอราคา')
    expect(h).toContain('1,199,000')
    expect(h).toContain('-30,000')
    expect(h).toContain('1,174,000')
    expect(h).toContain('อุปกรณ์: กล้อง')
    expect(h).toContain('ของแถม: ฟิล์ม')
    expect(h).toContain('15,990 บาท × 72 งวด')
    expect(h).toContain('30/11/')
    expect(h).toContain('สมชาย &lt;x&gt;')
    expect(h).not.toContain('รถเทิร์น')
  })
})
