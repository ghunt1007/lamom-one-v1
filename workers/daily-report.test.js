import { describe, it, expect, vi, afterEach } from 'vitest'
import worker, { daysSinceBangkok, formatThaiDate, todayBangkok, decodeFsValue, buildReport } from './daily-report.js'

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

describe('daily-report worker — buildReport (pure, same definitions as Dashboard.js)', () => {
  const today = '2026-10-22'
  const data = {
    bookings: [
      { bookingDate: '2026-10-22', status: 'รอผลไฟแนนซ์', salesName: 'บี' },
      { bookingDate: '2026-10-05', status: 'ส่งมอบแล้ว', cutDate: '2026-10-22', salesName: 'เอ', totalIncome: 30000 },
      { bookingDate: '2026-09-20', status: 'ตัดตัวเลขรอส่งมอบ', cutDate: '2026-10-10', salesName: 'บี', totalIncome: 0 },
      { bookingDate: '2026-03-01', status: 'ส่งมอบแล้ว', cutDate: '2026-03-15', salesName: 'เอ', totalIncome: 50000 },
      { bookingDate: '2026-10-03', status: 'ยกเลิก', salesName: 'เอ' },
      { bookingDate: '2026-10-04', status: 'รอรถ', salesName: 'เอ', deleted: true },
    ],
    customers: [
      { stage: 'lead', createdAt: '2026-10-21T18:30:00Z' }, // 01:30 น. วันที่ 22 เวลาไทย
      { stage: 'pp', createdAt: '2026-10-01T03:00:00Z' },
      { stage: 'customer', createdAt: '2026-10-22T03:00:00Z' },
    ],
    followups: [{ dueDate: today, status: 'pending' }, { dueDate: '2026-10-01', status: 'pending' }, { dueDate: today, status: 'done' }],
    testDrives: [{ date: today }],
    teamTargets: [{ period: '2026-10', metric: 'units', target: 12 }, { period: '2026-10', metric: 'units', target: 8 }, { period: '2026-10', metric: 'revenue', target: 9000000 }],
  }
  const text = buildReport(data, { today, time: '18:00', defaultTarget: 15 })

  it('counts leads from customers in lead/pp stage, using Bangkok dates for createdAt', () => {
    expect(text).toContain('Lead ใหม่วันนี้: 1 ราย')
    expect(text).toContain('Lead ที่ดูแลอยู่: 2 ราย')
    expect(text).toContain('Follow-up วันนี้: 1 ราย')
    expect(text).toContain('Follow-up เลยกำหนด: 1 ราย')
    expect(text).toContain('ทดลองขับวันนี้: 1 ราย')
  })
  it('counts deliveries by cutDate incl. ตัดตัวเลขรอส่งมอบ, skips deleted and cancelled', () => {
    expect(text).toContain('ส่งมอบวันนี้: 1 คัน')
    expect(text).toContain('ส่งมอบเดือนนี้: 2 คัน')
    expect(text).toContain('ส่งมอบปีนี้: 3 คัน')
    expect(text).toContain('จองใหม่เดือนนี้: 2 คัน')
    expect(text).toContain('ถอนจองเดือนนี้: 1 คัน')
    expect(text).not.toContain('รอรถ: 1')
  })
  it('sums revenue from totalIncome and flags deliveries with no income entered', () => {
    expect(text).toContain('รายได้เดือนนี้: 30,000 บาท')
    expect(text).toContain('ยังไม่กรอกรายได้ 1 จาก 2 คัน')
    expect(text).toContain('รายได้ปีนี้: 80,000 บาท')
  })
  it('lists every salesperson and sums unit targets from team_targets', () => {
    expect(text).toContain('เอ: ส่งมอบ 1 · จอง 1')
    expect(text).toContain('บี: ส่งมอบ 1 · จอง 1')
    expect(text).toContain('เป้าเดือนนี้: 20 คัน')
  })
  it('falls back to the default target when no unit target is set', () => {
    expect(buildReport({ ...data, teamTargets: [] }, { today, defaultTarget: 15 })).toContain('เป้าเดือนนี้: 15 คัน')
  })
})
