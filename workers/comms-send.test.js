import { describe, it, expect, vi, afterEach } from 'vitest'
import { generateKeyPairSync } from 'node:crypto'
import worker, { __resetRateLimit } from './comms-send.js'

const BASE_ENV = { FIREBASE_API_KEY: 'fake-public-key', FIREBASE_PROJECT_ID: 'fake-project', ALLOWED_ORIGIN: 'https://lamom-one.pages.dev' }

function req(path, body, { auth = 'Bearer valid' } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (auth) headers.Authorization = auth
  return new Request(`https://worker.example${path}`, { method: 'POST', headers, body: JSON.stringify(body) })
}

// staffRole defaults to 'sales' (a valid staff role) so existing "valid auth" tests keep passing
// once the worker also checks the caller's Firestore role, not just that the token verifies.
function stubFetch(routes, staffRole = 'sales') {
  global.fetch = vi.fn().mockImplementation((url, opts) => {
    const u = String(url)
    if (u.includes('identitytoolkit.googleapis.com')) {
      return Promise.resolve({ ok: true, json: async () => ({ users: [{ localId: 'staff-uid' }] }) })
    }
    if (u.includes('firestore.googleapis.com')) {
      return Promise.resolve({ ok: true, json: async () => ({ fields: { role: { stringValue: staffRole } } }) })
    }
    for (const [match, handler] of routes) {
      if (u.includes(match)) return Promise.resolve(handler(url, opts))
    }
    throw new Error('Unexpected fetch to ' + u)
  })
}

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); __resetRateLimit() })

describe('comms-send worker — CORS + auth gate', () => {
  it('responds to OPTIONS with the configured ALLOWED_ORIGIN', async () => {
    const res = await worker.fetch(new Request('https://worker.example/send/sms', { method: 'OPTIONS' }), BASE_ENV)
    expect(res.status).toBe(200)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://lamom-one.pages.dev')
  })

  it('rejects non-POST/OPTIONS methods', async () => {
    const res = await worker.fetch(new Request('https://worker.example/send/sms', { method: 'GET' }), BASE_ENV)
    expect(res.status).toBe(404)
  })

  it('rejects a request with no Authorization header before touching any provider', async () => {
    stubFetch([])
    const res = await worker.fetch(req('/send/sms', { recipients: ['+66812345678'], message: 'hi' }, { auth: '' }), BASE_ENV)
    expect(res.status).toBe(401)
  })

  it('rejects an invalid Firebase token', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) })
    const res = await worker.fetch(req('/send/sms', { recipients: [], message: 'hi' }), BASE_ENV)
    expect(res.status).toBe(401)
  })

  it('returns 404 for an unknown route even with valid auth', async () => {
    stubFetch([])
    const res = await worker.fetch(req('/send/carrier-pigeon', {}), BASE_ENV)
    expect(res.status).toBe(404)
  })

  it('rejects a valid but unapproved ("pending") account before touching any provider (v1.0.287)', async () => {
    stubFetch([], 'pending')
    const res = await worker.fetch(req('/send/sms', { recipients: ['+66812345678'], message: 'hi' }), BASE_ENV)
    expect(res.status).toBe(403)
  })
})

describe('comms-send worker — abuse/rate-limit guards (v1.0.288)', () => {
  it('rejects a single call with an absurdly large recipients array', async () => {
    stubFetch([['api.twilio.com', () => ({ ok: true, json: async () => ({}) })]])
    const hugeList = Array.from({ length: 3001 }, (_, i) => `+66${i}`)
    const res = await worker.fetch(req('/send/sms', { recipients: hugeList, message: 'hi' }), BASE_ENV)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/จำนวนผู้รับเกินขีดจำกัด/)
  })

  it('rate-limits repeated calls from the same account within the same minute', async () => {
    stubFetch([['api.twilio.com', () => ({ ok: true, json: async () => ({}) })]])
    let lastStatus = 200
    for (let i = 0; i < 6; i++) {
      const res = await worker.fetch(req('/send/sms', { recipients: ['+66812345678'], message: 'hi' }), { ...BASE_ENV, TWILIO_ACCOUNT_SID: 'x', TWILIO_AUTH_TOKEN: 'y', TWILIO_FROM_NUMBER: '+1' })
      lastStatus = res.status
    }
    expect(lastStatus).toBe(429)
  })
})

