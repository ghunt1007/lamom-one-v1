import { describe, it, expect } from 'vitest'
import { lineUidFor, viaSummary } from './customerSend.js'

const prefs = { optedOut: new Set(), line: new Map([['0811111111', 'U0123456789abcdef']]) }
describe('customerSend', () => {
  it('finds LINE uid by phone in any format', () => {
    expect(lineUidFor('081-111-1111', prefs)).toBe('U0123456789abcdef')
    expect(lineUidFor('0822222222', prefs)).toBe(null)
    expect(lineUidFor('', prefs)).toBe(null)
  })
  it('summarises LINE vs SMS', () => {
    expect(viaSummary([{ phone: '0811111111' }, { phone: '0822222222' }, { phone: '0833333333' }], prefs)).toBe('LINE 1 ราย · SMS 2 ราย')
    expect(viaSummary([{ phone: '0822222222' }], prefs)).toBe('SMS 1 ราย')
  })
})
