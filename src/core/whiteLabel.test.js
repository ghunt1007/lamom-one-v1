import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./db.js', () => ({ listDocs: vi.fn() }))

import { listDocs } from './db.js'
import { getState, setState } from './store.js'
import { safeAssetUrl, applyBrand, applyLayoutDefault, markPostLogin, postLoginRoute, loadWhiteLabel } from './whiteLabel.js'

const iconLink = { href: '/favicon.svg', removeAttribute: vi.fn() }
const mem = new Map()
globalThis.sessionStorage = {
  getItem: k => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: k => mem.delete(k),
}
globalThis.document = { title: 'LAMOM ONE', querySelector: () => iconLink }

beforeEach(() => {
  mem.clear()
  localStorage.clear()
  setState('sidebarCollapsed', false)
  document.title = 'LAMOM ONE'
  iconLink.href = '/favicon.svg'
})

describe('safeAssetUrl', () => {
  it('accepts http(s) URLs and site-relative paths', () => {
    expect(safeAssetUrl('https://cdn.example.com/logo.png')).toBe('https://cdn.example.com/logo.png')
    expect(safeAssetUrl('/logo.png')).toBe('/logo.png')
  })
  it('rejects javascript:, data: and protocol-relative URLs', () => {
    expect(safeAssetUrl('javascript:alert(1)')).toBe('')
    expect(safeAssetUrl('data:image/svg+xml,<svg/>')).toBe('')
    expect(safeAssetUrl('//evil.example.com/x.png')).toBe('')
    expect(safeAssetUrl('')).toBe('')
  })
})

describe('applyBrand', () => {
  it('falls back to the default brand when nothing is configured', () => {
    const b = applyBrand({})
    expect(b.brandName).toBe('LAMOM ONE')
    expect(getState('brand').brandName).toBe('LAMOM ONE')
    expect(document.title).toBe('LAMOM ONE')
  })
  it('applies a custom name, favicon and drops unsafe logo URLs', () => {
    const b = applyBrand({ brandName: 'โชว์รูมบางบัวทอง', favicon: '/my.ico', logoUrl: 'javascript:x' })
    expect(document.title).toBe('โชว์รูมบางบัวทอง')
    expect(iconLink.href).toBe('/my.ico')
    expect(b.logoUrl).toBe('')
  })
  it('ignores a default route that is not an in-app path', () => {
    expect(applyBrand({ defaultRoute: 'https://x.com' }).defaultRoute).toBe('/')
    expect(applyBrand({ defaultRoute: '/crm' }).defaultRoute).toBe('/crm')
  })
})

describe('applyLayoutDefault', () => {
  it('collapses the sidebar for the compact layout when the user has no own preference', () => {
    applyLayoutDefault('sidebar-compact')
    expect(getState('sidebarCollapsed')).toBe(true)
  })
  it("never overrides a user's own sidebar choice", () => {
    localStorage.setItem('lamom_sidebar', 'false')
    applyLayoutDefault('sidebar-compact')
    expect(getState('sidebarCollapsed')).toBe(false)
  })
})

describe('postLoginRoute', () => {
  it('redirects only right after a fresh login that landed on /', () => {
    markPostLogin()
    expect(postLoginRoute({ defaultRoute: '/service' }, '/')).toBe('/service')
    // flag is consumed — a later reload of the dashboard stays put
    expect(postLoginRoute({ defaultRoute: '/service' }, '/')).toBe(null)
  })
  it('does nothing without a fresh login or when the route is the dashboard', () => {
    expect(postLoginRoute({ defaultRoute: '/service' }, '/')).toBe(null)
    markPostLogin()
    expect(postLoginRoute({ defaultRoute: '/' }, '/')).toBe(null)
    markPostLogin()
    expect(postLoginRoute({ defaultRoute: '/crm' }, '/finance')).toBe(null)
  })
})

describe('loadWhiteLabel', () => {
  it('reads the saved settings doc', async () => {
    listDocs.mockResolvedValueOnce([{ brandName: 'ABC Motor', layoutId: 'sidebar-compact' }])
    const b = await loadWhiteLabel()
    expect(b.brandName).toBe('ABC Motor')
    expect(getState('sidebarCollapsed')).toBe(true)
  })
  it('falls back to defaults when Firestore fails', async () => {
    listDocs.mockRejectedValueOnce(new Error('offline'))
    expect((await loadWhiteLabel()).brandName).toBe('LAMOM ONE')
  })
})
