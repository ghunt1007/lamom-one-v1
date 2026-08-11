import { describe, it, expect } from 'vitest'
import { getBatteryStatus } from './EVBattery.js'

describe('getBatteryStatus', () => {
  it('is excellent at 90% SOH and above', () => {
    expect(getBatteryStatus(90)).toBe('excellent')
    expect(getBatteryStatus(100)).toBe('excellent')
  })

  it('is good in [80, 90)', () => {
    expect(getBatteryStatus(80)).toBe('good')
    expect(getBatteryStatus(89)).toBe('good')
  })

  it('is fair in [70, 80)', () => {
    expect(getBatteryStatus(70)).toBe('fair')
    expect(getBatteryStatus(79)).toBe('fair')
  })

  it('is poor below 70', () => {
    expect(getBatteryStatus(69)).toBe('poor')
    expect(getBatteryStatus(0)).toBe('poor')
  })
})
