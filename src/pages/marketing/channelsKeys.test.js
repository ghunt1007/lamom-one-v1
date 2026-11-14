import { describe, it, expect, vi } from 'vitest'
vi.mock('../../core/store.js', () => ({ showToast: vi.fn() }))
vi.mock('../../core/hierarchy.js', () => ({ isProgramOwner: () => true }))
vi.mock('../../utils/socialApi.js', () => ({ secretsCall: vi.fn(), WORKER_URL: 'https://w.example' }))
vi.mock('../../utils/modal.js', () => ({ confirmDialog: vi.fn() }))
import { nextStep, looksLikeKey, hookUrls } from './channelsKeys.js'

const on = (...ks) => Object.fromEntries(ks.map(k => [k, { set: true }]))

describe('nextStep', () => {
  it('starts with the AI key', () => expect(nextStep({}).key).toBe('GEMINI_API_KEY'))
  it('then the lead code', () => expect(nextStep(on('GEMINI_API_KEY')).key).toBe('LEAD_WEBHOOK_KEY'))
  it('then Meta as optional when none of the three is set', () => {
    const n = nextStep(on('GEMINI_API_KEY', 'LEAD_WEBHOOK_KEY'))
    expect(n.key).toBe('META_VERIFY_TOKEN'); expect(n.text).toContain('ข้ามได้')
  })
  it('counts missing Meta fields when partly done', () => {
    const n = nextStep(on('GEMINI_API_KEY', 'LEAD_WEBHOOK_KEY', 'META_VERIFY_TOKEN'))
    expect(n.key).toBe('META_SYSTEM_USER_TOKEN'); expect(n.text).toContain('2')
  })
  it('is null when everything is set', () => expect(nextStep(on('GEMINI_API_KEY', 'LEAD_WEBHOOK_KEY', 'META_SYSTEM_USER_TOKEN', 'META_APP_SECRET', 'META_VERIFY_TOKEN'))).toBeNull())
  it('survives a missing status', () => expect(nextStep(undefined).key).toBe('GEMINI_API_KEY'))
})

describe('looksLikeKey', () => {
  it('accepts a key-shaped value', () => expect(looksLikeKey(' abcdefghijklmnop1234 ')).toBe(true))
  it('rejects sentences, short text, multi-line and empty', () => {
    expect(looksLikeKey('สวัสดีครับ สนใจรถรุ่นนี้')).toBe(false)
    expect(looksLikeKey('abc')).toBe(false)
    expect(looksLikeKey('abcdefghijklmnop\nqrstuvwxyz')).toBe(false)
    expect(looksLikeKey('')).toBe(false)
    expect(looksLikeKey('x'.repeat(601))).toBe(false)
  })
})

describe('hookUrls', () => {
  it('builds lead links with the code', () => expect(hookUrls('LEAD_WEBHOOK_KEY', 'K')[0][1]).toBe('https://w.example/lead/webhook?key=K&source=tiktok'))
})
