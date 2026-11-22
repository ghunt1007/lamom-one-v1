import { describe, it, expect, vi } from 'vitest'
vi.mock('./print.js', () => ({
  docHeader: t => `<h>${t}</h>`, docFooter: () => '<f>',
  esc: s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
}))
import { templateDocHtml } from './templateDoc.js'

describe('templateDocHtml', () => {
  it('fills values, escapes, blanks empty fields', () => {
    const h = templateDocHtml({ name: 'ใบรับรถ', fields: ['ชื่อ', 'รุ่น<b>'] }, ['<x>', ''])
    expect(h).toContain('<h>ใบรับรถ</h>')
    expect(h).toContain('&lt;x&gt;')
    expect(h).toContain('รุ่น&lt;b&gt;')
    expect(h).toContain('.....')
    expect(h).not.toContain('<x>')
  })
  it('handles missing fields', () => {
    expect(templateDocHtml({}, [])).toContain('<tbody></tbody>')
  })
})
