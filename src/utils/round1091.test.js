import { describe, it, expect } from 'vitest'
import { parseOpsSpec, withdrawnAnswer, noShowAnswer, noBookSellerAnswer, finBankAnswer } from './opsQuestions.js'
import { parseBookingListSpec, bookingListLabel } from './bookingQuestions.js'
import { parseListSpec } from './listQuestions.js'
import { isMonthQuestion, periodSpec, periodStats, periodBriefText } from './monthBrief.js'
import { customerActionsFor } from './aiActions.js'

const today = '2026-11-12'
describe('v1.0.1091 manager questions', () => {
  it('routes', () => {
    expect(parseOpsSpec('ใครถอนจองเดือนนี้')).toEqual({ kind: 'withdrawn', prev: false })
    expect(parseOpsSpec('เดือนนี้ถอนจองกี่ใบ').kind).toBe('withdrawn')
    expect(isMonthQuestion('เดือนนี้ถอนจองกี่ใบ')).toBe(false)
    expect(parseOpsSpec('ลูกค้าที่นัดแล้วไม่มา')).toEqual({ kind: 'noshow', range: 30 })
    expect(parseOpsSpec('เซลส์คนไหนยังไม่มีใบจองเดือนนี้')).toEqual({ kind: 'nobookseller' })
    expect(parseOpsSpec('ไฟแนนซ์ไหนอนุมัติเยอะสุด')).toEqual({ kind: 'finbank' })
    expect(parseOpsSpec('ไฟแนนซ์ไหนดอกเบี้ยถูกสุด')).toBeNull()
    expect(parseOpsSpec('ลูกค้ามาโชว์รูมเดือนนี้กี่คน')).toEqual({ kind: 'walkin', day: 'month' })
    expect(parseOpsSpec('พรุ่งนี้มีใครนัดเข้าโชว์รูม').kind).toBe('showroom')
  })
  it('withdrawn list', () => {
    const r = withdrawnAnswer([{ custName: 'ก', bookingDate: '2026-11-02', status: 'ถอนจอง', salesName: 'หนึ่ง' }, { custName: 'ข', bookingDate: '2026-11-03', status: 'รอรถ' }], { today })
    expect(r.n).toBe(1); expect(r.text).toContain('1 ใบ จาก 2 ใบ (50%)')
    expect(withdrawnAnswer([], { today }).text).toContain('ยังไม่มี')
  })
  it('no-show list', () => {
    const r = noShowAnswer([{ customerName: 'เอ', date: '2026-11-10', status: 'noshow' }, { customerName: 'บี', date: '2026-11-10', status: 'done' }], [{ customerName: 'ซี', date: '2026-11-01', status: 'no_show', model: 'S07' }, { customerName: 'ดี', date: '2026-08-01', status: 'no_show' }], { today })
    expect(r.n).toBe(2); expect(r.text).toContain('🚗 ทดลองขับ S07'); expect(r.text).not.toContain('ดี ·')
  })
  it('sellers without bookings', () => {
    const r = noBookSellerAnswer({ sellers: ['หนึ่ง', 'สอง'], customers: [{ assignedTo: 'สาม', stage: 'lead', temperature: 'hot' }], bookings: [{ salesName: 'หนึ่ง', bookingDate: '2026-11-05', status: 'รอรถ' }, { salesName: 'สี่', bookingDate: '2026-11-06', status: 'ถอนจอง' }], today })
    expect(r.n).toBe(3)
    expect(r.text).toMatch(/สาม — ดูแลลูกค้า 1 คน · 🔥 HOT 1/)
    expect(r.text).toContain('✅ มีใบจองแล้ว: หนึ่ง 1')
  })
  it('finance by company', () => {
    const b = [
      { financeCo: 'A', finStatus: 'ผ่าน', bookingDate: '2026-10-01', status: 'ส่งมอบแล้ว' }, { financeCo: 'A', finStatus: 'ผ่าน', bookingDate: '2026-10-02', status: 'รอส่งมอบ' },
      { financeCo: 'A', finStatus: 'ไม่ผ่าน', bookingDate: '2026-10-03', status: 'ถอนจอง' }, { financeCo: 'B', finStatus: 'รอผล', bookingDate: '2026-11-01', status: 'รอผลไฟแนนซ์' },
      { financeCo: 'C', finStatus: 'ซื้อสด', bookingDate: '2026-11-01' }]
    const r = finBankAnswer(b, { today })
    expect(r.n).toBe(2)
    expect(r.text).toMatch(/1\. A — ยื่น 3 · ✅ ผ่าน 2 · ❌ ไม่ผ่าน 1 · ⏳ รอ 0 · ผ่าน 67%/)
    expect(r.text).toContain('A ผ่านง่ายสุด')
  })
  it('booking list: status + age, list: hot quiet', () => {
    const sp = parseBookingListSpec('ใบจองที่รอไฟแนนซ์นานเกิน 7 วัน')
    expect(sp).toMatchObject({ stuck: true, stuckDays: 7 })
    expect(bookingListLabel(sp)).toBe('ใบจองสถานะ รอไฟแนนซ์ ค้างเกิน 7 วัน')
    expect(parseListSpec('ลูกค้า hot ที่ไม่ได้ติดต่อเกิน 7 วัน')).toMatchObject({ temp: 'hot', quietDays: 7 })
  })
  it('year / quarter', () => {
    expect(periodSpec('ปีนี้ขายได้กี่คัน')).toEqual({ period: 'year', prev: false })
    expect(periodSpec('ยอดไตรมาสนี้')).toEqual({ period: 'quarter', prev: false })
    expect(periodSpec('ยอดปีที่แล้ว')).toEqual({ period: 'year', prev: true })
    expect(periodSpec('ยอดเดือนนี้')).toBeNull()
    const bookings = [{ bookingDate: '2026-10-05', deliveryDate: '2026-10-20', status: 'ส่งมอบแล้ว', salesName: 'หนึ่ง', brand: 'AION', model: 'V' }, { bookingDate: '2026-11-02', status: 'รอรถ', salesName: 'สอง', brand: 'AION', model: 'V' }]
    const t = periodBriefText(periodStats({ bookings, today, period: 'quarter' }))
    expect(t).toContain('ไตรมาส 4/2569 (ถึงวันนี้)')
    expect(t).toContain('📅 รายเดือน')
    expect(t).toContain('1. AION V')
  })
  it('no customer buttons on seller-income questions; duplicate first names get last names', () => {
    const cs = [{ id: 1, firstName: 'สมชาย', lastName: 'ก', phone: '081' }, { id: 2, firstName: 'สมชาย', lastName: 'ข', phone: '082' }]
    expect(customerActionsFor('ค่าคอมของสมชายเดือนนี้', cs)).toEqual([])
    expect(customerActionsFor('สมชายสนใจรุ่นไหน', cs).map(a => a.label)).toContain('📞 โทร สมชาย ก')
  })
})
