import { describe, it, expect } from 'vitest'
import { parseOpsSpec, moneyMonthAnswer } from './opsQuestions.js'
import { opexEntries } from './opex.js'
import { saleCost } from './saleCost.js'

const today = '2026-11-12'
describe('v1.0.1098 LAMI: expenses and profit this month', () => {
  it('parse', () => {
    expect(parseOpsSpec('ค่าใช้จ่ายเดือนนี้เท่าไหร่')).toEqual({ kind: 'expense', prev: false })
    expect(parseOpsSpec('กำไรเดือนนี้เท่าไหร่')).toEqual({ kind: 'profit', prev: false })
    expect(parseOpsSpec('กำไรเดือนที่แล้ว')).toEqual({ kind: 'profit', prev: true })
    expect(parseOpsSpec('S05 กำไรต่อคันเท่าไหร่')).toBeNull()
  })
  it('opex entries', () => {
    const e = opexEntries([{ date: '2026-11-03', cat: 'fuel', amount: 500, status: 'approved' }, { date: '2026-11-03', amount: 9, status: 'pending' }], [{ time: '2026-11-05T10:00', cat: 'meals', amount: 200, type: 'out', status: 'approved' }])
    expect(e).toHaveLength(2)
    expect(e[1]).toMatchObject({ month: '2026-11', label: '🍽 ค่าอาหาร', amt: 200 })
  })
  it('answers', () => {
    const opex = [{ month: '2026-11', label: '⛽ น้ำมัน', amt: 500 }, { month: '2026-10', label: '⛽ น้ำมัน', amt: 300 }]
    const x = moneyMonthAnswer({ opex, today, kind: 'expense', saleCost })
    expect(x.text).toContain('💸 ค่าใช้จ่ายเดือนนี้ (11/2569) ฿500 · เดือนก่อนหน้า ฿300')
    const p = moneyMonthAnswer({ sales: [{ date: '2026-11-02', salePrice: 1000000, cost: 900000 }], opex, today, kind: 'profit', saleCost })
    expect(p.text).toContain('กำไรขั้นต้น ฿100,000 (10%)')
    expect(p.text).toContain('กำไรสุทธิ ฿99,500')
  })
})
