import { describe, it, expect } from 'vitest'
import { parseBookingListSpec, bookingListLabel, bookingTargets } from './bookingQuestions.js'
import { parseOpsSpec } from './opsQuestions.js'

describe('ใบจอง: เลขตัวถัง / แจ้งประกัน / สายชาร์จ (v1.0.1538)', () => {
  it('parses without a question word', () => {
    expect(parseBookingListSpec('รถที่จองแล้วยังไม่มีเลขตัวถัง')?.noVin).toBe(true)
    expect(parseBookingListSpec('ใบจองที่ยังไม่ได้แจ้งประกัน')?.noIns).toBe(true)
    expect(parseBookingListSpec('ลูกค้าคนไหนยังไม่ได้รับสายชาร์จ')?.noCharger).toBe(true)
    expect(parseBookingListSpec('ใบจองที่ยังไม่ได้แจ้งประกัน').allOpen).toBe(false)
    expect(bookingListLabel(parseBookingListSpec('ใบจองที่ยังไม่ได้แจ้งประกัน'))).toContain('แจ้งประกัน')
  })
  it('keeps other routes', () => {
    expect(parseOpsSpec('ลูกค้าคนไหนยังไม่ได้รับสายชาร์จ')).toBeNull()
    expect(parseOpsSpec('ลูกค้าคนไหนไม่รับสาย')?.kind).toBe('noanswer')
    expect(parseOpsSpec('ใครยังไม่จ่ายเงินจอง')).toBeNull()
    expect(parseOpsSpec('ใครค้างชำระ')?.kind).toBe('debt')
  })
  it('filters on the Sheet Y/N column', () => {
    const bookings = [
      { id: 'a', customerId: 'ca', status: 'รอส่งมอบ', custName: 'ก', insuranceNotified: 'Y' },
      { id: 'b', customerId: 'cb', status: 'รอส่งมอบ', custName: 'ข', insuranceNotified: '' },
      { id: 'c', customerId: 'cc', status: 'ส่งมอบแล้ว', custName: 'ค' },
    ]
    const r = bookingTargets({ customers: [{ id: 'ca' }, { id: 'cb' }, { id: 'cc' }], bookings, today: '2026-11-28', spec: parseBookingListSpec('ใบจองที่ยังไม่ได้แจ้งประกัน') })
    expect(r.list.map(x => x.b.id)).toEqual(['b'])
  })
})
