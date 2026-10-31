import { describe, it, expect } from 'vitest'
import { normalizeUi, loadUi, saveUi, applyUi, resolveMode, UI_DEFAULTS } from './appearance.js'

const mem = () => { const m = {}; return { getItem: k => m[k] ?? null, setItem: (k, v) => { m[k] = v } } }
const fakeRoot = () => {
  const props = {}, attrs = {}
  return { props, attrs, style: { fontSize: '', setProperty: (k, v) => { props[k] = v }, removeProperty: k => { delete props[k] } }, setAttribute: (k, v) => { attrs[k] = v } }
}

describe('appearance', () => {
  it('normalizeUi keeps known values only', () => {
    expect(normalizeUi({ font: 'lg', radius: 'zzz', density: 'compact', effects: 'off', x: 1 }))
      .toEqual({ font: 'lg', radius: 'md', density: 'compact', effects: 'off' })
    expect(normalizeUi(null)).toEqual(UI_DEFAULTS)
  })
  it('round-trips through storage and survives bad JSON', () => {
    const s = mem()
    saveUi({ font: 'xl' }, s)
    expect(loadUi(s).font).toBe('xl')
    s.setItem('lamom_ui', '{oops')
    expect(loadUi(s)).toEqual(UI_DEFAULTS)
  })
  it('applyUi sets font size, radius vars and attributes; defaults clear overrides', () => {
    const r = fakeRoot()
    applyUi({ font: 'lg', radius: 'lg', density: 'compact', effects: 'off' }, r)
    expect(r.style.fontSize).toBe('16.5px')
    expect(r.props['--radius-lg']).toBe('22px')
    expect(r.attrs).toEqual({ 'data-density': 'compact', 'data-effects': 'off' })
    applyUi({}, r)
    expect(r.style.fontSize).toBe('')
    expect(r.props['--radius-lg']).toBeUndefined()
  })
  it('resolveMode follows the device only for auto', () => {
    expect(resolveMode('light', true)).toBe('light')
    expect(resolveMode('auto', false)).toBe('light')
    expect(resolveMode('auto', true)).toBe('dark')
    expect(resolveMode(undefined, undefined)).toBe('dark')
  })
})
