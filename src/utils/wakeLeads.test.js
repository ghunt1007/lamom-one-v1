import { describe, it, expect } from 'vitest'
import { pickWakeLeads, wakeMessage, buildWakePrompt, lastTouchDays } from './wakeLeads.js'
import { parseBatchNudgeReply } from './salesAi.js'

const today = '2026-11-21'
const U = 'U' + 'b'.repeat(32)
const base = { stage: 'pp', firstName: 'สมชาย', lastName: 'ใจดี', phone: '0812345678', interestedModel: 'S07', createdAt: '2026-09-01T03:00:00Z' }

describe('pickWakeLeads', () => {
  it('picks leads quiet 30+ days, LINE ones as line', () => {
    const r = pickWakeLeads([{ id: 'a', ...base, lineUserId: U }, { id: 'b', ...base }], { today })
    expect(r.map(x => [x.c.id, x.channel])).toEqual([['a', 'line'], ['b', 'phone']].sort(() => 0))
    expect(r[0].days).toBe(81)
  })
  it('skips recent, lost, booked, opted-out, blocked, no consent, cooldown and too old', () => {
    const cs = [
      { id: '1', ...base, lastContactAt: '2026-11-10T03:00:00Z' },
      { id: '2', ...base, isLost: true },
      { id: '3', ...base, stage: 'booking' },
      { id: '4', ...base, lineUserId: U, lineOptOut: true },
      { id: '5', ...base, lineBlockedAt: '2026-11-01' },
      { id: '6', ...base, marketingConsent: 'no' },
      { id: '7', ...base, wakeSentAt: '2026-11-01T03:00:00Z' },
      { id: '8', ...base, createdAt: '2025-01-01T00:00:00Z' },
      { id: '9', ...base, phone: '' },
      { id: '10', ...base, deleted: true },
    ]
    expect(pickWakeLeads(cs, { today })).toEqual([])
  })
  it('wakeSentAt older than cooldown counts as last touch', () => {
    const c = { id: 'x', ...base, wakeSentAt: '2026-10-10T03:00:00Z' }
    expect(lastTouchDays(c, today)).toBe(42)
    expect(pickWakeLeads([c], { today })).toHaveLength(1)
  })
  it('respects mine() and sorts hot first', () => {
    const cs = [{ id: 'a', ...base }, { id: 'b', ...base, temperature: 'hot' }, { id: 'c', ...base, assignedTo: 'คนอื่น' }]
    const r = pickWakeLeads(cs, { today, mine: c => c.assignedTo !== 'คนอื่น' })
    expect(r.map(x => x.c.id)).toEqual(['b', 'a'])
  })
})

describe('messages', () => {
  it('template greets by first name and only mentions real promos', () => {
    expect(wakeMessage(base, [], 'กอล์ฟ')).toContain('สวัสดีครับคุณสมชาย ผมกอล์ฟ')
    expect(wakeMessage(base, [])).not.toContain('เดือนนี้')
    expect(wakeMessage(base, ['ส่วนลดรวม 20,000 บาท'])).toContain('ส่วนลดรวม 20,000 บาท')
    expect(wakeMessage({ firstName: 'ลูกค้า LINE' })).toMatch(/^สวัสดีครับ ไม่ได้/)
  })
  it('AI prompt lists each lead and parses back', () => {
    const p = buildWakePrompt([{ c: base, days: 40, promo: ['แถม wallbox'] }])
    expect(p).toContain('1. สมชาย')
    expect(p).toContain('แถม wallbox')
    expect(parseBatchNudgeReply('[{"i":1,"msg":"สวัสดีครับคุณสมชาย"}]', 1)).toEqual([{ i: 1, msg: 'สวัสดีครับคุณสมชาย' }])
  })
})
