import { describe, it, expect } from 'vitest'
import { maybeCarPick, parseCarPick, carPick } from './carPick.js'

const V = [
  { brand: 'Deepal', model: 'S05', variant: 'LITE', year: 2026, type: 'SUV', fuel: 'BEV', price: 899000, range: 410, seats: 5 },
  { brand: 'Deepal', model: 'S05', variant: 'MAX', year: 2026, type: 'SUV', fuel: 'BEV', price: 999000, range: 510, seats: 5 },
  { brand: 'Deepal', model: 'S07 (2024)', variant: 'Std', year: 2024, type: 'SUV', fuel: 'BEV', price: 1099000, range: 485, seats: 5 },
  { brand: 'Deepal', model: 'S07 (2026)', variant: 'New', year: 2026, type: 'SUV', fuel: 'BEV', price: 1199000, range: 560, seats: 5 },
  { brand: 'GAC Aion', model: 'AION V', variant: '500', year: 2026, type: 'SUV', fuel: 'BEV', price: 799900, range: 500, seats: 5 },
  { brand: 'BYD', model: 'M6', variant: 'Ext', year: 2026, type: 'MPV', fuel: 'BEV', price: 899900, range: 530, seats: 7 },
  { brand: 'Toyota', model: 'Camry', variant: 'HV', year: 2026, type: 'Sedan', fuel: 'Hybrid', price: 1669000, seats: 5 },
]
const rank = b => ['deepal', 'aion'].findIndex(d => b.toLowerCase().includes(d)) >= 0 ? ['deepal', 'aion'].findIndex(d => b.toLowerCase().includes(d)) : 6
const opt = { dealerRank: rank, dealerCount: 6 }

describe('carPick', () => {
  it('recognises recommendation questions but not other topics', () => {
    expect(maybeCarPick('รถไฟฟ้าไม่เกิน 1 ล้าน')).toBe(true)
    expect(maybeCarPick('แนะนำรถงบ 8 แสน')).toBe(true)
    expect(maybeCarPick('ผ่อน S07 เดือนละเท่าไหร่')).toBe(false)
    expect(maybeCarPick('มีรถอะไรพร้อมขาย')).toBe(false)
    expect(maybeCarPick('ลูกค้างบ 1 ล้าน แนะนำรุ่นไหน')).toBe(false)
  })
  it('parses fuel, body, seats and budget', () => {
    expect(parseCarPick('รถไฟฟ้าไม่เกิน 1 ล้าน')).toEqual({ fuel: ['BEV'], body: null, seats: null, max: 1000000, min: null })
    expect(parseCarPick('SUV 7 ที่นั่ง งบ 1.2 ล้าน')).toEqual({ fuel: null, body: 'SUV', seats: 7, max: 1320000, min: 960000 })
    expect(parseCarPick('ไฮบริดตั้งแต่ 1 ล้านขึ้นไป แนะนำหน่อย')).toMatchObject({ fuel: ['Hybrid', 'PHEV'], min: 1000000, max: null })
    expect(parseCarPick('แนะนำหน่อย')).toBeNull()
  })
  it('lists dealer brands first and drops old model years', () => {
    const r = carPick(parseCarPick('รถไฟฟ้าไม่เกิน 1.2 ล้าน'), V, opt)
    const t = r.text
    expect(t.indexOf('🏢 รุ่นที่โชว์รูมขาย (3)')).toBeGreaterThan(0)
    expect(t).toContain('Deepal S05 · ฿899,000–฿999,000 · 510 กม.')
    expect(t).toContain('Deepal S07 · ฿1,199,000')
    expect(t).not.toContain('1,099,000')
    expect(t.indexOf('BYD M6')).toBeGreaterThan(t.indexOf('AION V'))
    expect(r.next).toContain('เทียบ S05 กับ S07')
    expect(r.copy).toContain('• Deepal S05')
    expect(r.copy).not.toContain('BYD')
  })
  it('filters by seats and says so when nothing fits', () => {
    expect(carPick(parseCarPick('รถไฟฟ้า 7 ที่นั่ง แนะนำ'), V, opt).text).toContain('BYD M6')
    const none = carPick(parseCarPick('รถไฟฟ้าไม่เกิน 5 แสน'), V, opt)
    expect(none.text).toContain('ไม่พบรุ่นที่ตรง')
    expect(none.next[0]).toBe('รถไฟฟ้า ไม่เกิน 0.6 ล้าน')
    const suv = carPick(parseCarPick('SUV 7 ที่นั่ง งบ 1.2 ล้าน'), V, opt)
    expect(suv.next).toEqual(['แนะนำรถ SUV 7 ที่นั่ง ไม่เกิน 1.6 ล้าน', 'แนะนำรถ SUV งบ 1.2 ล้าน'])
    suv.next.forEach(q => expect(parseCarPick(q)).not.toBeNull())
  })
})
