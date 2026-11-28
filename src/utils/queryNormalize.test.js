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

describe('v1.0.1532 more English words', () => {
  it('maps common phrases', () => {
    expect(normalizeQuery('pending finance')).toBe('ใครรอไฟแนนซ์')
    expect(normalizeQuery('who is waiting for car')).toBe('ใครรอรถ')
    expect(normalizeQuery('booth this week')).toBe('บูธ สัปดาห์นี้')
    expect(normalizeQuery('follow up today')).toBe('วันนี้ควรโทรหาใคร')
    expect(normalizeQuery('overdue follow up')).toBe('นัดเลยกำหนด')
    expect(normalizeQuery('top seller this month')).toBe('เซลส์คนไหนขายดีสุด เดือนนี้')
  })
})

describe('more English words (v1.0.1542)', () => {
  it('maps', () => {
    expect(normalizeQuery('today appointments')).toBe('วันนี้มีนัดอะไร')
    expect(normalizeQuery('who is on leave today')).toBe('ใครลา วันนี้')
    expect(normalizeQuery('pending quotations')).toBe('ใบเสนอราคาค้างอยู่กี่ใบ')
    expect(normalizeQuery('payroll this month')).toBe('สรุปเงินเดือน เดือนนี้')
    expect(normalizeQuery('profit this month')).toBe('กำไร เดือนนี้')
  })
})
