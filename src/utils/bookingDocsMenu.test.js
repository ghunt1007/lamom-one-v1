import { describe, it, expect, vi } from 'vitest'

vi.mock('../core/db.js', () => ({ updateDocData: vi.fn(), readDoc: vi.fn() }))
vi.mock('./storage.js', () => ({ uploadFile: vi.fn() }))
const printed = []
vi.mock('./print.js', async (orig) => ({ ...(await orig()), printDocument: (html, o) => printed.push({ html, title: o.title }) }))

import { BOOKING_PRINTS, fileEntry } from './bookingDocsMenu.js'
import { printAccessoryOrder, printSaleContract, printRegistrationRequest } from './bookingDocs.js'

const full = {
  bookingNo: 'BK-1', custName: 'สมชาย ใจดี', nid: '1234567890123', phone: '0812345678', address: '1 ถ.สุข', province: 'นนทบุรี',
  brand: 'BYD', model: 'Atto 3', variant: 'Extended', colorOut: 'ขาว', vin: 'VIN1', motorNo: 'M1', batNo: 'B1',
  price: 999000, bookingDeposit: 5000, down: 100000, financeCo: 'KBANK', financeAmount: 899000, installments: 72,
  deliveryDate: '2026-11-20', salesName: 'เซลส์ A', fiItems: [{ type: 'accessory', sold: true, provider: 'ฟิล์ม', price: 0 }, { type: 'insurance', sold: true, price: 20000 }],
}

describe('booking documents', () => {
  it('offers the showroom forms in sales order, incl. job order, contract, withdraw and registration', () => {
    expect(BOOKING_PRINTS.map(p => p.key)).toEqual(['booking', 'joborder', 'contract', 'attachment', 'expense', 'registration', 'delivery', 'commission', 'withdraw'])
    for (const p of BOOKING_PRINTS) expect(p.key === 'withdraw' ? p.print === null : typeof p.print === 'function').toBe(true)
  })

  it('fills each form from the booking and never prints undefined/NaN, even when empty', () => {
    for (const b of [full, { id: 'x' }]) {
      printed.length = 0
      printAccessoryOrder(b); printSaleContract(b); printRegistrationRequest(b)
      expect(printed).toHaveLength(3)
      for (const p of printed) expect(p.html).not.toMatch(/undefined|NaN|\[object/)
    }
    printed.length = 0
    printAccessoryOrder(full); printSaleContract(full)
    expect(printed[0].html).toContain('อุปกรณ์ตกแต่ง – ฟิล์ม')
    expect(printed[0].html).not.toContain('20,000') // ประกันไม่ใช่รายการแต่ง
    expect(printed[1].html).toContain('สมชาย ใจดี')
    expect(printed[1].html).toContain('999,000')
  })

  it('keeps only the link and basic info of an attached file', () => {
    const e = fileEntry({ name: 'contract.pdf', type: 'application/pdf', size: 1000 }, { url: 'https://x/file?key=k', key: 'k' }, 'A', '2026-11-02')
    expect(e).toEqual({ name: 'contract.pdf', url: 'https://x/file?key=k', key: 'k', type: 'application/pdf', size: 1000, at: '2026-11-02', by: 'A' })
  })
})
