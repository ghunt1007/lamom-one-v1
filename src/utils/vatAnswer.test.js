import { describe, it, expect } from 'vitest'
import { parseOpsSpec, vatAnswer } from './opsQuestions.js'

describe('LAMI vat (v1.0.1483)', () => {
  it('routes VAT questions', () => {
    for (const q of ['ภาษีขายเดือนนี้', 'เดือนนี้ต้องจ่าย VAT เท่าไหร่', 'ภาษีที่ต้องชำระเดือนนี้', 'ภพ.30 เดือนนี้', 'ภาษีซื้อเดือนก่อน'])
      expect(parseOpsSpec(q)?.kind, q).toBe('vat')
    expect(parseOpsSpec('ภาษีซื้อเดือนก่อน').prev).toBe(true)
    for (const q of ['ต่อภาษีรถ', 'ราคานี้รวม VAT ไหม', 'ภาษีหัก ณ ที่จ่ายเดือนนี้']) expect(parseOpsSpec(q)?.kind, q).not.toBe('vat')
  })
  it('extracts 7/107 and nets purchase VAT', () => {
    const r = vatAnswer({ today: '2026-11-28', sales: [{ date: '2026-11-03', salePrice: 1070000, cost: 963000 }, { date: '2026-11-10' }, { date: '2026-10-01', salePrice: 999999 }],
      pos: [{ status: 'received', cat: 'parts', amount: 10700, requestDate: '2026-11-05' }] })
    expect(r.text).toContain('ภาษีขาย ฿70,000')
    expect(r.text).toContain('1 คันยังไม่มีราคาขาย')
    expect(r.text).toContain('ภาษีซื้อ ฿63,700')
    expect(r.text).toContain('฿6,300')
  })
  it('no fake ฿0 when nothing priced', () => {
    const r = vatAnswer({ today: '2026-11-28', sales: [{ date: '2026-11-03' }] })
    expect(r.n).toBe(0); expect(r.text).not.toContain('฿0'); expect(r.text).toContain('ยังคำนวณ VAT ไม่ได้')
  })
})
