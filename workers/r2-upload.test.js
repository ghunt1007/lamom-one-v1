import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import worker from './r2-upload.js'

const ENV = { FIREBASE_API_KEY: 'fake-public-key', BUCKET: null }

function mockBucket() {
  return {
    put: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    get: vi.fn(),
  }
}

// Stubs global fetch — used internally by verifyFirebaseToken() to call Firebase's
// accounts:lookup REST endpoint. `ok` simulates whether Firebase accepted the token.
function stubFirebaseVerify(ok) {
  global.fetch = vi.fn().mockResolvedValue({
    ok,
    json: async () => (ok ? { users: [{ localId: 'real-user-uid' }] } : {}),
  })
}

beforeEach(() => {
  ENV.BUCKET = mockBucket()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('r2-upload worker — CORS preflight', () => {
  it('responds to OPTIONS with CORS headers and no auth check', async () => {
    const req = new Request('https://worker.example/upload', { method: 'OPTIONS' })
    const res = await worker.fetch(req, ENV)
    expect(res.status).toBe(200)
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST')
  })
})

describe('r2-upload worker — auth gate on /upload and /delete', () => {
  it('rejects /upload with no Authorization header at all', async () => {
    const req = new Request('https://worker.example/upload', { method: 'POST', body: new FormData() })
    const res = await worker.fetch(req, ENV)
    expect(res.status).toBe(401)
  })

  it('rejects /upload when the token fails Firebase verification (fake/expired token)', async () => {
    stubFirebaseVerify(false)
    const req = new Request('https://worker.example/upload', {
      method: 'POST',
      headers: { Authorization: 'Bearer some-fake-token' },
      body: new FormData(),
    })
    const res = await worker.fetch(req, ENV)
    expect(res.status).toBe(401)
  })

  it('rejects /delete with no token', async () => {
    const req = new Request('https://worker.example/delete?key=x', { method: 'DELETE' })
    const res = await worker.fetch(req, ENV)
    expect(res.status).toBe(401)
    expect(ENV.BUCKET.delete).not.toHaveBeenCalled()
  })

  it('rejects when Authorization header is present but missing the "Bearer " prefix', async () => {
    const req = new Request('https://worker.example/upload', {
      method: 'POST',
      headers: { Authorization: 'some-fake-token' },
      body: new FormData(),
    })
    const res = await worker.fetch(req, ENV)
    expect(res.status).toBe(401)
  })
})

describe('r2-upload worker — POST /upload with a genuinely valid token', () => {
  it('rejects a disallowed file type even with valid auth', async () => {
    stubFirebaseVerify(true)
    const form = new FormData()
    form.append('file', new File(['x'], 'malware.exe', { type: 'application/x-msdownload' }))
    const req = new Request('https://worker.example/upload', {
      method: 'POST', headers: { Authorization: 'Bearer valid' }, body: form,
    })
    const res = await worker.fetch(req, ENV)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/not allowed/i)
    expect(ENV.BUCKET.put).not.toHaveBeenCalled()
  })

  it('accepts a valid file and returns a URL built from the worker\'s own origin, not files.lamom.one', async () => {
    stubFirebaseVerify(true)
    const form = new FormData()
    form.append('file', new File(['hello'], 'receipt.pdf', { type: 'application/pdf' }))
    form.append('folder', 'expense-receipts')
    const req = new Request('https://worker.example/upload', {
      method: 'POST', headers: { Authorization: 'Bearer valid' }, body: form,
    })
    const res = await worker.fetch(req, ENV)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
    expect(data.url).toMatch(/^https:\/\/worker\.example\/file\?key=/)
    expect(data.url).not.toContain('files.lamom.one')
    expect(data.key).toMatch(/^expense-receipts\//)
    expect(ENV.BUCKET.put).toHaveBeenCalledOnce()
  })
})

describe('r2-upload worker — DELETE /delete with a valid token', () => {
  it('requires a key query param', async () => {
    stubFirebaseVerify(true)
    const req = new Request('https://worker.example/delete', { method: 'DELETE', headers: { Authorization: 'Bearer valid' } })
    const res = await worker.fetch(req, ENV)
    expect(res.status).toBe(400)
  })

  it('deletes the object when key is provided', async () => {
    stubFirebaseVerify(true)
    const req = new Request('https://worker.example/delete?key=uploads%2Ffoo.pdf', {
      method: 'DELETE', headers: { Authorization: 'Bearer valid' },
    })
    const res = await worker.fetch(req, ENV)
    expect(res.status).toBe(200)
    expect(ENV.BUCKET.delete).toHaveBeenCalledWith('uploads/foo.pdf')
  })
})

describe('r2-upload worker — GET /file (public read, no auth required)', () => {
  it('returns 400 with no key', async () => {
    const req = new Request('https://worker.example/file', { method: 'GET' })
    const res = await worker.fetch(req, ENV)
    expect(res.status).toBe(400)
  })

  it('returns 404 for a nonexistent object', async () => {
    ENV.BUCKET.get.mockResolvedValue(null)
    const req = new Request('https://worker.example/file?key=nope.pdf', { method: 'GET' })
    const res = await worker.fetch(req, ENV)
    expect(res.status).toBe(404)
  })

  it('serves the object body with its stored content-type when it exists', async () => {
    ENV.BUCKET.get.mockResolvedValue({ body: 'fake-body-stream', httpMetadata: { contentType: 'application/pdf' } })
    const req = new Request('https://worker.example/file?key=real.pdf', { method: 'GET' })
    const res = await worker.fetch(req, ENV)
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/pdf')
  })

  it('does not require Authorization — GET /file has no auth branch at all', async () => {
    ENV.BUCKET.get.mockResolvedValue({ body: 'x', httpMetadata: {} })
    const req = new Request('https://worker.example/file?key=x.pdf', { method: 'GET' })
    const res = await worker.fetch(req, ENV)
    expect(res.status).toBe(200)
  })
})

describe('r2-upload worker — unknown routes', () => {
  it('returns 404 for an unrecognized path', async () => {
    const req = new Request('https://worker.example/nope', { method: 'GET' })
    const res = await worker.fetch(req, ENV)
    expect(res.status).toBe(404)
  })
})
