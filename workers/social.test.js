import { describe, it, expect, vi, afterEach } from 'vitest'
import { metaErrorTh, shapeConversations, validatePost, shapeCampaign, validateAdUpdate, lineMessageText, lineThreadId,
  socialStatus, metaPost, metaAdsUpdate, recordLineInbound, lineReply, handleSocial, __resetSocialCache, __resetSocialRate } from './social.js'

afterEach(() => { vi.restoreAllMocks(); __resetSocialCache(); __resetSocialRate() })
const ok = d => ({ ok: true, json: async () => d })

describe('social worker helpers', () => {
  it('translates common Meta errors to Thai', () => {
    expect(metaErrorTh({ code: 190 })).toMatch('หมดอายุ')
    expect(metaErrorTh({ code: 10, error_subcode: 2018278 })).toMatch('สิทธิ์')
    expect(metaErrorTh({ code: 551 })).toMatch('24 ชม.')
  })
  it('shapes conversations oldest-first with the customer as counterpart', () => {
    const c = shapeConversations({ data: [{ id: 't1', updated_time: 'x', unread_count: 2, participants: { data: [{ id: 'P', name: 'Page' }, { id: '99', name: 'ลูกค้า ก' }] },
      messages: { data: [{ id: 'm2', message: 'ตอบ', from: { id: 'P' } }, { id: 'm1', message: 'สนใจ S07', from: { id: '99' } }] } }] }, 'P')
    expect(c[0]).toMatchObject({ withId: '99', withName: 'ลูกค้า ก', unread: 2 })
    expect(c[0].messages.map(m => [m.text, m.mine])).toEqual([['สนใจ S07', false], ['ตอบ', true]])
  })
  it('validates posts', () => {
    expect(validatePost({ pageIds: [], message: 'x' })).toMatch('เลือกเพจ')
    expect(validatePost({ pageIds: ['123'], message: '' })).toMatch('พิมพ์')
    expect(validatePost({ pageIds: ['123'], message: 'x', toInstagram: true })).toMatch('Instagram')
    expect(validatePost({ pageIds: ['123'], message: 'x', imageUrl: 'http://a' })).toMatch('https')
    expect(validatePost({ pageIds: ['123'], message: 'x' })).toBe('')
  })
  it('shapes campaigns (budget from minor units, leads + cost per lead)', () => {
    const c = shapeCampaign({ id: '1', name: 'S07', status: 'ACTIVE', daily_budget: '50000', insights: { data: [{ spend: '1200', actions: [{ action_type: 'lead', value: '3' }, { action_type: 'link_click', value: '40' }] }] } })
    expect(c).toMatchObject({ dailyBudget: 500, spend: 1200, leads: 3, costPerLead: 400 })
  })
  it('validates ad updates', () => {
    expect(validateAdUpdate({ campaignId: 'x', status: 'ACTIVE' })).toMatch('ไม่พบ')
    expect(validateAdUpdate({ campaignId: '123', status: 'DELETED' })).toMatch('สถานะ')
    expect(validateAdUpdate({ campaignId: '123', dailyBudget: 10 })).toMatch('งบ')
    expect(validateAdUpdate({ campaignId: '123', dailyBudget: 500 })).toBe('')
  })
  it('labels LINE message types', () => {
    expect(lineMessageText({ type: 'text', text: 'สวัสดี' })).toBe('สวัสดี')
    expect(lineMessageText({ type: 'sticker' })).toBe('[สติกเกอร์]')
    expect(lineThreadId('U12/ab')).toBe('line_U12ab')
  })
})

