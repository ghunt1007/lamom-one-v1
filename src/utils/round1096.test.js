import { describe, it, expect } from 'vitest'
import { parseOpsSpec, noTestDriveAnswer, deliveryAnswer } from './opsQuestions.js'
import { parseBookingListSpec } from './bookingQuestions.js'
import { isColorRankQuestion, monthStats, monthBriefText, periodStats, periodBriefText } from './monthBrief.js'

const today = '2026-11-12' // พฤหัส
describe('v1.0.1095 LAMI: no test drive, next-week delivery, finance not approved, best colour', () => {
  it('ลูกค้าที่ยังไม่ได้ทดลองขับ', () => {
    expect(parseOpsSpec('ลูกค้าคนไหนยังไม่ได้ทดลองขับ')).toEqual({ kind: 'notd' })
    expect(parseOpsSpec('ใครยังไม่เคยลองขับ')).toEqual({ kind: 'notd' })
    expect(parseOpsSpec('ลูกค้าที่ทดลองขับแล้วยังไม่จอง').kind).toBe('tdnobook')
    const cs = [
      { id: 1, firstName: 'ก', lastName: 'หนึ่ง', phone: '0811111111', stage: 'pp', temperature: 'warm' },
      { id: 2, firstName: 'ข', lastName: 'สอง', phone: '0822222222', stage: 'lead', temperature: 'hot', interestedModel: 'AION V' },
      { id: 3, firstName: 'ค', lastName: 'สาม', stage: 'booking', bookingId: 'x' },
      { id: 4, firstName: 'ง', lastName: 'สี่', stage: 'pp', isLost: true },
      { id: 5, firstName: 'จ', lastName: 'ห้า', stage: 'pp' },
    ]
    const r = noTestDriveAnswer(cs, [{ customerName: 'จ ห้า', date: '2026-11-01' }, { phone: '081-111-1111', date: '2026-11-02' }])
    expect(r.n).toBe(1)
    expect(r.text).toContain('ข สอง · HOT · 🚗 AION V')
  })
  it('นัดส่งมอบสัปดาห์หน้า = จันทร์–อาทิตย์ถัดไป', () => {
    expect(parseOpsSpec('นัดส่งมอบสัปดาห์หน้ามีใครบ้าง')).toEqual({ kind: 'delivery', day: 'nextweek' })
    const bks = [{ custName: 'A', deliveryDate: '2026-11-16', status: 'รอส่งมอบ' }, { custName: 'B', deliveryDate: '2026-11-14', status: 'รอส่งมอบ' }, { custName: 'C', deliveryDate: '2026-11-22', status: 'รอส่งมอบ' }]
    const r = deliveryAnswer(bks, { today, day: 'nextweek' })
    expect(r.n).toBe(2)
    expect(r.text).toContain('สัปดาห์หน้า (16/11/2569–22/11/2569)')
  })
  it('ใครยังไม่ได้อนุมัติไฟแนนซ์ → ใบจองรอไฟแนนซ์', () => {
    expect(parseBookingListSpec('ใครยังไม่ได้อนุมัติไฟแนนซ์').statuses).toContain('รอผลไฟแนนซ์')
    expect(parseBookingListSpec('ใบจองไหนไฟแนนซ์ยังไม่อนุมัติ').statuses).toContain('รอผลไฟแนนซ์')
  })
  it('สีขายดี', () => {
    expect(isColorRankQuestion('เดือนนี้ขายสีอะไรดีสุด')).toBe(true)
    expect(isColorRankQuestion('ยอดเดือนนี้เป็นไง')).toBe(false)
    const bookings = [
      { bookingDate: '2026-11-02', color: 'ขาว', model: 'AION V', status: 'จอง' },
      { bookingDate: '2026-11-03', color: 'ขาว', model: 'AION V', status: 'จอง' },
      { bookingDate: '2026-11-04', color: 'ดำ', model: 'S05', status: 'จอง' },
    ]
    const t = monthBriefText(monthStats({ bookings, today }), { colors: true })
    expect(t).toContain('🎨 สีขายดีเดือนนี้')
    expect(t).toMatch(/1\. ขาว — จอง 2/)
    const p = periodBriefText(periodStats({ bookings, today, period: 'year' }), { colors: true })
    expect(p).toMatch(/1\. ขาว — จอง 2/)
    expect(p).not.toContain('🚘 รุ่นขายดี')
  })
})

import { noQuoteAnswer, bookingsByModelAnswer } from './opsQuestions.js'
describe('v1.0.1095 LAMI: no quotation, bookings by model, next-month delivery', () => {
  it('parse', () => {
    expect(parseOpsSpec('ลูกค้าคนไหนยังไม่ได้ทำใบเสนอราคา')).toEqual({ kind: 'noquote' })
    expect(parseOpsSpec('ใครจองรุ่น S05 บ้าง')).toEqual({ kind: 'bookmodel', model: 'S05', period: 'all' })
    expect(parseOpsSpec('เดือนนี้จอง AION V กี่ใบ')).toEqual({ kind: 'bookmodel', model: 'AION V', period: 'month' })
    expect(parseOpsSpec('เดือนหน้ามีส่งมอบกี่คัน')).toEqual({ kind: 'delivery', day: 'nextmonth' })
    expect(parseOpsSpec('ยอดจองวันนี้').kind).toBe('bookday')
  })
  it('answers', () => {
    const q = noQuoteAnswer([{ id: 1, firstName: 'ก', stage: 'pp', temperature: 'hot' }, { id: 2, firstName: 'ข', stage: 'pp' }], [{ customerId: 2 }])
    expect(q.n).toBe(1)
    const bks = [{ custName: 'A', brand: 'DEEPAL', model: 'S05', status: 'ส่งมอบแล้ว', bookingDate: '2026-10-01' }, { custName: 'B', brand: 'DEEPAL', model: 'S05', status: 'รอรถ', bookingDate: '2026-09-01' }, { custName: 'C', model: 'S07', status: 'รอรถ' }, { custName: 'D', model: 'S05', status: 'ถอนจอง' }]
    const r = bookingsByModelAnswer(bks, { today, model: 'S05' })
    expect(r.n).toBe(2)
    expect(r.text.split('\n')[1]).toContain('B')
    const d = deliveryAnswer([{ custName: 'X', deliveryDate: '2026-12-31', status: 'รอส่งมอบ' }, { custName: 'Y', deliveryDate: '2027-01-01', status: 'รอส่งมอบ' }], { today, day: 'nextmonth' })
    expect(d.n).toBe(1)
    expect(d.text).toContain('เดือนหน้า (01/12/2569–31/12/2569)')
    const t = monthBriefText(monthStats({ bookings: [{ bookingDate: '2026-11-02', status: 'จอง' }], today }), { colors: true })
    expect(t).toContain('ยังไม่ได้ระบุสีรถ')
  })
})
