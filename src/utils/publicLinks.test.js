import { describe, it, expect } from 'vitest'
import { leadFormUrl, referralUrl, newReferralCode, referralLeadCounts, PUBLIC_ORIGIN, publicOrigin } from './publicLinks.js'

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

describe('publicOrigin', () => {
  it('uses the live site for the Android app, localhost and PR previews', () => {
    expect(publicOrigin({ protocol: 'https:', hostname: 'localhost', origin: 'https://localhost' })).toBe(PUBLIC_ORIGIN)
    expect(publicOrigin({ protocol: 'http:', hostname: 'localhost', origin: 'http://localhost:5173' })).toBe(PUBLIC_ORIGIN)
    expect(publicOrigin({ protocol: 'https:', hostname: 'abc123.lamom-one.pages.dev', origin: 'https://abc123.lamom-one.pages.dev' })).toBe(PUBLIC_ORIGIN)
    expect(publicOrigin(null)).toBe(PUBLIC_ORIGIN)
  })
  it('keeps a real https site (e.g. a future company domain)', () => {
    expect(publicOrigin({ protocol: 'https:', hostname: 'lamom-one.pages.dev', origin: 'https://lamom-one.pages.dev' })).toBe('https://lamom-one.pages.dev')
    expect(publicOrigin({ protocol: 'https:', hostname: 'crm.example.co.th', origin: 'https://crm.example.co.th' })).toBe('https://crm.example.co.th')
  })
})
