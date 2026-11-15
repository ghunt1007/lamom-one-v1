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

describe('whatsNew roles (2026-11-16)', () => {
  it('owner and admin see every highlight', async () => {
    const { highlightsFor } = await import('./whatsNew.js')
    expect(highlightsFor('admin')).toHaveLength(HIGHLIGHTS.length)
    expect(highlightsFor('sales', true)).toHaveLength(HIGHLIGHTS.length)
  })
  it('sales do not see owner-only or marketing-only items', async () => {
    const { highlightsFor } = await import('./whatsNew.js')
    const t = highlightsFor('sales').map(h => h.path)
    expect(t).toContain('/calendar')
    expect(t).toContain('/crm/customers')
    expect(t).not.toContain('/settings/health')
    expect(t).not.toContain('/marketing/channels')
    expect(highlightsFor('marketing').map(h => h.path)).toContain('/marketing/channels')
  })
  it('every path is a real route', async () => {
    const fs = await import('fs')
    const src = fs.readFileSync(new URL('../core/router.js', import.meta.url), 'utf8')
    HIGHLIGHTS.filter(h => h.path).forEach(h => expect(src).toContain(`'${h.path}':`))
  })
})