describe('comms-send worker — /send/sms (Twilio)', () => {
  const ENV = { ...BASE_ENV, TWILIO_ACCOUNT_SID: 'ACfake', TWILIO_AUTH_TOKEN: 'tokfake', TWILIO_FROM_NUMBER: '+15017122661' }

  it('reports not configured (rather than pretending to send) when Twilio secrets are missing', async () => {
    stubFetch([])
    const res = await worker.fetch(req('/send/sms', { recipients: ['+66812345678'], message: 'hi' }), BASE_ENV)
    const data = await res.json()
    expect(data.configured).toBe(false)
    expect(data.error).toMatch(/ยังไม่ได้ตั้งค่า/)
  })

  it('never calls Twilio when there are zero recipients', async () => {
    stubFetch([])
    const res = await worker.fetch(req('/send/sms', { recipients: [], message: 'hi' }), ENV)
    const data = await res.json()
    expect(data).toEqual({ configured: true, sent: 0, failed: 0, errors: [] })
    expect(global.fetch.mock.calls.some(c => String(c[0]).includes('twilio.com'))).toBe(false)
  })

  it('sends real per-recipient requests to Twilio and counts real success/failure (not random)', async () => {
    stubFetch([
      ['twilio.com', (url, opts) => {
        const body = new URLSearchParams(opts.body)
        const ok = body.get('To') !== '+66800000000'
        return { ok, status: ok ? 201 : 400, json: async () => (ok ? { sid: 'SMfake' } : { message: 'invalid number' }) }
      }],
    ])
    const res = await worker.fetch(req('/send/sms', { recipients: ['+66811111111', '+66800000000'], message: 'hi' }), ENV)
    const data = await res.json()
    expect(data).toEqual({ configured: true, sent: 1, failed: 1, errors: [{ target: '+66800000000', error: 'invalid number' }] })
  })

  it('authenticates to Twilio with Basic auth built from the secret SID/token, never exposing them in the body', async () => {
    stubFetch([['twilio.com', () => ({ ok: true, status: 201, json: async () => ({}) })]])
    await worker.fetch(req('/send/sms', { recipients: ['+66811111111'], message: 'hi' }), ENV)
    const call = global.fetch.mock.calls.find(c => String(c[0]).includes('twilio.com'))
    expect(call[1].headers.Authorization).toMatch(/^Basic /)
    expect(call[1].body.toString()).not.toContain('tokfake')
  })
})

describe('comms-send worker — /send/email (SendGrid)', () => {
  const ENV = { ...BASE_ENV, SENDGRID_API_KEY: 'SG.fake', SENDGRID_FROM_EMAIL: 'noreply@lamom.one' }

  it('reports not configured when SendGrid secrets are missing', async () => {
    stubFetch([])
    const res = await worker.fetch(req('/send/email', { recipients: ['a@b.com'], subject: 's', message: 'm' }), BASE_ENV)
    const data = await res.json()
    expect(data.configured).toBe(false)
  })

  it('sends real requests and relays per-recipient failure reasons from SendGrid', async () => {
    stubFetch([
      ['sendgrid.com', (url, opts) => {
        const body = JSON.parse(opts.body)
        const to = body.personalizations[0].to[0].email
        const ok = to !== 'bad@bad.com'
        return { ok, status: ok ? 202 : 400, json: async () => (ok ? {} : { errors: [{ message: 'invalid recipient' }] }) }
      }],
    ])
    const res = await worker.fetch(req('/send/email', { recipients: ['good@a.com', 'bad@bad.com'], subject: 'Promo', message: 'Hello' }), ENV)
    const data = await res.json()
    expect(data.sent).toBe(1)
    expect(data.failed).toBe(1)
    expect(data.errors[0].error).toBe('invalid recipient')
  })

  it('never leaks SENDGRID_API_KEY in the response', async () => {
    stubFetch([['sendgrid.com', () => ({ ok: false, status: 500, json: async () => ({ errors: [{ message: 'upstream' }] }) })]])
    const res = await worker.fetch(req('/send/email', { recipients: ['a@b.com'], subject: 's', message: 'm' }), ENV)
    const text = await res.text()
    expect(text).not.toContain(ENV.SENDGRID_API_KEY)
  })
})

