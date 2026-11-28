import { describe, it, expect } from 'vitest'
import { normalizeQuery } from './queryNormalize.js'
import { parseOpsSpec } from './opsQuestions.js'
import { isMonthQuestion } from './monthBrief.js'
import { isCallListQuestion } from './callList.js'

describe('normalizeQuery (v1.0.1518)', () => {
  it('leaves Thai and model names alone', () => {
    expect(normalizeQuery('ยอดเดือนนี้เป็นไง')).toBe('ยอดเดือนนี้เป็นไง')
    expect(normalizeQuery('AION V สีขาวมีไหม')).toBe('AION V สีขาวมีไหม')
  })
  it('maps common English words so instant answers work', () => {
    expect(parseOpsSpec(normalizeQuery('booking today'))).toEqual({ kind: 'bookday', day: 'today' })
    expect(parseOpsSpec(normalizeQuery('test drive tomorrow'))).toMatchObject({ kind: 'testdrive', day: 'tomorrow' })
    expect(parseOpsSpec(normalizeQuery('delivery this week'))).toMatchObject({ kind: 'delivery', day: 'week' })
    expect(isMonthQuestion(normalizeQuery('sales this month'))).toBe(true)
    expect(isCallListQuestion(normalizeQuery('who to call'))).toBe(true)
    expect(normalizeQuery('hot lead')).toBe('ลูกค้า hot')
  })
})
