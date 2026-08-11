import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./db.js', () => ({ listDocs: vi.fn() }))

import { listDocs } from './db.js'
import {
  getModuleForPath, hasModuleAccess, loadRolePermissions, invalidateRolePermissionsCache,
} from './permissions.js'

describe('getModuleForPath', () => {
  it('matches a path exactly equal to a module prefix', () => {
    expect(getModuleForPath('/crm')?.key).toBe('sales')
  })

  it('matches a path nested under a module prefix', () => {
    expect(getModuleForPath('/crm/customers')?.key).toBe('sales')
  })

  it('matches whichever module lists the prefix, across multiple prefixes for one module', () => {
    expect(getModuleForPath('/training/courses')?.key).toBe('hr')
    expect(getModuleForPath('/gamification/leaderboard')?.key).toBe('hr')
  })

  it('does not match a path that merely starts with the prefix string without a slash boundary', () => {
    // '/crmfake' should NOT be treated as under '/crm' — regression guard for the
    // startsWith(p + '/') boundary check in the real implementation.
    expect(getModuleForPath('/crmfake')).toBeNull()
  })

  it('returns null for a path not covered by any module (e.g. the dashboard)', () => {
    expect(getModuleForPath('/dashboard')).toBeNull()
    expect(getModuleForPath('/notifications')).toBeNull()
  })
})

describe('hasModuleAccess', () => {
  beforeEach(() => {
    invalidateRolePermissionsCache()
    vi.clearAllMocks()
  })

  it('always allows ungated paths (no moduleKey)', () => {
    expect(hasModuleAccess('staff', null)).toBe(true)
  })

  it('fails open when there is no role info yet', () => {
    expect(hasModuleAccess(null, 'finance')).toBe(true)
  })

  it('fails open when permissions have not been loaded yet (cache is cold)', () => {
    expect(hasModuleAccess('staff', 'finance')).toBe(true)
  })

  it('grants access when the loaded role config includes the module', async () => {
    listDocs.mockResolvedValue([{ id: 'staff', modules: ['sales', 'finance'] }])
    await loadRolePermissions()
    expect(hasModuleAccess('staff', 'finance')).toBe(true)
  })

  it('denies access when the loaded role config does not include the module', async () => {
    listDocs.mockResolvedValue([{ id: 'staff', modules: ['sales'] }])
    await loadRolePermissions()
    expect(hasModuleAccess('staff', 'finance')).toBe(false)
  })

  it('grants access to every module for a role with the wildcard "*"', async () => {
    listDocs.mockResolvedValue([{ id: 'owner', modules: ['*'] }])
    await loadRolePermissions()
    expect(hasModuleAccess('owner', 'finance')).toBe(true)
    expect(hasModuleAccess('owner', 'settings')).toBe(true)
  })

  it('defaults to full access for a role with no configured restriction at all', async () => {
    listDocs.mockResolvedValue([{ id: 'staff', modules: ['sales'] }])
    await loadRolePermissions()
    expect(hasModuleAccess('some_unconfigured_role', 'finance')).toBe(true)
  })
})

describe('loadRolePermissions caching', () => {
  beforeEach(() => {
    invalidateRolePermissionsCache()
    vi.clearAllMocks()
  })

  it('only fetches once across repeated calls until invalidated', async () => {
    listDocs.mockResolvedValue([{ id: 'staff', modules: ['sales'] }])
    await loadRolePermissions()
    await loadRolePermissions()
    await loadRolePermissions()
    expect(listDocs).toHaveBeenCalledTimes(1)
  })

  it('re-fetches when force=true even if already cached', async () => {
    listDocs.mockResolvedValue([{ id: 'staff', modules: ['sales'] }])
    await loadRolePermissions()
    await loadRolePermissions(true)
    expect(listDocs).toHaveBeenCalledTimes(2)
  })

  it('re-fetches after invalidateRolePermissionsCache()', async () => {
    listDocs.mockResolvedValue([{ id: 'staff', modules: ['sales'] }])
    await loadRolePermissions()
    invalidateRolePermissionsCache()
    await loadRolePermissions()
    expect(listDocs).toHaveBeenCalledTimes(2)
  })

  it('falls back to an empty permission set (fail-open via hasModuleAccess) if the fetch throws', async () => {
    listDocs.mockRejectedValue(new Error('network error'))
    const result = await loadRolePermissions()
    expect(result).toEqual({})
  })
})
