import { describe, it, expect } from 'vitest'
import { parseBookingListSpec, bookingListLabel, bookingTargets } from './bookingQuestions.js'
import { parseOpsSpec, boothShiftAnswer } from './opsQuestions.js'

describe('v1.0.1521 contract signing + document chase', () => {
  it('parses', () => {
    expect(parseBookingListSpec('ใบจองที่ยังไม่ได้ทำสัญญา')).toMatchObject({ noSign: true, allOpen: false })
    expect(parseBookingListSpec('ใครรอเซ็นสัญญา')).toMatchObject({ noSign: true })
    expect(bookingListLabel(parseBookingListSpec('ใครรอเซ็นสัญญา'))).toBe('ใบจองผ่อนที่ยังไม่ได้เซ็นสัญญา')
    expect(parseBookingListSpec('ลูกค้าที่ต้องโทรตามเอกสาร')).toMatchObject({ noDocs: true })
  })
  it('filters', () => {
    const customers = [1, 2, 3].map(i => ({ id: 'c' + i, bookingId: 'b' + i }))
    const bookings = [
      { id: 'b1', status: 'ผ่านไฟแนนซ์รอจอง', finStatus: 'ผ่าน' },
      { id: 'b2', status: 'ผ่านไฟแนนซ์รอจอง', finStatus: 'ผ่าน', signDate: '2026-11-20' },
      { id: 'b3', status: 'รอผลไฟแนนซ์', finStatus: 'รอเซ็นสัญญา' },
    ]
    const r = bookingTargets({ customers, bookings, today: '2026-11-28', spec: parseBookingListSpec('ใบจองที่ยังไม่ได้ทำสัญญา') })
    expect(r.list.map(x => x.b?.id || x.booking?.id || x.id).filter(Boolean).length).toBe(2)
  })
  it('appointments today / no LINE', () => {
    expect(parseOpsSpec('วันนี้มีนัดอะไรบ้าง')).toEqual({ kind: 'apptday', day: 'today' })
    expect(parseOpsSpec('พรุ่งนี้มีนัดอะไร')).toEqual({ kind: 'apptday', day: 'tomorrow' })
    expect(parseBookingListSpec('ลูกค้าที่ไม่มีไลน์')).toMatchObject({ noLine: true })
  })
  it('booth shifts + incoming next month', () => {
    expect(parseOpsSpec('บูธสัปดาห์นี้ใครเข้ากะ')).toMatchObject({ kind: 'boothshift', day: 'week' })
    expect(parseOpsSpec('พรุ่งนี้ใครเข้าบูธ')).toMatchObject({ kind: 'boothshift', day: 'tomorrow' })
    expect(parseOpsSpec('วันเสาร์มีออกบูธไหม')).toMatchObject({ kind: 'boothshift', day: 'wd', wd: 6 })
    expect(parseOpsSpec('ออกบูธครั้งไหนได้ลีดเยอะสุด')).toEqual({ kind: 'eventbest' })
    expect(parseOpsSpec('รถเข้าเดือนหน้ากี่คัน')).toEqual({ kind: 'incoming' })
    expect(parseOpsSpec('ใครยังไม่ได้ส่งรูปส่งมอบ')).toBeNull()
    const ev = [{ title: 'งานห้าง', venue: 'เซ็นทรัล', startDate: '2026-11-28', endDate: '2026-11-30', shifts: { '2026-11-29': ['กมล', 'วิภา'] } }, { title: 'ยกเลิก', startDate: '2026-11-29', status: 'cancelled' }]
    const r = boothShiftAnswer(ev, { today: '2026-11-28', day: 'tomorrow' })
    expect(r.n).toBe(1)
    expect(r.text).toContain('• งานห้าง @เซ็นทรัล · เวร: กมล, วิภา')
    expect(r.text).not.toContain('ยกเลิก')
    const w = boothShiftAnswer(ev, { today: '2026-11-28', day: 'week' })
    expect(w.n).toBe(3); expect(w.text).toContain('ยังไม่ได้จัดเวร 2 งาน')
    expect(boothShiftAnswer([], { today: '2026-11-28', day: 'today' }).text).toBe('🎪 ไม่มีงานออกบูธ/อีเวนต์ วันนี้ (28/11/2569)')
  })
})