describe('social worker endpoints', () => {
  it('status never leaks page tokens', async () => {
    global.fetch = vi.fn().mockResolvedValue(ok({ data: [{ id: '111', name: 'LAMOM', access_token: 'SECRET-PAGE', instagram_business_account: { id: '222', username: 'lamom' } }] }))
    const s = await socialStatus({ META_SYSTEM_USER_TOKEN: 'sys', LINE_CHANNEL_ACCESS_TOKEN: 'l' })
    expect(s.meta.pages[0]).toMatchObject({ id: '111', name: 'LAMOM', ig: { id: '222' } })
    expect(JSON.stringify(s)).not.toContain('SECRET')
    expect(s.line.configured).toBe(true)
    expect(s.google.configured).toBe(false)
  })
  it('reports not configured without a Meta token', async () => {
    global.fetch = vi.fn()
    expect((await socialStatus({})).meta.configured).toBe(false)
    expect(await metaPost({}, { pageIds: ['1'] })).toEqual({ configured: false })
    expect(global.fetch).not.toHaveBeenCalled()
  })
  it('posts to FB with photo and to IG', async () => {
    const calls = []
    global.fetch = vi.fn().mockImplementation(async (url, init) => {
      calls.push([String(url).split('?')[0], init?.body ? JSON.parse(init.body) : null])
      if (String(url).includes('me/accounts')) return ok({ data: [{ id: '111', name: 'P', access_token: 'pt', instagram_business_account: { id: '222' } }] })
      if (String(url).includes('/media_publish')) return ok({ id: 'igpost' })
      if (String(url).includes('/media')) return ok({ id: 'container' })
      return ok({ id: 'photo', post_id: 'fbpost' })
    })
    const r = await metaPost({ META_SYSTEM_USER_TOKEN: 's' }, { pageIds: ['111'], message: 'โปร', imageUrl: 'https://x/y.jpg', toInstagram: true })
    expect(r.results[0]).toMatchObject({ facebook: { ok: true, id: 'fbpost' }, instagram: { ok: true, id: 'igpost' } })
    expect(calls.find(c => c[0].endsWith('111/photos'))[1]).toMatchObject({ url: 'https://x/y.jpg', caption: 'โปร', access_token: 'pt' })
  })
  it('only managers can change ads', async () => {
    global.fetch = vi.fn().mockResolvedValue(ok({ success: true }))
    await expect(metaAdsUpdate({ META_SYSTEM_USER_TOKEN: 's' }, { campaignId: '123', status: 'PAUSED' }, 'sales')).rejects.toThrow('ผู้จัดการ')
    expect(await metaAdsUpdate({ META_SYSTEM_USER_TOKEN: 's' }, { campaignId: '123', dailyBudget: 300 }, 'manager')).toMatchObject({ ok: true })
    expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toMatchObject({ daily_budget: '30000' })
  })
  it('records LINE inbound 1:1 messages only', async () => {
    global.fetch = vi.fn().mockResolvedValue(ok({ displayName: 'คุณเอ' }))
    const env = { FIREBASE_PROJECT_ID: 'p', LINE_CHANNEL_ACCESS_TOKEN: 'l' }
    expect(await recordLineInbound(env, 'fs', { type: 'message', source: { type: 'group', userId: 'U1234567890' }, message: { type: 'text', text: 'x' } })).toBe(false)
    expect(await recordLineInbound(env, 'fs', { type: 'message', source: { type: 'user', userId: 'U1234567890' }, message: { type: 'text', text: 'สนใจรถ' }, timestamp: 1 })).toBe(true)
    const thread = global.fetch.mock.calls.find(c => String(c[0]).includes('social_threads/line_U1234567890'))
    expect(JSON.parse(thread[1].body).fields).toMatchObject({ name: { stringValue: 'คุณเอ' }, unread: { booleanValue: true }, lastText: { stringValue: 'สนใจรถ' } })
  })
  it('LINE reply pushes and logs outbound; rejects bad thread ids', async () => {
    global.fetch = vi.fn().mockResolvedValue(ok({}))
    const env = { FIREBASE_PROJECT_ID: 'p', LINE_CHANNEL_ACCESS_TOKEN: 'l' }
    await expect(lineReply(env, 'fs', { threadId: 'x', text: 'hi' })).rejects.toThrow('ห้องแชต')
    expect(await lineReply(env, 'fs', { threadId: 'line_U1234567890', text: 'สวัสดีครับ' }, 'เอ')).toMatchObject({ sent: true })
    expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toMatchObject({ to: 'U1234567890' })
  })
  it('router: unknown path → null, write rate limit', async () => {
    expect(await handleSocial('/social/nope', {}, {}, {})).toBe(null)
    global.fetch = vi.fn().mockResolvedValue(ok({}))
    const env = { FIREBASE_PROJECT_ID: 'p', LINE_CHANNEL_ACCESS_TOKEN: 'l' }
    for (let i = 0; i < 20; i++) await handleSocial('/social/line/reply', { threadId: 'line_U1234567890', text: 'a' }, env, { uid: 'u' })
    await expect(handleSocial('/social/line/reply', { threadId: 'line_U1234567890', text: 'a' }, env, { uid: 'u' })).rejects.toThrow('ถี่')
  })
})

