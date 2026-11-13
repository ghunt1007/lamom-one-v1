import { describe, it, expect } from 'vitest'
import { parseLeadPayload, normPhone, normSource, buildLeadFields, handleLeadWebhook, metaEvents, metaThreadId, verifyMetaSig, metaVerifyChallenge, handleMetaWebhook } from './leadIntake.js'
import { __resetInboxCache } from './inboxAuto.js'

async function sign(body, secret) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body)))
  return 'sha256=' + [...sig].map(b => b.toString(16).padStart(2, '0')).join('')
}

describe('lead parsing', () => {
  it('phones and sources', () => {
    expect(normPhone('+66 81-234-5678')).toBe('0812345678')
    expect(normPhone('66812345678')).toBe('0812345678')
    expect(normPhone('081 234 5678')).toBe('0812345678')
    expect(normPhone('12345')).toBe('')
    expect(normSource('TikTok Lead')).toBe('tiktok')
    expect(normSource('fb')).toBe('facebook')
    expect(normSource('gmail')).toBe('email')
    expect(normSource('xyz')).toBe('other')
  })
  it('reads flat, Facebook field_data and TikTok-style payloads', () => {
    expect(parseLeadPayload({ name: 'สมชาย ใจดี', phone: '0812345678', model: 'S07' }, { source: 'tiktok' })).toMatchObject({ first: 'สมชาย', last: 'ใจดี', phone: '0812345678', model: 'S07', source: 'tiktok' })
    expect(parseLeadPayload({ fields: [{ name: 'full_name', values: ['Somsri K'] }, { name: 'phone_number', values: ['+66891112222'] }, { name: 'email', values: ['A@B.co'] }] })).toMatchObject({ first: 'Somsri', last: 'K', phone: '0891112222', email: 'a@b.co' })
    expect(parseLeadPayload({ lead: { user_info: [{ field_name: 'Phone', field_value: '0899999999' }, { field_name: 'Name', field_value: 'Ton' }] } })).toMatchObject({ first: 'Ton', phone: '0899999999' })
    expect(parseLeadPayload({ 'ชื่อ': 'แดง', 'เบอร์โทร': '0811111111', 'รุ่นที่สนใจ': 'Seal' }).model).toBe('Seal')
  })
  it('builds a customer with source, tags and account', () => {
    const f = buildLeadFields({ first: 'A', last: '', phone: '0812345678', email: '', lineId: '', model: 'S07', note: 'ขอราคา', source: 'tiktok', account: 'acc1' }, { now: '2026-11-14T00:00:00.000Z' })
    expect(f.source.stringValue).toBe('tiktok')
    expect(f.stage.stringValue).toBe('pp')
    expect(f.sourceAccountId.stringValue).toBe('acc1')
    expect(f.tags.arrayValue.values.map(v => v.stringValue)).toContain('TikTok')
    expect(f.notes.stringValue).toContain('สนใจ S07')
    expect(f.createdAt.timestampValue).toBe('2026-11-14T00:00:00.000Z')
  })
})

