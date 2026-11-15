import { describe, it, expect } from 'vitest'
import { leadFormUrl, referralUrl, newReferralCode, referralLeadCounts, referralStats, PUBLIC_ORIGIN, publicOrigin } from './publicLinks.js'

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

describe('referralStats', () => {
  it('counts leads, bookings and deliveries per code', () => {
    const r = referralStats([{ referralCode: 'R1', stage: 'pp' }, { referralCode: 'R1', stage: 'booking' }, { referralCode: 'r1', stage: 'delivered' }, { referralCode: 'R1', stage: 'delivered', deleted: true }])
    expect(r).toEqual({ R1: { leads: 3, booked: 2, sold: 1 } })
  })
})

describe('UTM helpers', async () => {
  const { withUtm, utmLeadCounts, utmKey } = await import('./publicLinks.js')
  it('adds utm params, keeping an existing query', () => {
    expect(withUtm('https://lamom-one.pages.dev/lead.html?m=S07', { source: 'facebook', medium: 'paid', campaign: 'nov promo' }))
      .toBe('https://lamom-one.pages.dev/lead.html?m=S07&utm_source=facebook&utm_medium=paid&utm_campaign=nov+promo')
  })
  it('counts leads per source+campaign, case-insensitive', () => {
    const r = utmLeadCounts([{ utmSource: 'Facebook', utmCampaign: 'NOV' }, { utmSource: 'facebook', utmCampaign: 'nov' }, { utmSource: 'line', utmCampaign: 'nov', deleted: true }, {}])
    expect(r).toEqual({ [utmKey('facebook', 'nov')]: 2 })
  })
})
