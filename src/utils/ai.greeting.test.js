import { describe, it, expect } from 'vitest'
import { bangkokHour, thaiGreeting } from './ai.js'

describe('Thai time greeting', () => {
  it('uses Bangkok time', () => {
    expect(bangkokHour(Date.UTC(2026, 9, 25, 18, 30))).toBe(1)
    expect(bangkokHour(Date.UTC(2026, 9, 25, 2, 0))).toBe(9)
  })
  it('greets by time of day', () => {
    expect(thaiGreeting(8)).toBe('อรุณสวัสดิ์')
    expect(thaiGreeting(14)).toBe('สวัสดีตอนบ่าย')
    expect(thaiGreeting(19)).toBe('สวัสดีตอนเย็น')
    expect(thaiGreeting(2)).toBe('สวัสดี')
  })
})
