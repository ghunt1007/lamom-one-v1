import { describe, it, expect } from 'vitest'
import { menuMatches } from './menuSearch.js'

describe('menuMatches', () => {
  it('ค้นภาษาไทยเจอเมนูชื่ออังกฤษ', () => {
    expect(menuMatches('Test Drive', '/crm/testdrive', 'ทดลองขับ')).toBe(true)
    expect(menuMatches('TD Schedule', '/dms/testdrive-schedule', 'ลองขับ')).toBe(true)
    expect(menuMatches('Payroll', '/finance/payroll', 'เงินเดือน')).toBe(true)
    expect(menuMatches('Follow-up', '/crm/followup', 'ติดตาม')).toBe(true)
  })
  it('ค้นชื่อเดิม/ไม่สนตัวพิมพ์/ช่องว่าง', () => {
    expect(menuMatches('Loan Calculator', '/finance/loan', 'loan calc')).toBe(true)
    expect(menuMatches('จองรถ', '/crm/bookings', 'จอง')).toBe(true)
    expect(menuMatches('Test Drive', '/crm/testdrive', 'testdrive')).toBe(true)
  })
  it('ไม่เจอ = false · ว่าง = แสดงทั้งหมด', () => {
    expect(menuMatches('Payroll', '/finance/payroll', 'ทดลองขับ')).toBe(false)
    expect(menuMatches('Payroll', '/finance/payroll', '  ')).toBe(true)
  })
})
