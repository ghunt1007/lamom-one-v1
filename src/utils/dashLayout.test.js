import { describe, it, expect } from 'vitest'
import { DASH_SECTIONS, normalizeLayout, loadDashLayout, saveDashLayout, moveSection } from './dashLayout.js'

const mem = () => { const m = {}; return { getItem: k => m[k] ?? null, setItem: (k, v) => { m[k] = v } } }

describe('dashLayout', () => {
  it('defaults to every section in default order, none hidden', () => {
    const l = normalizeLayout(null)
    expect(l.order).toEqual(DASH_SECTIONS.map(([k]) => k))
    expect(l.hidden).toEqual([])
  })
  it('drops unknown keys and appends missing ones', () => {
    const l = normalizeLayout({ order: ['radar', 'bogus', 'hero', 'radar'], hidden: ['x', 'main'] })
    expect(l.order.slice(0, 2)).toEqual(['radar', 'hero'])
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
    expect(moveSection(l, 'briefing', -1).order.slice(0, 2)).toEqual(['briefing', 'hero'])
    expect(moveSection(l, 'hero', -1)).toBe(l)
  })
})
