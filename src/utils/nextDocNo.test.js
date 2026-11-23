import { describe, it, expect } from 'vitest'
import { nextDocNo } from './nextDocNo.js'

describe('nextDocNo', () => {
  it('takes max of same prefix+year, not list length', () => {
    expect(nextDocNo('INV', ['INV-2026-007', 'QT-2026-050', 'INV-2026-003', 'INV-2025-099'], { year: 2026 })).toBe('INV-2026-008')
  })
  it('starts at 1 for a new year or empty list', () => {
    expect(nextDocNo('BR', ['BR-2025-0012'], { year: 2026, pad: 4 })).toBe('BR-2026-0001')
    expect(nextDocNo('WHT', [], { year: 2026, pad: 4 })).toBe('WHT-2026-0001')
  })
  it('does not collide after a delete', () => {
    expect(nextDocNo('INV', ['INV-2026-001', 'INV-2026-003'], { year: 2026 })).toBe('INV-2026-004')
  })
})
