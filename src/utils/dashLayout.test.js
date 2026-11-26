import { describe, it, expect } from 'vitest'
import { DASH_SECTIONS, normalizeLayout, loadDashLayout, saveDashLayout, moveSection } from './dashLayout.js'

const mem = () => { const m = {}; return { getItem: k => m[k] ?? null, setItem: (k, v) => { m[k] = v } } }

describe('dashLayout', () => {
  it('defaults to every section in default order, none hidden', () => {
    const l = normalizeLayout(null)
    expect(l.order).toEqual(DASH_SECTIONS.map(([k]) => k))
    expect(l.hidden).toEqual([])
  })
  it('drops unknown keys and inserts missing ones after their default neighbour', () => {
    const l = normalizeLayout({ order: ['radar', 'bogus', 'hero', 'radar'], hidden: ['x', 'main'] })
    expect(l.order[0]).toBe('radar')
    expect(l.order[l.order.indexOf('hero') + 1]).toBe('status')
    const old = normalizeLayout({ order: DASH_SECTIONS.map(([k]) => k).filter(k => k !== 'status').reverse() })
    expect(old.order[old.order.indexOf('hero') + 1]).toBe('status')
    expect(l.order).toHaveLength(DASH_SECTIONS.length)
    expect(l.hidden).toEqual(['main'])
  })
  it('round-trips through storage and survives bad JSON', () => {
    const s = mem()
    saveDashLayout({ order: ['main'], hidden: ['radar'] }, s)
    expect(loadDashLayout(s).order[0]).toBe('main')
    s.setItem('lamom_dash_layout', '{bad')
    expect(loadDashLayout(s).order[0]).toBe('hero')
  })
  it('moveSection swaps neighbours and ignores edges', () => {
    const l = normalizeLayout(null)
    expect(moveSection(l, 'status', -1).order.slice(0, 2)).toEqual(['status', 'hero'])
    expect(moveSection(l, 'hero', -1)).toBe(l)
  })
})
