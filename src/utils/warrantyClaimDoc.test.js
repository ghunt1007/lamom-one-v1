import { describe, it, expect } from 'vitest'
import { warrantyClaimHtml, warrantyClaimValue } from './warrantyClaimDoc.js'

describe('warrantyClaimDoc', () => {
  it('value tolerates missing numbers', () => {
    expect(warrantyClaimValue({ partCost: 1000, laborHrs: 1.5 }, 500)).toBe(1750)
    expect(warrantyClaimValue({}, 500)).toBe(0)
  })
  it('prints car, issue, amounts and DD/MM date, escaped', () => {
    const h = warrantyClaimHtml({ plate: 'กข <1>', model: 'S07', vin: 'V1', issue: 'แอร์ไม่เย็น', parts: 'คอมแอร์', partCost: 12000, laborHrs: 2, submitted: '2026-11-20', warrantyType: 'ทั่วไป 3 ปี' }, { laborRate: 500, statusLabel: 'ส่งค่ายแล้ว' })
    expect(h).toContain('ใบสรุปการเคลมรับประกัน')
    expect(h).toContain('กข &lt;1&gt;')
    expect(h).toContain('12,000')
    expect(h).toContain('13,000')
    expect(h).toMatch(/20\/11\/(2026|2569)/)
  })
})
