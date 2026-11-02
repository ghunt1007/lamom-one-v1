import { describe, it, expect } from 'vitest'
import { sheetNeedsSync } from './sheetWatch.js'

describe('sheetNeedsSync', () => {
  const t = '2026-11-02T10:00:00.000Z'
  it('asks when the Sheet changed after the last sync', () => {
    expect(sheetNeedsSync(t, '2026-11-02T09:00:00.000Z', '')).toBe(true)
    expect(sheetNeedsSync(t, '', '')).toBe(true)
  })
  it('stays quiet when already synced, dismissed, or unknown', () => {
    expect(sheetNeedsSync(t, t, '')).toBe(false)
    expect(sheetNeedsSync(t, '2026-11-02T11:00:00.000Z', '')).toBe(false)
    expect(sheetNeedsSync(t, '', t)).toBe(false)
    expect(sheetNeedsSync('', '', '')).toBe(false)
  })
})
