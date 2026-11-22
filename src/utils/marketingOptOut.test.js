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
