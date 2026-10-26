import { describe, it, expect } from 'vitest'
import { appendSpoken } from './micInput.js'

describe('appendSpoken', () => {
  it('joins with a space and trims', () => {
    expect(appendSpoken('นัดเสาร์', ' ทดลองขับ ')).toBe('นัดเสาร์ ทดลองขับ')
    expect(appendSpoken('', 'สวัสดี')).toBe('สวัสดี')
    expect(appendSpoken('ok', '')).toBe('ok')
  })
})
