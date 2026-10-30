import { describe, it, expect } from 'vitest'
import { isZeroKpiText } from './kpiQuiet.js'

describe('isZeroKpiText', () => {
  it('treats empty counters as zero', () => {
    for (const t of ['0', ' 0 ', '฿0', '฿ 0', '0%', '0.0%', '0 คัน', '0 รายการ', '0 ข้อ/คัน', '—']) expect(isZeroKpiText(t)).toBe(true)
  })
  it('keeps real numbers', () => {
    for (const t of ['8', '฿9,432,000', '60%', '10 คัน', '0.5', '100']) expect(isZeroKpiText(t)).toBe(false)
  })
})
