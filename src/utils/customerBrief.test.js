import { describe, it, expect } from 'vitest'
import { briefTarget, customerBrief, briefCommands } from './customerBrief.js'
import { parseLamiCommand } from './lamiCommands.js'

const today = '2026-11-11'
const iso = d => new Date(d + 'T05:00:00Z').toISOString()
const a = { id: 'a', firstName: 'สมชาย', lastName: 'รักไทย', stage: 'lead', temperature: 'hot', phone: '0811111111', interestedModel: 'S05', lastContactAt: iso('2026-11-01') }
const b = { id: 'b', firstName: 'มานี', stage: 'booked', bookingId: 'b1', phone: '' }
const cs = [a, b]

describe('briefTarget', () => {
  it('finds the customer asked about', () => {
    expect(briefTarget('สมชายถึงไหนแล้ว', cs)?.id).toBe('a')
    expect(briefTarget('สรุปมานี', cs)?.id).toBe('b')
    expect(briefTarget('สถานะสมชาย?', cs)?.id).toBe('a')
  })
  it('ignores commands and other questions', () => {
    for (const q of ['นัดสมชายพรุ่งนี้ 10 โมง', 'สมชาย hot', 'สรุปยอดขาย', 'สรุปวันนี้', 'ควรพูดกับสมชายยังไง', 'วิภาถึงไหนแล้ว', ''])
      expect(briefTarget(q, cs)).toBe(null)
    expect(parseLamiCommand('สมชายถึงไหนแล้ว', cs, today)).toEqual([])
  })
})

describe('customerBrief', () => {
  it('lead with overdue follow-up', () => {
    const txt = customerBrief({ customer: a, followups: [{ customerId: 'a', status: 'pending', dueDate: '2026-11-09', purpose: 'โทรตาม' }], today })
    expect(txt).toContain('สมชาย รักไทย — 🧲 Lead · 🔥 HOT · 🚗 S05')
    expect(txt).toContain('ติดต่อล่าสุด 01/11/2569 (10 วันก่อน)')
    expect(txt).toContain('นัดถัดไป 09/11/2569 — โทรตาม (เลยมา 2 วัน)')
    expect(txt).toContain('💡 นัดเลยกำหนดมา 2 วัน')
  })
  it('lead without follow-up', () => {
    const txt = customerBrief({ customer: a, today })
    expect(txt).toContain('⚠️ ยังไม่มีนัดติดตาม')
    expect(txt).toContain('เงียบมา 10 วันและไม่มีนัด')
  })
  it('booked customer waiting for delivery without a date', () => {
    const txt = customerBrief({ customer: b, booking: { id: 'b1', bookingNo: 'SKT1', status: 'รอส่งมอบ', bookingDate: '2026-11-01', brand: 'DEEPAL', model: 'S07' }, today })
    expect(txt).toContain('📝 ใบจอง SKT1: รอส่งมอบ')
    expect(txt).toContain('จองมา 10 วัน')
    expect(txt).toContain('ยังไม่ได้นัดวันส่งมอบ')
    expect(txt).not.toContain('ยังไม่มีนัดติดตาม')
  })
  it('commands', () => {
    expect(briefCommands(a).map(c => c.kind)).toEqual(['tel', 'open'])
    expect(briefCommands(b).map(c => c.kind)).toEqual(['open'])
  })
})