describe('comms-send worker — /send/line (Messaging API broadcast)', () => {
  const ENV = { ...BASE_ENV, LINE_CHANNEL_ACCESS_TOKEN: 'linetokenfake' }

  it('reports not configured when the LINE channel token is missing', async () => {
    stubFetch([])
    const res = await worker.fetch(req('/send/line', { message: 'promo' }), BASE_ENV)
    const data = await res.json()
    expect(data.configured).toBe(false)
  })

  it('calls the broadcast endpoint (not multicast) since no per-user LINE ids are tracked', async () => {
    stubFetch([['api.line.me', (url) => { expect(String(url)).toContain('/broadcast'); return { ok: true, json: async () => ({}) } }]])
    const res = await worker.fetch(req('/send/line', { message: 'promo' }), ENV)
    const data = await res.json()
    expect(data.configured).toBe(true)
    expect(data.broadcast).toBe(true)
  })
})

describe('comms-send worker — /line/insight (real follower stats, v1.0.332)', () => {
  const ENV = { ...BASE_ENV, LINE_CHANNEL_ACCESS_TOKEN: 'linetokenfake' }

  it('reports not configured when the LINE channel token is missing', async () => {
    stubFetch([])
    const res = await worker.fetch(req('/line/insight', {}), BASE_ENV)
    const data = await res.json()
    expect(data.configured).toBe(false)
  })

  it('returns real followers/blocks and computes monthlyGrowth when both dates are ready', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-15T12:00:00Z')) // yesterday=20260814, monthStart=20260801 — fixed to avoid TZ/day-boundary flakiness
    stubFetch([['api.line.me/v2/bot/insight/followers', (url) => {
      const dateParam = new URL(String(url)).searchParams.get('date')
      const isMonthStart = dateParam === '20260801'
      return { ok: true, json: async () => ({ status: 'ready', followers: isMonthStart ? 4700 : 4820, blocks: 312 }) }
    }]])
    const res = await worker.fetch(req('/line/insight', {}), ENV)
    const data = await res.json()
    expect(data.configured).toBe(true)
    expect(data.followers).toBe(4820)
    expect(data.blocks).toBe(312)
    expect(data.monthlyGrowth).toBe(120)
  })

  it('returns null stats (not fabricated numbers) when LINE has no data ready for the date', async () => {
    stubFetch([['api.line.me/v2/bot/insight/followers', () => ({ ok: true, json: async () => ({ status: 'unready' }) })]])
    const res = await worker.fetch(req('/line/insight', {}), ENV)
    const data = await res.json()
    expect(data.configured).toBe(true)
    expect(data.followers).toBeNull()
    expect(data.monthlyGrowth).toBeNull()
  })
})

describe('comms-send worker — /whoami (real client IP for IP Whitelist warnings, v1.0.350)', () => {
  it('returns the CF-Connecting-IP header value when authorized', async () => {
    stubFetch([])
    const request = new Request('https://worker.example/whoami', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid', 'CF-Connecting-IP': '203.0.113.5' },
      body: JSON.stringify({}),
    })
    const res = await worker.fetch(request, BASE_ENV)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ip).toBe('203.0.113.5')
  })

  it('returns null ip when the header is missing', async () => {
    stubFetch([])
    const res = await worker.fetch(req('/whoami', {}), BASE_ENV)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ip).toBeNull()
  })

  it('still requires valid staff auth like every other route', async () => {
    const res = await worker.fetch(req('/whoami', {}, { auth: '' }), BASE_ENV)
    expect(res.status).toBe(401)
  })
})

