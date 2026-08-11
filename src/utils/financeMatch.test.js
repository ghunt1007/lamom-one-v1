import { describe, it, expect } from 'vitest'
import { scoreFinanceMatch, rankFinanceMatches } from './financeMatch.js'

describe('scoreFinanceMatch — occupation', () => {
  it('gives a neutral +20 when the bank has no occupation preference set', () => {
    const { score, reasons } = scoreFinanceMatch({}, { preferredOccupations: [] })
    expect(score).toBe(35) // 20 (occ) + 10 (no income data) + 0 (approval) + 5 (no down data)
    expect(reasons).toEqual([])
  })

  it('gives +40 and a positive reason when the customer occupation is on the preferred list', () => {
    const { score, reasons } = scoreFinanceMatch(
      { occupation: 'ราชการ/รัฐวิสาหกิจ' },
      { preferredOccupations: ['ราชการ/รัฐวิสาหกิจ'] }
    )
    expect(score).toBe(55) // 40 (occ match) + 10 + 0 + 5
    expect(reasons.some(r => r.includes('ชอบลูกค้าอาชีพ'))).toBe(true)
  })

  it('adds no occupation points and flags a caution reason when occupation is not preferred', () => {
    const { score, reasons } = scoreFinanceMatch(
      { occupation: 'เกษตรกร' },
      { preferredOccupations: ['ราชการ/รัฐวิสาหกิจ'] }
    )
    expect(score).toBe(15) // 0 (occ mismatch) + 10 + 0 + 5
    expect(reasons.some(r => r.includes('ปกติไม่ค่อยรับลูกค้าอาชีพ'))).toBe(true)
  })
})

describe('scoreFinanceMatch — income', () => {
  it('adds +20 with no extra reason when income clears the minimum but not 1.5x', () => {
    const { score, reasons } = scoreFinanceMatch(
      { monthlyIncome: 35000 },
      { preferredOccupations: [], minIncome: 30000 }
    )
    expect(score).toBe(45) // 20 (occ, no pref) + 20 (income) + 0 + 5
    expect(reasons).toEqual([])
  })

  it('adds a bonus reason when income is at least 1.5x the minimum', () => {
    const { reasons } = scoreFinanceMatch(
      { monthlyIncome: 50000 },
      { preferredOccupations: [], minIncome: 30000 }
    )
    expect(reasons.some(r => r.includes('รายได้สูงกว่าเกณฑ์ขั้นต่ำมาก'))).toBe(true)
  })

  it('adds no income points and warns when income is below the minimum', () => {
    const { score, reasons } = scoreFinanceMatch(
      { monthlyIncome: 20000 },
      { preferredOccupations: [], minIncome: 30000 }
    )
    expect(score).toBe(25) // 20 (occ) + 0 (income below min) + 0 + 5
    expect(reasons.some(r => r.includes('รายได้ต่ำกว่าเกณฑ์ขั้นต่ำ'))).toBe(true)
  })
})

describe('scoreFinanceMatch — approval rate', () => {
  it('scales the approval bonus proportionally (0-20 points)', () => {
    expect(scoreFinanceMatch({}, { preferredOccupations: [], approval: 0 }).score).toBe(35)
    expect(scoreFinanceMatch({}, { preferredOccupations: [], approval: 50 }).score).toBe(45)
    expect(scoreFinanceMatch({}, { preferredOccupations: [], approval: 100 }).score).toBe(55)
  })

  it('flags a high-approval reason at 80% and above', () => {
    const low = scoreFinanceMatch({}, { preferredOccupations: [], approval: 79 })
    const high = scoreFinanceMatch({}, { preferredOccupations: [], approval: 80 })
    expect(low.reasons.some(r => r.includes('Approval Rate สูง'))).toBe(false)
    expect(high.reasons.some(r => r.includes('Approval Rate สูง'))).toBe(true)
  })
})

describe('scoreFinanceMatch — down payment', () => {
  it('adds +10 when the intended down payment meets the bank minimum', () => {
    const { score } = scoreFinanceMatch(
      { downPct: 20 },
      { preferredOccupations: [], minDown: 15 }
    )
    expect(score).toBe(40) // 20 (occ, no pref) + 10 (income, no data) + 0 (approval) + 10 (down meets min)
  })

  it('adds no down-payment points and warns when below the bank minimum', () => {
    const { score, reasons } = scoreFinanceMatch(
      { downPct: 10 },
      { preferredOccupations: [], minDown: 15 }
    )
    expect(score).toBe(30) // 20 (occ) + 10 (income) + 0 (approval) + 0 (down below min)
    expect(reasons).toContain('เงินดาวน์ที่ตั้งใจจะลง (10%) ต่ำกว่าขั้นต่ำของธนาคารนี้ (15%)')
  })
})

describe('scoreFinanceMatch — blacklist history', () => {
  it('does not penalize when the bank explicitly accepts blacklist history', () => {
    const { score, reasons } = scoreFinanceMatch(
      { hasBlacklistHistory: true },
      { preferredOccupations: [], blacklistOk: true }
    )
    expect(score).toBe(35) // same as neutral baseline — no penalty applied
    expect(reasons.some(r => r.includes('รับพิจารณาลูกค้าที่มีประวัติค้างชำระ'))).toBe(true)
  })

  it('subtracts 20 points when the bank does not accept blacklist history', () => {
    const { score, reasons } = scoreFinanceMatch(
      { hasBlacklistHistory: true },
      { preferredOccupations: [], blacklistOk: false }
    )
    expect(score).toBe(15) // 35 baseline - 20 penalty
    expect(reasons.some(r => r.includes('มีประวัติค้างชำระ — ธนาคารนี้ปกติไม่รับกรณีนี้'))).toBe(true)
  })
})

describe('scoreFinanceMatch — score clamping', () => {
  it('never returns a score below 0 even when every penalty stacks', () => {
    const { score } = scoreFinanceMatch(
      { occupation: 'เกษตรกร', monthlyIncome: 10000, downPct: 5, hasBlacklistHistory: true },
      { preferredOccupations: ['ราชการ/รัฐวิสาหกิจ'], minIncome: 30000, approval: 0, minDown: 20, blacklistOk: false }
    )
    expect(score).toBe(0)
  })
})

describe('rankFinanceMatches', () => {
  it('sorts banks by score descending and preserves the original bank fields', () => {
    const customerProfile = { occupation: 'พนักงานบริษัทเอกชน', monthlyIncome: 40000 }
    const banks = [
      { name: 'ธนาคาร A (approval ต่ำ)', preferredOccupations: [], approval: 10 },
      { name: 'ธนาคาร B (approval สูง)', preferredOccupations: [], approval: 90 },
    ]
    const ranked = rankFinanceMatches(customerProfile, banks)
    expect(ranked.map(r => r.name)).toEqual(['ธนาคาร B (approval สูง)', 'ธนาคาร A (approval ต่ำ)'])
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score)
    expect(ranked[0]).toHaveProperty('reasons')
  })
})
