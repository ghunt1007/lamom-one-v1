import { describe, it, expect } from 'vitest'
import { maybePromoQuestion, parsePromoSpec, promoAnswer } from './promoQuestions.js'

const V = [
  { brand: 'Deepal', model: 'S07 (2026)', year: 2026, price: 1199000 },
  { brand: 'GAC Aion', model: 'AION V', year: 2026, price: 799900 },
]
const T = '2026-11-12'
const P = [
  { type: 'showroom', title: 'ลดท้ายปี', brand: 'Deepal', models: ['S07'], dateFrom: '2026-11-01', dateTo: '2026-11-15', amount: 30000, gift: 'ฟิล์ม', status: 'active' },
  { type: 'finance', title: 'ดอกเบี้ยพิเศษ', brand: 'Deepal', models: ['S07'], dateFrom: '2026-11-01', dateTo: '2026-11-30', financeCo: 'SCB', rates: [{ rate: 1.99, down: 25, months: 48 }], status: 'active' },
  { type: 'brand', title: 'AION แถมชาร์จเจอร์', brand: 'GAC Aion', models: ['AION V'], dateFrom: '2026-11-01', dateTo: '2026-12-31', gift: 'Wall Charger', status: 'active' },
  { type: 'margin', title: 'มาร์จิ้น', brand: 'Deepal', models: [], dateFrom: '2026-11-01', dateTo: '2026-11-30', amount: 50000, status: 'active' },
  { type: 'showroom', title: 'หมดแล้ว', brand: 'Deepal', models: ['S07'], dateFrom: '2026-10-01', dateTo: '2026-10-31', amount: 99999, status: 'active' },
]

describe('promoQuestions', () => {
  it('spots promo questions only', () => {
    expect(maybePromoQuestion('โปรเดือนนี้มีอะไรบ้าง')).toBe(true)
    expect(maybePromoQuestion('S07 มีโปรอะไร')).toBe(true)
    expect(maybePromoQuestion('ลูกค้าคนไหนได้โปร')).toBe(false)
    expect(maybePromoQuestion('โทรหาสมชายแล้ว แจ้งโปร')).toBe(false)
    expect(maybePromoQuestion('เปิดโปรไฟล์')).toBe(false)
  })
  it('parses model, ending and finance', () => {
    expect(parsePromoSpec('S07 มีโปรอะไร', V)).toEqual({ model: 'S07 (2026)', brand: 'Deepal', ending: false, finance: false })
    expect(parsePromoSpec('โปรไหนใกล้หมด', V)).toMatchObject({ model: '', ending: true })
    expect(parsePromoSpec('ดอกเบี้ยพิเศษมีไหม', V)).toMatchObject({ finance: true })
  })
  it('lists active customer promos, never manager-only or ended ones', () => {
    const r = promoAnswer({ programs: P, spec: parsePromoSpec('โปรเดือนนี้มีอะไรบ้าง', V), today: T })
    expect(r.text).toContain('3 รายการ')
    expect(r.text).not.toContain('มาร์จิ้น')
    expect(r.text).not.toContain('หมดแล้ว')
    expect(r.text).toContain('⏳ เหลือ 3 วัน')
    expect(r.next).toContain('โปรไหนใกล้หมด')
  })
  it('answers for one model with a customer-ready copy', () => {
    const r = promoAnswer({ programs: P, spec: parsePromoSpec('S07 มีโปรอะไร', V), today: T })
    expect(r.text).toContain('โปร S07 ที่ใช้ได้วันนี้ 2 รายการ')
    expect(r.text).toContain('ส่วนลดรวม 30,000 บาท')
    expect(r.text).toContain('ดอกเบี้ยพิเศษ 1.99%')
    expect(r.copy).toContain('โปรพิเศษ S07 ตอนนี้ (เหลือ 3 วัน)')
    expect(r.copy).toContain('• แถม ฟิล์ม')
    expect(r.copy).not.toContain('ℹ️')
  })
  it('filters ending-soon and says so when nothing matches', () => {
    const e = promoAnswer({ programs: P, spec: parsePromoSpec('โปรไหนใกล้หมด', V), today: T })
    expect(e.text).toContain('1 รายการ')
    const none = promoAnswer({ programs: P, spec: parsePromoSpec('โปร AION V ใกล้หมด', V), today: T })
    expect(none.text).toContain('ไม่พบโปร AION V')
    expect(none.next).toContain('โปรเดือนนี้มีอะไรบ้าง')
  })
})
