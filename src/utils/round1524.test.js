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

import { dataCheckAnswer } from './opsQuestions.js'
describe('v1.0.1527 booking data check in LAMI', () => {
  it('routes', () => {
    expect(parseOpsSpec('ใบจองที่ข้อมูลไม่ครบ')).toEqual({ kind: 'datacheck' })
    expect(parseOpsSpec('ต้องแก้อะไรใน Sheet')).toEqual({ kind: 'datacheck' })
    expect(parseOpsSpec('ลูกค้าคนไหนยังไม่มีเบอร์')?.kind).toBe('nophone')
  })
  it('summarises issues with the Sheet column', () => {
    const r = dataCheckAnswer([{ bookingNo: '1', custName: 'ก', status: 'รอรถ', bookingDate: '2026-11-01', price: 900000 }, { bookingNo: '2', custName: 'ข', salesName: 'หนึ่ง', status: 'รอรถ', bookingDate: '2026-11-02', price: 900000 }], { today: '2026-11-28' })
    expect(r.n).toBe(1)
    expect(r.text).toContain('🔴 ไม่มีชื่อเซลส์ — 1 ใบ · แก้คอลัมน์ "ชื่อเซลล์"')
    expect(r.text).toContain('เช่น #1 ก')
    expect(dataCheckAnswer([{ bookingNo: '2', custName: 'ข', salesName: 'หนึ่ง', status: 'รอรถ', bookingDate: '2026-11-02', price: 900000 }], { today: '2026-11-28' }).text).toBe('✅ ข้อมูลใบจองครบ — ไม่พบช่องสำคัญที่ว่างหรือผิดรูป (ตรวจ 1 ใบ)')
    expect(dataCheckAnswer([]).text).toContain('ยังไม่มีใบจองในระบบ')
  })
})

import { parseLamiCommand } from './lamiCommands.js'
describe('v1.0.1528 visit / test drive done = log', () => {
  const cs = [{ id: 'a', firstName: 'สมชาย', lastName: 'ดี', phone: '0811111111' }]
  const kinds = q => [].concat(parseLamiCommand(q, cs, '2026-11-28') || []).map(x => x.kind + ':' + (x.type || ''))
  it('logs a visit', () => {
    expect(kinds('สมชายมาโชว์รูมแล้ว')).toEqual(['log:visit'])
    expect(kinds('สมชายทดลองขับแล้ว')).toEqual(['log:visit'])
    expect(kinds('สมชายทดลองขับแล้วหรือยัง')).toEqual([])
    expect(kinds('นัดสมชายทดลองขับเสาร์')).toEqual(['td:'])
  })
})

import { commandHref, quotePrefill } from './lamiCommands.js'
describe('v1.0.1529 quote command', () => {
  const cs = [{ id: 'a', firstName: 'สมชาย', lastName: 'ดี', phone: '0811111111', interestedModel: 'AION V' }]
  it('opens a prefilled quote', () => {
    const [c] = parseLamiCommand('สมชายขอใบเสนอราคา S07', cs, '2026-11-28')
    expect(c.kind).toBe('quote'); expect(c.model).toBe('S07')
    expect(commandHref(c)).toBe('/crm/quotation')
    expect(quotePrefill(c)).toEqual({ customerId: 'a', customerName: 'สมชาย ดี', phone: '0811111111', email: '', lineId: '', interestedModel: 'S07' })
    expect(parseLamiCommand('ทำใบเสนอราคาให้สมชาย', cs, '2026-11-28')[0].model).toBe('AION V')
    expect(parseLamiCommand('สมชายได้ใบเสนอราคาหรือยัง', cs, '2026-11-28')).toEqual([])
  })
})
