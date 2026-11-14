import { describe, it, expect } from 'vitest'
import { dialNumber, callLink } from './callLink.js'

describe('callLink', () => {
  it('keeps digits and a leading plus', () => {
    expect(dialNumber('081-234 5678')).toBe('0812345678')
    expect(dialNumber('+66 81 234 5678')).toBe('+66812345678')
  })
  it('rejects short or empty numbers', () => {
    expect(dialNumber('1234')).toBe('')
    expect(dialNumber(null)).toBe('')
  })
  it('makes a tel link with an escaped label', () => {
    const h = callLink('081-234-5678', 'A "B" <c>')
    expect(h).toContain('href="tel:0812345678"')
    expect(h).toContain('class="call-pill"')
    expect(h).not.toContain('<c>')
    expect(h).toContain('📞 081-234-5678')
  })
  it('falls back to plain escaped text when not dialable', () => {
    expect(callLink('<b>12')).toBe('📞 &lt;b&gt;12')
    expect(callLink('')).toBe('')
    expect(callLink('0812345678', '', { icon: '' })).toMatch(/>0812345678<\/a>$/)
  })
})

import { mailHref } from './callLink.js'
describe('mailHref', () => {
  it('builds a mailto with encoded subject and body', () => {
    expect(mailHref(' a@b.co ', { subject: 'สวัสดี & ทักทาย', body: 'บรรทัด1\nบรรทัด2' })).toBe('mailto:a@b.co?subject=' + encodeURIComponent('สวัสดี & ทักทาย') + '&body=' + encodeURIComponent('บรรทัด1\nบรรทัด2'))
    expect(mailHref('a@b.co')).toBe('mailto:a@b.co')
  })
  it('rejects non-emails', () => {
    for (const bad of ['', null, 'abc', 'a@b', 'a b@c.d', '"x"@y.z']) expect(mailHref(bad)).toBe('')
  })
})
