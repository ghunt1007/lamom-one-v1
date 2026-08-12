import { describe, it, expect } from 'vitest'
import { translateTrimmed } from './autoTranslate.js'

describe('translateTrimmed', () => {
  it('translates a Thai term to English and Chinese', () => {
    expect(translateTrimmed('บันทึก', 'en')).toBe('Save')
    expect(translateTrimmed('บันทึก', 'zh')).toBe('保存')
  })

  it('is a no-op (returns the Thai source) when lang is th', () => {
    expect(translateTrimmed('ยกเลิก', 'th')).toBe('ยกเลิก')
  })

  it('round-trips: en/zh text matches back to the same Thai key', () => {
    expect(translateTrimmed('Save', 'th')).toBe('บันทึก')
    expect(translateTrimmed('保存', 'th')).toBe('บันทึก')
    expect(translateTrimmed('Save', 'zh')).toBe('保存')
    expect(translateTrimmed('保存', 'en')).toBe('Save')
  })

  it('preserves emoji-prefixed button labels as a single unit', () => {
    expect(translateTrimmed('💾 บันทึก', 'en')).toBe('💾 Save')
    expect(translateTrimmed('🗑️ ลบ', 'zh')).toBe('🗑️ 删除')
  })

  it('returns null for text not in the dictionary (leaves free-form content untouched)', () => {
    expect(translateTrimmed('สุดา มาดี', 'en')).toBe(null)
    expect(translateTrimmed('เลขที่ ABC-12345', 'en')).toBe(null)
  })

  it('does not partially match substrings — only exact full-string matches', () => {
    // "บันทึกไฟล์" ไม่ใช่ "บันทึก" เป๊ะๆ ต้องไม่แปล เพื่อไม่ไปแก้เนื้อหาที่ไม่ได้ตั้งใจ
    expect(translateTrimmed('บันทึกไฟล์', 'en')).toBe(null)
  })
})
