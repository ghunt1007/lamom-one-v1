import { describe, it, expect } from 'vitest'
import { isIncomeQuestion, wantsPrevMonth, incomeStats, incomeBriefText, incomeFollowUps } from './incomeBrief.js'
import { isMonthQuestion } from './monthBrief.js'
import { isTodayQuestion } from './todayBrief.js'
import { isTeamQuestion } from './teamBrief.js'
import { maybePayQuestion } from './payQuestions.js'
import { parseStockSpec } from './stockQuestions.js'
import { parseListSpec } from './listQuestions.js'
import { parseBookingListSpec } from './bookingQuestions.js'
import { parseBulkSpec } from './bulkCommands.js'

const today = '2026-11-11'
const bks = [
  { id: '1', salesName: 'เอ', status: 'ส่งมอบแล้ว', cutDate: '2026-11-03', com70: 5000, comFinance: 2000, marginLeft: 3000, totalIncome: 10000 },
  { id: '2', salesName: 'บี', status: 'ตัดตัวเลขรอส่งมอบ', cutDate: '2026-11-10', com70: 4000, comFinance: 0, marginLeft: 1000, totalIncome: 5000 },
  { id: '3', salesName: 'บี', status: 'ส่งมอบแล้ว', cutDate: '2026-11-09' },
  { id: '4', salesName: 'เอ', status: 'ส่งมอบแล้ว', cutDate: '2026-10-20', com70: 6000, totalIncome: 6000 },
  { id: '5', salesName: 'เอ', status: 'รอส่งมอบ', bookingDate: '2026-11-05' },
  { id: '6', salesName: 'เอ', status: 'ส่งมอบแล้ว', cutDate: '2026-11-04', totalIncome: 99999, deleted: true },
]

describe('isIncomeQuestion', () => {
  it('matches commission / income questions', () => {
    for (const q of ['ค่าคอมเดือนนี้เท่าไหร่', 'ค่าคอมฉันเท่าไหร่?', 'รายได้เดือนนี้', 'สรุปรายได้เดือนก่อน', 'คอมมิชชั่นเดือนที่แล้ว', 'ค่าคอมทีมเดือนนี้']) expect(isIncomeQuestion(q), q).toBe(true)
  })
  it('leaves other questions alone', () => {
    for (const q of ['ค่าคอมคิดยังไง', 'ทำไมค่าคอมน้อย', 'กรอกรายได้คันไหน', 'ใครยังไม่กรอกรายได้', 'ลูกค้ารายได้ 30000 ผ่อนไหวไหม', 'รายได้ปีนี้', 'ยอดเดือนนี้เป็นไง', 'วันนี้มีอะไรบ้าง', '']) expect(isIncomeQuestion(q), q).toBe(false)
  })
  it('is not claimed by another local answer', () => {
    for (const q of ['ค่าคอมเดือนนี้เท่าไหร่', 'รายได้เดือนนี้', 'ค่าคอมเดือนก่อนเท่าไหร่']) {
      expect(isMonthQuestion(q)).toBe(false); expect(isTodayQuestion(q)).toBe(false); expect(isTeamQuestion(q)).toBe(false); expect(maybePayQuestion(q)).toBe(false)
      expect(parseStockSpec(q, [])).toBeNull(); expect(parseListSpec(q)).toBeNull(); expect(parseBookingListSpec(q)).toBeNull(); expect(parseBulkSpec(q)).toBeNull()
    }
  })
  it('detects previous month', () => {
    expect(wantsPrevMonth('ค่าคอมเดือนก่อน')).toBe(true); expect(wantsPrevMonth('ค่าคอมเดือนนี้')).toBe(false)
  })
})

describe('incomeStats / text', () => {
  it('sums the month like the income page', () => {
    const s = incomeStats({ bookings: bks, today })
    expect(s.total.delivered).toBe(3); expect(s.total.income).toBe(15000); expect(s.total.missing).toBe(1)
    expect(s.before.income).toBe(6000)
    const t = incomeBriefText(s, { scope: 'ทั้งโชว์รูม' })
    expect(t).toContain('ส่งมอบ 3 คัน · รายได้รวม ฿15,000')
    expect(t).toContain('คอมเซลส์ ฿9,000 · คอมไฟแนนซ์ ฿2,000 · มาร์จิ้นคงเหลือ ฿4,000')
    expect(t).toContain('(▲฿9,000)')
    expect(t).toContain('ยังไม่กรอกรายได้ 1 คัน')
    expect(t).toContain('1. เอ — 1 คัน · ฿10,000')
    expect(t).toContain('2. บี — 2 คัน · ฿5,000 (ยังไม่กรอก 1)')
    expect(incomeFollowUps(s)[0]).toBe('ค่าคอมเดือนก่อนเท่าไหร่')
  })
  it('previous month and single seller', () => {
    const s = incomeStats({ bookings: bks.filter(b => b.salesName === 'เอ'), today, prev: true })
    expect(s.ym).toBe('2026-10'); expect(s.total.income).toBe(6000)
    const t = incomeBriefText(s, { scope: 'ของคุณ' })
    expect(t).toContain('รายได้เดือนก่อน'); expect(t).not.toContain('🏆'); expect(t).toContain('เฉลี่ยคันละ ฿6,000')
    expect(incomeFollowUps(s)).toEqual(['ค่าคอมเดือนนี้เท่าไหร่', 'ยอดเดือนนี้เป็นไง'])
  })
  it('no deliveries yet', () => {
    const t = incomeBriefText(incomeStats({ bookings: [], today }))
    expect(t).toContain('ยังไม่มีรถส่งมอบในเดือนนี้')
  })
})
