import { describe, it, expect } from 'vitest'
import { optedOutPhones, splitByConsent, phoneKey } from './marketingOptOut.js'

describe('marketingOptOut', () => {
  it('collects only customers who said no, normalising +66', () => {
    const s = optedOutPhones([
      { phone: '+66 81 234 5678', marketingConsent: 'no' },
      { phone: '0899999999', marketingConsent: 'yes' },
      { phone: '0811111111', marketingConsent: 'no', deleted: true },
      { phone: '', marketingConsent: 'no' },
    ])
    expect([...s]).toEqual(['0812345678'])
  })
  it('splits rows by phone', () => {
    const { keep, skipped } = splitByConsent([{ phone: '081-234-5678' }, { phone: '0899999999' }], new Set(['0812345678']))
    expect(keep).toEqual([{ phone: '0899999999' }])
    expect(skipped.length).toBe(1)
    expect(phoneKey('66812345678')).toBe('0812345678')
  })
})

import { lineContacts } from './marketingOptOut.js'
describe('lineContacts', () => {
  it('maps phone to linked LINE uid, skipping opted-out/blocked/no-consent', () => {
    const m = lineContacts([
      { phone: '081-111-1111', lineUserId: 'U0123456789abcdef' },
      { phone: '0822222222', lineUserId: 'U1111111111aaaaaa', lineOptOut: true },
      { phone: '0833333333', lineUserId: 'U2222222222bbbbbb', lineBlockedAt: '2026-11-01' },
      { phone: '0844444444', lineUserId: 'U3333333333cccccc', marketingConsent: 'no' },
      { phone: '0855555555', lineUserId: 'not-a-uid' },
      { phone: '0866666666', lineUserId: 'U4444444444dddddd', deleted: true },
    ])
    expect([...m.entries()]).toEqual([['0811111111', 'U0123456789abcdef']])
  })
})
