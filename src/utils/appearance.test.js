import { describe, it, expect } from 'vitest'
import { normalizeUi, loadUi, saveUi, applyUi, resolveMode, wallImage, UI_DEFAULTS } from './appearance.js'
import { WALLPAPERS } from '../data/wallpapers.js'

const mem = () => { const m = {}; return { getItem: k => m[k] ?? null, setItem: (k, v) => { m[k] = v } } }
const fakeRoot = () => {
  const props = {}, attrs = {}
  return { props, attrs, style: { fontSize: '', setProperty: (k, v) => { props[k] = v }, removeProperty: k => { delete props[k] } }, setAttribute: (k, v) => { attrs[k] = v } }
}

describe('appearance', () => {
  it('normalizeUi keeps known values only', () => {
    expect(normalizeUi({ font: 'lg', radius: 'zzz', density: 'compact', effects: 'off', x: 1 }))
      .toMatchObject({ font: 'lg', radius: 'md', density: 'compact', effects: 'off', wall: 'none' })
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
    expect(r.attrs).toEqual({ 'data-density': 'compact', 'data-effects': 'off', 'data-fx3d': 'off' })
    expect(r.props['--wall-dim']).toBe('40%')
    applyUi({}, r)
    expect(r.style.fontSize).toBe('')
    expect(r.props['--radius-lg']).toBeUndefined()
  })
  it('wallpaper and 3D settings: known ids only, custom needs a stored image', () => {
    expect(normalizeUi({ wall: 'sunset', wallDim: 'dim', fx3d: 'on' })).toMatchObject({ wall: 'sunset', wallDim: 'dim', fx3d: 'on' })
    expect(normalizeUi({ wall: 'nope', fx3d: 'maybe' })).toMatchObject({ wall: 'none', fx3d: 'off' })
    expect(wallImage('sunset')).toMatch(/^url\("data:image\/svg\+xml/)
    expect(wallImage('none')).toBe('')
    const s = mem()
    expect(wallImage('custom', s)).toBe('')
    s.setItem('lamom_wall_img', 'data:image/jpeg;base64,AAA')
    expect(wallImage('custom', s)).toBe('url("data:image/jpeg;base64,AAA")')
  })
  it('every wallpaper renders valid-looking SVG', () => {
    for (const w of WALLPAPERS) {
      const out = w.make()
      expect(out.startsWith('<svg')).toBe(true)
      expect(out).not.toMatch(/NaN|undefined/)
    }
  })
  it('resolveMode follows the device only for auto', () => {
    expect(resolveMode('light', true)).toBe('light')
    expect(resolveMode('auto', false)).toBe('light')
    expect(resolveMode('auto', true)).toBe('dark')
    expect(resolveMode(undefined, undefined)).toBe('dark')
  })
})
