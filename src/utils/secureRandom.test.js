import { describe, it, expect, vi } from 'vitest'
import { randomString, genPassword, genApiKey } from './secureRandom.js'

describe('secureRandom', () => {
  it('password has letters, # and 2 digits', () => {
    const p = genPassword()
    expect(p).toMatch(/^[A-HJ-NP-Za-km-np-z2-9]{10}#[2-9]{2}$/)
  })
  it('api key format', () => {
    expect(genApiKey()).toMatch(/^lmm_live_[a-z0-9]{32}$/)
  })
  it('does not repeat', () => {
    const s = new Set(Array.from({ length: 200 }, genPassword))
    expect(s.size).toBe(200)
  })
  it('uses crypto, not Math.random', () => {
    const spy = vi.spyOn(Math, 'random')
    genPassword(); genApiKey()
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
  it('covers all chars roughly evenly', () => {
    const s = randomString(6000, 'abc')
    for (const ch of 'abc') {
      const n = s.split(ch).length - 1
      expect(n).toBeGreaterThan(1700)
      expect(n).toBeLessThan(2300)
    }
  })
})
