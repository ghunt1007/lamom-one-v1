import { describe, it, expect } from 'vitest'
import { isMonthQuestion, monthStats, monthBriefText, monthFollowUps } from './monthBrief.js'
import { isTodayQuestion } from './todayBrief.js'
import { parseListSpec } from './listQuestions.js'
import { parseBookingListSpec } from './bookingQuestions.js'
import { parseBulkSpec } from './bulkCommands.js'

const today = '2026-11-11'
const bks = [
  { id: '1', salesName: 'เอ', status: 'ส่งมอบแล้ว', bookingDate: '2026-10-20', cutDate: '2026-11-03' },
  { id: '2', salesName: 'เอ', status: 'ตัดตัวเลขรอส่งมอบ', bookingDate: '2026-11-02', cutDate: '2026-11-10' },
  { id: '3', salesName: 'บี', status: 'รอส่งมอบ', bookingDate: '2026-11-05' },
  { id: '4', salesName: 'บี', status: 'รอผลไฟแนนซ์', bookingDate: '2026-11-09' },
  { id: '5', salesName: 'บี', status: 'ถอนจอง', bookingDate: '2026-11-06' },
  { id: '6', salesName: 'เอ', status: 'ส่งมอบแล้ว', bookingDate: '2026-10-01', cutDate: '2026-10-05' },
  { id: '7', salesName: 'เอ', status: 'ส่งมอบแล้ว', bookingDate: '2026-10-02', cutDate: '2026-10-25' },
  { id: '8', salesName: 'เอ', status: 'รอรถ', bookingDate: '2026-10-08' },
  { id: '9', salesName: 'เอ', status: 'ส่งมอบแล้ว', bookingDate: '2026-11-01', cutDate: '2026-11-04', deleted: true },
]

describe('isMonthQuestion', () => {
  it('matches month / target questions', () => {
    for (const q of ['ยอดเดือนนี้เป็นไง', 'ยอดเดือนนี้เป็นยังไงบ้าง?', 'เดือนนี้ขายได้กี่คัน', 'สรุปยอดเดือนนี้', 'ถึงเป้าหรือยัง', 'เหลืออีกกี่คันถึงเป้า', 'เป้าเดือนนี้เหลือเท่าไหร่', 'ยอดของฉัน', 'ยอดขายตอนนี้', 'ใครขายดีสุด', 'ส่งมอบเดือนนี้กี่คันแล้ว']) expect(isMonthQuestion(q), q).toBe(true)
  })
  it('leaves other questions alone', () => {
    for (const q of ['สรุปยอดวันนี้', 'วันนี้มีอะไรบ้าง', 'ใครยอดจองคงค้าง', 'ส่งมอบเดือนนี้มีใครบ้าง', 'ยอดปีนี้เป็นไง', 'ยอดเดือนก่อนเท่าไหร่', 'ทำไมยอดเดือนนี้ตก', 'ยอดดาวน์ ORA เท่าไหร่', 'นัดสมชายเดือนนี้', 'ค่าคอมเดือนนี้เท่าไหร่', 'ลูกค้า hot มีใครบ้าง', '']) expect(isMonthQuestion(q), q).toBe(false)
  })
  it('does not steal questions other local answers handle', () => {
    for (const q of ['ยอดเดือนนี้เป็นไง', 'ถึงเป้าหรือยัง', 'ใครขายดีสุด']) {
      expect(isTodayQuestion(q)).toBe(false); expect(parseListSpec(q)).toBeNull(); expect(parseBookingListSpec(q)).toBeNull(); expect(parseBulkSpec(q)).toBeNull()
    }
  })
})