describe('comms-send worker — /send/push (FCM v1)', () => {
  it('reports not configured when the service account secret is missing', async () => {
    stubFetch([])
    const res = await worker.fetch(req('/send/push', { tokens: ['tok1'], title: 't', message: 'm' }), BASE_ENV)
    const data = await res.json()
    expect(data.configured).toBe(false)
  })

  it('is configured but honestly reports zero recipients when no push tokens exist yet (no customer push registration in this app)', async () => {
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
    const pem = privateKey.export({ type: 'pkcs8', format: 'pem' })
    const ENV = { ...BASE_ENV, FCM_SERVICE_ACCOUNT_JSON: JSON.stringify({ client_email: 'x@y.iam.gserviceaccount.com', private_key: pem, project_id: 'lamom-one-v1' }) }
    stubFetch([])
    const res = await worker.fetch(req('/send/push', { tokens: [], title: 't', message: 'm' }), ENV)
    const data = await res.json()
    expect(data).toMatchObject({ configured: true, sent: 0, failed: 0 })
    expect(global.fetch.mock.calls.some(c => String(c[0]).includes('oauth2.googleapis.com'))).toBe(false)
  })

  it('signs a real JWT, exchanges it for an OAuth token, and sends via FCM v1 when tokens exist', async () => {
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
    const pem = privateKey.export({ type: 'pkcs8', format: 'pem' })
    const ENV = { ...BASE_ENV, FCM_SERVICE_ACCOUNT_JSON: JSON.stringify({ client_email: 'x@y.iam.gserviceaccount.com', private_key: pem, project_id: 'lamom-one-v1' }) }
    stubFetch([
      ['oauth2.googleapis.com/token', () => ({ ok: true, json: async () => ({ access_token: 'fcm-access-token' }) })],
      ['fcm.googleapis.com', (url, opts) => {
        expect(String(url)).toContain('/projects/lamom-one-v1/messages:send')
        expect(opts.headers.Authorization).toBe('Bearer fcm-access-token')
        return { ok: true, json: async () => ({ name: 'projects/x/messages/1' }) }
      }],
    ])
    const res = await worker.fetch(req('/send/push', { tokens: ['device-token-1'], title: 't', message: 'm' }), ENV)
    const data = await res.json()
    expect(data).toEqual({ configured: true, sent: 1, failed: 0, errors: [] })
  })
})

describe('comms-send worker — message length caps (v1.0.309)', () => {
  it('rejects an SMS message longer than MAX_SMS_LENGTH', async () => {
    stubFetch([['api.twilio.com', () => ({ ok: true, json: async () => ({}) })]])
    const res = await worker.fetch(req('/send/sms', { recipients: ['+66812345678'], message: 'x'.repeat(1601) }), BASE_ENV)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/ข้อความยาวเกินขีดจำกัด/)
  })

  it('accepts an SMS message within MAX_SMS_LENGTH', async () => {
    stubFetch([['api.twilio.com', () => ({ ok: true, json: async () => ({}) })]])
    const res = await worker.fetch(req('/send/sms', { recipients: ['+66812345678'], message: 'x'.repeat(1600) }), { ...BASE_ENV, TWILIO_ACCOUNT_SID: 'x', TWILIO_AUTH_TOKEN: 'y', TWILIO_FROM_NUMBER: '+1' })
    expect(res.status).toBe(200)
  })

  it('rejects a LINE message longer than MAX_LINE_LENGTH', async () => {
    stubFetch([['api.line.me', () => ({ ok: true, json: async () => ({}) })]])
    const res = await worker.fetch(req('/send/line', { message: 'x'.repeat(5001) }), BASE_ENV)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/ข้อความยาวเกินขีดจำกัด/)
  })

  it('rejects an email subject longer than MAX_SUBJECT_LENGTH', async () => {
    stubFetch([['api.sendgrid.com', () => ({ ok: true, json: async () => ({}) })]])
    const res = await worker.fetch(req('/send/email', { recipients: ['a@b.com'], subject: 'x'.repeat(301), message: 'hi' }), BASE_ENV)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/หัวข้ออีเมลยาวเกินขีดจำกัด/)
  })

  it('rejects an email message longer than MAX_EMAIL_LENGTH', async () => {
    stubFetch([['api.sendgrid.com', () => ({ ok: true, json: async () => ({}) })]])
    const res = await worker.fetch(req('/send/email', { recipients: ['a@b.com'], subject: 'hi', message: 'x'.repeat(20001) }), BASE_ENV)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/ข้อความยาวเกินขีดจำกัด/)
  })
})
