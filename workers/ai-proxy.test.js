import { describe, it, expect, vi, afterEach } from 'vitest'
import worker from './ai-proxy.js'

const ENV = { FIREBASE_API_KEY: 'fake-public-key', GEMINI_API_KEY: 'fake-secret', ALLOWED_ORIGIN: 'https://lamom-one.pages.dev' }

// Routes the global fetch mock by target URL, since a single request can trigger both
// a Firebase token-verification call AND a Gemini API call — they must not share a response.
function stubFetch({ firebaseOk = true, geminiStatus = 200, geminiBody = '{"candidates":[]}' } = {}) {
  global.fetch = vi.fn().mockImplementation((url) => {
    if (String(url).includes('identitytoolkit.googleapis.com')) {
      return Promise.resolve({
        ok: firebaseOk,
        json: async () => (firebaseOk ? { users: [{ localId: 'real-user-uid' }] } : {}),
      })
    }
    if (String(url).includes('generativelanguage.googleapis.com')) {
      return Promise.resolve({
        status: geminiStatus,
        text: async () => geminiBody,
        body: 'fake-sse-stream',
      })
    }
    throw new Error('Unexpected fetch to ' + url)
  })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ai-proxy worker — CORS preflight', () => {
  it('responds to OPTIONS with the configured ALLOWED_ORIGIN, not a wildcard', async () => {
    const req = new Request('https://worker.example/generate', { method: 'OPTIONS' })
    const res = await worker.fetch(req, ENV)
    expect(res.status).toBe(200)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://lamom-one.pages.dev')
  })
})

describe('ai-proxy worker — auth gate', () => {
  it('rejects any non-OPTIONS/non-POST method before even checking auth', async () => {
    const req = new Request('https://worker.example/generate', { method: 'GET' })
    const res = await worker.fetch(req, ENV)
    expect(res.status).toBe(404)
  })

  it('rejects POST /generate with no Authorization header', async () => {
    const req = new Request('https://worker.example/generate', { method: 'POST', body: '{}' })
    const res = await worker.fetch(req, ENV)
    expect(res.status).toBe(401)
    const data = await res.json()
    expect(data.error).toMatch(/missing token/i)
  })

  it('rejects a token that Firebase does not recognize (fake/expired)', async () => {
    stubFetch({ firebaseOk: false })
    const req = new Request('https://worker.example/generate', {
      method: 'POST', headers: { Authorization: 'Bearer fake-token' }, body: '{}',
    })
    const res = await worker.fetch(req, ENV)
    expect(res.status).toBe(401)
    const data = await res.json()
    expect(data.error).toMatch(/invalid token/i)
  })

  it('never reaches Gemini when the Firebase check fails', async () => {
    stubFetch({ firebaseOk: false })
    const req = new Request('https://worker.example/generate', {
      method: 'POST', headers: { Authorization: 'Bearer fake-token' }, body: '{}',
    })
    await worker.fetch(req, ENV)
    const calledUrls = global.fetch.mock.calls.map(c => String(c[0]))
    expect(calledUrls.some(u => u.includes('generativelanguage'))).toBe(false)
  })
})

describe('ai-proxy worker — /generate with a genuinely valid token', () => {
  it('forwards to Gemini and relays its status + body verbatim', async () => {
    stubFetch({ firebaseOk: true, geminiStatus: 200, geminiBody: '{"candidates":[{"content":{"parts":[{"text":"OK"}]}}]}' })
    const req = new Request('https://worker.example/generate', {
      method: 'POST',
      headers: { Authorization: 'Bearer valid', 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'hi' }] }] }),
    })
    const res = await worker.fetch(req, ENV)
    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text).toContain('"text":"OK"')
  })

  it('never lets the real GEMINI_API_KEY leak into the response body or an error message', async () => {
    stubFetch({ firebaseOk: true, geminiStatus: 500, geminiBody: '{"error":"upstream failure"}' })
    const req = new Request('https://worker.example/generate', {
      method: 'POST', headers: { Authorization: 'Bearer valid' }, body: '{}',
    })
    const res = await worker.fetch(req, ENV)
    const text = await res.text()
    expect(text).not.toContain(ENV.GEMINI_API_KEY)
  })

  it('relays a non-200 Gemini status through unchanged (e.g. rate limit)', async () => {
    stubFetch({ firebaseOk: true, geminiStatus: 429, geminiBody: '{"error":"rate limited"}' })
    const req = new Request('https://worker.example/generate', {
      method: 'POST', headers: { Authorization: 'Bearer valid' }, body: '{}',
    })
    const res = await worker.fetch(req, ENV)
    expect(res.status).toBe(429)
  })

  it('returns 500 with a clear message if GEMINI_API_KEY secret was never set, rather than calling Gemini with "undefined"', async () => {
    stubFetch({ firebaseOk: true })
    const req = new Request('https://worker.example/generate', {
      method: 'POST', headers: { Authorization: 'Bearer valid' }, body: '{}',
    })
    const res = await worker.fetch(req, { ...ENV, GEMINI_API_KEY: undefined })
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toMatch(/not configured/i)
  })
})

describe('ai-proxy worker — /generate-stream', () => {
  it('streams the response body through as text/event-stream', async () => {
    stubFetch({ firebaseOk: true })
    const req = new Request('https://worker.example/generate-stream', {
      method: 'POST', headers: { Authorization: 'Bearer valid' }, body: '{}',
    })
    const res = await worker.fetch(req, ENV)
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('text/event-stream')
  })
})

describe('ai-proxy worker — /embed (RAG)', () => {
  it('forwards text to the embedContent endpoint and relays the vector back', async () => {
    stubFetch({ firebaseOk: true, geminiStatus: 200, geminiBody: '{"embedding":{"values":[0.1,0.2,0.3]}}' })
    const req = new Request('https://worker.example/embed', {
      method: 'POST',
      headers: { Authorization: 'Bearer valid', 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'สวัสดี', taskType: 'RETRIEVAL_DOCUMENT' }),
    })
    const res = await worker.fetch(req, ENV)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.embedding.values).toEqual([0.1, 0.2, 0.3])
    const calledUrl = String(global.fetch.mock.calls.find(c => String(c[0]).includes('generativelanguage'))[0])
    expect(calledUrl).toContain('gemini-embedding-001:embedContent')
  })

  it('rejects /embed with no Authorization header, same as /generate', async () => {
    const req = new Request('https://worker.example/embed', { method: 'POST', body: '{}' })
    const res = await worker.fetch(req, ENV)
    expect(res.status).toBe(401)
  })

  it('never leaks GEMINI_API_KEY through an /embed error response', async () => {
    stubFetch({ firebaseOk: true, geminiStatus: 500, geminiBody: '{"error":"upstream failure"}' })
    const req = new Request('https://worker.example/embed', {
      method: 'POST', headers: { Authorization: 'Bearer valid' }, body: '{"text":"x"}',
    })
    const res = await worker.fetch(req, ENV)
    const text = await res.text()
    expect(text).not.toContain(ENV.GEMINI_API_KEY)
  })
})

describe('ai-proxy worker — unknown routes', () => {
  it('returns 404 for a POST to an unrecognized path, even with valid auth', async () => {
    stubFetch({ firebaseOk: true })
    const req = new Request('https://worker.example/not-a-real-route', {
      method: 'POST', headers: { Authorization: 'Bearer valid' }, body: '{}',
    })
    const res = await worker.fetch(req, ENV)
    expect(res.status).toBe(404)
  })
})
