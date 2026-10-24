import { describe, it, expect, vi } from 'vitest'
vi.mock('../core/db.js', () => ({ createDoc: vi.fn(async () => 'x') }))
vi.mock('../core/companyScope.js', () => ({ myEffectiveCompanyId: () => null }))
const { buildQuoteFollowup } = await import('./quoteFollowup.js')

describe('quotation follow-up', () => {
  it('calls back 2 days after sending a draft quote', () => {
    const f = buildQuoteFollowup({ id: 'Q1', status: 'draft', customerName: 'ก', salesperson: 'วิชัย', vehicleLabel: 'BYD Seal', finalPrice: 1200000, monthlyPayment: 15000 }, '2026-10-30')
    expect(f).toMatchObject({ dueDate: '2026-11-01', salesperson: 'วิชัย', sourceQuotationId: 'Q1', purpose: 'ติดตามใบเสนอราคา' })
    expect(f.note).toContain('ผ่อน')
  })
  it('does not repeat for quotes already sent or answered', () => {
    expect(buildQuoteFollowup({ id: 'Q1', status: 'sent' })).toBe(null)
    expect(buildQuoteFollowup({ id: 'Q1', status: 'accepted' })).toBe(null)
    expect(buildQuoteFollowup(null)).toBe(null)
  })
})