import { lineChannels, parseLineThread, handleExtraLineWebhook, googlePlaces, shapePlace } from './social.js'
describe('extra LINE OAs + Google Maps (v1.0.977)', () => {
  const env = { LINE_CHANNEL_ACCESS_TOKEN: 'main', FIREBASE_PROJECT_ID: 'p', LINE_EXTRA_CHANNELS: JSON.stringify([{ id: 'showroom', name: 'LINE โชว์รูม', secret: 's1', token: 't1' }, { id: 'BAD ID', secret: 'x', token: 'y' }, { id: 'nosecret', token: 'y' }]) }
  const sign = async (body, secret) => {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body)))
    let b = ''; sig.forEach(x => { b += String.fromCharCode(x) }); return btoa(b)
  }
  it('parses channel config and thread ids', () => {
    expect(lineChannels(env).map(c => c.id)).toEqual(['showroom'])
    expect(lineChannels({ LINE_EXTRA_CHANNELS: 'not json' })).toEqual([])
    expect(lineThreadId('Uabc1234567', 'showroom')).toBe('line_showroom__Uabc1234567')
    expect(parseLineThread('line_showroom__Uabc1234567')).toEqual({ channel: 'showroom', userId: 'Uabc1234567' })
    expect(parseLineThread('line_Uabc1234567')).toEqual({ channel: '', userId: 'Uabc1234567' })
    expect(parseLineThread('line_x')).toBe(null)
  })
  it('extra webhook checks signature and records with the channel token', async () => {
    const body = JSON.stringify({ events: [{ type: 'message', source: { type: 'user', userId: 'Uabc1234567' }, message: { type: 'text', text: 'สนใจ' }, timestamp: 1 }] })
    expect((await handleExtraLineWebhook(env, 'showroom', body, 'bad', async () => 'fs')).status).toBe(401)
    expect((await handleExtraLineWebhook(env, 'nope', body, 'bad', async () => 'fs')).status).toBe(404)
    const f = globalThis.fetch = vi.fn().mockResolvedValue(ok({ displayName: 'ลูกค้า' }))
    const r = await handleExtraLineWebhook(env, 'showroom', body, await sign(body, 's1'), async () => 'fs')
    expect(r).toEqual({ status: 200, body: { ok: true, saved: 1 } })
    expect(f.mock.calls[0][1].headers.Authorization).toBe('Bearer t1')
    expect(f.mock.calls.some(c => String(c[0]).includes('social_threads/line_showroom__Uabc1234567'))).toBe(true)
  })
  it('replies through the right OA', async () => {
    const f = globalThis.fetch = vi.fn().mockResolvedValue(ok({}))
    await lineReply(env, null, { threadId: 'line_showroom__Uabc1234567', text: 'สวัสดีครับ' })
    expect(f.mock.calls[0][1].headers.Authorization).toBe('Bearer t1')
    expect(JSON.parse(f.mock.calls[0][1].body).to).toBe('Uabc1234567')
    await lineReply(env, null, { threadId: 'line_Uabc1234567', text: 'x' })
    expect(f.mock.calls[1][1].headers.Authorization).toBe('Bearer main')
    expect(await lineReply({ ...env, LINE_EXTRA_CHANNELS: '' }, null, { threadId: 'line_showroom__Uabc1234567', text: 'x' })).toEqual({ configured: false })
  })
  it('google places: not configured, shapes and caches', async () => {
    expect(await googlePlaces({}, { query: 'โชว์รูม' })).toEqual({ configured: false, places: [] })
    const f = globalThis.fetch = vi.fn().mockResolvedValue(ok({ places: [{ id: 'a', displayName: { text: 'โชว์รูม' }, rating: 4.6, userRatingCount: 120, reviews: [{ rating: 5, text: { text: 'ดีมาก' }, authorAttribution: { displayName: 'ก' } }] }] }))
    const r = await googlePlaces({ GOOGLE_MAPS_API_KEY: 'k' }, { query: 'โชว์รูม' })
    expect(r.places[0]).toMatchObject({ name: 'โชว์รูม', rating: 4.6, reviews: 120 })
    expect(r.places[0].latest[0]).toMatchObject({ rating: 5, text: 'ดีมาก', author: 'ก' })
    await googlePlaces({ GOOGLE_MAPS_API_KEY: 'k' }, { query: 'โชว์รูม' })
    expect(f).toHaveBeenCalledTimes(1)
    expect(shapePlace({}).rating).toBe(null)
    await expect(googlePlaces({ GOOGLE_MAPS_API_KEY: 'k' }, { query: 'a' })).rejects.toThrow('2 ตัวอักษร')
  })
})

