import { describe, it, expect } from 'vitest'
import { escHtml } from './escape.js'
import { safeInlineHtml } from './modal.js'

describe('escHtml', () => {
  it('escapes tags and quotes', () => {
    expect(escHtml('<img src=x onerror="a">\'')).toBe('&lt;img src=x onerror=&quot;a&quot;&gt;&#39;')
    expect(escHtml(null)).toBe('')
    expect(escHtml(0)).toBe('0')
  })
})

describe('safeInlineHtml (confirm dialogs)', () => {
  it('keeps simple bold/br, blocks other tags and attributes', () => {
    expect(safeInlineHtml('ลบ <strong>3 ราย</strong><br>')).toBe('ลบ <strong>3 ราย</strong><br>')
    expect(safeInlineHtml('<img src=x onerror=alert(1)>')).toBe('&lt;img src=x onerror=alert(1)>')
    expect(safeInlineHtml('<strong onmouseover=x>')).toBe('&lt;strong onmouseover=x>')
    expect(safeInlineHtml('<script>')).toBe('&lt;script>')
  })
  it('leaves already-escaped text alone', () => {
    expect(safeInlineHtml('A &amp; B &lt;x&gt;')).toBe('A &amp; B &lt;x&gt;')
  })
})
