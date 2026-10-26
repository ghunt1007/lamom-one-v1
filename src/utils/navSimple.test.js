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