describe('monthStats', () => {
  const s = monthStats({ bookings: bks, today, target: 5 })
  it('counts with the dashboard definitions', () => {
    expect(s.delivered).toBe(2)
    expect(s.booked).toBe(4)
    expect(s.withdrawn).toBe(1)
    expect(s.prevDelivered).toBe(1) // เดือนก่อนนับถึงวันที่ 11 เท่านั้น
    expect(s.prevBooked).toBe(3)
    expect(s.open).toBe(3)
    expect(s.waitDeliv).toBe(1)
    expect(s.fin).toBe(1)
    expect(s.left).toBe(3)
    expect(s.daysLeft).toBe(19)
    expect(s.label).toBe('พ.ย. 2569')
    expect(s.board.map(r => r.name)).toEqual(['เอ', 'บี'])
  })
  it('hides the ranking when only one seller is in scope', () => {
    expect(monthStats({ bookings: bks.filter(b => b.salesName === 'เอ'), today }).board).toEqual([])
  })
})

describe('monthBriefText / monthFollowUps', () => {
  it('writes the summary with target and tip', () => {
    const t = monthBriefText(monthStats({ bookings: bks, today, target: 5 }), { scope: 'ทั้งโชว์รูม' })
    expect(t).toContain('📊 ยอดเดือนนี้ พ.ย. 2569 — ทั้งโชว์รูม')
    expect(t).toContain('ส่งมอบแล้ว 2 คัน · เดือนก่อนช่วงเดียวกัน 1 คัน (▲1)')
    expect(t).toContain('จองใหม่ 4 ใบ · ถอน 1 ใบ')
    expect(t).toContain('เป้าส่งมอบ 5 คัน · ทำได้ 40% · ขาดอีก 3 คัน · เหลือ 19 วัน')
    expect(t).toContain('🏆 อันดับเดือนนี้\n1. เอ — ส่งมอบ 2 · จอง 1')
    expect(t).toContain('ต้องส่งมอบอีก 3 คันใน 19 วัน')
  })
  it('celebrates a reached target and skips the target line when none is set', () => {
    expect(monthBriefText(monthStats({ bookings: bks, today, target: 2 }))).toContain('ถึงเป้าแล้ว 🎉')
    expect(monthBriefText(monthStats({ bookings: bks, today }))).toContain('ยังไม่ได้ตั้งเป้า')
    expect(monthBriefText(monthStats({ bookings: [], today }))).toContain('ส่งมอบแล้ว 0 คัน · เดือนก่อนช่วงเดียวกัน 0 คัน (เท่าเดิม)')
  })
  it('offers follow-ups that LAMI can answer as lists', () => {
    const next = monthFollowUps(monthStats({ bookings: bks, today }))
    expect(next).toEqual(['ใครรอส่งมอบ', 'ใครรอไฟแนนซ์', 'ใบจองไหนค้างนานสุด', 'ลูกค้า hot มีใครบ้าง'])
    next.forEach(q => expect(parseBookingListSpec(q) || parseListSpec(q), q).toBeTruthy())
    expect(monthFollowUps(monthStats({ bookings: [], today }))).toEqual(['ลูกค้า hot มีใครบ้าง'])
  })
})

describe('isMonthQuestion top seller (v1.0.1082)', () => {
  it('catches "which sales sold best"', () => {
    expect(isMonthQuestion('เซลส์คนไหนขายดีสุดเดือนนี้')).toBe(true)
    expect(isMonthQuestion('ใครขายได้มากสุด')).toBe(true)
  })
})

describe('previous month (v1.0.1086)', () => {
  it('detects and summarises last month', async () => {
    const { isPrevMonthQuestion, prevMonthEnd } = await import('./monthBrief.js')
    expect(isPrevMonthQuestion('ยอดเดือนก่อนเป็นไง')).toBe(true)
    expect(isPrevMonthQuestion('ยอดเดือนนี้เป็นไง')).toBe(false)
    expect(prevMonthEnd('2026-01-12')).toBe('2025-12-31')
    const st = monthStats({ bookings: [{ status: 'ส่งมอบแล้ว', actualDeliveryDate: '2026-10-05', bookingDate: '2026-10-01', salesName: 'A' }], today: '2026-10-31', target: 2 })
    const t = monthBriefText(st, { past: true })
    expect(t).toContain('ยอดเดือนก่อน')
    expect(t).toContain('ทำได้')
  })
})

