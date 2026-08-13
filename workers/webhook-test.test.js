import { describe, it, expect, vi, afterEach } from 'vitest'
import worker, { isBlockedTarget } from './webhook-test.js'

const BASE_ENV = { FIREBASE_API_KEY: 'fake-public-key', FIREBASE_PROJECT_ID: 'fake-project', ALLOWED_ORIGIN: 'https://lamom-one.pages.dev' }

function req(body, { auth = 'Bearer valid' } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (auth) headers.Authorization = auth
  return new Request('https://worker.example/test', { method: 'POST', headers, body: JSON.stringify(body) })
}

function stubAuth(staffRole = 'owner') {
  global.fetch = vi.fn().mockImplementation((url, opts) => {
    const u = String(url)
    if (u.includes('identitytoolkit.googleapis.com')) {
      return Promise.resolve({ ok: true, json: async () => ({ users: [{ localId: 'staff-uid', email: 'owner@lamom.one' }] }) })
    }
    if (u.includes('firestore.googleapis.com') && u.includes('/users/')) {
      return Promise.resolve({ ok: true, json: async () => ({ fields: { role: { stringValue: staffRole } } }) })
    }
    return Promise.resolve({ ok: true, status: 200, text: async () => 'OK' })
  })
}

afterEach(() => { vi.restoreAllMocks() })

describe('webhook-test worker — SSRF guard (pure function)', () => {
  it('blocks loopback, private (RFC1918), link-local, and cloud metadata hosts', async () => {
    expect(await isBlockedTarget('127.0.0.1')).toBeTruthy()
    expect(await isBlockedTarget('10.0.0.5')).toBeTruthy()
    expect(await isBlockedTarget('172.20.1.1')).toBeTruthy()
    expect(await isBlockedTarget('192.168.1.1')).toBeTruthy()
    expect(await isBlockedTarget('169.254.169.254')).toBeTruthy()
    expect(await isBlockedTarget('localhost')).toBeTruthy()
    expect(await isBlockedTarget('myapp.local')).toBeTruthy()
  })

  it('does not block ordinary public hostnames', async () => {
    expect(await isBlockedTarget('example.com')).toBeFalsy()
    expect(await isBlockedTarget('hooks.slack.com')).toBeFalsy()
    expect(await isBlockedTarget('172.15.0.1')).toBeFalsy() // just outside the 172.16-31 private range
    expect(await isBlockedTarget('172.32.0.1')).toBeFalsy()
  })
})

describe('webhook-test worker — CORS + auth gate', () => {
  it('responds to OPTIONS with the configured ALLOWED_ORIGIN', async () => {
    const res = await worker.fetch(new Request('https://worker.example/test', { method: 'OPTIONS' }), BASE_ENV)
    expect(res.status).toBe(200)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://lamom-one.pages.dev')
  })

  it('rejects a request with no Authorization header before touching any target', async () => {
    const res = await worker.fetch(req({ url: 'https://example.com/hook' }, { auth: '' }), BASE_ENV)
    expect(res.status).toBe(401)
  })

  it('rejects an unapproved ("pending") account', async () => {
    stubAuth('pending')
    const res = await worker.fetch(req({ url: 'https://example.com/hook' }), BASE_ENV)
    expect(res.status).toBe(403)
  })

  it('returns 404 for GET or an unknown path', async () => {
    stubAuth()
    const res = await worker.fetch(new Request('https://worker.example/test', { method: 'GET' }), BASE_ENV)
    expect(res.status).toBe(404)
  })
})

describe('webhook-test worker — request validation', () => {
  it('rejects a malformed URL', async () => {
    stubAuth()
    const res = await worker.fetch(req({ url: 'not-a-url' }), BASE_ENV)
    const data = await res.json()
    expect(res.status).toBe(400)
    expect(data.error).toMatch(/URL/)
  })

  it('rejects a private-network target instead of firing the request', async () => {
    stubAuth()
    const res = await worker.fetch(req({ url: 'http://192.168.1.50/hook' }), BASE_ENV)
    const data = await res.json()
    expect(res.status).toBe(400)
    expect(data.error).toMatch(/ปฏิเสธ/)
  })
})

describe('webhook-test worker — successful test-send', () => {
  it('fires the request and reports ok:true with the target response status', async () => {
    stubAuth()
    const res = await worker.fetch(req({ url: 'https://example.com/hook', event: 'sale.created' }), BASE_ENV)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
    expect(data.status).toBe(200)
    expect(data.payloadSent.event).toBe('sale.created')
  })

  it('reports ok:false (still HTTP 200) when the target itself errors, never throwing', async () => {
    global.fetch = vi.fn().mockImplementation((u) => {
      const url = String(u)
      if (url.includes('identitytoolkit')) return Promise.resolve({ ok: true, json: async () => ({ users: [{ localId: 'uid' }] }) })
      if (url.includes('firestore')) return Promise.resolve({ ok: true, json: async () => ({ fields: { role: { stringValue: 'owner' } } }) })
      return Promise.resolve({ ok: false, status: 500, text: async () => 'Internal Error' })
    })
    const res = await worker.fetch(req({ url: 'https://example.com/broken-hook' }), BASE_ENV)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(false)
    expect(data.status).toBe(500)
  })
})
