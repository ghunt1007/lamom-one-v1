import { describe, it, expect } from 'vitest'
import { isValidationMessage } from './store.js'

describe('isValidationMessage', () => {
  it('detects "fill this in" errors only', () => {
    expect(isValidationMessage('❗ กรุณากรอกคะแนน', 'error')).toBe(true)
    expect(isValidationMessage('กรุณาเลือกวันนัด', 'error')).toBe(true)
    expect(isValidationMessage('❗ กรอกชื่อ', 'error')).toBe(true)
    expect(isValidationMessage('บันทึกไม่สำเร็จ', 'error')).toBe(false)
    expect(isValidationMessage('❗ กรุณากรอกชื่อ', 'warning')).toBe(false)
    expect(isValidationMessage('✅ บันทึกแล้ว', 'success')).toBe(false)
  })
})
