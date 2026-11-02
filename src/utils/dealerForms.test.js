import { describe, it, expect, vi } from 'vitest'

const printed = []
vi.mock('./print.js', async (orig) => ({ ...(await orig()), printDocument: (html, o) => printed.push({ html, title: o.title }) }))

import { saleOf, saleTotals, thaiDateParts, addrLine, DEFAULT_ITEMS, isCashBooking } from './saleDoc.js'
import * as F from './dealerForms.js'

// ข้อมูลสมมติล้วน (ห้ามใช้ข้อมูลลูกค้าจริง)
const fin = {
  id: 'b1', bookingNo: 'BK-T1', bookingDate: '2026-10-05', custName: 'ทดสอบ ใจดี', nid: '1111111111111', phone: '0800000000',
  brand: 'DEEPAL', model: 'S07', variant: 'Ultra', colorOut: 'ขาว', vin: 'TESTVIN0001', price: 1199000, down: 70990,
  bookingDeposit: 4000, financeCo: 'ธนาคารทดสอบ', financeAmount: 1128010, installments: 84, salesName: 'เซลส์ ทดสอบ', comFinance: 12000,
  sale: {
    carNo: '7', year: '2026', addr: { houseNo: '9/9', moo: '1', subdistrict: 'บางรักใหญ่', district: 'บางบัวทอง', province: 'นนทบุรี' },
    items: [{ name: 'ประกันภัยชั้น 1', giftValue: 8000 }, { name: 'พรบ', giftValue: 645 }, { name: 'ฟิล์ม', giftValue: 1000 }],
    redPlateDeposit: 3000, regFee: 9900, discount: 60000, giftBudget: 20000, accessoryCommission: 500,
  },
}
const cash = { id: 'b2', price: 899000, finStatus: 'ซื้อสด', bookingDeposit: 10000, sale: { cashBack: 50000 } }

describe('sale document numbers', () => {
  it('matches the sample sheet arithmetic (finance)', () => {
    const t = saleTotals(fin)
    expect(t.cash).toBe(false)
    expect(t.gross).toBe(83890)
    expect(t.balance).toBe(19890)
    expect(t.giftUsed).toBe(9645)
    expect(t.giftLeft).toBe(10355)
    expect(t.netCommission).toBe(10355 + 12000 + 500)
  })
  it('uses car price minus cash back for cash buyers', () => {
    expect(isCashBooking(cash)).toBe(true)
    const t = saleTotals(cash)
    expect(t.carPrice).toBe(849000)
    expect(t.balance).toBe(839000)
    expect(t.financeAmount).toBe(0)
  })
  it('fills defaults for a booking with no sale data', () => {
    const s = saleOf({ province: 'นนทบุรี' })
    expect(s.items.map(i => i.name)).toEqual(DEFAULT_ITEMS)
    expect(s.addr.province).toBe('นนทบุรี')
    expect(thaiDateParts('2026-11-02')).toMatchObject({ d: '2', m: 'พฤศจิกายน', y: '2569' })
    expect(addrLine(saleOf(fin))).toContain('ต.บางรักใหญ่')
  })
})

describe('dealer forms', () => {
  const prints = ['printJobOrder', 'printContract', 'printContractAttachment', 'printExpenseNotice', 'printDeliveryNote', 'printRegistrationIntent', 'printCommissionSheet', 'printWithdrawRequest']
  it('renders all 8 forms with no undefined/NaN for full, cash and empty bookings', () => {
    for (const b of [fin, cash, { id: 'x' }]) {
      printed.length = 0
      for (const p of prints) F[p](b, { name: 'บริษัท ทดสอบ จำกัด', bankAccount: '000-0-00000-0' }, { reason: 'ทดสอบ' })
      expect(printed).toHaveLength(8)
      for (const p of printed) expect(p.html).not.toMatch(/undefined|NaN|\[object|null/)
    }
  })
  it('puts booking data into the forms', () => {
    printed.length = 0
    F.printJobOrder(fin, {}); F.printContract(fin, {}); F.printWithdrawRequest(fin, {}, { reason: 'ไฟแนนซ์ไม่ผ่าน' })
    expect(printed[0].html).toContain('ทดสอบ ใจดี')
    expect(printed[0].html).toContain('8,000')
    expect(printed[1].html).toContain('ต้นฉบับ')
    expect(printed[1].html).toContain('สำเนา')
    expect(printed[1].html).toContain('TESTVIN0001')
    expect(printed[2].html).toContain('ไฟแนนซ์ไม่ผ่าน')
    expect(printed[2].html).toMatch(/✓<\/span>DEEPAL S07/)
  })
})
