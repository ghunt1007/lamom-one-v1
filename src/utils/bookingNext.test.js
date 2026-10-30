import { describe, it, expect } from 'vitest'
import { bookingNextStep } from './bookingNext.js'

const today = '2026-10-31'
describe('bookingNextStep', () => {
  it('is null for finished bookings', () => {
    expect(bookingNextStep({ status: 'ส่งมอบแล้ว' }, today)).toBe(null)
    expect(bookingNextStep({ status: 'ถอนจอง' }, today)).toBe(null)
  })
  it('flags an overdue delivery first', () => {
    const s = bookingNextStep({ status: 'รอรถ', bookingDate: '2026-10-20', deliveryDate: '2026-10-28' }, today)
    expect(s.tone).toBe('danger')
    expect(s.text).toMatch(/เลยกำหนดส่งมอบมา 3 วัน/)
  })
  it('warns when finance has been pending over a week', () => {
    const s = bookingNextStep({ status: 'รอผลไฟแนนซ์', bookingDate: '2026-10-01', financeCo: 'KK' }, today)
    expect(s).toEqual({ tone: 'warning', text: 'รอผลไฟแนนซ์ KK มา 30 วันแล้ว — โทรตามผล หรือเตรียมยื่นเจ้าอื่นสำรอง' })
  })
  it('counts down to delivery', () => {
    expect(bookingNextStep({ status: 'รอส่งมอบ', deliveryDate: '2026-11-02' }, today).text).toMatch(/อีก 2 วัน/)
    expect(bookingNextStep({ status: 'รอส่งมอบ', deliveryDate: '2026-10-31' }, today).text).toMatch(/ส่งมอบวันนี้/)
    expect(bookingNextStep({ status: 'รอส่งมอบ' }, today).text).toMatch(/ยังไม่มีวันส่งมอบ/)
  })
  it('asks for a VIN before drawing the car', () => {
    expect(bookingNextStep({ status: 'ซื้อสดรอเบิกรถ' }, today).text).toMatch(/ยังไม่ผูกเลขตัวถัง/)
  })
  it('returns null for unknown statuses', () => {
    expect(bookingNextStep({ status: 'อะไรสักอย่าง' }, today)).toBe(null)
  })
})
