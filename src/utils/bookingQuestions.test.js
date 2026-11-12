import { describe, it, expect } from 'vitest'
import { parseBookingListSpec, bookingTargets, bookingListCommands, bookingListIntro } from './bookingQuestions.js'
import { parseListSpec } from './listQuestions.js'
import { parseLamiCommand } from './lamiCommands.js'

const today = '2026-11-11'
const cs = [
  { id: 'a', firstName: 'สมชาย', stage: 'booked', bookingId: 'b1' },
  { id: 'b', firstName: 'มานี', stage: 'booked', bookingId: 'b2' },
  { id: 'c', firstName: 'ปิติ', stage: 'booked', bookingId: 'b3' },
  { id: 'd', firstName: 'ชูใจ', stage: 'booked', bookingId: 'b4' },
]
const bks = [
  { id: 'b1', custName: 'สมชาย', status: 'รอผลไฟแนนซ์', bookingDate: '2026-10-01', brand: 'DEEPAL', model: 'S05' },
  { id: 'b2', custName: 'มานี', status: 'รอส่งมอบ', bookingDate: '2026-11-05', deliveryDate: '2026-11-12', deliveryTime: '10:00' },
  { id: 'b3', custName: 'ปิติ', status: 'รอส่งมอบ', bookingDate: '2026-09-01' },
  { id: 'b4', custName: 'ชูใจ', status: 'ส่งมอบแล้ว', bookingDate: '2026-08-01' },
  { id: 'b5', custName: 'คนอื่น', status: 'รอรถ', bookingDate: '2026-08-01' },
  { id: 'b6', custName: 'ถอน', status: 'ถอนจอง', bookingDate: '2026-08-01', customerId: 'a' },
]
const run = q => bookingTargets({ customers: cs, bookings: bks, today, spec: parseBookingListSpec(q), tomorrow: '2026-11-12', weekEnd: '2026-11-18' })
const ids = q => run(q).list.map(x => x.b.id)

describe('parseBookingListSpec', () => {
  it('reads booking questions', () => {
    expect(parseBookingListSpec('ใครรอไฟแนนซ์')).toMatchObject({ statuses: ['รอผลไฟแนนซ์', 'จัดไฟแนนซ์ก่อนจอง'] })
    expect(parseBookingListSpec('ใครรอรถอยู่บ้าง')).toMatchObject({ statuses: ['รอรถ'] })
    expect(parseBookingListSpec('ใครยังไม่ได้นัดส่งมอบ')).toMatchObject({ noDate: true })
    expect(parseBookingListSpec('ใบจองไหนค้างนานสุด')).toMatchObject({ stuck: true, stuckDays: 14 })
    expect(parseBookingListSpec('ใบจองค้างเกิน 30 วันมีใครบ้าง')).toMatchObject({ stuckDays: 30 })
    expect(parseBookingListSpec('ส่งมอบพรุ่งนี้มีใครบ้าง')).toMatchObject({ when: 'tomorrow' })
  })
  it('ignores other sentences', () => {
    for (const q of ['สมชาย รอรถ', 'ลูกค้า hot มีใครบ้าง', 'ใครยังไม่มีนัด', 'นัดส่งมอบสมชาย ศุกร์นี้ 10 โมง', 'ยอดจองเดือนนี้กี่คัน', 'ใครบ้าง', ''])
      expect(parseBookingListSpec(q)).toBe(null)
  })
  it('leaves customer list questions and commands alone', () => {
    expect(parseListSpec('ใครยังไม่มีนัด')).not.toBe(null)
    expect(parseLamiCommand('ใครรอไฟแนนซ์', cs, today)).toEqual([])
  })
})

describe('bookingTargets', () => {
  it('filters by status, only bookings of visible customers', () => {
    expect(ids('ใครรอไฟแนนซ์')).toEqual(['b1'])
    expect(ids('ใครรอรถ')).toEqual([])
    expect(ids('ใครรอส่งมอบ')).toEqual(['b3', 'b2'])
  })
  it('unscheduled, delivery day, stuck', () => {
    expect(ids('ใครยังไม่นัดส่งมอบ')).toEqual(['b3'])
    expect(ids('ส่งมอบพรุ่งนี้มีใครบ้าง')).toEqual(['b2'])
    expect(ids('ส่งมอบวันนี้มีใครบ้าง')).toEqual([])
    expect(ids('ใบจองไหนค้างนานสุด')).toEqual(['b3', 'b1'])
  })
  it('commands open the booking', () => {
    const r = run('ใครยังไม่นัดส่งมอบ')
    const [cmd] = bookingListCommands(r.list)
    expect(cmd).toMatchObject({ kind: 'bk', bookingId: 'b3' })
    expect(cmd.desc).toContain('จองมา 71 วัน')
    expect(bookingListIntro(parseBookingListSpec('ใครยังไม่นัดส่งมอบ'), r)).toContain('1 ใบ')
    expect(bookingListIntro(parseBookingListSpec('ใครรอรถ'), run('ใครรอรถ'))).toContain('ไม่มี')
  })
})

describe('parseBookingListSpec มี…ไหม form (v1.0.1082)', () => {
  it('accepts yes/no questions', () => {
    expect(parseBookingListSpec('มีใบจองที่ไฟแนนซ์ไม่ผ่านไหม').finFail).toBe(true) // (v1.0.1110) ไม่ผ่าน = โดนปฏิเสธ
    expect(parseBookingListSpec('มีใบจองที่ไฟแนนซ์ยังไม่ผ่านไหม').statuses[0]).toBe('รอผลไฟแนนซ์')
    expect(parseBookingListSpec('มีใครรอรถไหมคะ').statuses).toEqual(['รอรถ'])
  })
})

describe('no VIN (v1.0.1086)', () => {
  it('lists open bookings without VIN, skipping รอรถ', () => {
    const spec = parseBookingListSpec('มีใบจองที่ยังไม่ได้กรอกเลขตัวถังไหม')
    expect(spec.noVin).toBe(true)
    const r = bookingTargets({ customers: [{ id: 'c1' }], bookings: [
      { id: 'b1', customerId: 'c1', status: 'รอส่งมอบ' }, { id: 'b2', customerId: 'c1', status: 'รอส่งมอบ', vin: 'X1' }, { id: 'b3', customerId: 'c1', status: 'รอรถ' }], today: '2026-11-12', spec })
    expect(r.list.map(x => x.b.id)).toEqual(['b1'])
  })
})

describe('no deposit (v1.0.1087)', () => {
  it('lists open bookings with zero deposit', () => {
    const spec = parseBookingListSpec('ลูกค้าคนไหนจองแล้วแต่ยังไม่ได้วางมัดจำ')
    const r = bookingTargets({ customers: [{ id: 'c1' }], bookings: [{ id: 'b1', customerId: 'c1', status: 'รอรถ' }, { id: 'b2', customerId: 'c1', status: 'รอรถ', bookingDeposit: 5000 }], today: '2026-11-12', spec })
    expect(r.list.map(x => x.b.id)).toEqual(['b1'])
  })
})
