import { describe, it, expect } from 'vitest'
import { isWhereQuestion, findPages, whereAnswer } from './whereIs.js'
import { NAV } from '../data/navMenu.js'

describe('whereIs', () => {
  it('detects "where is" questions', () => {
    expect(isWhereQuestion('ดอกเบี้ย โปร แคมเปญ เงินพิเศษอยู่ตรงไหนฉันหาไม่เจอ')).toBe(true)
    expect(isWhereQuestion('ยอดขายเดือนนี้เท่าไร')).toBe(false)
  })
  it('finds the campaigns page from the team wording', () => {
    const r = findPages('ดอกเบี้ย โปร แคมเปญ เงินพิเศษอยู่ตรงไหนฉันหาไม่เจอ', NAV)
    expect(r[0].path).toBe('/crm/programs')
    expect(whereAnswer(r)).toContain('การขาย')
  })
  it('finds other common pages', () => {
    expect(findPages('ออกบูธ motor expo อยู่ไหน', NAV)[0].path).toBe('/marketing/events')
    expect(findPages('ใบเสนอราคาอยู่ตรงไหน', NAV)[0].path).toBe('/crm/quotation')
    expect(findPages('ตอบแชตเฟซบุ๊กตรงไหน', NAV)[0].path).toBe('/marketing/channels')
    expect(findPages('อยู่ตรงไหน', NAV)).toEqual([])
  })
})

import { matchMenuPages } from './searchIntent.js'
describe('global search falls back to team wording', () => {
  it('finds the campaigns page from a sentence', () => {
    expect(matchMenuPages(NAV, 'ดอกเบี้ย โปร เงินพิเศษอยู่ไหน')[0].path).toBe('/crm/programs')
    expect(matchMenuPages(NAV, 'จองรถ')[0].path).toBe('/crm/bookings')
  })
})
