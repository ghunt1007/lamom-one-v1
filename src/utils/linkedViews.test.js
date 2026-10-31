import { describe, it, expect } from 'vitest'
import { LINKED_VIEWS, viewGroupFor, isMergedPath, viewTabsHtml } from './linkedViews.js'
import { NAV } from '../data/navMenu.js'

describe('linkedViews', () => {
  it('every linked page is still a real menu entry (Ctrl+K and breadcrumb keep working)', () => {
    const paths = new Set(NAV.flatMap(g => g.items.map(i => i.path)))
    LINKED_VIEWS.flat().forEach(v => expect(paths.has(v.path)).toBe(true))
  })
  it('keeps the first page of each group in the sidebar and hides the rest', () => {
    expect(isMergedPath('/crm/testdrive')).toBe(false)
    expect(isMergedPath('/dms/testdrive-schedule')).toBe(true)
    expect(isMergedPath('/finance/tracker?id=1')).toBe(true)
    expect(isMergedPath('/crm/bookings')).toBe(false)
  })
  it('renders tabs with the current page active, skipping pages the user cannot open', () => {
    expect(viewGroupFor('/service/warranty-claim')).toHaveLength(3)
    const html = viewTabsHtml('/service/warranty-claim', p => p !== '/service/warranty-expiry')
    expect(html).toContain('class="view-tab active" data-view="/service/warranty-claim"')
    expect(html).not.toContain('/service/warranty-expiry')
    expect(viewTabsHtml('/finance/payroll', () => false)).toBe('')
    expect(viewTabsHtml('/crm/bookings')).toBe('')
  })
})
