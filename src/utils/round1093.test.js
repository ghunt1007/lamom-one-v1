import { describe, it, expect } from 'vitest'
import { mentionedBookings } from './recordFacts.js'
import { mentionedCustomers } from './aiActions.js'

describe('v1.0.1093 generic words are not names', () => {
  it('does not match "ลูกค้า ทดสอบ" bookings for generic questions', () => {
    const bk = [{ custName: 'ลูกค้า ทดสอบ 3' }, { custName: 'สมชาย ใจดี' }]
    expect(mentionedBookings('ลูกค้าของฉันมีกี่คน', bk)).toEqual([])
    expect(mentionedBookings('สมชายรับรถยัง', bk).map(b => b.custName)).toEqual(['สมชาย ใจดี'])
    expect(mentionedBookings('ลูกค้าทดสอบ3 ถึงไหนแล้ว', bk).length).toBe(1)
  })
  it('customer first name "ลูกค้า" is ignored', () => {
    expect(mentionedCustomers('ลูกค้าที่ยังไม่มีเบอร์', [{ firstName: 'ลูกค้า', lastName: 'งาน ev1' }])).toEqual([])
  })
})
