import { describe, it, expect } from 'vitest'
import { recordFacts, mentionedBookings, customersByPhone, thaiDate } from './recordFacts.js'

const today = '2026-11-03'
const customers = [
  { id: 'c1', firstName: 'มานี', lastName: 'รักไทย', phone: '089-000-0027', stage: 'booking', interestedModel: 'AION V', assignedTo: 'เซลส์ หนึ่ง', lastContactAt: '2026-10-20' },
  { id: 'c2', firstName: 'มานะ', lastName: 'ใจดี', phone: '0890000099', stage: 'lead', interestedModel: 'S07' },
  { id: 'c3', firstName: 'ปิติ', stage: 'pp', deleted: true },
]
const bookings = [
  { id: 'b1', bookingNo: 'SKT2605', custName: 'มานี รักไทย', customerId: 'c1', model: 'AION V', status: 'รอส่งมอบ', bookingDate: '2026-10-20', deliveryDate: '2026-11-09', salesName: 'เซลส์ หนึ่ง' },
  { id: 'b2', bookingNo: 'SKT2700', custName: 'สมชาย ทดสอบ', model: 'S07', status: 'ถอนจอง', bookingDate: '2026-09-01' },
]
const followups = [{ id: 'f1', customerId: 'c1', dueDate: '2026-11-05', status: 'pending', type: 'โทร' }]

describe('recordFacts', () => {
  it('finds a customer by name with booking + next follow-up, and never leaks the phone', () => {
    const f = recordFacts('มานีถึงไหนแล้ว', { customers, bookings, followups }, today)
    const text = Object.values(f)[0]
    expect(text).toContain('มานี รักไทย')
    expect(text).toContain('SKT2605')
    expect(text).toContain('นัดส่งมอบ 09/11/2569 (อีก 6 วัน)')
    expect(text).toContain('นัดติดตามถัดไป 05/11/2569 (อีก 2 วัน)')
    expect(text).not.toContain('089')
    expect(text).not.toContain('มานะ')
  })
  it('finds by booking number and by phone', () => {
    expect(mentionedBookings('ใบจอง skt2700 สถานะอะไร', bookings).map(b => b.id)).toEqual(['b2'])
    expect(customersByPhone('เบอร์ 089 000 0099 คือใคร', customers).map(c => c.id)).toEqual(['c2'])
    const f = recordFacts('0890000099 คุยล่าสุดเมื่อไหร่', { customers, bookings }, today)
    expect(Object.values(f)[0]).toContain('มานะ ใจดี')
  })
  it('returns nothing when no record is mentioned, ignores deleted', () => {
    expect(recordFacts('ยอดขายเดือนนี้เท่าไร', { customers, bookings }, today)).toEqual({})
    expect(recordFacts('ปิติเป็นยังไง', { customers, bookings }, today)).toEqual({})
  })
  it('formats Thai dates', () => {
    expect(thaiDate('2026-01-31')).toBe('31/01/2569')
    expect(thaiDate('')).toBe('')
  })
})

import { isFollowUpQuestion } from './recordFacts.js'
describe('isFollowUpQuestion', () => {
  it('treats pronoun / short questions as follow-ups, new topics as not', () => {
    expect(isFollowUpQuestion('แล้วส่งมอบเมื่อไหร่')).toBe(true)
    expect(isFollowUpQuestion('เขาจองรุ่นไหน')).toBe(true)
    expect(isFollowUpQuestion('ไฟแนนซ์ล่ะ')).toBe(true)
    expect(isFollowUpQuestion('วันนี้ต้องโทรหาใครบ้าง')).toBe(false)
    expect(isFollowUpQuestion('ยอดขายเดือนนี้เทียบเดือนก่อนเป็นยังไง')).toBe(false)
  })
})
