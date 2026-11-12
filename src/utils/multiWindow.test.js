import { describe, it, expect } from 'vitest'
import { wantsNewWindow, windowFeatures, pickWindowPages, windowTitle, syncKeyAction, canUseWindows } from './multiWindow.js'
import { idleRemaining } from './sessionTimeout.js'

const NAV = [
  { group: 'ภาพรวม', items: [{ icon: '🏠', label: 'ภาพรวมบริษัท', labelEn: 'Dashboard', path: '/' }] },
  { group: 'การขาย', items: [
    { icon: '☀️', label: 'งานของฉันวันนี้', labelEn: 'My Day', path: '/crm/my-day' },
    { icon: '👥', label: 'ลูกค้า (รวม Lead)', path: '/crm/customers' },
    { icon: '📝', label: 'จองรถ', labelEn: 'Bookings', path: '/crm/bookings' },
    { icon: '💵', label: 'เงินเดือน', labelEn: 'Payroll', path: '/finance/payroll' },
  ] },
]

describe('multiWindow', () => {
  it('detects new-window clicks', () => {
    expect(wantsNewWindow({ button: 0 })).toBe(false)
    expect(wantsNewWindow({ button: 0, ctrlKey: true })).toBe(true)
    expect(wantsNewWindow({ button: 0, metaKey: true })).toBe(true)
    expect(wantsNewWindow({ button: 1 })).toBe(true)
    expect(wantsNewWindow(null)).toBe(false)
  })
  it('places the new window on the right half of a wide screen', () => {
    const f = windowFeatures({ availWidth: 1920, availHeight: 1040, availLeft: 0, availTop: 0 })
    expect(f).toContain('width=960'); expect(f).toContain('left=960'); expect(f).toContain('height=1040'); expect(f).toContain('noopener')
  })
  it('centres on a small screen and respects a second monitor offset', () => {
    const f = windowFeatures({ availWidth: 1366, availHeight: 728, availLeft: 1920, availTop: 0 })
    expect(f).toContain('width=1161'); expect(f).toContain('left=' + (1920 + Math.floor((1366 - 1161) / 2)))
  })
  it('lists shortcuts the user may open, and searches all menu pages', () => {
    const can = p => p !== '/crm/bookings'
    expect(pickWindowPages(NAV, can).map(p => p.path)).toEqual(['/crm/my-day', '/crm/customers', '/'])
    expect(pickWindowPages(NAV, () => true, 'payroll').map(p => p.path)).toEqual(['/finance/payroll'])
    expect(pickWindowPages(NAV, () => true, 'จอง').map(p => p.path)).toEqual(['/crm/bookings'])
    expect(pickWindowPages(NAV, can, 'จอง')).toEqual([])
  })
  it('titles the window with the page name', () => {
    expect(windowTitle('/crm/bookings', 'LAMOM ONE', NAV)).toBe('จองรถ · LAMOM ONE')
    expect(windowTitle('/unknown', 'LAMOM ONE', NAV)).toBe('LAMOM ONE')
  })
  it('syncs only appearance/language keys across windows', () => {
    expect(syncKeyAction('lamom_mode')).toBe('mode')
    expect(syncKeyAction('lamom_ui')).toBe('ui')
    expect(syncKeyAction('lamom_lang')).toBe('lang')
    expect(syncKeyAction('lamom_sidebar')).toBe(null)
    expect(syncKeyAction('lamom_company_filter')).toBe(null)
  })
  it('hides on phones and in the Android app', () => {
    expect(canUseWindows({ open() {}, innerWidth: 1280 })).toBe(true)
    expect(canUseWindows({ open() {}, innerWidth: 600 })).toBe(false)
    expect(canUseWindows({ open() {}, innerWidth: 1280, Capacitor: { isNativePlatform: () => true } })).toBe(false)
  })
})

describe('session timeout across windows', () => {
  const MIN = 60 * 1000
  it('counts idle time from the most recent activity in any window', () => {
    const now = 100 * MIN
    expect(idleRemaining(now, now - 31 * MIN, 0)).toBeLessThan(0)          // one window, idle → log out
    expect(idleRemaining(now, now - 31 * MIN, now - 2 * MIN)).toBe(28 * MIN) // another window used 2 min ago → stay
  })
})
