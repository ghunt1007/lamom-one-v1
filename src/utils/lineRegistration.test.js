import { describe, it, expect } from 'vitest'
import { lineRegistrationStatus } from './lineRegistration.js'

describe('lineRegistrationStatus', () => {
  it('แยกคนที่ลงทะเบียนแล้ว / ยังไม่ลงทะเบียน / ชื่อที่ลงทะเบียนไม่ตรงกับใคร', () => {
    const s = lineRegistrationStatus(['วิชัย ขายเก่ง', 'นภา', 'ปวีณา', 'นภา'], [
      { name: 'คุณวิชัย ขายเก่ง' }, { name: 'นภา ' }, { name: 'วิไช' }, { name: '' },
    ])
    expect(s.registered).toEqual(['วิชัย ขายเก่ง', 'นภา'])
    expect(s.missing).toEqual(['ปวีณา'])
    expect(s.unknown).toEqual(['วิไช'])
  })
  it('ไม่มีข้อมูล', () => {
    expect(lineRegistrationStatus([], [])).toEqual({ registered: [], missing: [], unknown: [] })
  })
})
