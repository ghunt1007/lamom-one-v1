import { describe, it, expect } from 'vitest'
import { isTodayQuestion, todayStats, todayBriefText, todayFollowUps } from './todayBrief.js'
import { parseListSpec } from './listQuestions.js'
import { parseBookingListSpec } from './bookingQuestions.js'
import { isCallListQuestion } from './callList.js'

const today = '2026-11-11', tomorrow = '2026-11-12'
const iso = d => new Date(d + 'T05:00:00Z').toISOString()
const cs = [
  { id: 'a', firstName: 'สมชาย', stage: 'lead', temperature: 'hot', createdAt: iso('2026-11-11') },
  { id: 'b', firstName: 'มานี', stage: 'pp', temperature: 'hot', createdAt: iso('2026-10-01') },
  { id: 'c', firstName: 'ปิติ', stage: 'booked', bookingId: 'b1' },
  { id: 'd', firstName: 'ชูใจ', stage: 'booked', bookingId: 'b2' },
]
const fus = [
  { customerId: 'b', status: 'pending', dueDate: '2026-11-11' },
  { customerId: 'b', status: 'pending', dueDate: '2026-11-08' },
  { customerId: 'b', status: 'done', dueDate: '2026-11-11' },
  { customerId: 'zz', status: 'pending', dueDate: '2026-11-11' },
]
const bks = [
  { id: 'b1', custName: 'ปิติ', status: 'รอส่งมอบ', deliveryDate: '2026-11-11' },
  { id: 'b2', custName: 'ชูใจ', status: 'รอส่งมอบ' },
  { id: 'b9', custName: 'คนอื่น', status: 'รอส่งมอบ', deliveryDate: '2026-11-11' },
]

describe('isTodayQuestion', () => {
  it('matches today questions only', () => {
    for (const q of ['วันนี้มีอะไรบ้าง', 'สรุปวันนี้', 'วันนี้ต้องทำอะไร?', 'งานวันนี้', 'มีอะไรต้องทำบ้าง']) expect(isTodayQuestion(q)).toBe(true)
    for (const q of ['วันนี้ควรโทรหาใคร', 'สรุปยอดวันนี้', 'นัดสมชายวันนี้ 10 โมง', 'ส่งมอบวันนี้มีใครบ้าง', '']) expect(isTodayQuestion(q)).toBe(false)
  })
})

describe('todayStats / text', () => {
  const s = todayStats({ customers: cs, followups: fus, bookings: bks, today, tomorrow })
  it('counts only what the user can see', () => {
    expect(s).toMatchObject({ dueToday: 1, overdue: 1, delivToday: 1, delivTodayNames: 'ปิติ', delivTomorrow: 0, newLeads: 1, hotNoFu: 1, noDate: 1 })
  })
  it('text and follow-ups', () => {
    const txt = todayBriefText(s, '11/11/2569')
    expect(txt).toContain('นัดติดตามวันนี้ 1 นัด · ⚠️ เลยกำหนด 1 นัด')
    expect(txt).toContain('ส่งมอบวันนี้ 1 คัน — ปิติ')
    expect(txt).toContain('เริ่มจาก: เคลียร์นัดที่เลยกำหนดก่อน')
    expect(todayBriefText(todayStats({ today, tomorrow }))).toContain('ไม่มีงานค้าง')
  })
  it('every follow-up chip is a question LAMI answers locally', () => {
    const f = todayFollowUps(s)
    expect(f.length).toBe(5)
    for (const q of f) expect(isCallListQuestion(q) || !!parseBookingListSpec(q) || !!parseListSpec(q)).toBe(true)
    expect(parseListSpec('ลูกค้า hot ที่ยังไม่มีนัดมีใครบ้าง')).toMatchObject({ temp: 'hot', noFu: true })
  })
})