describe('LINE multicast to a customer segment (v1.0.1023)', () => {
  it('only managers/marketing; dedupes, validates ids and splits into 500s', async () => {
    const { lineMulticast } = await import('./social.js')
    const env = { LINE_CHANNEL_ACCESS_TOKEN: 'l' }
    await expect(lineMulticast(env, { userIds: ['U1234567890'], text: 'hi' }, 'sales')).rejects.toThrow('เฉพาะ')
    expect(await lineMulticast({}, { userIds: ['U1234567890'], text: 'hi' }, 'owner')).toMatchObject({ configured: false })
    await expect(lineMulticast(env, { userIds: ['bad'], text: 'hi' }, 'owner')).rejects.toThrow('ไม่มีลูกค้า')
    global.fetch = vi.fn().mockResolvedValue(ok({}))
    const ids = Array.from({ length: 600 }, (_, i) => 'U' + String(i).padStart(12, '0'))
    const r = await lineMulticast(env, { userIds: [...ids, ids[0], 'x'], text: 'โปรเดือนนี้' }, 'marketing')
    expect(r).toMatchObject({ configured: true, sent: 600, failed: 0 })
    expect(global.fetch).toHaveBeenCalledTimes(2)
    expect(JSON.parse(global.fetch.mock.calls[0][1].body).to).toHaveLength(500)
  })
  it('reports quota errors per chunk', async () => {
    const { lineMulticast } = await import('./social.js')
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 429, json: async () => ({ message: 'You have reached your monthly limit.' }) })
    const r = await lineMulticast({ LINE_CHANNEL_ACCESS_TOKEN: 'l' }, { userIds: ['U1234567890'], text: 'x' }, 'manager')
    expect(r).toMatchObject({ sent: 0, failed: 1, errors: ['โควตาข้อความ LINE OA เดือนนี้หมดแล้ว'] })
  })
})

describe('LINE broadcast via social worker (v1.0.1025)', () => {
  it('managers only; posts to broadcast endpoint', async () => {
    const { lineBroadcast } = await import('./social.js')
    const env = { LINE_CHANNEL_ACCESS_TOKEN: 'l' }
    await expect(lineBroadcast(env, { text: 'x' }, 'sales')).rejects.toThrow('เฉพาะ')
    await expect(lineBroadcast(env, { text: ' ' }, 'owner')).rejects.toThrow('พิมพ์')
    global.fetch = vi.fn().mockResolvedValue(ok({}))
    expect(await lineBroadcast(env, { text: 'โปร' }, 'owner')).toMatchObject({ configured: true, broadcast: true })
    expect(global.fetch.mock.calls[0][0]).toContain('/broadcast')
  })
})

describe('v1.0.1135 /social/ai/test role gate', () => {
  it('blocks sales staff and lets managers see the no-key answer', async () => {
    const { handleSocial: hs } = await import('./social.js')
    await expect(hs('/social/ai/test', { text: 'สวัสดี' }, {}, { uid: 'g1', role: 'sales' })).rejects.toThrow('เฉพาะ')
    expect(await hs('/social/ai/test', { text: 'สวัสดี' }, {}, { uid: 'g2', role: 'manager' })).toEqual({ ok: false, reason: 'nokey' })
  })
})
