import { describe, it, expect } from 'vitest'
import { parseBookingListSpec, bookingListLabel, bookingTargets } from './bookingQuestions.js'
import { parseOpsSpec } from './opsQuestions.js'

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
})
