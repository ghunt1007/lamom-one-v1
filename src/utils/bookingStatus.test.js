import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { BOOKING_STATUSES, CANCELLED_STATUSES, isOpenBooking, isDelivered, isCancelled } from './bookingStatus.js'

// คำที่บอกว่าเป็นสถานะใบจอง — ข้อความที่มีคำเหล่านี้และถูกใช้เป็นสถานะ ต้องสะกดตรงกับรายการกลาง
const BOOKING_WORDS = /จอง|ส่งมอบ|ไฟแนนซ์|เบิก/
const ALLOWED = new Set([...BOOKING_STATUSES, ...CANCELLED_STATUSES])

describe('booking status list', () => {
  it('sorts bookings into open / delivered / cancelled', () => {
    expect(isOpenBooking({ status: 'รอรถ' })).toBe(true)
    expect(isDelivered({ status: 'ตัดตัวเลขรอส่งมอบ' })).toBe(true)
    expect(isCancelled({ status: 'ถอนจอง' })).toBe(true)
    expect(isOpenBooking({ status: 'ส่งมอบแล้ว' })).toBe(false)
  })

  it('no file compares a booking status that is spelled differently from the list', () => {
    const files = execSync("git ls-files 'src/*.js'", { encoding: 'utf8' }).trim().split('\n').filter(f => !f.endsWith('.test.js'))
    const bad = []
    for (const f of files) {
      const src = readFileSync(f, 'utf8')
      for (const m of src.matchAll(/(\w+)\.status\s*[!=]==?\s*'([^']*)'/g)) {
        if (/^(v|vehicle|car)$/.test(m[1])) continue // สถานะรถในสต็อก คนละชุด
        if (BOOKING_WORDS.test(m[2]) && !ALLOWED.has(m[2])) bad.push(`${f}: ${m[2]}`)
      }
    }
    expect(bad).toEqual([])
  })
})