describe('findSeller (v1.0.1088)', () => {
  it('matches full names ignoring spaces, unique first names only', async () => {
    const { findSeller } = await import('./monthBrief.js')
    const N = ['เซลส์ หนึ่ง', 'เซลส์ สอง', 'สมชาย ใจดี', 'สมหญิง ใจดี']
    expect(findSeller('ใบจองเดือนนี้ของเซลส์หนึ่ง', N)).toBe('เซลส์ หนึ่ง')
    expect(findSeller('สมชายขายได้กี่คันเดือนนี้', N)).toBe('สมชาย ใจดี')
    expect(findSeller('ยอดของเซลส์เดือนนี้', N)).toBe('')
    expect(findSeller('ยอดเดือนนี้เป็นไง', N)).toBe('')
  })
})

describe('monthBriefText pace (v1.0.1403)', () => {
  it('มีประวัติพอ → บรรทัดคาดจองสิ้นเดือน', async () => {
    const { monthStats, monthBriefText } = await import('./monthBrief.js')
    const mk = (ym, days) => days.map((d, i) => ({ id: ym + i, bookingDate: `${ym}-${String(d).padStart(2, '0')}`, status: 'รอรถ' }))
    const B = [...['2026-08', '2026-09', '2026-10'].flatMap(ym => mk(ym, [3, 8, 22, 24, 25, 26, 27, 28, 29, 30])), ...mk('2026-11', [2, 9])]
    const t = monthBriefText(monthStats({ bookings: B, today: '2026-11-10' }))
    expect(t).toContain('🔮 คาดจองสิ้นเดือน ≈ 10 ใบ')
  })
})

describe('isMonthQuestion booking projection (v1.0.1412)', () => {
  it('booking projection phrasings → month brief', () => {
    for (const q of ['คาดยอดจองสิ้นเดือน', 'สิ้นเดือนจะได้ยอดจองเท่าไหร่', 'เดือนนี้จะจองได้กี่ใบ']) expect(isMonthQuestion(q), q).toBe(true)
    expect(isMonthQuestion('ยอดจองเดือนก่อนสิ้นเดือนเท่าไหร่')).toBe(false)
  })
})

describe('better/worse than last month (v1.0.1469)', () => {
  it('routes comparison phrasings to the month summary', () => {
    expect(isMonthQuestion('เดือนนี้ดีกว่าเดือนที่แล้วไหม')).toBe(true)
    expect(isMonthQuestion('ร้านเราขายดีขึ้นไหม')).toBe(true)
    expect(isMonthQuestion('ยอดตกไหม')).toBe(true)
    expect(isMonthQuestion('ทำไมยอดตก')).toBe(false)
    expect(isMonthQuestion('กำไรเดือนนี้ดีกว่าเดือนที่แล้วไหม')).toBe(false)
    expect(isMonthQuestion('สีไหนขายดี')).toBe(true) // (v1.0.1471)
    expect(isMonthQuestion('รุ่นไหนขายดี')).toBe(true)
    expect(isMonthQuestion('สีไหนเหลือในสต็อก')).toBe(false)
    expect(isMonthQuestion('รุ่นไหนคนสนใจเยอะ')).toBe(false)
    expect(isMonthQuestion('ฉันขายได้กี่คันแล้ว')).toBe(true) // (v1.0.1480)
    expect(isMonthQuestion('ส่งมอบไปกี่คันแล้ว')).toBe(true)
  })
})

describe('findModel (v1.0.1479)', async () => {
  const { findModel, sameModel } = await import('./monthBrief.js')
  it('finds the model the question names', () => {
    const bk = [{ brand: 'DEEPAL', model: 'S07' }, { brand: 'AION', model: 'AION V' }, { brand: 'DEEPAL', model: 'L07' }]
    expect(findModel('S07 ขายได้กี่คันเดือนนี้', bk)).toBe('S07')
    expect(findModel('ยอดจอง aion v เดือนนี้', bk)).toBe('AION V')
    expect(findModel('ยอดเดือนนี้เป็นไง', bk)).toBe('')
    expect(sameModel({ brand: 'DEEPAL', model: 'S07' }, 'S07')).toBe(true)
    expect(sameModel({ brand: 'DEEPAL', model: 'L07' }, 'S07')).toBe(false)
  })
})
