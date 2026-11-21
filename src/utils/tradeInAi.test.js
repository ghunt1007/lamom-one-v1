import { describe, it, expect } from 'vitest'
import { parseTradeInReply, midPrice, TRADEIN_PROMPT } from './tradeInAi.js'

describe('parseTradeInReply', () => {
  it('reads a normal reply', () => {
    const r = parseTradeInReply('```json\n{"brand":"Toyota","model":"Yaris","year":2018,"mileage":"85,000","grade":"b","priceLow":280000,"priceHigh":340000,"issues":["รอยขีดกันชนหลัง"],"checks":["เช็กประวัติชน"],"confidence":"medium"}\n```', 2026)
    expect(r).toMatchObject({ car: 'Toyota Yaris 2018', year: 2018, mileage: 85000, grade: 'B', low: 280000, high: 340000, confidence: 'medium' })
    expect(r.issues).toEqual(['รอยขีดกันชนหลัง'])
    expect(midPrice(r)).toBe(310000)
  })
  it('drops nonsense values', () => {
    const r = parseTradeInReply('{"brand":"Honda","model":"City","year":3000,"grade":"Z","priceLow":100000,"priceHigh":900000,"mileage":-5}', 2026)
    expect(r).toMatchObject({ car: 'Honda City', year: null, grade: null, low: null, high: null, mileage: null, confidence: 'low' })
    expect(midPrice(r)).toBe(null)
  })
  it('swaps reversed range and strips html', () => {
    const r = parseTradeInReply('{"brand":"<b>Mazda</b>","model":"2","priceLow":400000,"priceHigh":350000}')
    expect(r.low).toBe(350000)
    expect(r.car).not.toMatch(/[<>]/)
  })
  it('returns null for empty or broken', () => {
    expect(parseTradeInReply('')).toBe(null)
    expect(parseTradeInReply('ไม่ทราบ')).toBe(null)
    expect(parseTradeInReply('{}')).toBe(null)
  })
  it('prompt asks for JSON and null when unsure', () => {
    expect(TRADEIN_PROMPT).toContain('JSON')
    expect(TRADEIN_PROMPT).toContain('null')
  })
})
