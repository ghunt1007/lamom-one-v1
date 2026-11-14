import { describe, it, expect } from 'vitest'
import { GO_LIVE_STEPS, REVIEW_NOTES, goLiveHtml } from './channelsGoLive.js'

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')

describe('go-live guide', () => {
  it('has four ordered steps, each with an https link', () => {
    expect(GO_LIVE_STEPS.map(s => s.n)).toEqual([1, 2, 3, 4])
    for (const s of GO_LIVE_STEPS) expect(s.url).toMatch(/^https:\/\//)
  })
  it('covers the permissions the webhook and inbox need', () => {
    const perms = REVIEW_NOTES.map(r => r.perm)
    for (const p of ['pages_messaging', 'instagram_manage_messages', 'leads_retrieval', 'pages_manage_metadata']) expect(perms).toContain(p)
    for (const r of REVIEW_NOTES) expect(r.text.length).toBeGreaterThan(60)
  })
  it('renders copy buttons and the icon download from the given origin', () => {
    const h = goLiveHtml(esc, 'https://app.example/')
    expect(h).toContain('href="https://app.example/meta-app-icon.png"')
    expect((h.match(/data-key-copy=/g) || []).length).toBe(REVIEW_NOTES.length)
    expect(h).not.toContain('undefined')
  })
})
