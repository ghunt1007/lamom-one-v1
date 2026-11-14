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

import { phoneFromText, fillPhoneFromChat } from './leadIntake.js'
describe('v1.0.1139 phone from chat', () => {
  it('finds Thai mobile numbers in free text', () => {
    expect(phoneFromText('สนใจครับ เบอร์ 081-234-5678 สมชาย')).toBe('0812345678')
    expect(phoneFromText('โทร 0912345678 ได้เลย')).toBe('0912345678')
    expect(phoneFromText('+66 81 234 5678')).toBe('0812345678')
    expect(phoneFromText('06 1234 5678')).toBe('0612345678')
    expect(phoneFromText('เบอร์ 0812345678 0898765432')).toBe('0812345678')
    for (const t of ['ราคา 1,234,567 บาท', 'ดาวน์ 0 บาท ผ่อน 84 งวด', 'เลขบัญชี 12081234567890', '02-123-4567', '']) expect(phoneFromText(t), t).toBe('')
  })
  const env = { FIREBASE_PROJECT_ID: 'p' }
  const fake = (doc) => {
    const calls = []
    const f = async (url, init = {}) => {
      calls.push({ url, method: init.method || 'GET', body: init.body })
      if (url.endsWith(':runQuery')) return { ok: true, json: async () => (doc ? [{ document: doc }] : [{}]) }
      return { ok: true, json: async () => ({}) }
    }
    return { f, calls }
  }
  it('fills the phone of the linked customer and leaves a note', async () => {
    const { f, calls } = fake({ name: 'projects/p/databases/(default)/documents/customers/c1', fields: { phone: { stringValue: '' } } })
    const r = await fillPhoneFromChat(env, 't', { field: 'lineUserId', value: 'U1', text: 'เบอร์ 0812345678 ค่ะ', channelLabel: 'LINE OA' }, f)
    expect(r).toEqual({ id: 'c1', phone: '0812345678', filled: true })
    const patch = calls.find(c => c.method === 'PATCH')
    expect(patch.url).toContain('customers/c1?updateMask.fieldPaths=phone')
    expect(JSON.parse(patch.body).fields.phone.stringValue).toBe('0812345678')
    expect(calls.some(c => c.url.endsWith('/customer_notes') && c.method === 'POST')).toBe(true)
  })
  it('never overwrites an existing phone and ignores unlinked chats', async () => {
    const a = fake({ name: 'x/customers/c2', fields: { phone: { stringValue: '0899999999' } } })
    expect((await fillPhoneFromChat(env, 't', { field: 'lineUserId', value: 'U2', text: '0812345678' }, a.f)).skipped).toBe('hasPhone')
    expect(a.calls.some(c => c.method === 'PATCH')).toBe(false)
    const b = fake(null)
    expect(await fillPhoneFromChat(env, 't', { field: 'lineUserId', value: 'U3', text: '0812345678' }, b.f)).toBe(null)
    expect(await fillPhoneFromChat(env, 't', { field: 'lineUserId', value: 'U3', text: 'สวัสดี' }, b.f)).toBe(null)
  })
})

