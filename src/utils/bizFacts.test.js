import { describe, it, expect } from 'vitest'
import { businessFacts } from './bizFacts.js'

describe('businessFacts', () => {
  const today = '2026-10-26'
  const bookings = [
    { salesName: 'เอ', bookingDate: '2026-10-02', status: 'รอรถ' },
    { salesName: 'เอ', bookingDate: '2026-09-20', status: 'ส่งมอบแล้ว', actualDeliveryDate: '2026-10-05' },
    { salesName: 'บี', bookingDate: '2026-10-10', status: 'ถอนจอง', cancelDate: '2026-10-12' },
    { salesName: 'บี', bookingDate: '2026-09-01', status: 'รอส่งมอบ' },
    { salesName: 'บี', bookingDate: '2026-10-11', status: 'รอผลไฟแนนซ์', deleted: true },
  ]
  const customers = [
    { source: 'facebook', stage: 'booking', createdAt: '2026-10-01' },
    { source: 'facebook', stage: 'lead', createdAt: '2026-10-03' },
    { source: 'walk-in', stage: 'pp', createdAt: '2026-10-04', isLost: true, lostAt: '2026-10-08', lostReason: 'ไฟแนนซ์ไม่ผ่าน - งานอิสระ' },
    { source: 'line', stage: 'lead', createdAt: '2025-01-01' },
  ]
  const f = businessFacts({ customers, bookings }, today)
  it('counts bookings and deliveries for this and last month', () => {
    expect(f['ใบจองเดือนนี้ (จากระบบจองรถ)']).toBe('จอง 1 ใบ (เดือนก่อน 2) · ส่งมอบ/ตัดตัวเลข 1 คัน (เดือนก่อน 0) · ถอนจองเดือนนี้ 1')
  })
  it('ranks salespeople', () => {
    expect(f['ผลงานรายเซลส์เดือนนี้']).toBe('เอ จอง 1 ส่งมอบ 1')
  })
  it('shows lead source conversion for the last 90 days', () => {
    expect(f['Lead 90 วันล่าสุดแยกตามที่มา']).toBe('Facebook 2 ราย ปิดเป็นใบจอง 1 (50%) · Walk-in 1 ราย ปิดเป็นใบจอง 0 (0%)')
  })
  it('stage counts skip lost deals', () => {
    expect(f['ลูกค้าในแต่ละขั้น']).toBe('Lead 2 · Prospect 0 · จองแล้ว 1 · เสียดีล 1')
  })
  it('summarises lost reasons', () => {
    expect(f['เหตุผลเสียดีล 90 วันล่าสุด']).toBe('ไฟแนนซ์ไม่ผ่าน 1')
  })
})
