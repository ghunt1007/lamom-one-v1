import { describe, it, expect, vi, afterEach } from 'vitest'
import { generateKeyPairSync } from 'node:crypto'
import worker from './comms-send.js'

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

afterEach(() => { vi.restoreAllMocks() })

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
