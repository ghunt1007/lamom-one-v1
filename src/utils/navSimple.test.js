import { describe, it, expect } from 'vitest'
import { buildSimpleNav, recordVisit, readVisits, readNavMode, writeNavMode, countItems, ESSENTIALS } from './navSimple.js'

function fakeLs() {
  const m = {}
  return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v) } }
}
const NAV = [
  { group: 'ภาพรวม', items: [{ path: '/', label: 'Dashboard' }, { path: '/notifications', label: 'Notifications' }] },
  { group: 'การขาย', items: [{ path: '/crm/my-day', label: 'งานของฉันวันนี้' }, { path: '/crm/customers', label: 'ลูกค้า (รวม Lead)' }, { path: '/crm/vip', label: 'VIP Club' }, { path: '/crm/birthdays', label: 'Birthday' }] },
]

describe('buildSimpleNav', () => {
  it('keeps only essentials the user can see, with friendlier labels', () => {
    const g = buildSimpleNav(NAV, {})
    const paths = g.flatMap(x => x.items.map(i => i.path))
    expect(paths).toEqual(['/crm/my-day', '/crm/customers', '/', '/notifications'])
    expect(g[0].items[1].label).toBe('ลูกค้า / Lead')
    expect(g[0].items[1].fullLabel).toBe('ลูกค้า (รวม Lead)')
  })
  it('adds a frequent group from visits, skipping essentials and one-off visits', () => {
    const g = buildSimpleNav(NAV, { '/crm/vip': 5, '/crm/birthdays': 1, '/crm/customers': 50, '/nope': 9 })
    expect(g[0].key).toBe('frequent')
    expect(g[0].items.map(i => i.path)).toEqual(['/crm/vip'])
  })
  it('drops empty groups', () => {
    const g = buildSimpleNav([{ group: 'x', items: [{ path: '/crm/my-day', label: 'a' }] }], {})
    expect(g).toHaveLength(1)
    expect(g[0].key).toBe('sales')
  })
  it('has no duplicate essentials', () => {
    const all = ESSENTIALS.flatMap(e => e.paths)
    expect(new Set(all).size).toBe(all.length)
  })
})

describe('visits + mode', () => {
  it('counts visits and ignores login', () => {
    const ls = fakeLs()
    recordVisit('/crm/vip', ls); recordVisit('/crm/vip', ls); recordVisit('/login', ls)
    expect(readVisits(ls)).toEqual({ '/crm/vip': 2 })
  })
  it('caps stored pages at 60', () => {
    const ls = fakeLs()
    for (let i = 0; i < 80; i++) recordVisit('/p' + i, ls)
    expect(Object.keys(readVisits(ls))).toHaveLength(60)
  })
  it('defaults to simple mode and survives broken storage', () => {
    const ls = fakeLs()
    expect(readNavMode(ls)).toBe('simple')
    writeNavMode('all', ls)
    expect(readNavMode(ls)).toBe('all')
    expect(readNavMode({ getItem: () => { throw new Error('x') } })).toBe('simple')
    expect(readVisits({ getItem: () => '{bad' })).toEqual({})
  })
  it('counts unique menu items', () => {
    expect(countItems(NAV)).toBe(6)
  })
})

import { essentialsFor, ROLE_ESSENTIALS, buildSimpleNav as bsn } from './navSimple.js'
import { NAV as FULL_NAV } from '../data/navMenu.js'
describe('v1.0.1131 role main menus', () => {
  const all = new Set(FULL_NAV.flatMap(g => g.items.map(i => i.path)))
  it('every role menu path exists in the full menu', () => {
    for (const [role, groups] of Object.entries(ROLE_ESSENTIALS)) for (const g of groups) for (const p of g.paths) expect(all.has(p), `${role} ${p}`).toBe(true)
  })
  it('service staff see service work first, sales keep the sales menu', () => {
    const nav = FULL_NAV
    expect(bsn(nav, {}, { role: 'service' })[0].key).toBe('service')
    expect(bsn(nav, {}, { role: 'sales' })[0].key).toBe('sales')
    expect(bsn(nav, {}, { role: 'owner' })[0].key).toBe('boss')
    expect(essentialsFor('unknown')[0].key).toBe('sales')
  })
  it('each role menu stays short (≤ 28 items)', () => {
    for (const role of Object.keys(ROLE_ESSENTIALS)) expect(new Set(essentialsFor(role).flatMap(g => g.paths)).size).toBeLessThanOrEqual(28)
  })
})
