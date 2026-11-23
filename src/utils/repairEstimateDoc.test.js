import { describe, it, expect } from 'vitest'
import { repairEstimateHtml } from './repairEstimateDoc.js'

describe('repairEstimateHtml', () => {
  it('prints saved lines and totals with baht text, escaped', () => {
    const h = repairEstimateHtml({ customer: 'สมชาย <x>', plate: 'กข 1', createdAt: '2026-11-23T03:00:00Z', items: [{ name: 'ไส้กรองแอร์', price: 380, hours: 0.5, qty: 2 }], partsTotal: 760, laborHours: 1, laborTotal: 500, discount: 0, discountAmt: 0, vat: 88, grand: 1348 })
    expect(h).toContain('ใบประเมินราคาซ่อม')
    expect(h).toContain('สมชาย &lt;x&gt;')
    expect(h).toContain('>760<')
    expect(h).toContain('1,348')
    expect(h).toContain('หนึ่งพันสามร้อยสี่สิบแปดบาทถ้วน')
    expect(h).not.toContain('ส่วนลด')
    expect(h).toMatch(/23\/11\/(2026|2569)/)
  })
})