describe('lead webhook', () => {
  const env = { FIREBASE_PROJECT_ID: 'p', LEAD_WEBHOOK_KEY: 'k123' }
  const req = (body, q = 'key=k123&source=tiktok') => new Request(`https://w/lead/webhook?${q}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  it('rejects wrong key and empty payloads', async () => {
    expect((await handleLeadWebhook(req({ name: 'x' }, 'key=bad'), env, async () => 't')).status).toBe(401)
    expect((await handleLeadWebhook(req({ foo: 1 }), env, async () => 't')).status).toBe(400)
    expect((await handleLeadWebhook(req({ name: 'x' }), { FIREBASE_PROJECT_ID: 'p' }, async () => 't')).status).toBe(503)
  })
  it('creates a new customer, and a note instead of a duplicate', async () => {
    const calls = []
    let dup = false
    const fetch = async (url, init = {}) => {
      calls.push([String(url), init.method])
      if (String(url).endsWith(':runQuery')) return { ok: true, json: async () => (dup ? [{ document: { name: 'x/customers/c9' } }] : [{}]) }
      if (String(url).includes('/customers')) return { ok: true, status: 200, json: async () => ({ name: 'x/customers/new1' }) }
      if (String(url).includes('/customer_notes')) return { ok: true, json: async () => ({}) }
      return { ok: false }
    }
    const r = await handleLeadWebhook(req({ name: 'สมชาย', phone: '0812345678' }), env, async () => 't', { fetch })
    expect(r.body).toMatchObject({ ok: true, created: true, id: 'new1' })
    dup = true
    const r2 = await handleLeadWebhook(req({ name: 'สมชาย', phone: '081-234-5678' }), env, async () => 't', { fetch })
    expect(r2.body).toMatchObject({ ok: true, created: false, duplicate: true, id: 'c9' })
    expect(calls.some(c => c[0].includes('/customer_notes'))).toBe(true)
  })
})

describe('meta webhook', () => {
  it('verify challenge', () => {
    expect(metaVerifyChallenge(new URL('https://w/meta/webhook?hub.mode=subscribe&hub.verify_token=abc&hub.challenge=42'), { META_VERIFY_TOKEN: 'abc' })).toBe('42')
    expect(metaVerifyChallenge(new URL('https://w/meta/webhook?hub.mode=subscribe&hub.verify_token=no&hub.challenge=42'), { META_VERIFY_TOKEN: 'abc' })).toBe(null)
  })
  it('parses messages, echoes and leadgen', () => {
    const ev = metaEvents({ object: 'page', entry: [{ id: '111', messaging: [{ sender: { id: '999' }, recipient: { id: '111' }, timestamp: 1, message: { mid: 'm1', text: 'สนใจครับ' } }, { sender: { id: '111' }, recipient: { id: '999' }, message: { is_echo: true, text: 'ตอบแล้ว' } }], changes: [{ field: 'leadgen', value: { leadgen_id: '555', page_id: '111' } }] }] })
    expect(ev.map(e => e.kind)).toEqual(['message', 'echo', 'leadgen'])
    expect(ev[0]).toMatchObject({ pageId: '111', userId: '999', platform: 'messenger', isText: true })
    expect(ev[1]).toMatchObject({ pageId: '111', userId: '999' })
    expect(metaThreadId('instagram', '111', '999')).toBe('ig_111__999')
  })
  it('signature check', async () => {
    const body = '{"a":1}'
    expect(await verifyMetaSig(body, await sign(body, 's'), 's')).toBe(true)
    expect(await verifyMetaSig(body, await sign(body, 'x'), 's')).toBe(false)
  })
  it('stores a Messenger chat, creates a lead and lets AI answer', async () => {
    __resetInboxCache()
    const state = { writes: [] }
    const fetch = async (url, init = {}) => {
      const u = String(url)
      const ok = b => ({ ok: true, status: 200, json: async () => b })
      if (u.includes('inbox_auto')) return ok({ name: 'x/inbox_auto', fields: { aiReply: { booleanValue: true }, autoLead: { booleanValue: true } } })
      if (u.startsWith('https://graph.facebook.com') && u.includes('/999?')) return ok({ name: 'Khun B' })
      if (u.includes('/me/messages')) { state.sent = JSON.parse(init.body); return ok({}) }
      if (u.includes('generativelanguage')) return ok({ candidates: [{ content: { parts: [{ text: 'สวัสดีค่ะ ขอเบอร์โทรได้ไหมคะ' }] } }] })
      if (u.endsWith(':runQuery')) return ok(String(init.body).includes('social_messages') ? [{ document: { name: 'x/m', fields: { direction: { stringValue: 'in' }, text: { stringValue: 'สนใจครับ' } } } }] : [])
      if (u.includes('/social_threads/') && !init.method) return ok({ name: 'x', fields: {} })
      if (u.includes('/sales_programs')) return ok({ documents: [] })
      state.writes.push([u.split('/documents/')[1]?.split('?')[0], init.method])
      return ok({ name: 'x/customers/fb_999' })
    }
    const body = JSON.stringify({ object: 'page', entry: [{ id: '111', messaging: [{ sender: { id: '999' }, recipient: { id: '111' }, timestamp: 1763000000000, message: { mid: 'm1', text: 'สนใจครับ' } }] }] })
    const req = new Request('https://w/meta/webhook', { method: 'POST', headers: { 'X-Hub-Signature-256': await sign(body, 'sec') }, body })
    const r = await handleMetaWebhook(req, { FIREBASE_PROJECT_ID: 'p', META_APP_SECRET: 'sec', GEMINI_API_KEY: 'g' }, async () => 't', { fetch, pages: async () => [{ id: '111', name: 'เพจทีม', token: 'pt', ig: null }] })
    expect(r.body).toMatchObject({ ok: true, saved: 1, leads: 1 })
    expect(state.writes.some(w => w[0] === 'customers')).toBe(true)
    expect(state.writes.some(w => w[0]?.startsWith('social_threads/fb_111__999'))).toBe(true)
    expect(state.sent.recipient.id).toBe('999')
    expect(state.sent.message.text).toContain('ขอเบอร์โทร')
  })
  it('rejects a bad signature', async () => {
    const req = new Request('https://w/meta/webhook', { method: 'POST', headers: { 'X-Hub-Signature-256': 'sha256=00' }, body: '{}' })
    expect((await handleMetaWebhook(req, { META_APP_SECRET: 'sec' }, async () => 't')).status).toBe(401)
  })
})
