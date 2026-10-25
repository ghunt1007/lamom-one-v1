import { describe, it, expect } from 'vitest'
import { customerStatusMessage } from './bookingNotify.js'

describe('customerStatusMessage', () => {
  const b = { custName: 'สมชาย ใจดี', brand: 'Deepal', model: 'S07', salesName: 'เอ', deliveryDate: '2026-11-05' }
  it('uses first name, car and delivery date', () => {
    const t = customerStatusMessage(b, 'รอส่งมอบ')
    expect(t).toContain('คุณสมชาย')
    expect(t).not.toContain('ใจดี')
    expect(t).toContain('Deepal S07')
    expect(t).toContain('5 พ.ย. 2569')
    expect(t).toContain('เอ (เซลส์ผู้ดูแล)')
  })
  it('does not repeat brand already in model', () => {
    expect(customerStatusMessage({ brand: 'DEEPAL', model: 'DEEPAL S05' }, 'รอรถ')).toContain('รถ DEEPAL S05 เข้า')
  })
  it('asks for a date when none is set', () => {
    expect(customerStatusMessage({ model: 'S05' }, 'รอส่งมอบ')).toContain('สะดวกรับรถวันไหน')
  })
  it('returns empty for statuses without a message', () => {
    expect(customerStatusMessage(b, 'ถอนจอง')).toBe('')
  })
})

import { revisitMessage } from './bookingNotify.js'
describe('revisitMessage', () => {
  it('fits the old lost reason', () => {
    expect(revisitMessage({ firstName: 'วิภา', interestedModel: 'S05' }, 'finance')).toContain('ไฟแนนซ์')
    expect(revisitMessage({ name: 'วิภา ทดลอง', interestedModel: 'S05' }, 'price')).toContain('คุณวิภา')
    expect(revisitMessage({}, 'other')).toMatch(/^สวัสดีครับ ผม/)
  })
})

import { testDriveThanks } from './bookingNotify.js'
describe('testDriveThanks', () => {
  it('fits the result', () => {
    const t = { customerName: 'สมชาย ใจดี', model: 'DEEPAL S07', staff: 'เซลส์ เอ' }
    expect(testDriveThanks(t, 'booked')).toContain('จอง DEEPAL S07')
    expect(testDriveThanks(t, 'interested')).toContain('คำนวณค่างวด')
    expect(testDriveThanks(t, '')).toMatch(/^สวัสดีครับคุณสมชาย/)
    expect(testDriveThanks(t, 'maybe')).toContain('เซลส์ เอ')
  })
})

import { firstReplyMessage } from './bookingNotify.js'
describe('firstReplyMessage', () => {
  it('asks for a phone number', () => {
    const m = firstReplyMessage({ firstName: 'นิด', interestedModel: 'DEEPAL S05' }, 'เอ')
    expect(m).toMatch(/^สวัสดีครับคุณนิด ผมเอ ขอบคุณที่สนใจ DEEPAL S05/)
    expect(m).toContain('ขอเบอร์โทร')
    expect(firstReplyMessage({})).toContain('สนใจรถของเรา')
  })
})