import { handleLeadForm, formRateOk, accountLeadInfo, __resetFormHits, cleanTestDrive } from './leadIntake.js'
import { beforeEach } from 'vitest'
describe('v1.0.1140 public lead form', () => {
  beforeEach(() => { __resetInboxCache(); __resetFormHits() })
  const env = { FIREBASE_PROJECT_ID: 'p' }
  const req = (body, ip = '1.1.1.1') => new Request('https://w/lead/form', { method: 'POST', headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip }, body: typeof body === 'string' ? body : JSON.stringify(body) })
  const world = ({ on = true, account = null, dup = false } = {}) => {
    const calls = []
    const f = async (url, init = {}) => {
      calls.push({ url, method: init.method || 'GET', body: init.body })
      if (url.includes('system_integrations/inbox_auto')) return { ok: true, json: async () => ({ fields: { publicForm: { booleanValue: on } } }) }
      if (url.includes('/social_channels/')) return account ? { ok: true, json: async () => account } : { ok: false, status: 404, json: async () => ({}) }
      if (url.endsWith(':runQuery')) return { ok: true, json: async () => (dup ? [{ document: { name: 'x/customers/old1', fields: {} } }] : [{}]) }
      if (url.includes('/customers') && init.method === 'POST') return { ok: true, status: 200, json: async () => ({ name: 'x/customers/new1' }) }
      return { ok: true, json: async () => ({}) }
    }
    return { f, calls }
  }
  const created = calls => { const c = calls.find(x => /\/customers(\?|$)/.test(x.url) && x.method === 'POST'); return c ? JSON.parse(c.body).fields : null }

  it('creates a lead tied to the social account, assigned to a sales-level owner', async () => {
    const w = world({ account: { name: 'x/social_channels/acc1', fields: { platform: { stringValue: 'tiktok' }, level: { stringValue: 'sales' }, owner: { stringValue: 'เซลส์ หนึ่ง' }, name: { stringValue: 'TikTok พี่หนึ่ง' }, companyId: { stringValue: 'co1' } } } })
    const r = await handleLeadForm(req({ name: 'สมชาย ใจดี', phone: '081-234-5678', model: 'S07', note: 'ขอใบเสนอราคา', a: 'acc1' }), env, async () => 't', { fetch: w.f })
    expect(r).toEqual({ status: 200, body: { ok: true } })
    const f = created(w.calls)
    expect(f.firstName.stringValue).toBe('สมชาย'); expect(f.lastName.stringValue).toBe('ใจดี')
    expect(f.phone.stringValue).toBe('0812345678'); expect(f.source.stringValue).toBe('tiktok')
    expect(f.assignedTo.stringValue).toBe('เซลส์ หนึ่ง'); expect(f.sourceAccountId.stringValue).toBe('acc1')
    expect(f.companyId.stringValue).toBe('co1'); expect(f.sourceAccountLevel.stringValue).toBe('sales')
  })
  // (v1.0.1145) ขอนัดทดลองขับจากฟอร์ม
  const NOW = Date.parse('2026-11-14T08:00:00Z') // 15:00 เวลาไทย
  it('a test-drive request books the shared test-drive table, notes the lead and alerts', async () => {
    const w = world()
    const told = []
    const r = await handleLeadForm(req({ name: 'สมชาย ใจดี', phone: '0812345678', model: 'S07', note: 'โทรช่วงเย็น', td: true, tdDate: '2026-11-20', tdTime: '10:00' }), env, async () => 't', { fetch: w.f, now: NOW, onLead: async (l, res) => told.push([l.note, res.id]) })
    expect(r.status).toBe(200)
    expect(created(w.calls).notes.stringValue).toContain('ขอนัดทดลองขับ 20/11/2026 10:00')
    const td = w.calls.find(x => x.url.endsWith('/test_drives') && x.method === 'POST')
    const f = JSON.parse(td.body).fields
    expect(f).toMatchObject({ date: { stringValue: '2026-11-20' }, time: { stringValue: '10:00' }, status: { stringValue: 'scheduled' }, customerId: { stringValue: 'new1' }, phone: { stringValue: '0812345678' }, model: { stringValue: 'S07' } })
    expect(told).toEqual([['ขอนัดทดลองขับ 20/11/2026 10:00 · โทรช่วงเย็น', 'new1']])
  })
  it('without the tick no test drive is booked; a bad date is refused before anything is saved', async () => {
    const w = world()
    await handleLeadForm(req({ name: 'มานี', phone: '0912345678', tdDate: '2026-11-20', tdTime: '10:00' }), env, async () => 't', { fetch: w.f, now: NOW })
    expect(w.calls.some(x => x.url.endsWith('/test_drives'))).toBe(false)
    const w2 = world()
    const r = await handleLeadForm(req({ name: 'มานี', phone: '0912345678', td: true, tdDate: '2026-11-13', tdTime: '10:00' }), env, async () => 't', { fetch: w2.f, now: NOW })
    expect(r.status).toBe(400); expect(w2.calls.length).toBe(0)
  })
  it('cleanTestDrive accepts today in Thai time and rejects the past, far future, odd hours and nonsense', () => {
    expect(cleanTestDrive({}, NOW)).toBe(null)
    expect(cleanTestDrive({ td: true, tdDate: '2026-11-14', tdTime: '16:00' }, NOW)).toEqual({ date: '2026-11-14', time: '16:00', label: '14/11/2026 16:00' })
    // 18:30 UTC ของวันที่ 14 = 01:30 เวลาไทยของวันที่ 15 → วันที่ 14 ถือว่าผ่านไปแล้ว
    expect(cleanTestDrive({ td: true, tdDate: '2026-11-14', tdTime: '10:00' }, Date.parse('2026-11-14T18:30:00Z')).error).toContain('ผ่านไปแล้ว')
    expect(cleanTestDrive({ td: true, tdDate: '2027-03-01', tdTime: '10:00' }, NOW).error).toContain('60 วัน')
    expect(cleanTestDrive({ td: true, tdDate: '2026-11-20', tdTime: '22:00' }, NOW).error).toContain('08:00')
    expect(cleanTestDrive({ td: true, tdDate: '2026-02-31', tdTime: '10:00' }, NOW).error).toBeTruthy()
    expect(cleanTestDrive({ td: true, tdDate: '', tdTime: '' }, NOW).error).toBeTruthy()
  })
  it('team accounts and unknown accounts do not assign anyone', async () => {
    expect(accountLeadInfo({ name: 'x/social_channels/a', fields: { platform: { stringValue: 'facebook' }, level: { stringValue: 'team' }, owner: { stringValue: 'แอดมิน' } } }).assignedTo).toBe('')
    expect(accountLeadInfo({ name: 'x/a', fields: { deleted: { booleanValue: true } } })).toBe(null)
    const w = world()
    await handleLeadForm(req({ name: 'มานี', phone: '0912345678', a: 'nope' }), env, async () => 't', { fetch: w.f })
    const f = created(w.calls)
    expect(f.source.stringValue).toBe('website'); expect(f.assignedTo.stringValue).toBe(''); expect(f.sourceAccountId).toBeUndefined()
  })
  it('is closed unless the owner switched it on', async () => {
    const w = world({ on: false })
    const r = await handleLeadForm(req({ name: 'มานี', phone: '0912345678' }), env, async () => 't', { fetch: w.f })
    expect(r.status).toBe(403); expect(created(w.calls)).toBe(null)
  })
  it('rejects bad input, traps bots, and never reveals duplicates', async () => {
    const w = world()
    expect((await handleLeadForm(req({ name: 'ก', phone: '0912345678' }), env, async () => 't', { fetch: w.f })).status).toBe(400)
    expect((await handleLeadForm(req({ name: 'มานี', phone: '02-123-4567' }), env, async () => 't', { fetch: w.f })).status).toBe(400)
    expect((await handleLeadForm(req('not json'), env, async () => 't', { fetch: w.f })).status).toBe(400)
    expect((await handleLeadForm(req('x'.repeat(6000)), env, async () => 't', { fetch: w.f })).status).toBe(413)
    expect(await handleLeadForm(req({ name: 'bot', phone: '0912345678', website: 'http://spam' }), env, async () => 't', { fetch: w.f })).toEqual({ status: 200, body: { ok: true } })
    expect(w.calls.length).toBe(0)
    const d = world({ dup: true })
    expect(await handleLeadForm(req({ name: '<b>มานี</b>', phone: '0912345678' }), env, async () => 't', { fetch: d.f })).toEqual({ status: 200, body: { ok: true } })
    expect(created(d.calls)).toBe(null)
    expect(d.calls.some(c => c.url.endsWith('/customer_notes'))).toBe(true)
  })
  it('limits submissions per IP', async () => {
    for (let i = 0; i < 5; i++) expect(formRateOk('9.9.9.9', 1000 + i)).toBe(true)
    expect(formRateOk('9.9.9.9', 2000)).toBe(false)
    expect(formRateOk('8.8.8.8', 2000)).toBe(true)
    expect(formRateOk('9.9.9.9', 1000 + 11 * 60_000)).toBe(true)
    const w = world()
    const r = await handleLeadForm(req({ name: 'มานี', phone: '0912345678' }, '9.9.9.9'), env, async () => 't', { fetch: w.f, now: 1000 + 11 * 60_000 + 5 })
    expect(r.status).toBe(200)
  })
})
