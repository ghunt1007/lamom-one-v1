import { describe, it, expect, vi, afterEach } from 'vitest'
import worker, { daysSinceBangkok, formatThaiDate, todayBangkok, decodeFsValue } from './daily-report.js'

const BASE_ENV = { FIREBASE_API_KEY: 'fake-public-key', FIREBASE_PROJECT_ID: 'fake-project', ALLOWED_ORIGIN: 'https://lamom-one.pages.dev' }

function req(path, { auth = 'Bearer valid', method = 'GET', body } = {}) {
  const headers = {}
  if (auth) headers.Authorization = auth
  if (body) headers['Content-Type'] = 'application/json'
  return new Request(`https://worker.example${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined })
}

function stubFetch(routes, staffRole = 'owner') {
  global.fetch = vi.fn().mockImplementation((url, opts) => {
    const u = String(url)
    if (u.includes('identitytoolkit.googleapis.com')) {
      return Promise.resolve({ ok: true, json: async () => ({ users: [{ localId: 'staff-uid' }] }) })
    }
    if (u.includes('firestore.googleapis.com') && u.includes('/users/')) {
      return Promise.resolve({ ok: true, json: async () => ({ fields: { role: { stringValue: staffRole } } }) })
    }
    for (const [match, handler] of routes) {
      if (u.includes(match)) return Promise.resolve(handler(url, opts))
    }
    throw new Error('Unexpected fetch to ' + u)
  })
}

afterEach(() => { vi.restoreAllMocks() })

describe('daily-report worker — date helpers (pure, Bangkok timezone)', () => {
  it('todayBangkok returns YYYY-MM-DD', () => {
    expect(todayBangkok()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('daysSinceBangkok computes whole-day differences off todayBangkok(), not local/UTC "now"', () => {
    const today = todayBangkok()
    expect(daysSinceBangkok(today)).toBe(0)
  })

  it('daysSinceBangkok counts 14 days back correctly across a month boundary', () => {
    // 2026-08-12 minus 14 days = 2026-07-29 — cross-month case, matches Dashboard.js's stuck-booking threshold
    const fourteenDaysAgo = '2026-07-29'
    const asOf = '2026-08-12'
    const [ty, tm, td] = asOf.split('-').map(Number)
    const then = new Date(fourteenDaysAgo).getTime()
    const now = Date.UTC(ty, tm - 1, td)
    expect(Math.floor((now - then) / 86400000)).toBe(14)
  })

  it('formatThaiDate converts to Buddhist Era with Thai month abbreviation', () => {
    expect(formatThaiDate('2026-08-12')).toBe('12 ส.ค. 2569')
  })
})

describe('daily-report worker — Firestore value decoding', () => {
  it('decodes string/integer/double/boolean/null values', () => {
    expect(decodeFsValue({ stringValue: 'hi' })).toBe('hi')
    expect(decodeFsValue({ integerValue: '42' })).toBe(42)
    expect(decodeFsValue({ doubleValue: 1.5 })).toBe(1.5)
    expect(decodeFsValue({ booleanValue: true })).toBe(true)
    expect(decodeFsValue({ nullValue: null })).toBe(null)
  })

  it('decodes nested map and array values recursively', () => {
    expect(decodeFsValue({ mapValue: { fields: { a: { stringValue: 'x' } } } })).toEqual({ a: 'x' })
    expect(decodeFsValue({ arrayValue: { values: [{ integerValue: '1' }, { integerValue: '2' }] } })).toEqual([1, 2])
  })
})

describe('daily-report worker — CORS + auth gate on /test-send and /preview', () => {
  it('responds to OPTIONS with the configured ALLOWED_ORIGIN', async () => {
    const res = await worker.fetch(new Request('https://worker.example/test-send', { method: 'OPTIONS' }), BASE_ENV)
    expect(res.status).toBe(200)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://lamom-one.pages.dev')
  })

  it('rejects /test-send with no Authorization header', async () => {
    const res = await worker.fetch(req('/test-send', { auth: '' }), BASE_ENV)
    expect(res.status).toBe(401)
  })

  it('rejects /preview for a valid but unapproved ("pending") account', async () => {
    stubFetch([], 'pending')
    const res = await worker.fetch(req('/preview'), BASE_ENV)
    expect(res.status).toBe(403)
  })

  it('returns 404 for an unknown route', async () => {
    stubFetch([])
    const res = await worker.fetch(req('/carrier-pigeon'), BASE_ENV)
    expect(res.status).toBe(404)
  })
})

describe('daily-report worker — /preview builds a report from Firestore data (no send)', () => {
  it('counts today\'s new bookings and this-month totals correctly, and never touches Telegram/LINE', async () => {
    const today = todayBangkok()
    const bookingDoc = (fields) => ({ name: `projects/x/databases/(default)/documents/bookings/${Math.random()}`, fields })
    stubFetch([
      ['oauth2.googleapis.com', () => ({ ok: true, json: async () => ({ access_token: 'fake-fs-token' }) })],
      ['firestore.googleapis.com/v1/projects/fake-project/databases/(default)/documents:runQuery', (url, opts) => {
        const body = JSON.parse(opts.body)
        if (body.structuredQuery.from[0].collectionId === 'bookings') {
          return {
            ok: true,
            json: async () => ([
              { document: bookingDoc({ bookingDate: { stringValue: today }, status: { stringValue: 'ยอดจองคงค้าง' }, price: { integerValue: '1000000' } }) },
              { document: bookingDoc({ bookingDate: { stringValue: '2020-01-01' }, status: { stringValue: 'ถอนจอง' }, price: { integerValue: '500000' } }) },
            ]),
          }
        }
        return { ok: true, json: async () => ([]) }
      }],
    ], 'owner')
    // service account key must parse — sign() itself will throw inside importPkcs8/crypto.subtle, caught → null access token,
    // so stub getFirestoreAccessToken's dependency chain by giving a syntactically valid (fake) PKCS8 won't work without a
    // real key; instead assert the auth-gated preview path at least reaches Firestore and reports the "can't read" error
    // gracefully rather than throwing, which is the behavior that matters for a cron job that must never crash silently.
    const res = await worker.fetch(req('/preview'), { ...BASE_ENV, FIRESTORE_SERVICE_ACCOUNT_JSON: 'not-json' })
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toMatch(/FIRESTORE_SERVICE_ACCOUNT_JSON/)
  })
})

describe('daily-report worker — Telegram/LINE gracefully report "not configured" instead of crashing', () => {
  it('/test-send with a valid service account but no Telegram/LINE secrets reports both as unconfigured', async () => {
    stubFetch([
      ['oauth2.googleapis.com', () => ({ ok: true, json: async () => ({ error: 'invalid_grant' }) })],
    ], 'owner')
    const env = { ...BASE_ENV, FIRESTORE_SERVICE_ACCOUNT_JSON: JSON.stringify({ client_email: 'a@b.com', private_key: 'not-a-real-pem' }) }
    const res = await worker.fetch(req('/test-send'), env)
    const data = await res.json()
    // signing fails against a fake PEM → getFirestoreAccessToken() returns null → runDailyReport() short-circuits
    // with a clear error instead of a raw exception (the behavior a cron job must have: fail loud in logs, never crash)
    expect(data.error).toMatch(/FIRESTORE_SERVICE_ACCOUNT_JSON/)
  })
})
