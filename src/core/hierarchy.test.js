import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockState = { user: null, role: null }
vi.mock('./store.js', () => ({
  getState: key => mockState[key],
}))

let mockStaffList = []
vi.mock('./db.js', () => ({
  listDocs: vi.fn(async () => mockStaffList),
}))

const { normName, isProgramOwner, getVisibilityScope, scopeIncludesStaff, PROGRAM_OWNER_EMAIL } = await import('./hierarchy.js')

function staff(overrides) {
  return { firstName: '', lastName: '', managerId: null, deleted: false, ...overrides }
}

describe('normName', () => {
  it('trims, lowercases, and collapses whitespace', () => {
    expect(normName('  Somchai   Deedee  ')).toBe('somchai deedee')
  })
  it('handles empty/undefined input', () => {
    expect(normName(undefined)).toBe('')
    expect(normName(null)).toBe('')
  })
})

describe('isProgramOwner', () => {
  beforeEach(() => { mockState.user = null })

  it('is true only for the exact program-owner email', () => {
    mockState.user = { email: PROGRAM_OWNER_EMAIL }
    expect(isProgramOwner()).toBe(true)
  })
  it('is case-insensitive on email match', () => {
    mockState.user = { email: PROGRAM_OWNER_EMAIL.toUpperCase() }
    expect(isProgramOwner()).toBe(true)
  })
  it('is false for any other account, including role=owner', () => {
    mockState.user = { email: 'somchai@lamom.one' }
    mockState.role = 'owner'
    expect(isProgramOwner()).toBe(false)
  })
  it('is false when not signed in', () => {
    mockState.user = null
    expect(isProgramOwner()).toBe(false)
  })
})

