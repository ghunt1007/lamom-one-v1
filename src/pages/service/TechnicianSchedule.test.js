import { describe, it, expect } from 'vitest'
import { mondayOf, addDaysStr, weekDatesOf } from './TechnicianSchedule.js'

describe('mondayOf', () => {
  it('returns the same date when already a Monday', () => {
    expect(mondayOf('2026-08-10')).toBe('2026-08-10') // ยืนยันว่า 2026-08-10 เป็นวันจันทร์จริง
  })

  it('rolls back to Monday for mid-week dates', () => {
    expect(mondayOf('2026-08-12')).toBe('2026-08-10') // พุธ → จันทร์เดียวกัน
    expect(mondayOf('2026-08-16')).toBe('2026-08-10') // อาทิตย์ → จันทร์ของสัปดาห์เดียวกัน (ไม่ใช่สัปดาห์หน้า)
  })

  it('handles month/year boundaries', () => {
    expect(mondayOf('2026-09-01')).toBe('2026-08-31') // อังคาร 1 ก.ย. → จันทร์ 31 ส.ค.
    expect(mondayOf('2027-01-01')).toBe('2026-12-28') // ศุกร์ 1 ม.ค. 2027 → จันทร์สัปดาห์ก่อนข้ามปี
  })
})

describe('addDaysStr', () => {
  it('adds and subtracts days across month boundaries', () => {
    expect(addDaysStr('2026-08-10', 7)).toBe('2026-08-17')
    expect(addDaysStr('2026-08-10', -7)).toBe('2026-08-03')
    expect(addDaysStr('2026-08-31', 1)).toBe('2026-09-01')
    expect(addDaysStr('2026-01-01', -1)).toBe('2025-12-31')
  })
})

describe('weekDatesOf', () => {
  it('returns 7 consecutive dates starting from the given Monday', () => {
    expect(weekDatesOf('2026-08-10')).toEqual([
      '2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13',
      '2026-08-14', '2026-08-15', '2026-08-16',
    ])
  })
})
