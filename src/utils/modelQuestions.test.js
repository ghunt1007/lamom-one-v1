import { describe, it, expect } from 'vitest'
import { maybeModelQuestion, findModels, parseModelSpec, modelAnswer } from './modelQuestions.js'

const V = [
  { id: 'A1', brand: 'GAC Aion', model: 'AION V', variant: '500 Premium', year: 2026, type: 'SUV', fuel: 'BEV', price: 799900, power: 204, battery: '60 kWh LFP', range: 500, length: 4605, seats: 5, bootSpace: 451, chargeTime: 'DC 30→80% ~20 นาที', warranty: '5 ปี/150,000 km', colors: ['White', 'Black'] },
  { id: 'A2', brand: 'GAC Aion', model: 'AION V', variant: '620 Luxury', year: 2026, type: 'SUV', fuel: 'BEV', price: 899900, power: 204, battery: '75 kWh', range: 620, length: 4605, seats: 5, bootSpace: 451, chargeTime: 'DC 30→80% ~18 นาที', warranty: '5 ปี/150,000 km', colors: ['White', 'Black'] },
  { id: 'U1', brand: 'GAC Aion', model: 'AION UT', variant: 'Standard', year: 2026, type: 'Hatchback', fuel: 'BEV', price: 549900, range: 420, length: 4270, seats: 5 },
  { id: 'S24', brand: 'Deepal', model: 'S07 (2024)', variant: 'Standard Range', year: 2024, type: 'SUV', fuel: 'BEV', price: 1099000, range: 485, length: 4750, seats: 5 },
  { id: 'S26', brand: 'Deepal', model: 'S07 (2026)', variant: 'New Standard', year: 2026, type: 'SUV', fuel: 'BEV', price: 1199000, range: 560, length: 4750, seats: 5, power: 258 },
  { id: 'C1', brand: 'Toyota', model: 'Camry', variant: '2.5 HV', year: 2026, type: 'Sedan', fuel: 'Hybrid', price: 1669000, range: 0, engine: '2.5L', fuelEconomy: '18.4 km/L', length: 4885, seats: 5 },
]

describe('modelQuestions', () => {
  it('spots model questions and leaves other topics alone', () => {
    expect(maybeModelQuestion('ราคา AION V เท่าไหร่')).toBe(true)
    expect(maybeModelQuestion('เทียบ AION V กับ S07')).toBe(true)
    expect(maybeModelQuestion('ผ่อน AION V เดือนละเท่าไหร่')).toBe(false)
    expect(maybeModelQuestion('โทรหาสมชายแล้ว ถามราคา AION V')).toBe(false)
    expect(maybeModelQuestion('ยอดขายเดือนนี้เท่าไหร่')).toBe(false)
  })
  it('finds models in order, longest name wins, latest year for bare names', () => {
    expect(findModels('ราคา aion v เท่าไหร่', V)).toEqual(['AION V'])
    expect(findModels('เทียบ S07 กับ AION UT', V)).toEqual(['S07 (2026)', 'AION UT'])
    expect(findModels('S07 2024 ราคา', V)).toEqual(['S07 (2024)'])
    expect(findModels('ราคารถ', V)).toEqual([])
  })
  it('parses info and compare', () => {
    expect(parseModelSpec('ราคา AION V เท่าไหร่?', V)).toEqual({ mode: 'info', models: ['AION V'] })
    expect(parseModelSpec('เทียบ AION V กับ S07', V)).toEqual({ mode: 'compare', models: ['AION V', 'S07 (2026)'] })
    expect(parseModelSpec('AION V ดีกว่าไหม', V)).toBeNull()
    expect(parseModelSpec('ราคาทองวันนี้เท่าไหร่', V)).toBeNull()
  })
  it('answers with variants, range and a customer-ready copy', () => {
    const r = modelAnswer({ mode: 'info', models: ['AION V'] }, V)
    expect(r.text).toContain('฿799,900 – ฿899,900')
    expect(r.text).toContain('• 620 Luxury → ฿899,900 · 620 กม.')
    expect(r.text).toContain('500–620 กม.')
    expect(r.copy).toContain('AION V')
    expect(r.copy).not.toContain('ℹ️')
    expect(r.query).toBe('AION V')
    expect(r.next[0]).toBe('ผ่อน AION V เดือนละเท่าไหร่')
  })
  it('handles a petrol/hybrid car without EV lines', () => {
    const r = modelAnswer({ mode: 'info', models: ['Camry'] }, V)
    expect(r.text).toContain('18.4 km/L')
    expect(r.text).not.toContain('🔋')
  })
  it('compares two models with measurable differences', () => {
    const r = modelAnswer({ mode: 'compare', models: ['AION V', 'S07 (2026)'] }, V)
    expect(r.text).toContain('⚖️ AION V  |  Deepal S07')
    expect(r.text).toContain('AION V เริ่มต้นถูกกว่า ฿399,100')
    expect(r.text).toContain('AION V วิ่งได้ไกลกว่า 60 กม.')
    expect(r.ids).toEqual(['A1', 'S26'])
  })
})
