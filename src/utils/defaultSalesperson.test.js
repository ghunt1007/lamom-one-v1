import { describe, it, expect } from 'vitest'
import { isMyName, defaultSalesperson } from './defaultSalesperson.js'

describe('defaultSalesperson', () => {
  const opts = ['สมชาย ใจดี', 'บี', 'ยังไม่ระบุ']
  it('picks my own name (full or first word)', () => {
    expect(defaultSalesperson(opts, 'สมชาย ใจดี').selected).toBe('สมชาย ใจดี')
    expect(defaultSalesperson(opts, 'สมชาย').selected).toBe('สมชาย ใจดี')
  })
  it('adds me on top when missing, keeps list when unknown', () => {
    expect(defaultSalesperson(opts, 'ซี')).toEqual({ options: ['ซี', ...opts], selected: 'ซี' })
    expect(defaultSalesperson(opts, '')).toEqual({ options: opts, selected: '' })
    expect(defaultSalesperson(opts, 'เจ้าของ', { addIfMissing: false })).toEqual({ options: opts, selected: '' })
  })
})

describe('salesOptionsHtml', async () => {
  const { salesOptionsHtml } = await import('./defaultSalesperson.js')
  const staff = ['สมชาย ใจดี', 'บี']
  it('keeps the record value even if not in the staff list', () => {
    const h = salesOptionsHtml(staff, { current: 'คนเก่า', me: 'บี' })
    expect(h.startsWith('<option value="คนเก่า" selected>')).toBe(true)
  })
  it('defaults to me by first name', () => {
    expect(salesOptionsHtml(staff, { me: 'สมชาย' })).toContain('<option value="สมชาย ใจดี" selected>')
  })
  it('blank option and escaping', () => {
    const h = salesOptionsHtml(['a"b'], { blank: true })
    expect(h).toBe('<option value="">-</option><option value="a&quot;b">a&quot;b</option>')
  })
})

describe('isMyName', () => {
  it('matches full name ignoring prefix/space/case', () => {
    expect(isMyName('คุณสมชาย  ใจดี', 'สมชาย ใจดี')).toBe(true)
    expect(isMyName('Somchai', 'somchai jaidee')).toBe(true)
  })
  it('does not match different surnames or empty', () => {
    expect(isMyName('สมชาย ก', 'สมชาย ข')).toBe(false)
    expect(isMyName('', 'สมชาย')).toBe(false)
    expect(isMyName('สมหญิง', 'สมชาย')).toBe(false)
  })
})
