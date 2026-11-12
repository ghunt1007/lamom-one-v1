import { describe, it, expect } from 'vitest'
import { parseOpsSpec, newCustomerAnswer, bookDayAnswer } from './opsQuestions.js'
import { parseBookingListSpec, bookingTargets, bookingListLabel } from './bookingQuestions.js'

const T = '2026-11-12'
describe('v1.0.1103 LAMI', () => {
  it('"เมื่อวานได้ลีดกี่ราย" = ลูกค้าใหม่เมื่อวาน', () => {
    expect(parseOpsSpec('เมื่อวานได้ลีดกี่ราย')).toEqual({ kind: 'newcust', period: 'yesterday' })
  })
  it('7 วันมีคำนำหน้า ไม่ติดตัวเลข', () => {
    expect(newCustomerAnswer([], { today: T, period: 'week' }).text).toContain('ลูกค้าใหม่ในรอบ 7 วัน')
    expect(bookDayAnswer([], { today: T, day: 'week' }).text).toContain('ยอดจองในรอบ 7 วัน')
  })
  it('"นัดเข้าศูนย์บริการพรุ่งนี้" เป็นคำถาม ไม่ใช่คำสั่ง', () => {
    expect(parseOpsSpec('นัดเข้าศูนย์บริการพรุ่งนี้')).toEqual({ kind: 'service', day: 'tomorrow' })
    expect(parseOpsSpec('นัดสมชายเข้าศูนย์พรุ่งนี้')).toBeNull()
  })
  it('"ยังไม่ผูกเลขตัวถัง" = noVin', () => {
    expect(parseBookingListSpec('ใบจองที่ยังไม่ผูกเลขตัวถัง').noVin).toBe(true)
  })
  it('"ใครยังไม่ได้วางเงินดาวน์" = ใบจองผ่อนที่ไม่มียอดดาวน์ (ไม่นับซื้อสด)', () => {
    const spec = parseBookingListSpec('ใครยังไม่ได้วางเงินดาวน์')
    expect(spec.noDown).toBe(true)
    expect(bookingListLabel(spec)).toContain('ดาวน์')
    const customers = [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }]
    const bookings = [
      { id: 'b1', customerId: 'c1', status: 'รอรถ', down: 0 },
      { id: 'b2', customerId: 'c2', status: 'รอรถ', down: 50000 },
      { id: 'b3', customerId: 'c3', status: 'รอรถ', finStatus: 'ซื้อสด' },
    ]
    const r = bookingTargets({ customers, bookings, today: T, spec })
    expect(r.list.map(x => x.b.id)).toEqual(['b1'])
  })
})
import { parseQuoteSpec } from './quoteQuestions.js'
describe('v1.0.1103 noquote vs unsent', () => {
  it('ถามหาลูกค้า → noquote', () => {
    expect(parseQuoteSpec('ลูกค้าที่ยังไม่ได้ส่งใบเสนอราคา')).toBeNull()
    expect(parseOpsSpec('ลูกค้าที่ยังไม่ได้ส่งใบเสนอราคา')).toEqual({ kind: 'noquote' })
    expect(parseQuoteSpec('ใบเสนอราคาที่ยังไม่ได้ส่ง')).toEqual({ focus: 'unsent' })
  })
})
import { plateAnswer } from './opsQuestions.js'
import { isCallListQuestion } from './callList.js'
describe('v1.0.1103 plate + call list', () => {
  it('ป้ายขาว', () => {
    expect(parseOpsSpec('ลูกค้าคนไหนยังไม่ได้จดทะเบียน')).toEqual({ kind: 'plate' })
    expect(parseOpsSpec('ค่าจดทะเบียนเท่าไหร่')).toBeNull()
    const r = plateAnswer([
      { custName: 'ก', status: 'ส่งมอบแล้ว', deliveryDate: '2026-09-01', redPlate: '1กข' },
      { custName: 'ข', status: 'ส่งมอบแล้ว', deliveryDate: '2026-11-01', whitePlate: '1กก 1234' },
      { custName: 'ค', status: 'ส่งมอบแล้ว', deliveryDate: '2026-11-05' },
    ], { today: T })
    expect(r.n).toBe(2)
    expect(r.text).toContain('เกิน 45 วัน 1 คัน')
    expect(r.text.indexOf('ก ·')).toBeLessThan(r.text.indexOf('ค ·'))
  })
  it('"ใครควรได้โทรตามวันนี้"', () => {
    expect(isCallListQuestion('ใครควรได้โทรตามวันนี้')).toBe(true)
  })
})
import { arrivedAnswer } from './opsQuestions.js'
describe('v1.0.1107 arrived', () => {
  it('parse', () => {
    expect(parseOpsSpec('รถเข้าใหม่สัปดาห์นี้')).toEqual({ kind: 'arrived', days: 7 })
    expect(parseOpsSpec('เดือนนี้รับรถเข้าสต็อกกี่คัน')).toEqual({ kind: 'arrived', days: 'month' })
    expect(parseOpsSpec('รถเข้าศูนย์วันนี้').kind).toBe('service')
  })
  it('arrivedAnswer', () => {
    const r = arrivedAnswer([{ arrivedAt: '2026-11-10', brand: 'AION', model: 'V', status: 'available' }, { arrivedAt: '2026-10-01' }], { today: '2026-11-12', days: 7 })
    expect(r.n).toBe(1)
  })
})
import { parsePromoSpec } from './promoQuestions.js'
import { parseAheadSpec } from './aheadBrief.js'
describe('v1.0.1108 LAMI wording', () => {
  it('ops', () => {
    expect(parseOpsSpec('ลูกค้าคนไหนใกล้ตัดสินใจ').kind).toBe('topscore')
    expect(parseOpsSpec('ลูกค้าที่ยังไม่ได้นัดทดลองขับ').kind).toBe('notd')
    expect(parseOpsSpec('ลูกค้าที่ทักมาทางไลน์วันนี้').kind).toBe('line')
    expect(parseOpsSpec('ลูกค้าหายไปนานที่สุด').kind).toBe('stale')
    expect(parseOpsSpec('ลูกค้าที่เพิ่งเพิ่มวันนี้')).toEqual({ kind: 'newcust', period: 'today' })
  })
  it('booking + promo + ahead', () => {
    expect(parseBookingListSpec('ใบจองของฉันมีกี่ใบ').allOpen).toBe(true)
    expect(parsePromoSpec('มีโปรอะไรให้ลูกค้า S05 บ้าง')).not.toBeNull()
    expect(parsePromoSpec('ลูกค้าที่ได้โปรเดือนนี้')).toBeNull()
    expect(parseAheadSpec('ฉันมีนัดอะไรพรุ่งนี้')).toEqual({ mode: 'tomorrow' })
  })
})
import { isTeamQuestion } from './teamBrief.js'
describe('v1.0.1109 manager wording', () => {
  it('team questions', () => {
    expect(parseOpsSpec('ทีมฉันใครยังไม่มียอด').kind).toBe('nobookseller')
    expect(parseOpsSpec('ลูกค้า hot ของทีมมีกี่คน').kind).toBe('hotbyseller')
    expect(isTeamQuestion('ใครมีนัดติดตามค้างเยอะสุด')).toBe(true)
  })
})
