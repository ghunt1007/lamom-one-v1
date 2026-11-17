// (v1.0.1222) สถานะใน Sheet "DATA Booking" ต้องมีในแอปครบ — ทั้งสถานะใบจองและสถานะเช่าซื้อ
import { describe, it, expect } from 'vitest'
import { BOOKING_STATUSES, isOpenBooking } from './bookingStatus.js'
import { mergeSheetList } from '../data/masterData.js'
import { bookingNextStep, bookingNextAction } from './bookingNext.js'
import { PIPELINE_ORDER } from './dashStats.js'
import { FIN_PASSED_STATUSES } from './finance.js'

const SHEET_STATUS = ['ยอดจองคงค้าง', 'ซื้อสดรอเบิกรถ', 'รอผลไฟแนนซ์', 'ผ่านไฟแนนซ์รอเบิก', 'ผ่านไฟแนนซ์รอจอง', 'รอรถ', 'ได้รถแล้วรอสั่งแต่ง', 'รอส่งมอบ', 'ตัดตัวเลขรอส่งมอบ', 'ส่งมอบแล้ว', 'ถอนจอง']
const SHEET_FIN = ['ซื้อสด', 'รอส่ง', 'รอเซ็นต์', 'รอผล', 'รอโยกหัว', 'ผ่าน', 'ถอนจอง']

describe('สถานะจาก Sheet', () => {
  it('สถานะใบจองใน Sheet มีครบในแอป', () => {
    for (const s of SHEET_STATUS) expect(BOOKING_STATUSES).toContain(s)
  })
  it('สถานะเช่าซื้อใน Sheet มีครบในค่าเริ่มต้น', async () => {
    const src = (await import('node:fs')).readFileSync(new URL('../data/masterData.js', import.meta.url), 'utf8')
    const line = src.match(/financeStatus: \[([^\]]+)\]/)[1]
    for (const s of SHEET_FIN) expect(line).toContain(`'${s}'`)
  })
  it('รายการเก่าที่บันทึกไว้ได้สถานะใหม่เพิ่ม และเก็บค่าที่ผู้ใช้เพิ่มเอง', () => {
    const out = mergeSheetList(['ก', 'ข', 'ค'], ['ก', 'ค', 'พิเศษ'])
    expect(out).toEqual(['ก', 'ข', 'ค', 'พิเศษ'])
    expect(mergeSheetList(['ก'], undefined)).toEqual(['ก'])
  })
  it('ได้รถแล้วรอสั่งแต่ง = ใบจองยังเปิด อยู่ในเส้นทาง ไฟแนนซ์ผ่านแล้ว และมีขั้นต่อไป', () => {
    const b = { status: 'ได้รถแล้วรอสั่งแต่ง', bookingDate: '2026-11-01' }
    expect(isOpenBooking(b)).toBe(true)
    expect(PIPELINE_ORDER.indexOf('ได้รถแล้วรอสั่งแต่ง')).toBeLessThan(PIPELINE_ORDER.indexOf('รอส่งมอบ'))
    expect(FIN_PASSED_STATUSES).toContain('ได้รถแล้วรอสั่งแต่ง')
    expect(bookingNextStep(b, '2026-11-17').text).toContain('สั่งแต่ง')
    expect(bookingNextAction(b, '2026-11-17').key).toBe('print:joborder')
  })
})
