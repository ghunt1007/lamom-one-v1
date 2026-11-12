import { describe, it, expect } from 'vitest'
import { quoteText } from './quoteText.js'

const Q = { customerName: 'สมชาย ใจดี', brand: 'Deepal', model: 'S07 (2026)', variant: 'New Standard', color: 'ขาว', basePrice: 1199000, regFee: 2900, discount: 30000, tradeIn: 0, finalPrice: 1186900, downPayment: 200000, monthlyPayment: 19500, term: 60, rate: 2.79, financeCo: 'SCB', validUntil: '2026-12-12', salesperson: 'เซลส์ เอ', notes: 'ภายใน' }

describe('quoteText', () => {
  it('builds a customer-ready message without internal fields', () => {
    const t = quoteText(Q, [{ name: 'ฟิล์ม', price: 5000, free: false }, { name: 'พรม', price: 1500, free: true }])
    expect(t.split('\n')[0]).toBe('เรียนคุณสมชาย ใบเสนอราคา Deepal S07 New Standard สีขาว')
    expect(t).toContain('• ราคารถ 1,199,000 บาท')
    expect(t).toContain('• ฟิล์ม 5,000 บาท')
    expect(t).toContain('• ส่วนลด -30,000 บาท')
    expect(t).not.toContain('รถเทิร์น')
    expect(t).toContain('รวมสุทธิ 1,186,900 บาท')
    expect(t).toContain('🎁 แถม: พรม')
    expect(t).toContain('ผ่อน 19,500 บาท/เดือน × 60 งวด (ดอกเบี้ย 2.79% ต่อปี SCB)')
    expect(t).toContain('ใช้ได้ถึง 12/12/2569')
    expect(t).not.toContain('เซลส์ เอ')
    expect(t).not.toContain('ภายใน')
  })
  it('handles a cash quote with no name', () => {
    const t = quoteText({ vehicleLabel: 'AION V', basePrice: 799900, finalPrice: 799900 })
    expect(t.split('\n')[0]).toBe('เรียนลูกค้า ใบเสนอราคา AION V')
    expect(t).not.toContain('ผ่อน')
    expect(quoteText({ basePrice: 1, finalPrice: 1, downPayment: 0, monthlyPayment: 100, term: 60, rate: 2.99 })).toContain('💳 ไม่ใช้เงินดาวน์ · ผ่อน 100 บาท/เดือน')
  })
})
