// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { isChipRow } from './chipRows.js'

const el = (kids, extra = {}) => ({
  children: kids.map(c => ({ tagName: 'BUTTON', className: 'btn ' + c })),
  classList: { contains: k => (extra.cls || []).includes(k) },
  closest: () => extra.inside || null,
})

describe('isChipRow', () => {
  it('accepts rows of 4+ small buttons', () => {
    expect(isChipRow(el(['btn-sm', 'btn-sm', 'btn-xs', 'btn-sm']))).toBe(true)
  })
  it('skips short rows, big buttons, already-scrolling rows and modals', () => {
    expect(isChipRow(el(['btn-sm', 'btn-sm', 'btn-sm']))).toBe(false)
    expect(isChipRow(el(['btn-sm', 'btn-sm', 'btn-sm', 'btn-primary']))).toBe(false)
    expect(isChipRow(el(['btn-sm', 'btn-sm', 'btn-sm', 'btn-sm'], { cls: ['chip-scroll'] }))).toBe(false)
    expect(isChipRow(el(['btn-sm', 'btn-sm', 'btn-sm', 'btn-sm'], { inside: {} }))).toBe(false)
  })
})
