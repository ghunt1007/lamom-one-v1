import { describe, it, expect } from 'vitest'
import { parseOpsSpec, tdNoBookAnswer, bookDayAnswer, newCustomerAnswer } from './opsQuestions.js'
import { parseBookingListSpec, bookingListLabel } from './bookingQuestions.js'
import { monthStats, monthBriefText, isModelRankQuestion } from './monthBrief.js'

const today = '2026-11-12'
describe('v1.0.1090 LAMI gaps', () => {
  it('test drive without booking', () => {
    expect(parseOpsSpec('ลูกค้าที่ทดลองขับแล้วยังไม่จอง')).toEqual({ kind: 'tdnobook', range: 30 })
    expect(parseOpsSpec('นัดทดลองขับวันนี้มีใครบ้าง').kind).toBe('testdrive')
    const drives = [
      { customerName: 'เอ', phone: '081-111-1111', date: '2026-11-10', result: 'maybe', model: 'S07' },
      { customerName: 'บี', phone: '0822222222', date: '2026-11-09', result: 'interested' },
      { customerName: 'ซี', phone: '0833333333', date: '2026-11-08' },
      { customerName: 'ดี', phone: '0844444444', date: '2026-09-01' },
      { customerName: 'อี', phone: '0855555555', date: '2026-11-11', status: 'cancelled' },
    ]
    const r = tdNoBookAnswer(drives, [{ custName: 'ซี', phone: '083 333 3333', status: 'รอรถ' }], { today, range: 30 })
    expect(r.n).toBe(2)
    expect(r.text.indexOf('บี')).toBeLessThan(r.text.indexOf('เอ'))
    expect(r.text).not.toMatch(/ซี|ดี ·|อี/)
  })
  it('bookings today / yesterday', () => {
    expect(parseOpsSpec('ยอดจองวันนี้')).toEqual({ kind: 'bookday', day: 'today' })
    expect(parseOpsSpec('เมื่อวานปิดได้กี่คัน')).toEqual({ kind: 'bookday', day: 'yesterday' })
    expect(parseOpsSpec('นัดส่งมอบวันนี้มีใครบ้าง').kind).toBe('delivery')
    const b = [{ custName: 'ก', bookingDate: today, salesName: 'หนึ่ง', status: 'รอรถ' }, { custName: 'ข', bookingDate: today, salesName: 'สอง', status: 'ถอนจอง' }, { custName: 'ค', bookingDate: '2026-11-01' }]
    const r = bookDayAnswer(b, { today })
    expect(r.n).toBe(1)
    expect(r.text).toContain('ถอนแล้ว 1 ใบ')
    expect(bookDayAnswer([], { today }).text).toContain('ยังไม่มี')
  })
  it('overdue accepts งานค้าง', () => {
    expect(parseOpsSpec('มีงานค้างอะไรบ้าง').kind).toBe('overdue')
    expect(parseOpsSpec('งานซ่อมค้างอยู่กี่งาน').kind).toBe('service')
  })
  it('new customers by source', () => {
    const sp = parseOpsSpec('ลูกค้าจากเฟสบุ๊คเดือนนี้กี่คน')
    expect(sp).toMatchObject({ kind: 'newcust', source: 'facebook', period: 'month' })
    const cs = [{ createdAt: '2026-11-05', source: 'facebook', firstName: 'ฟ' }, { createdAt: '2026-11-06', source: 'line' }]
    const r = newCustomerAnswer(cs, { today, source: 'facebook', sourceLabel: { facebook: '📘 Facebook' } })
    expect(r.n).toBe(1)
    expect(r.text).toContain('📘 Facebook 1 คน')
    expect(newCustomerAnswer(cs, { today, source: 'tiktok' }).n).toBe(0)
  })
  it('booked but not delivered', () => {
    const sp = parseBookingListSpec('ลูกค้าที่จองแต่ยังไม่ส่งมอบมีกี่คน')
    expect(sp.allOpen).toBe(true)
    expect(bookingListLabel(sp)).toBe('ใบจองที่ยังไม่ส่งมอบ')
  })
  it('model ranking in month brief', () => {
    expect(isModelRankQuestion('รถรุ่นไหนขายดีสุดเดือนนี้')).toBe(true)
    const st = monthStats({ bookings: [{ brand: 'DEEPAL', model: 'S07', bookingDate: '2026-11-03', status: 'รอรถ' }, { brand: 'DEEPAL', model: 'S07', bookingDate: '2026-11-04', status: 'รอรถ' }, { brand: 'AION', model: 'V', bookingDate: '2026-11-05', status: 'รอรถ' }], today })
    const t = monthBriefText(st, { models: true })
    expect(t).toContain('🚘 รุ่นขายดีเดือนนี้')
    expect(t).toMatch(/1\. DEEPAL S07 — จอง 2/)
    expect(monthBriefText(st)).not.toContain('🚘')
  })
})
