import { describe, it, expect, vi } from 'vitest'
vi.mock('../core/db.js', () => ({ createDoc: vi.fn() }))
vi.mock('../core/firebase.js', () => ({ auth: {} }))
import { teamNotifyPlan, deptRoles } from './teamNotify.js'

describe('teamNotifyPlan', () => {
  it('drops my own uid, blanks and duplicates', () => {
    const p = teamNotifyPlan({ uids: ['me', 'a', 'a', '', undefined], names: [' สมชาย ', '', null], roles: ['finance', 'owner', 'finance'] }, 'me')
    expect(p.direct).toEqual(['a'])
    expect(p.names).toEqual(['สมชาย'])
    expect(p.roles).toEqual(['finance'])
    expect(p.callWorker).toBe(true)
  })
  it('only calls the worker when there are roles or names', () => {
    expect(teamNotifyPlan({ uids: ['a'] }, 'me').callWorker).toBe(false)
    expect(teamNotifyPlan({}, 'me').callWorker).toBe(false)
  })
})

describe('deptRoles', () => {
  it('maps task departments to user roles', () => {
    expect(deptRoles('finance')).toEqual(['finance'])
    expect(deptRoles('sales')).toEqual(['sales'])
    expect(deptRoles('marketing')).toEqual([])
    expect(deptRoles('general')).toEqual([])
  })
})
