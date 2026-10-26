import { describe, it, expect } from 'vitest'
import { planSheetReconcile, normPhone, normPersonName, splitFullName, isTempBookingNo } from './sheetReconcile.js'

const row = (no, name, phone, status = 'ส่งมอบแล้ว', r = 4) => ({ 'เลขใบจอง': no, 'ชื่อลูกค้า-นามสกุล': name, 'หมายเลขโทรศัพท์': phone, 'สถานะ': status, 'รุ่นรถ': 'S07', __row: r })

describe('normalizers', () => {
  it('normPhone keeps last 9 digits', () => {
    expect(normPhone('081-234-5678')).toBe('812345678')
    expect(normPhone(812345678)).toBe('812345678')
    expect(normPhone('+66812345678')).toBe('812345678')
    expect(normPhone('1234')).toBe('')
  })
  it('normPersonName drops prefixes and spaces', () => {
    expect(normPersonName('นาย ทดสอบ  ระบบ')).toBe(normPersonName('ทดสอบ ระบบ'))
    expect(normPersonName('คุณทดสอบ ระบบ')).toBe('ทดสอบระบบ')
  })
  it('splitFullName / isTempBookingNo', () => {
    expect(splitFullName('ก ข ค')).toEqual({ firstName: 'ก ข', lastName: 'ค' })
    expect(isTempBookingNo('SK250101-TEMP')).toBe(true)
    expect(isTempBookingNo('')).toBe(true)
    expect(isTempBookingNo('BK001')).toBe(false)
  })
})

describe('planSheetReconcile', () => {
  const sheet = [
    row('BK1', 'ลูกค้า หนึ่ง', '0810000001'),
    row('BK2', 'ลูกค้า สอง', '0810000002', 'รอรถ'),
    row('', 'ลูกค้า สาม', '0810000003', 'รอผลไฟแนนซ์'),
    row('BK4', 'ลูกค้า สี่', '0810000004', 'รอรถ'),
    row('BK5', 'ลูกค้า ห้า', '0810000005'),
  ]

  it('finds extra, duplicate and temp bookings', () => {
    const bookings = [
      { id: 'b1', bookingNo: 'BK1', custName: 'ลูกค้า หนึ่ง', phone: '0810000001', customerId: 'c1', createdAt: '2026-01-01' },
      { id: 'b1dup', bookingNo: 'BK1', custName: 'ลูกค้า หนึ่ง', phone: '0810000001', createdAt: '2026-02-01' },
      { id: 'b2', bookingNo: 'BK2', custName: 'ลูกค้า สอง', phone: '0810000002', customerId: 'c2' },
      { id: 'b3', bookingNo: 'SK260101-TEMP', custName: 'ลูกค้า สาม', phone: '0810000003' }, // ยังไม่มีเลขในไฟล์ → เก็บ
      { id: 'b4', bookingNo: 'SK260102-TEMP', custName: 'ลูกค้า สี่', phone: '0810000004' }, // ไฟล์ออกเลข BK4 แล้ว → เปลี่ยนเลข
      { id: 'b5t', bookingNo: 'SK260103-TEMP', custName: 'ลูกค้า ห้า', phone: '0810000005' }, // มี BK5 แล้ว → ซ้ำ
      { id: 'b5', bookingNo: 'BK5', custName: 'ลูกค้า ห้า', phone: '0810000005' },
      { id: 'bx', bookingNo: 'BK9', custName: 'คนนอก ไฟล์', phone: '0899999999' },
      { id: 'bdel', bookingNo: 'BK8', deleted: true },
    ]
    const p = planSheetReconcile(sheet, bookings, [])
    const extra = Object.fromEntries(p.extraBookings.map(x => [x.booking.id, x.reason]))
    expect(extra).toEqual({ b1dup: 'dup-number', b5t: 'temp-dup', bx: 'not-in-sheet' })
    expect(p.renumberBookings.map(r => [r.booking.id, r.patch.bookingNo])).toEqual([['b4', 'BK4']])
    expect(p.missingBookings).toEqual([])
  })

  it('reports sheet bookings missing from the program', () => {
    const p = planSheetReconcile(sheet, [], [])
    expect(p.missingBookings.map(m => m.bookingNo).sort()).toEqual(['BK1', 'BK2', 'BK4', 'BK5'])
  })

  it('classifies customers: matched, duplicate, extra, lead, fixes, missing', () => {
    const bookings = [
      { id: 'b1', bookingNo: 'BK1', customerId: 'c1' },
      { id: 'b2', bookingNo: 'BK2', customerId: 'c2' },
      { id: 'b4', bookingNo: 'BK4' },
      { id: 'b5', bookingNo: 'BK5' },
    ]
    const customers = [
      { id: 'c1', firstName: 'ลูกค้า', lastName: 'หนึ่ง', phone: '0810000001', stage: 'booking', createdAt: '2026-01-01' },
      { id: 'c1b', firstName: 'ลูกค้า', lastName: 'หนึ่ง', phone: '081-000-0001', stage: 'pp', createdAt: '2025-12-01' },
      { id: 'c2', firstName: 'ชื่อ', lastName: 'ผิด', phone: '0820000000', stage: 'booking' },
      { id: 'c5', firstName: 'ลูกค้า', lastName: 'ห้า', phone: '0810000005', stage: 'delivered' },
      { id: 'cx', firstName: 'จอง', lastName: 'นอกไฟล์', phone: '0877777777', stage: 'booking' },
      { id: 'cl', firstName: 'ลีด', lastName: 'ใหม่', phone: '0866666666', stage: 'lead' },
      { id: 'cd', firstName: 'ลบ', lastName: 'แล้ว', stage: 'booking', deleted: true },
    ]
    const p = planSheetReconcile(sheet, bookings, customers)
    expect(Object.fromEntries(p.extraCustomers.map(x => [x.customer.id, x.reason]))).toEqual({ cx: 'not-in-sheet', c1b: 'duplicate' })
    expect(p.leads.map(c => c.id)).toEqual(['cl'])
    const fix = Object.fromEntries(p.customerFixes.map(f => [f.customer.id, f.changes]))
    expect(fix).toEqual({ c1: ['stage'], c2: ['name', 'phone'] })
    expect(p.customerFixes.find(f => f.customer.id === 'c2').patch).toMatchObject({ firstName: 'ลูกค้า', lastName: 'สอง', phone: '0810000002' })
    expect(p.missingCustomers.map(m => m.booking.id)).toEqual(['b4'])
    expect(p.linkOnly.map(l => [l.booking.id, l.customer.id])).toEqual([['b5', 'c5']])
  })

  it('keeps the customer linked to a booking over an older unlinked duplicate', () => {
    const p = planSheetReconcile([row('BK1', 'ลูกค้า หนึ่ง', '0810000001')],
      [{ id: 'b1', bookingNo: 'BK1', customerId: 'new' }],
      [{ id: 'old', firstName: 'ลูกค้า', lastName: 'หนึ่ง', phone: '0810000001', createdAt: '2025-01-01' },
       { id: 'new', firstName: 'ลูกค้า', lastName: 'หนึ่ง', phone: '0810000001', createdAt: '2026-01-01' }])
    expect(p.extraCustomers.map(x => x.customer.id)).toEqual(['old'])
  })
})
