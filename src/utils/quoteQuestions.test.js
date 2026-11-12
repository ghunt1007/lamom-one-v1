import { describe, it, expect } from 'vitest'
import { maybeQuoteQuestion, parseQuoteSpec, quoteStats, quoteBriefText, quoteFollowUps, quotePageQuery } from './quoteQuestions.js'

const T = '2026-11-12'
const Q = [
  { id: 'a', customerName: 'คุณเอ', vehicleLabel: 'AION V', status: 'draft', createdDate: '2026-11-10', validUntil: '2026-12-10', finalPrice: 1000000 },
  { id: 'b', customerName: 'คุณบี', vehicleLabel: 'S07', status: 'sent', createdDate: '2026-11-01', sentDate: '2026-11-05', validUntil: '2026-11-15', finalPrice: 900000 },
  { id: 'c', customerName: 'คุณซี', status: 'accepted', createdDate: '2026-11-02', validUntil: '2026-12-02' },
  { id: 'd', customerName: 'คุณดี', status: 'accepted', bookingId: 'bk1', createdDate: '2026-11-02', validUntil: '2026-12-02' },
  { id: 'e', customerName: 'คุณอี', status: 'sent', createdDate: '2026-09-01', validUntil: '2026-10-01' },
  { id: 'f', customerName: 'คุณเอฟ', status: 'draft', deleted: true, createdDate: '2026-11-11', validUntil: '2026-12-11' },
  { id: 'g', customerName: 'คุณจี', status: 'rejected', createdDate: '2026-11-11', validUntil: '2026-12-11' },
]

describe('quoteQuestions', () => {
  it('detects questions, not create commands', () => {
    expect(maybeQuoteQuestion('ใบเสนอราคาค้างอยู่กี่ใบ')).toBe(true)
    expect(maybeQuoteQuestion('ใบเสนอราคาไหนใกล้หมดอายุ')).toBe(true)
    expect(maybeQuoteQuestion('สร้างใบเสนอราคาให้คุณเอ')).toBe(false)
    expect(maybeQuoteQuestion('ราคา AION V เท่าไหร่')).toBe(false)
  })
  it('parses focus', () => {
    expect(parseQuoteSpec('ใบเสนอราคาไหนใกล้หมดอายุ').focus).toBe('expiring')
    expect(parseQuoteSpec('ใบเสนอราคาที่ยังไม่ได้ส่ง').focus).toBe('unsent')
    expect(parseQuoteSpec('ใบเสนอราคาที่ส่งแล้วรอคำตอบ').focus).toBe('waiting')
    expect(parseQuoteSpec('ใบเสนอราคาค้างอยู่กี่ใบ').focus).toBe('all')
  })
  it('groups open quotes', () => {
    const st = quoteStats({ quotes: Q, today: T })
    expect(st.total).toBe(6)
    expect(st.unsent.map(q => q.id)).toEqual(['a'])
    expect(st.waiting.map(q => q.id)).toEqual(['b'])
    expect(st.waiting[0]._days).toBe(7)
    expect(st.expiring.map(q => [q.id, q._left])).toEqual([['b', 3]])
    expect(st.expired.map(q => q.id)).toEqual(['e'])
    expect(st.toBook.map(q => q.id)).toEqual(['c'])
    expect(st.openValue).toBe(1900000)
  })
  it('writes a summary with DD/MM/YYYY and focus filters', () => {
    const st = quoteStats({ quotes: Q, today: T })
    const all = quoteBriefText(st)
    expect(all).toContain('คุณซี')
    expect(all).toMatch(/15\/11\/(2026|2569)/)
    expect(all).toContain('1,900,000')
    expect(all).toContain('หมดอายุแล้ว 1 ใบ')
    const exp = quoteBriefText(st, { focus: 'expiring' })
    expect(exp).toContain('คุณบี')
    expect(exp).not.toContain('คุณเอ ')
    expect(quoteFollowUps(st, { focus: 'expiring' })).not.toContain('ใบเสนอราคาไหนใกล้หมดอายุ')
    expect(quotePageQuery(st, { focus: 'all' })).toBe('accepted')
    expect(quotePageQuery(st, { focus: 'unsent' })).toBe('draft')
  })
  it('handles empty and all-done', () => {
    expect(quoteBriefText(quoteStats({ quotes: [], today: T }))).toContain('ยังไม่มีใบเสนอราคา')
    const done = quoteStats({ quotes: [Q[3]], today: T })
    expect(quoteBriefText(done)).toContain('ไม่มีใบเสนอราคาค้าง')
    expect(quoteBriefText(done, { focus: 'unsent' })).toContain('ส่งครบทุกใบแล้ว')
  })
})
