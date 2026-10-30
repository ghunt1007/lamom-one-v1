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
  it('lists open bookings by status with the oldest age', () => {
    expect(f['ใบจองที่ยังค้าง 2 ใบ แยกตามสถานะ']).toBe('รอรถ 1 (นานสุด 24 วัน) · รอส่งมอบ 1 (นานสุด 55 วัน)')
  })
  it('gives a 6-month trend', () => {
    expect(f['แนวโน้ม 6 เดือน (จอง/ส่งมอบ)']).toMatch(/^2026-05 .* 2026-10 จอง 1\/ส่งมอบ 1$/)
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
  it('ranks booked models and counts due deliveries', () => {
    const g = businessFacts({ customers: [], bookings: [
      { brand: 'DEEPAL', model: 'S07', bookingDate: '2026-10-01', status: 'รอรถ', deliveryDate: '2026-10-20' },
      { brand: 'DEEPAL', model: 'DEEPAL S05', bookingDate: '2026-10-02', status: 'รอส่งมอบ', deliveryDate: '2026-10-30' },
      { brand: 'DEEPAL', model: 'S07', bookingDate: '2026-09-15', status: 'ส่งมอบแล้ว', deliveryDate: '2026-10-01' },
      { brand: 'AVATR', model: '11', bookingDate: '2026-10-05', status: 'ถอนจอง', deliveryDate: '2026-10-28' },
    ] }, today)
    expect(g['รุ่นที่ถูกจองมากสุด 90 วันล่าสุด']).toBe('DEEPAL S07 2 · DEEPAL S05 1')
    expect(g['กำหนดส่งมอบ (ใบจองที่ยังไม่ส่ง)']).toBe('เลยกำหนดแล้ว 1 คัน · ภายใน 7 วันข้างหน้า 1 คัน')
  })
  it('summarises lost reasons', () => {
    expect(f['เหตุผลเสียดีล 90 วันล่าสุด']).toBe('ไฟแนนซ์ไม่ผ่าน 1')
  })
})

import { stockFacts, testDriveFacts } from './bizFacts.js'
describe('stockFacts', () => {
  it('groups ready cars by model and colour', () => {
    const f = stockFacts([
      { brand: 'DEEPAL', model: 'S07', color: 'ขาว', status: 'available' },
      { brand: 'DEEPAL', model: 'S07', color: 'ขาว', status: 'available' },
      { brand: 'DEEPAL', model: 'S07', color: 'ดำ', status: 'available' },
      { brand: 'DEEPAL', model: 'L07', color: 'ขาว', status: 'reserved' },
      { brand: 'DEEPAL', model: 'L07', status: 'transit' },
      { brand: 'DEEPAL', model: 'S05', status: 'available', deleted: true },
    ])
    expect(f['รถพร้อมขายในสต็อก (แยกรุ่น/สี)']).toBe('3 คัน — DEEPAL S07: ขาว 2, ดำ 1 · กำลังขนส่งมา 1 คัน')
  })
  it('empty stock', () => {
    expect(stockFacts([])['รถพร้อมขายในสต็อก (แยกรุ่น/สี)']).toBe('0 คัน')
  })
})

describe('testDriveFacts', () => {
  const today = '2026-10-26'
  it('นัด 7 วันข้างหน้า เรียงตามเวลา ใช้ชื่อต้น ไม่มีเบอร์', () => {
    const f = testDriveFacts([
      { date: '2026-10-28', time: '14:00', customerName: 'สมชาย ใจดี', phone: '0812345678', model: 'S07', status: 'scheduled' },
      { date: '2026-10-26', time: '10:00', customerName: 'วิภา', model: 'L07', staff: 'เอ', status: 'scheduled' },
      { date: '2026-11-10', time: '10:00', customerName: 'ไกล', status: 'scheduled' },
      { date: '2026-10-27', time: '09:00', customerName: 'ยกเลิก', status: 'cancelled' },
    ], today)
    const v = f['นัดทดลองขับ 7 วันข้างหน้า']
    expect(v.startsWith('2 นัด')).toBe(true)
    expect(v.indexOf('วิภา')).toBeLessThan(v.indexOf('สมชาย'))
    expect(v).toContain('วันนี้ 10:00')
    expect(v).not.toContain('ใจดี')
    expect(v).not.toContain('0812345678')
  })
  it('อัตราลองขับแล้วจอง', () => {
    const f = testDriveFacts([
      { date: '2026-10-01', status: 'done', result: 'booked' },
      { date: '2026-10-02', status: 'done', result: 'interested' },
      { date: '2026-05-01', status: 'done', result: 'booked' },
    ], today)
    expect(f['ทดลองขับแล้วจอง (90 วันล่าสุด)']).toBe('ลองขับ 2 ครั้ง จองแล้ว 1 ครั้ง (50%)')
    expect(testDriveFacts([], today)['นัดทดลองขับ 7 วันข้างหน้า']).toBe('ยังไม่มีนัด')
  })
})
