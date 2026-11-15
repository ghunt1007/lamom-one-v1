import { describe, it, expect } from 'vitest'
import { leadFormUrl, referralUrl, newReferralCode, referralLeadCounts, PUBLIC_ORIGIN } from './publicLinks.js'

describe('public links', () => {
  it('points to the real site, never lamom.app', () => {
    expect(referralUrl('R7K2PQ')).toBe(`${PUBLIC_ORIGIN}/lead.html?ref=R7K2PQ`)
    expect(leadFormUrl()).toBe(`${PUBLIC_ORIGIN}/lead.html`)
    expect(leadFormUrl({ model: 'Deepal S07' })).toBe(`${PUBLIC_ORIGIN}/lead.html?m=Deepal+S07`)
    expect(referralUrl('สมชา001')).toContain('ref=%E0%B8')
  })
  it('makes readable ascii referral codes', () => {
    expect(newReferralCode(() => 0)).toBe('RAAAAA'); expect(newReferralCode()).toMatch(/^R[A-Z2-9]{5}$/)
  })
  it('counts leads per referral code, ignoring deleted', () => {
    expect(referralLeadCounts([{ referralCode: 'r1' }, { referralCode: 'R1' }, { referralCode: 'R2', deleted: true }, {}])).toEqual({ R1: 2 })
  })
})
