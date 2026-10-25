import { describe, it, expect } from 'vitest'
import { shouldShowWhatsNew, WHATS_NEW_ID, HIGHLIGHTS } from './whatsNew.js'

describe('whatsNew', () => {
  it('shows once per release id', () => {
    expect(shouldShowWhatsNew(null)).toBe(true)
    expect(shouldShowWhatsNew('2026-01-01')).toBe(true)
    expect(shouldShowWhatsNew(WHATS_NEW_ID)).toBe(false)
  })
  it('every highlight has somewhere to go', () => {
    HIGHLIGHTS.forEach(h => expect(h.path || h.action).toBeTruthy())
  })
})