describe('getVisibilityScope', () => {
  beforeEach(() => {
    mockState.user = null
    mockState.role = null
    mockStaffList = []
  })

  it('program owner gets unrestricted scope regardless of role/company', () => {
    mockState.user = { email: PROGRAM_OWNER_EMAIL, uid: 'u1' }
    mockState.role = 'sales'
    return getVisibilityScope().then(scope => {
      expect(scope.unrestricted).toBe(true)
    })
  })

  it('admin role gets company-only scope (no hierarchy restriction)', async () => {
    mockState.user = { uid: 'u-admin' }
    mockState.role = 'admin'
    mockStaffList = [staff({ id: 's-admin', uid: 'u-admin', companyIds: ['c1'] })]
    const scope = await getVisibilityScope()
    expect(scope.companyOnly).toBe(true)
    expect(scope.companyIds).toEqual(['c1'])
    expect(scope.unrestricted).toBeUndefined()
  })

  it('groupWide staff (not admin/owner) sees every company, no hierarchy restriction', async () => {
    mockState.user = { uid: 'u-hr', displayName: 'HR Person', groupWide: true, companyIds: ['c1'] }
    mockState.role = 'staff'
    mockStaffList = [
      staff({ id: 's-hr', uid: 'u-hr', companyIds: ['c1'] }),
      staff({ id: 's-other-company', companyIds: ['c2'] }),
    ]
    const scope = await getVisibilityScope()
    expect(scope.unrestricted).toBeUndefined()
    expect(scope.companyOnly).toBe(true)
    expect(scope.companyIds).toEqual([])
    expect(scopeIncludesStaff(scope, mockStaffList[0])).toBe(true)
    expect(scopeIncludesStaff(scope, mockStaffList[1])).toBe(true)
  })

  it('groupWide:false staff (plain default) is not affected — falls through to hierarchy scope', async () => {
    mockState.user = { uid: 'u-plain', displayName: 'Plain Staff', groupWide: false }
    mockState.role = 'staff'
    mockStaffList = [staff({ id: 's-plain', uid: 'u-plain', companyIds: ['c1'] })]
    const scope = await getVisibilityScope()
    expect(scope.companyOnly).toBeUndefined()
    expect(scope.staffIds).toBeDefined()
  })

  it('owner role (not program owner) gets company-only scope like admin', async () => {
    mockState.user = { email: 'somsak@lamom.one', uid: 'u-owner2' }
    mockState.role = 'owner'
    mockStaffList = [staff({ id: 's-owner2', uid: 'u-owner2', companyIds: ['c2'] })]
    const scope = await getVisibilityScope()
    expect(scope.unrestricted).toBeUndefined()
    expect(scope.companyOnly).toBe(true)
    expect(scope.companyIds).toEqual(['c2'])
  })

  it('manager sees self + transitive subordinates only, within own company', async () => {
    mockState.user = { uid: 'u-mgr', displayName: 'Manager One' }
    mockState.role = 'manager'
    mockStaffList = [
      staff({ id: 'mgr', uid: 'u-mgr', firstName: 'Manager', lastName: 'One', companyIds: ['c1'] }),
      staff({ id: 'child1', firstName: 'Child', lastName: 'One', managerId: 'mgr', companyIds: ['c1'] }),
      staff({ id: 'grandchild1', firstName: 'Grandchild', lastName: 'One', managerId: 'child1', companyIds: ['c1'] }),
      staff({ id: 'unrelated', firstName: 'Unrelated', lastName: 'Person', companyIds: ['c1'] }),
      staff({ id: 'boss', firstName: 'Boss', lastName: 'Person', companyIds: ['c1'] }),
    ]
    // แต่งให้ mgr มีหัวหน้าของตัวเอง (boss) — ต้องไม่เห็น boss เลย (เห็นคนสูงกว่าไม่ได้)
    mockStaffList[0].managerId = 'boss'
    const scope = await getVisibilityScope()
    expect(scope.hasSubordinates).toBe(true)
    expect(scope.staffIds.has('mgr')).toBe(true)
    expect(scope.staffIds.has('child1')).toBe(true)
    expect(scope.staffIds.has('grandchild1')).toBe(true)
    expect(scope.staffIds.has('unrelated')).toBe(false)
    expect(scope.staffIds.has('boss')).toBe(false)
  })

  it('staff with no linked account gets a name-only scope with hasSubordinates false', async () => {
    mockState.user = { uid: 'u-unknown', displayName: 'Ghost User' }
    mockState.role = 'staff'
    mockStaffList = []
    const scope = await getVisibilityScope()
    expect(scope.hasSubordinates).toBe(false)
    expect(scope.names.has('ghost user')).toBe(true)
  })
})

describe('scopeIncludesStaff', () => {
  it('unrestricted scope sees everyone', () => {
    expect(scopeIncludesStaff({ unrestricted: true }, staff({ id: 'x' }))).toBe(true)
  })

  it('companyOnly scope sees anyone sharing a company id', () => {
    const scope = { companyOnly: true, companyIds: ['c1'] }
    expect(scopeIncludesStaff(scope, staff({ id: 'a', companyIds: ['c1'] }))).toBe(true)
    expect(scopeIncludesStaff(scope, staff({ id: 'b', companyIds: ['c2'] }))).toBe(false)
  })

  it('hierarchy scope requires both same company and staffIds membership', () => {
    const scope = { companyIds: ['c1'], staffIds: new Set(['a', 'b']) }
    expect(scopeIncludesStaff(scope, staff({ id: 'a', companyIds: ['c1'] }))).toBe(true)
    expect(scopeIncludesStaff(scope, staff({ id: 'c', companyIds: ['c1'] }))).toBe(false)
    expect(scopeIncludesStaff(scope, staff({ id: 'b', companyIds: ['c2'] }))).toBe(false)
  })

  it('treats a staff member with no companyIds as visible to any single-company scope (unassigned, not excluded)', () => {
    const scope = { companyOnly: true, companyIds: ['c1'] }
    expect(scopeIncludesStaff(scope, staff({ id: 'x' }))).toBe(true)
  })
})
