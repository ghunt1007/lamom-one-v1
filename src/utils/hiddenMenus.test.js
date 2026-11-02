import { describe, it, expect } from 'vitest'
import { cleanHiddenMenus, hiddenMenuSet } from './hiddenMenus.js'

describe('hidden menus', () => {
  it('keeps valid paths once, drops query strings and never hides the way back', () => {
    expect(cleanHiddenMenus(['/ai/upsell', '/ai/upsell?x=1', '/', '/settings/page-usage', 'bad', 3, '/b2b'])).toEqual(['/ai/upsell', '/b2b'])
    expect(cleanHiddenMenus(null)).toEqual([])
    expect(hiddenMenuSet({ hiddenMenus: ['/notes'] }).has('/notes')).toBe(true)
  })
})
