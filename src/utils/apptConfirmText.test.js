import { describe, it, expect } from 'vitest'
import { serviceApptText, testDriveApptText, showroomApptText, deliveryApptText, addDaysYmd } from './apptConfirmText.js'

describe('serviceApptText', () => {
  it('uses the tomorrow reminder wording when the date is tomorrow', () => {
    const t = serviceApptText({ date: '2026-11-26', time: '09:30', custName: 'คุณสมศรี ใจดี', type: 'เช็กระยะ', plate: 'กข 1234' }, '2026-11-25')
    expect(t).toContain('สวัสดีครับคุณสมศรี')
    expect(t).toContain('พรุ่งนี้ 26/11/2569 เวลา 09:30 น.')
  })
  it('states the exact date otherwise', () => {
    expect(serviceApptText({ date: '2026-12-03', time: '13:00', custName: 'ลูกค้าใหม่' }, '2026-11-25')).toBe('สวัสดีครับ ขอยืนยันนัดเข้าศูนย์บริการ วันที่ 03/12/2569 เวลา 13:00 น. ครับ 🔧\nถ้าต้องการเลื่อนนัด ตอบกลับข้อความนี้ได้เลยครับ')
    expect(serviceApptText({ date: '2026-11-25', custName: 'มานี' }, '2026-11-25')).toContain('วันนี้ 25/11/2569')
  })
  it('addDaysYmd crosses month ends', () => {
    expect(addDaysYmd('2026-11-30', 1)).toBe('2026-12-01')
  })
  it('test drive text', () => {
    expect(testDriveApptText({ date: '2026-11-28', time: '10:00', customerName: 'สมชาย', model: 'Deepal S07' }, '2026-11-25')).toContain('ขอยืนยันนัดทดลองขับ (Deepal S07) วันที่ 28/11/2569 เวลา 10:00 น.')
    expect(testDriveApptText({ date: '2026-11-26', customerName: 'สมชาย', model: 'S07' }, '2026-11-25')).toContain('ขอเตือนนัดทดลองขับ S07 พรุ่งนี้')
  })
  it('showroom text', () => {
    expect(showroomApptText({ date: '2026-11-29', time: '14:00', custName: 'คุณวิชัย', purpose: 'ดูรถ' }, '2026-11-25')).toContain('สวัสดีครับคุณวิชัย ขอยืนยันนัดเข้าโชว์รูม (ดูรถ) วันที่ 29/11/2569 เวลา 14:00 น.')
  })
  it('delivery text', () => {
    expect(deliveryApptText({ deliveryDate: '2026-11-30', deliveryTime: '10:00', custName: 'คุณนภา', brand: 'DEEPAL', model: 'S07' }, '2026-11-25')).toContain('ขอยืนยันนัดรับรถ')
    expect(deliveryApptText({ deliveryDate: '2026-11-26', deliveryTime: '10:00', custName: 'นภา', model: 'S07' }, '2026-11-25')).toContain('ขอเตือนนัดรับรถ')
  })
})
