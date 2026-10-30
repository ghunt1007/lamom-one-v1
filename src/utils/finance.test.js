import { describe, it, expect } from 'vitest'
import { finPassPatch, isFinancePassed, isCashBooking } from './finance.js'

describe('finance utils', () => {
  it('finPassPatch ตรงกับ worker', () => {
    expect(finPassPatch({ status: 'รอส่งมอบ', finStatus: 'รอผล' })).toEqual({ finStatus: 'ผ่าน' })
    expect(finPassPatch({ status: 'ส่งมอบแล้ว', finStatus: 'ไม่ผ่าน' })).toEqual({ finStatus: 'ผ่าน' })
    expect(finPassPatch({ status: 'รอรถ', finStatus: 'ซื้อสด' })).toBeNull()
    expect(finPassPatch({ status: 'ยอดจองคงค้าง', finStatus: 'รอผล' })).toBeNull()
  })
  it('isFinancePassed / isCashBooking', () => {
    expect(isFinancePassed({ status: 'รอรถ' })).toBe(true)
    expect(isFinancePassed({ status: 'รอผลไฟแนนซ์', finStatus: 'ผ่าน' })).toBe(true)
    expect(isFinancePassed({ status: 'รอผลไฟแนนซ์', finStatus: 'รอผล' })).toBe(false)
    expect(isCashBooking({ financeCo: 'ซื้อสด' })).toBe(true)
  })
})

describe('สถานะใหม่จาก Sheet (30 ต.ค. 69)', () => {
  it('ผ่านไฟแนนซ์รอเบิก/รอจอง = ไฟแนนซ์ผ่าน', () => {
    expect(isFinancePassed({ status: 'ผ่านไฟแนนซ์รอเบิก' })).toBe(true)
    expect(finPassPatch({ status: 'ผ่านไฟแนนซ์รอจอง', finStatus: 'รอผล' })).toEqual({ finStatus: 'ผ่าน' })
  })
  it('ซื้อสดรอเบิกรถ = ซื้อสด ไม่ถูกตั้งไฟแนนซ์ผ่าน', () => {
    expect(isCashBooking({ status: 'ซื้อสดรอเบิกรถ' })).toBe(true)
    expect(finPassPatch({ status: 'ซื้อสดรอเบิกรถ' })).toBeNull()
  })
})
