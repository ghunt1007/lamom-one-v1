import { describe, it, expect } from 'vitest'
import { parseOpsSpec } from './opsQuestions.js'
import { parseListSpec } from './listQuestions.js'
import { parseBookingListSpec, bookingListLabel } from './bookingQuestions.js'

describe('v1.0.1524 more plain questions', () => {
  it('temperature lists with ทั้งหมด', () => {
    expect(parseListSpec('ลูกค้าเย็นทั้งหมด')).toMatchObject({ temp: 'cold' })
    expect(parseListSpec('ลูกค้า hot ทั้งหมดมีใครบ้าง')).toMatchObject({ temp: 'hot' })
  })
  it('withdrawn bookings phrased as ใบจองที่ถอน', () => {
    expect(parseOpsSpec('ใบจองที่ถอนเดือนนี้')).toMatchObject({ kind: 'withdrawn', prev: false })
    expect(parseOpsSpec('ใบจองที่ยกเลิกเดือนก่อน')).toMatchObject({ kind: 'withdrawn', prev: true })
    expect(parseOpsSpec('ใครยังไม่ได้รับเงินคืน').kind).toBe('refund')
  })
  it('who gets the car = delivery', () => {
    expect(parseOpsSpec('ใครจะได้รถสัปดาห์หน้า')).toEqual({ kind: 'delivery', day: 'nextweek' })
    expect(parseOpsSpec('ลูกค้ารับรถพรุ่งนี้')).toEqual({ kind: 'delivery', day: 'tomorrow' })
    expect(parseOpsSpec('ใครรับรถวันเสาร์')).toMatchObject({ kind: 'delivery', day: 'wd', wd: 6 })
  })
  it('cut but not delivered', () => {
    const sp = parseBookingListSpec('รถที่ตัดแล้วยังไม่ส่งมอบ')
    expect(sp.statuses).toEqual(['ตัดตัวเลขรอส่งมอบ'])
    expect(bookingListLabel(sp)).toBe('ใบจองสถานะ ตัดตัวเลขรอส่งมอบ')
    expect(parseOpsSpec('ขอเงินคืนได้ไหม')).toBeNull()
  })
})

import { noteSearchTerm, noteSearchAnswer } from './opsQuestions.js'
describe('v1.0.1526 note search', () => {
  it('parses only explicit note questions', () => {
    expect(parseOpsSpec('ลูกค้าที่รอโบนัส')).toEqual({ kind: 'notesearch', term: 'รอโบนัส' })
    expect(parseOpsSpec('ใครบอกว่าแพง')).toEqual({ kind: 'notesearch', term: 'แพง' })
    expect(parseOpsSpec('ลูกค้าที่บอกว่าแพงมีใครบ้าง')).toEqual({ kind: 'notesearch', term: 'แพง' })
    expect(parseOpsSpec('หาโน้ต สีขาว')).toEqual({ kind: 'notesearch', term: 'สีขาว' })
    expect(noteSearchTerm('ลูกค้าที่รอไฟแนนซ์')).toBe('')
    expect(noteSearchTerm('ใครรอส่งมอบ')).toBe('')
  })
  it('matches customer notes and timeline notes', () => {
    const customers = [{ id: 'a', firstName: 'เอ', notes: 'รอ โบนัสสิ้นปี', assignedTo: 'กมล' }, { id: 'b', firstName: 'บี', interestedModel: 'S07' }, { id: 'c', firstName: 'ซี' }]
    const notes = [{ customerId: 'b', text: 'ลูกค้ารอโบนัสเดือนธันวา', time: '2026-11-20T03:00:00Z' }, { customerId: 'x', text: 'รอโบนัส' }]
    const r = noteSearchAnswer({ customers, notes, term: 'รอโบนัส' })
    expect(r.n).toBe(2)
    expect(r.text).toContain('• บี · 🚗 S07 — "ลูกค้ารอโบนัสเดือนธันวา" (20/11/2569)')
    expect(r.text).toContain('• เอ · 👤 กมล')
    expect(noteSearchAnswer({ customers, notes, term: 'แพง' }).n).toBe(0)
  })
})
