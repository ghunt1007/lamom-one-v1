import { describe, it, expect } from 'vitest'
import { isTeamQuestion, teamStats, teamBriefText, teamFollowUps } from './teamBrief.js'
import { isTodayQuestion } from './todayBrief.js'
import { isMonthQuestion } from './monthBrief.js'
import { parseListSpec } from './listQuestions.js'
import { parseBookingListSpec } from './bookingQuestions.js'
import { parseBulkSpec } from './bulkCommands.js'
import { isCallListQuestion } from './callList.js'

const today = '2026-11-11'
const iso = d => new Date(d + 'T05:00:00Z').toISOString()
const cs = [
  { id: 'a', assignedTo: 'เอ', stage: 'lead', temperature: 'hot', createdAt: iso('2026-11-11') },
  { id: 'b', assignedTo: 'เอ', stage: 'pp', temperature: 'warm', createdAt: iso('2026-10-01') },
  { id: 'c', assignedTo: 'บี', stage: 'lead', temperature: 'hot', createdAt: iso('2026-10-01') },
  { id: 'd', assignedTo: '', stage: 'lead', temperature: 'hot', createdAt: iso('2026-10-01') },
  { id: 'e', assignedTo: 'บี', stage: 'booked', bookingId: 'x' },
  { id: 'f', assignedTo: 'บี', stage: 'lead', isLost: true },
]
const fus = [
  { customerId: 'b', status: 'pending', dueDate: '2026-11-08' },
  { customerId: 'b', status: 'pending', dueDate: '2026-11-11' },
  { customerId: 'c', status: 'pending', dueDate: '2026-11-20' },
  { customerId: 'zz', status: 'pending', dueDate: '2026-11-01' },
  { customerId: 'a', status: 'done', dueDate: '2026-11-01' },
]

describe('isTeamQuestion', () => {
  it('matches team follow-up questions only', () => {
    for (const q of ['ทีมวันนี้เป็นไง', 'สรุปงานทีม', 'ใครมีนัดค้างเยอะสุด?', 'ลูกทีมตามงานถึงไหน สรุปให้หน่อย', 'ใครไม่ตามลูกค้า', 'ภาพรวมทีมขาย']) expect(isTeamQuestion(q), q).toBe(true)
    for (const q of ['ยอดทีมเดือนนี้', 'ใครขายดีสุด', 'วันนี้มีอะไรบ้าง', 'นัดลูกค้า hot ทุกคนพรุ่งนี้ 10 โมง', 'ลูกค้า hot มีใครบ้าง', 'ทีมขายมีกี่คน', '']) expect(isTeamQuestion(q), q).toBe(false)
  })
  it('does not collide with other local answers', () => {
    for (const q of ['ทีมวันนี้เป็นไง', 'สรุปงานทีม', 'ใครมีนัดค้างเยอะสุด']) {
      expect(isTodayQuestion(q)).toBe(false); expect(isMonthQuestion(q)).toBe(false); expect(parseListSpec(q)).toBeNull()
      expect(parseBookingListSpec(q)).toBeNull(); expect(parseBulkSpec(q)).toBeNull(); expect(isCallListQuestion(q)).toBe(false)
    }
  })
})

describe('teamStats / text', () => {
  const st = teamStats({ customers: cs, followups: fus, today })
  it('counts per seller, visible customers only', () => {
    expect(st.sellers.map(r => r.name)).toEqual(['เอ', 'บี'])
    expect(st.sellers[0]).toMatchObject({ active: 2, overdue: 1, dueToday: 1, hotNoFu: 1, newToday: 1 })
    expect(st.sellers[1]).toMatchObject({ active: 1, overdue: 0, dueToday: 0, hotNoFu: 0 })
    expect(st.unowned).toMatchObject({ active: 1, hotNoFu: 1 })
  })
  it('writes the summary', () => {
    const t = teamBriefText(st, '11/11/2026')
    expect(t).toContain('👥 งานติดตามของทีมวันนี้ 11/11/2026 — 2 คน')
    expect(t).toContain('• เอ — ⚠️ เลยกำหนด 1 · 📞 วันนี้ 1 · 🔥 HOT ไม่มีนัด 1 · 🧲 ลีดใหม่ 1 · ดูแล 2 คน')
    expect(t).toContain('• บี — ✅ ไม่มีงานค้าง · ดูแล 1 คน')
    expect(t).toContain('🙋 ลูกค้าที่ยังไม่มีผู้ดูแล 1 คน (HOT 1)')
    expect(t).toContain('💡 คุยกับ เอ ก่อน')
    expect(teamBriefText(teamStats({ customers: [], followups: [], today }))).toContain('ยังไม่มีลูกค้า')
  })
  it('offers follow-ups', () => {
    expect(teamFollowUps(st)).toEqual(['วันนี้ควรโทรหาใคร', 'ลูกค้า hot ที่ยังไม่มีนัดมีใครบ้าง', 'ใครขายดีสุด'])
  })
})
