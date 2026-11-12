import { describe, it, expect } from 'vitest'
import { parseAheadSpec, aheadStats, aheadBriefText, aheadFollowUps, addDays } from './aheadBrief.js'
import { isTodayQuestion } from './todayBrief.js'
import { isMonthQuestion } from './monthBrief.js'
import { isTeamQuestion } from './teamBrief.js'
import { isIncomeQuestion } from './incomeBrief.js'
import { parseBulkSpec } from './bulkCommands.js'

const today = '2026-11-11' // พุธ
const customers = [
  { id: 'c1', firstName: 'สมชาย', lastName: 'ใจดี', stage: 'lead' },
  { id: 'c2', firstName: 'มานี', stage: 'pp' },
  { id: 'c3', firstName: 'ปิติ', stage: 'booked', bookingId: 'b1' },
]
const followups = [
  { customerId: 'c1', status: 'pending', dueDate: '2026-11-12' },
  { customerId: 'c2', status: 'pending', dueDate: '2026-11-12T10:00' },
  { customerId: 'c1', status: 'pending', dueDate: '2026-11-15' },
  { customerId: 'c2', status: 'pending', dueDate: '2026-11-09' },
  { customerId: 'c2', status: 'done', dueDate: '2026-11-12' },
  { customerId: 'zz', status: 'pending', dueDate: '2026-11-12' },
  { customerId: 'c1', status: 'pending', dueDate: '2026-11-18' },
]
const bookings = [
  { id: 'b1', custName: 'ปิติ', status: 'รอส่งมอบ', deliveryDate: '2026-11-12' },
  { id: 'b2', custName: 'คนอื่น', status: 'รอส่งมอบ', deliveryDate: '2026-11-12' },
  { id: 'b3', customerId: 'c1', custName: 'สมชาย', status: 'ส่งมอบแล้ว', deliveryDate: '2026-11-13' },
]

describe('parseAheadSpec', () => {
  it('matches tomorrow / week questions', () => {
    for (const q of ['พรุ่งนี้มีอะไรบ้าง', 'พรุ่งนี้ต้องทำอะไร?', 'นัดพรุ่งนี้มีอะไรบ้าง', 'สรุปงานพรุ่งนี้', 'งานพรุ่งนี้']) expect(parseAheadSpec(q), q).toEqual({ mode: 'tomorrow' })
    for (const q of ['สัปดาห์นี้มีอะไรบ้าง', 'อาทิตย์นี้มีนัดอะไรบ้าง', 'สรุปงานสัปดาห์นี้', 'ตารางงาน 7 วันข้างหน้า', '7 วันข้างหน้ามีอะไรบ้างครับ']) expect(parseAheadSpec(q), q).toEqual({ mode: 'week' })
  })
  it('leaves commands and other questions alone', () => {
    for (const q of ['นัดสมชายพรุ่งนี้', 'พรุ่งนี้โทรหามานี', 'ส่งมอบพรุ่งนี้มีใครบ้าง', 'วันนี้มีอะไรบ้าง', 'ยอดสัปดาห์นี้เป็นไง', 'พรุ่งนี้', 'เลื่อนนัดเป็นพรุ่งนี้', 'ทีมสัปดาห์นี้เป็นไง', '']) expect(parseAheadSpec(q), q).toBeNull()
  })
  it('is not claimed by answers earlier in the chain', () => {
    for (const q of ['พรุ่งนี้มีอะไรบ้าง', 'สัปดาห์นี้มีอะไรบ้าง', 'สรุปงานพรุ่งนี้']) {
      expect(isTodayQuestion(q), q).toBe(false); expect(isMonthQuestion(q)).toBe(false); expect(isTeamQuestion(q)).toBe(false); expect(isIncomeQuestion(q)).toBe(false); expect(parseBulkSpec(q)).toBeNull()
    }
  })
})

describe('aheadStats / text', () => {
  it('addDays crosses months', () => { expect(addDays('2026-11-30', 1)).toBe('2026-12-01') })
  it('tomorrow', () => {
    const s = aheadStats({ customers, followups, bookings, today, mode: 'tomorrow' })
    expect(s.days).toHaveLength(1); expect(s.followups).toBe(2); expect(s.deliveries).toBe(1); expect(s.overdue).toBe(1)
    const t = aheadBriefText(s)
    expect(t).toContain('🗓️ งานพรุ่งนี้ พฤ. 12/11/2569')
    expect(t).toContain('📞 นัดติดตาม 2 นัด — สมชาย ใจดี, มานี')
    expect(t).toContain('🚗 ส่งมอบ 1 คัน — ปิติ')
    expect(t).toContain('นัดเลยกำหนดค้างอยู่ 1 นัด')
    expect(aheadFollowUps(s)).toEqual(['สัปดาห์นี้มีอะไรบ้าง', 'วันนี้ควรโทรหาใคร', 'ส่งมอบพรุ่งนี้มีใครบ้าง'])
  })
  it('week', () => {
    const s = aheadStats({ customers, followups, bookings, today, mode: 'week' })
    expect(s.from).toBe('2026-11-11'); expect(s.to).toBe('2026-11-17'); expect(s.followups).toBe(3); expect(s.deliveries).toBe(1)
    const t = aheadBriefText(s)
    expect(t).toContain('11/11/2569 – 17/11/2569')
    expect(t).toContain('• พฤ. 12/11 — 📞 2 นัด (สมชาย ใจดี, มานี) · 🚗 ส่งมอบ 1 คัน (ปิติ)')
    expect(t).toContain('• อา. 15/11 — 📞 1 นัด (สมชาย ใจดี)')
    expect(t).toContain('🟢 วันว่าง: พ. 11/11, ศ. 13/11')
  })
  it('empty', () => {
    const t = aheadBriefText(aheadStats({ customers, followups: [], bookings: [], today, mode: 'tomorrow' }))
    expect(t).toContain('ยังไม่มีนัดติดตาม'); expect(t).toContain('พรุ่งนี้ยังว่าง')
  })
})
