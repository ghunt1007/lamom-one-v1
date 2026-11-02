import { describe, it, expect } from 'vitest'
import { quoteToWizard, vehicleOfQuote } from './quoteToBooking.js'

const vehicles = [{ brand: 'DEEPAL', model: 'S05', variant: 'RWD' }]

describe('quoteToWizard', () => {
  it('carries customer, car, price, finance and gifts into the booking form', () => {
    const w = quoteToWizard({
      id: 'q1', customerName: 'ลูกค้า ทดสอบ', phone: '0800000000', customerId: 'c1', salesperson: 'เซลส์ A',
      vehicleLabel: 'DEEPAL S05 RWD', basePrice: 999000, color: 'ขาว', discount: 20000, regFee: 5000, tradeIn: 100000,
      downPayment: 200000, term: 72, rate: 1.99,
      accessories: [{ name: 'ฟิล์ม', price: 8000, free: true }, { name: 'กล้องหน้า', price: 3500, free: false }],
    }, vehicles)
    expect(w).toMatchObject({ custName: 'ลูกค้า ทดสอบ', customerId: 'c1', salesName: 'เซลส์ A', brand: 'DEEPAL', model: 'S05', variant: 'RWD', colorOut: 'ขาว',
      price: 999000, discount: 20000, accessories: 3500, down: 200000, installments: 72, interestRate: 1.99, quotationId: 'q1' })
    expect(w.sale.items).toEqual([
      { name: 'ฟิล์ม', detail: '', cost: '', giftValue: 8000, salePrice: '', campaign: false },
      { name: 'กล้องหน้า', detail: '', cost: '', giftValue: '', salePrice: 3500, campaign: false },
    ])
    expect(w.sale).toMatchObject({ discount: 20000, regFee: 5000 })
    expect(w.sale.note).toContain('รถเทิร์น 100,000')
  })
  it('keeps wizard defaults when the quote has no salesperson or finance terms', () => {
    const w = quoteToWizard({ customerName: 'x', vehicleLabel: 'A B C D' })
    expect(w).not.toHaveProperty('salesName')
    expect(w).not.toHaveProperty('installments')
    expect(vehicleOfQuote({ vehicleLabel: 'A B C D' })).toEqual({ brand: 'A', model: 'B', variant: 'C D' })
  })
  it('prefers stored brand/model', () => {
    expect(vehicleOfQuote({ brand: 'X', model: 'Y', vehicleLabel: 'nope' })).toEqual({ brand: 'X', model: 'Y', variant: '' })
    expect(quoteToWizard(null)).toBe(null)
  })
})
