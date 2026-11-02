import { describe, it, expect } from 'vitest'
import { carLabel, carOf } from './carLabel.js'

describe('carLabel', () => {
  it('drops a brand the model already names', () => {
    expect(carLabel('AION', 'AION V')).toBe('AION V')
    expect(carLabel('OMODA & JAECOO', 'JAECOO 6')).toBe('JAECOO 6')
    expect(carLabel('Deepal', 'DEEPAL S07')).toBe('DEEPAL S07')
  })
  it('keeps the brand when the model does not include it', () => {
    expect(carLabel('BYD', 'Dolphin')).toBe('BYD Dolphin')
    expect(carLabel('Deepal', 'S07', 'Max')).toBe('Deepal S07 Max')
  })
  it('handles missing parts', () => {
    expect(carLabel('', 'S07')).toBe('S07')
    expect(carLabel('BYD', '')).toBe('BYD')
    expect(carLabel()).toBe('')
    expect(carOf(null)).toBe('')
    expect(carOf({ brand: 'AION', model: 'AION Y Plus', variant: 'Plus' }, true)).toBe('AION Y Plus')
  })
  it('does not match short fragments', () => {
    expect(carLabel('MG', 'MG4')).toBe('MG MG4')
  })
})
