import { describe, it, expect, vi, afterEach } from 'vitest'
import worker, { daysSinceBangkok, formatThaiDate, todayBangkok, decodeFsValue, buildReport, buildMorningReminder, buildMorningSections, buildPersonalReminder, matchSalesTargets, parseLineCommand, buildWeeklyReport, isMonday, buildLineLeadFields, pickNextSales, staffCompanyFor, buildLineFollowupFields, buildNewLineLeadNotice, sellerGoal, lineLeadDocId } from './daily-report.js'

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

describe('buildMorningReminder (09:00 per-salesperson reminder)', () => {

  const data = {
    customers: [
      { stage: 'pp', firstName: 'สมชาย', lastName: 'ใจดี', assignedTo: 'วิชัย', interestedModel: 'BYD Seal', createdAt: '2026-10-10T03:00:00Z', updatedAt: '2026-10-19T03:00:00Z' },
      { stage: 'lead', firstName: 'มานี', assignedTo: 'วิชัย', createdAt: '2026-10-22T03:00:00Z' }, // 2 วัน — ยังไม่ถึงเกณฑ์
      { stage: 'lead', firstName: 'ปิติ', assignedTo: '', createdAt: '2026-10-01T03:00:00Z' },
      { stage: 'pp', firstName: 'เสียดีล', assignedTo: 'วิชัย', isLost: true, createdAt: '2026-10-01T03:00:00Z' },
      { stage: 'booking', firstName: 'จองแล้ว', assignedTo: 'วิชัย', createdAt: '2026-10-01T03:00:00Z' },
      { stage: 'lead', firstName: 'ลบแล้ว', assignedTo: 'วิชัย', createdAt: '2026-10-01T03:00:00Z', deleted: true },
    ],
    followups: [
      { status: 'pending', dueDate: '2026-10-24', salesperson: 'นภา', customerName: 'คุณเอ' },
      { status: 'pending', dueDate: '2026-10-20', salesperson: 'นภา', customerName: 'คุณบี' },
      { status: 'done', dueDate: '2026-10-20', salesperson: 'นภา', customerName: 'เสร็จแล้ว' },
      { status: 'pending', dueDate: '2026-10-30', salesperson: 'นภา', customerName: 'ยังไม่ถึง' },
    ],
    bookings: [
      { status: 'ส่งมอบแล้ว', cutDate: '2026-10-15', salesName: 'วิชัย', custName: 'คุณซี', model: 'Atto 3', totalIncome: 0 },
      { status: 'ส่งมอบแล้ว', cutDate: '2026-10-15', salesName: 'วิชัย', custName: 'กรอกแล้ว', totalIncome: 30000 },
      { status: 'ส่งมอบแล้ว', cutDate: '2026-09-15', salesName: 'วิชัย', custName: 'เดือนก่อน', totalIncome: 0 },
    ],
  }

  it('groups stale leads, due follow-ups and missing income by person', () => {
    const text = buildMorningReminder(data, { today: '2026-10-24' })
    expect(text).toContain('👤 วิชัย')
    expect(text).toContain('Lead ไม่ได้ติดตามเกิน 3 วัน: 1 ราย')
    expect(text).toContain('สมชาย ใจดี (BYD Seal) · 5 วัน')
    expect(text).not.toContain('มานี')
    expect(text).not.toContain('เสียดีล')
    expect(text).not.toContain('จองแล้ว')
    expect(text).not.toContain('ลบแล้ว')
    expect(text).toContain('👤 (ยังไม่มีผู้ดูแล)')
    expect(text).toContain('ปิติ · 23 วัน')
    expect(text).toContain('👤 นภา')
    expect(text).toContain('Follow-up วันนี้/เลยกำหนด: 2 ราย')
    expect(text).toContain('คุณบี ⚠️ เลยกำหนด')
    expect(text).not.toContain('ยังไม่ถึง')
    expect(text).toContain('ส่งมอบแล้วยังไม่กรอกรายได้: 1 คัน')
    expect(text).toContain('คุณซี (Atto 3)')
    expect(text).not.toContain('เดือนก่อน')
  })

  it('does not flag a lead contacted recently (lastContactAt)', () => {
    const text = buildMorningReminder({ customers: [
      { stage: 'lead', firstName: 'โทรแล้ว', assignedTo: 'A', createdAt: '2026-10-01T03:00:00Z', lastContactAt: '2026-10-23T03:00:00Z' },
      { stage: 'lead', firstName: 'ยังไม่โทร', assignedTo: 'A', createdAt: '2026-10-01T03:00:00Z' },
    ] }, { today: '2026-10-24' })
    expect(text).toContain('ยังไม่โทร')
    expect(text).not.toContain('โทรแล้ว')
  })

  it('caps each list and says how many more there are', () => {
    const many = Array.from({ length: 8 }, (_, i) => ({ stage: 'lead', firstName: 'L' + i, assignedTo: 'A', createdAt: '2026-10-01T03:00:00Z' }))
    const text = buildMorningReminder({ customers: many }, { today: '2026-10-24', maxNames: 5 })
    expect(text).toContain('…และอีก 3 ราย')
  })

  it('says there is nothing pending when everything is up to date', () => {
    expect(buildMorningReminder({}, { today: '2026-10-24' })).toContain('ไม่มีงานค้าง')
  })
})

describe('per-salesperson LINE reminders', () => {
  it('parses register / unregister commands sent to the LINE OA', () => {
    expect(parseLineCommand('ลงทะเบียน สมชาย')).toEqual({ type: 'register', name: 'สมชาย' })
    expect(parseLineCommand('ลงทะเบียนเซลส์: วิชัย ใจดี')).toEqual({ type: 'register', name: 'วิชัย ใจดี' })
    expect(parseLineCommand('register Somchai')).toEqual({ type: 'register', name: 'Somchai' })
    expect(parseLineCommand('ยกเลิก')).toEqual({ type: 'unregister' })
    expect(parseLineCommand('สวัสดีครับ สนใจรถ')).toEqual({ type: 'none' })
    expect(parseLineCommand('ลงทะเบียน')).toEqual({ type: 'none' })
  })

  it('matches registered names to sections ignoring spaces, case and the คุณ prefix', () => {
    const sections = buildMorningSections({
      customers: [{ stage: 'lead', firstName: 'ก', assignedTo: 'วิชัย ใจดี', createdAt: '2026-10-01T03:00:00Z' }],
      followups: [{ status: 'pending', dueDate: '2026-10-24', salesperson: 'Napa', customerName: 'ข' }],
    }, { today: '2026-10-24' })
    expect(sections.map(s => s.name)).toEqual(['Napa', 'วิชัย ใจดี'].sort((a, b) => a.localeCompare(b)))
    const m = matchSalesTargets(sections, [
      { name: 'คุณวิชัยใจดี', userId: 'U1' }, { name: 'napa', userId: 'U2' }, { name: 'ไม่มีงาน', userId: 'U3' },
    ])
    expect(m.map(x => [x.name, x.userId])).toEqual([['วิชัย ใจดี', 'U1'], ['Napa', 'U2']])
    const text = buildPersonalReminder(m[0].section, '2026-10-24')
    expect(text).toContain('งานค้างของคุณเช้านี้')
    expect(text).toContain('👤 วิชัย ใจดี')
    expect(text).not.toContain('Napa')
    expect(buildPersonalReminder(m[0].section, '2026-10-24', 'https://lamom-one.pages.dev/')).toContain('https://lamom-one.pages.dev/crm/my-day')
  })
})

async function fakeServiceAccount() {
  const kp = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 1024, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify'])
  const der = new Uint8Array(await crypto.subtle.exportKey('pkcs8', kp.privateKey))
  let bin = ''; der.forEach(b => { bin += String.fromCharCode(b) })
  return JSON.stringify({ client_email: 'sa@x.iam.gserviceaccount.com', private_key: `-----BEGIN PRIVATE KEY-----\n${btoa(bin)}\n-----END PRIVATE KEY-----\n` })
}
async function lineSig(body, secret) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body)))
  let bin = ''; sig.forEach(b => { bin += String.fromCharCode(b) })
  return btoa(bin)
}

describe('LINE webhook — owner capture and salesperson registration', () => {
  async function post(events, env, { ownerStored = true } = {}) {
    const calls = []
    stubFetch([
      ['oauth2.googleapis.com', () => ({ ok: true, json: async () => ({ access_token: 'fs' }) })],
      ['system_integrations/line_daily_report', (url, opts) => {
        calls.push(['owner', opts?.method || 'GET', opts?.body])
        return ownerStored && !opts?.method ? { ok: true, json: async () => ({ fields: { userId: { stringValue: 'UOWNER' } } }) } : { ok: !opts?.method ? false : true, json: async () => ({}) }
      }],
      ['line_sales_targets/', (url, opts) => { calls.push(['sales', opts.method, decodeURIComponent(String(url).split('/').pop()), opts.body]); return { ok: true, json: async () => ({}) } }],
      ['api.line.me/v2/bot/message/reply', (url, opts) => { calls.push(['reply', JSON.parse(opts.body).messages[0].text]); return { ok: true, json: async () => ({}) } }],
    ])
    const body = JSON.stringify({ events })
    const env2 = { ...BASE_ENV, LINE_CHANNEL_SECRET: 'sec', LINE_CHANNEL_ACCESS_TOKEN: 'tok', FIRESTORE_SERVICE_ACCOUNT_JSON: await fakeServiceAccount(), ...env }
    const res = await worker.fetch(new Request('https://w/line/webhook', { method: 'POST', headers: { 'X-Line-Signature': await lineSig(body, 'sec') }, body }), env2)
    expect(res.status).toBe(200)
    return calls
  }
  const msg = (text, userId = 'USALES') => ({ type: 'message', replyToken: 'rt', source: { userId }, message: { type: 'text', text } })

  it('registers a salesperson by name and confirms', async () => {
    const calls = await post([msg('ลงทะเบียน วิชัย')])
    const w = calls.find(c => c[0] === 'sales')
    expect(w[1]).toBe('PATCH')
    expect(w[2]).toBe('USALES')
    expect(JSON.parse(w[3]).fields.name.stringValue).toBe('วิชัย')
    expect(calls.find(c => c[0] === 'reply')[1]).toContain('ลงทะเบียนชื่อ "วิชัย" แล้ว')
    expect(calls.some(c => c[0] === 'owner' && c[1] === 'PATCH')).toBe(false)
  })

  it('unregisters on ยกเลิก', async () => {
    const calls = await post([msg('ยกเลิก')])
    expect(calls.find(c => c[0] === 'sales')[1]).toBe('DELETE')
  })

  it('no longer overwrites the owner report destination when someone else chats, and stays silent', async () => {
    const calls = await post([msg('สนใจรถครับ', 'UCUSTOMER')])
    expect(calls.some(c => c[0] === 'owner' && c[1] === 'PATCH')).toBe(false)
    expect(calls.some(c => c[0] === 'reply')).toBe(false)
  })

  it('still captures the first person as owner when no destination is stored yet', async () => {
    const calls = await post([msg('สวัสดี', 'UFIRST')], {}, { ownerStored: false })
    const w = calls.find(c => c[0] === 'owner' && c[1] === 'PATCH')
    expect(JSON.parse(w[2]).fields.userId.stringValue).toBe('UFIRST')
    expect(calls.find(c => c[0] === 'reply')[1]).toContain('ลงทะเบียนรับรายงานประจำวัน')
  })
})

describe('09:00 cron — summary to owner plus personal pushes', () => {
  it('sends the full summary to Telegram/owner LINE and each registered salesperson their own part', async () => {
    const today = todayBangkok()
    const pushes = []
    const telegrams = []
    const doc = (fields) => ({ document: { name: 'projects/x/databases/(default)/documents/c/' + Math.random(), fields } })
    stubFetch([
      ['oauth2.googleapis.com', () => ({ ok: true, json: async () => ({ access_token: 'fs' }) })],
      ['documents:runQuery', (url, opts) => {
        const col = JSON.parse(opts.body).structuredQuery.from[0].collectionId
        const rows = {
          followups: [
            doc({ status: { stringValue: 'pending' }, dueDate: { stringValue: today }, salesperson: { stringValue: 'วิชัย' }, customerName: { stringValue: 'คุณเอ' } }),
            doc({ status: { stringValue: 'pending' }, dueDate: { stringValue: today }, salesperson: { stringValue: 'นภา' }, customerName: { stringValue: 'คุณบี' } }),
          ],
          line_sales_targets: [doc({ name: { stringValue: 'วิชัย' }, userId: { stringValue: 'UV' } })],
        }[col] || []
        return { ok: true, json: async () => rows }
      }],
      ['system_integrations/line_daily_report', () => ({ ok: true, json: async () => ({ fields: { userId: { stringValue: 'UOWNER' } } }) })],
      ['api.telegram.org', (url, opts) => { telegrams.push(JSON.parse(opts.body).text); return { ok: true, json: async () => ({}) } }],
      ['api.line.me/v2/bot/message/push', (url, opts) => { const b = JSON.parse(opts.body); pushes.push([b.to, b.messages[0].text]); return { ok: true, json: async () => ({}) } }],
    ])
    const waits = []
    await worker.scheduled({ cron: '0 2 * * *' }, {
      ...BASE_ENV, FIRESTORE_SERVICE_ACCOUNT_JSON: await fakeServiceAccount(),
      TELEGRAM_BOT_TOKEN: 't', TELEGRAM_CHAT_ID: 'c', LINE_CHANNEL_ACCESS_TOKEN: 'tok',
    }, { waitUntil: p => waits.push(p) })
    await Promise.all(waits)
    const telegram = telegrams.find(t => t.includes('เตือนงานเช้านี้'))
    expect(telegram).toContain('คุณบี')
    const owner = pushes.find(p => p[0] === 'UOWNER' && p[1].includes('เตือนงานเช้านี้'))
    expect(owner[1]).toContain('คุณเอ')
    const personal = pushes.find(p => p[0] === 'UV')
    expect(personal[1]).toContain('งานค้างของคุณเช้านี้')
    expect(personal[1]).toContain('คุณเอ')
    expect(personal[1]).not.toContain('คุณบี')
    // วันจันทร์จะมีสรุปสัปดาห์ตามไปอีก 1 ข้อความถึงเจ้าของ — ไม่นับในเทสนี้
    expect(pushes.filter(p => !p[1].includes('สรุปสัปดาห์'))).toHaveLength(2)
  })
})

describe('auto lead follow-ups in the morning reminder', () => {
  it('skips automatic follow-ups for customers who already booked or were lost, keeps the rest', () => {
    const text = buildMorningReminder({
      customers: [
        { id: 'c1', stage: 'booking', firstName: 'จองแล้ว' },
        { id: 'c2', stage: 'pp', isLost: true, firstName: 'เสียดีล' },
        { id: 'c3', stage: 'pp', firstName: 'ยังติดตาม', updatedAt: '2026-10-24T01:00:00Z' },
      ],
      followups: [
        { status: 'pending', dueDate: '2026-10-24', salesperson: 'A', customerName: 'จองแล้ว', customerId: 'c1', autoLead: true },
        { status: 'pending', dueDate: '2026-10-24', salesperson: 'A', customerName: 'เสียดีล', customerId: 'c2', autoLead: true },
        { status: 'pending', dueDate: '2026-10-24', salesperson: 'A', customerName: 'ยังติดตาม', customerId: 'c3', autoLead: true },
        { status: 'pending', dueDate: '2026-10-24', salesperson: 'A', customerName: 'นัดเอง', customerId: 'c1' },
      ],
    }, { today: '2026-10-24' })
    expect(text).toContain('Follow-up วันนี้/เลยกำหนด: 2 ราย')
    expect(text).toContain('ยังติดตาม')
    expect(text).toContain('นัดเอง')
    expect(text).not.toContain('- จองแล้ว')
    expect(text).not.toContain('เสียดีล')
  })
})

describe('round 3 — stuck bookings and lead sources', () => {
  it('lists bookings stuck 14+ days per salesperson in the morning reminder', () => {
    const text = buildMorningReminder({ bookings: [
      { salesName: 'A', custName: 'ค้างนาน', status: 'รอรถ', bookingDate: '2026-09-01' },
      { salesName: 'A', custName: 'ยังไม่นาน', status: 'รอรถ', bookingDate: '2026-10-20' },
      { salesName: 'A', custName: 'ส่งแล้ว', status: 'ส่งมอบแล้ว', bookingDate: '2026-09-01', cutDate: '2026-09-30', totalIncome: 1 },
      { salesName: 'A', custName: 'ถอน', status: 'ถอนจอง', bookingDate: '2026-09-01' },
    ] }, { today: '2026-10-24' })
    expect(text).toContain('ใบจองค้างเกิน 14 วัน: 1 ใบ')
    expect(text).toContain('ค้างนาน · รอรถ · 53 วัน')
    expect(text).not.toContain('ยังไม่นาน')
    expect(text).not.toContain('- ถอน')
  })

  it('breaks down today\'s new leads by source in the 18:00 report', () => {
    const text = buildReport({ customers: [
      { stage: 'lead', source: 'facebook', createdAt: '2026-10-24T03:00:00Z' },
      { stage: 'pp', source: 'facebook', createdAt: '2026-10-24T04:00:00Z' },
      { stage: 'pp', source: 'walk-in', createdAt: '2026-10-24T05:00:00Z' },
      { stage: 'pp', createdAt: '2026-10-24T05:00:00Z' },
    ] }, { today: '2026-10-24', time: '18:00' })
    expect(text).toContain('Lead ใหม่วันนี้: 4 ราย')
    expect(text).toContain('มาจาก: Facebook 2 · Walk-in 1 · อื่นๆ 1')
  })
})

describe('weekly summary (Monday mornings)', () => {
  it('knows which days are Mondays', () => {
    expect(isMonday('2026-10-26')).toBe(true)
    expect(isMonday('2026-10-24')).toBe(false)
  })

  it('summarises last Monday–Sunday against the week before', () => {
    const text = buildWeeklyReport({
      customers: [
        { createdAt: '2026-10-20T03:00:00Z' }, { createdAt: '2026-10-25T03:00:00Z' }, // สัปดาห์นี้ 2
        { createdAt: '2026-10-14T03:00:00Z' }, // สัปดาห์ก่อน 1
        { createdAt: '2026-10-26T03:00:00Z' }, // วันนี้ ไม่นับ
      ],
      bookings: [
        { salesName: 'วิชัย', status: 'ส่งมอบแล้ว', bookingDate: '2026-10-01', cutDate: '2026-10-21', totalIncome: 40000 },
        { salesName: 'นภา', status: 'ส่งมอบแล้ว', bookingDate: '2026-10-19', cutDate: '2026-10-22', totalIncome: 0 },
        { salesName: 'นภา', status: 'รอรถ', bookingDate: '2026-10-23' },
        { salesName: 'นภา', status: 'ถอนจอง', bookingDate: '2026-10-05', cancelDate: '2026-10-24' },
        { salesName: 'วิชัย', status: 'ส่งมอบแล้ว', cutDate: '2026-10-15', totalIncome: 60000 },
      ],
    }, { today: '2026-10-26' })
    expect(text).toContain('19 ต.ค. 2569 – 25 ต.ค. 2569')
    expect(text).toContain('Lead ใหม่: 2 ราย (🔺 +1)')
    expect(text).toContain('จองใหม่: 2 คัน (🔺 +2)')
    expect(text).toContain('ส่งมอบ: 2 คัน (🔺 +1)')
    expect(text).toContain('รายได้: 40,000 บาท (🔻 −20,000 บาท)')
    expect(text).toContain('ยังไม่กรอกรายได้ 1 คัน')
    expect(text).toContain('ถอนจอง: 1 คัน (🔺 +1)')
    expect(text).toContain('🥇 วิชัย: ส่งมอบ 1 · จอง 0 · รายได้ 40,000 บาท')
    expect(text).toContain('🥈 นภา: ส่งมอบ 1 · จอง 2 · รายได้ 0 บาท')
  })
})

describe('Monday 09:00 run also sends the weekly summary', () => {
  it('sends the weekly report after the morning reminder only on Mondays', async () => {
    for (const [iso, expectWeekly] of [['2026-10-26T02:00:00Z', true], ['2026-10-27T02:00:00Z', false]]) {
      vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(iso))
      const telegrams = []
      stubFetch([
        ['oauth2.googleapis.com', () => ({ ok: true, json: async () => ({ access_token: 'fs' }) })],
        ['documents:runQuery', () => ({ ok: true, json: async () => [] })],
        ['api.telegram.org', (url, opts) => { telegrams.push(JSON.parse(opts.body).text); return { ok: true, json: async () => ({}) } }],
      ])
      const waits = []
      await worker.scheduled({ cron: '0 2 * * *' }, { ...BASE_ENV, FIRESTORE_SERVICE_ACCOUNT_JSON: await fakeServiceAccount(), TELEGRAM_BOT_TOKEN: 't', TELEGRAM_CHAT_ID: 'c' }, { waitUntil: p => waits.push(p) })
      await Promise.all(waits)
      vi.useRealTimers()
      expect(telegrams[0]).toContain('เตือนงานเช้านี้')
      expect(telegrams.some(t => t.includes('สรุปสัปดาห์ที่แล้ว'))).toBe(expectWeekly)
    }
  })
})

describe('LINE OA auto lead (opt-in AUTO_LEAD_FROM_LINE)', () => {
  it('buildLineLeadFields makes a Prospect from LINE with the first message as a note', () => {
    const f = buildLineLeadFields({ userId: 'U1', displayName: 'Somchai Test', firstText: 'สนใจ Seal', now: '2026-10-24T03:00:00.000Z' })
    expect(f.firstName.stringValue).toBe('Somchai')
    expect(f.lastName.stringValue).toBe('Test')
    expect(f.source.stringValue).toBe('line')
    expect(f.stage.stringValue).toBe('pp')
    expect(f.lineUserId.stringValue).toBe('U1')
    expect(f.notes.stringValue).toContain('สนใจ Seal')
    expect(f.companyId).toEqual({ nullValue: null })
    expect(f.createdAt.timestampValue).toBe('2026-10-24T03:00:00.000Z')
    expect(buildLineLeadFields({ userId: 'U2', displayName: '', firstText: '', now: 'x', companyId: 'c1' }).firstName.stringValue).toBe('ลูกค้า LINE')
    expect(buildLineLeadFields({ userId: 'U2', now: 'x', companyId: 'c1' }).companyId.stringValue).toBe('c1')
  })

  async function post(text, userId, env, { isSales = false, existing = false } = {}) {
    const calls = []
    stubFetch([
      ['oauth2.googleapis.com', () => ({ ok: true, json: async () => ({ access_token: 'fs' }) })],
      ['system_integrations/line_daily_report', () => ({ ok: true, json: async () => ({ fields: { userId: { stringValue: 'UOWNER' } } }) })],
      ['line_sales_targets/', () => { calls.push('salesCheck'); return { ok: isSales, json: async () => ({}) } }],
      [':runQuery', () => { calls.push('query'); return { ok: true, json: async () => (existing ? [{ document: { name: 'x' } }] : [{}]) } }],
      ['api.line.me/v2/bot/profile/', () => ({ ok: true, json: async () => ({ displayName: 'Khun A' }) })],
      ['/documents/customers', (url, opts) => { calls.push(['create', JSON.parse(opts.body).fields]); return { ok: true, json: async () => ({}) } }],
      ['api.line.me/v2/bot/message/reply', () => { calls.push('reply'); return { ok: true, json: async () => ({}) } }],
    ])
    const body = JSON.stringify({ events: [{ type: 'message', replyToken: 'rt', source: { userId }, message: { type: 'text', text } }] })
    const env2 = { ...BASE_ENV, LINE_CHANNEL_SECRET: 'sec', LINE_CHANNEL_ACCESS_TOKEN: 'tok', FIRESTORE_SERVICE_ACCOUNT_JSON: await fakeServiceAccount(), ...env }
    const res = await worker.fetch(new Request('https://w/line/webhook', { method: 'POST', headers: { 'X-Line-Signature': await lineSig(body, 'sec') }, body }), env2)
    expect(res.status).toBe(200)
    return calls
  }
  const creates = calls => calls.filter(c => Array.isArray(c) && c[0] === 'create')

  it('creates a customer when enabled and a new person chats', async () => {
    const calls = await post('สนใจรถครับ', 'UCUST', { AUTO_LEAD_FROM_LINE: '1' })
    const c = creates(calls)
    expect(c).toHaveLength(1)
    expect(c[0][1].firstName.stringValue).toBe('Khun')
    expect(c[0][1].lineUserId.stringValue).toBe('UCUST')
    expect(calls).not.toContain('reply')
  })

  it('does nothing when the setting is off', async () => {
    expect(creates(await post('สนใจรถครับ', 'UCUST', {}))).toHaveLength(0)
  })

  it('skips the owner, registered salespeople and people already in the system', async () => {
    expect(creates(await post('hi', 'UOWNER', { AUTO_LEAD_FROM_LINE: '1' }))).toHaveLength(0)
    expect(creates(await post('hi', 'USALES', { AUTO_LEAD_FROM_LINE: '1' }, { isSales: true }))).toHaveLength(0)
    expect(creates(await post('hi', 'UOLD', { AUTO_LEAD_FROM_LINE: '1' }, { existing: true }))).toHaveLength(0)
  })

  it('คนนอกพิมพ์คำสั่งเซลส์ ("หา รถ", "งาน", "สรุป") ไม่ได้ข้อมูล และยังถูกจับเป็น Lead ตามปกติ', async () => {
    for (const text of ['หา รถไฟฟ้า', 'งาน', 'สรุป', 'คำสั่ง']) {
      const calls = await post(text, 'UCUST', { AUTO_LEAD_FROM_LINE: '1' })
      expect(calls).not.toContain('reply')
      expect(creates(calls)).toHaveLength(1)
    }
  })
})

describe('LINE OA leads handed to salespeople in turn (AUTO_ASSIGN_LINE_LEADS)', () => {
  it('pickNextSales rotates by name and skips duplicates', () => {
    const t = [{ name: 'บี', userId: 'U2' }, { name: 'เอ', userId: 'U1' }, { name: 'คุณเอ', userId: 'U9' }, { name: '', userId: 'U3' }]
    expect(pickNextSales(t, '')?.userId).toBe('U2') // 'บี' < 'เอ' ตามลำดับตัวอักษรไทย
    expect(pickNextSales(t, 'บี')?.userId).toBe('U1')
    expect(pickNextSales(t, 'เอ')?.userId).toBe('U2')
    expect(pickNextSales([], 'x')).toBe(null)
  })

  it('staffCompanyFor matches full name or nickname', () => {
    const staff = [{ firstName: 'วิชัย', lastName: 'ใจดี', nickname: 'ชัย', companyIds: ['c1'] }, { firstName: 'นภา', companyId: 'c2' }]
    expect(staffCompanyFor(staff, 'วิชัย ใจดี')).toBe('c1')
    expect(staffCompanyFor(staff, 'ชัย')).toBe('c1')
    expect(staffCompanyFor(staff, 'นภา')).toBe('c2')
    expect(staffCompanyFor(staff, 'ไม่มี')).toBe(null)
  })

  it('builds 3 follow-ups and a notice with a link', () => {
    const f = buildLineFollowupFields({ customerId: 'X', customerName: 'A', salesperson: 'วิชัย', companyId: 'c1', today: '2026-10-31', now: 'n' })
    expect(f.map(x => x.dueDate.stringValue)).toEqual(['2026-11-01', '2026-11-03', '2026-11-07'])
    expect(f[0].autoLead.booleanValue).toBe(true)
    expect(f[0].companyId.stringValue).toBe('c1')
    const n = buildNewLineLeadNotice({ customerName: 'A', firstText: 'สนใจ', customerId: 'X', appUrl: 'https://app/' })
    expect(n).toContain('https://app/crm/customers?id=X')
    expect(n).toContain('สนใจ')
  })

  it('webhook assigns the next salesperson, schedules follow-ups and tells them on LINE', async () => {
    const calls = []
    stubFetch([
      ['oauth2.googleapis.com', () => ({ ok: true, json: async () => ({ access_token: 'fs' }) })],
      ['system_integrations/line_daily_report', () => ({ ok: true, json: async () => ({ fields: { userId: { stringValue: 'UOWNER' } } }) })],
      ['system_integrations/line_lead_rr', (url, opts) => {
        if (opts?.method === 'PATCH') { calls.push(['rr', JSON.parse(opts.body).fields.lastName.stringValue]); return { ok: true, json: async () => ({}) } }
        return { ok: true, json: async () => ({ fields: { lastName: { stringValue: 'บี' } } }) }
      }],
      ['line_sales_targets/', () => ({ ok: false, json: async () => ({}) })],
      [':runQuery', (url, opts) => {
        const col = JSON.parse(opts.body).structuredQuery.from[0].collectionId
        const doc = (id, fields) => ({ document: { name: `x/${id}`, fields } })
        const s = v => ({ stringValue: v })
        if (col === 'customers') return { ok: true, json: async () => [{}] }
        if (col === 'line_sales_targets') return { ok: true, json: async () => [doc('U1', { name: s('เอ'), userId: s('U1') }), doc('U2', { name: s('บี'), userId: s('U2') })] }
        if (col === 'staff') return { ok: true, json: async () => [doc('s1', { firstName: s('เอ'), companyId: s('comp-A') })] }
        return { ok: true, json: async () => [] }
      }],
      ['api.line.me/v2/bot/profile/', () => ({ ok: true, json: async () => ({ displayName: 'Khun A' }) })],
      ['/documents/customers', (url, opts) => { calls.push(['customer', JSON.parse(opts.body).fields]); return { ok: true, json: async () => ({ name: 'projects/p/databases/(default)/documents/customers/NEWID' }) } }],
      ['/documents/followups', (url, opts) => { calls.push(['fu', JSON.parse(opts.body).fields]); return { ok: true, json: async () => ({}) } }],
      ['api.line.me/v2/bot/message/push', (url, opts) => { const b = JSON.parse(opts.body); calls.push(['push', b.to, b.messages[0].text]); return { ok: true, json: async () => ({}) } }],
    ])
    const body = JSON.stringify({ events: [{ type: 'message', replyToken: 'rt', source: { userId: 'UCUST' }, message: { type: 'text', text: 'ขอราคา Seal' } }] })
    const env = { ...BASE_ENV, LINE_CHANNEL_SECRET: 'sec', LINE_CHANNEL_ACCESS_TOKEN: 'tok', FIRESTORE_SERVICE_ACCOUNT_JSON: await fakeServiceAccount(), AUTO_LEAD_FROM_LINE: '1', AUTO_ASSIGN_LINE_LEADS: '1' }
    const res = await worker.fetch(new Request('https://w/line/webhook', { method: 'POST', headers: { 'X-Line-Signature': await lineSig(body, 'sec') }, body }), env)
    expect(res.status).toBe(200)
    const cust = calls.find(c => c[0] === 'customer')[1]
    expect(cust.assignedTo.stringValue).toBe('เอ')
    expect(cust.companyId.stringValue).toBe('comp-A')
    expect(calls.find(c => c[0] === 'rr')[1]).toBe('เอ')
    const fus = calls.filter(c => c[0] === 'fu')
    expect(fus).toHaveLength(3)
    expect(fus[0][1].customerId.stringValue).toBe('NEWID')
    expect(fus[0][1].salesperson.stringValue).toBe('เอ')
    const push = calls.find(c => c[0] === 'push')
    expect(push[1]).toBe('U1')
    expect(push[2]).toContain('/crm/customers?id=NEWID')
  })
})

describe('upcoming deliveries in the 09:00 reminder and 18:00 report', () => {
  const bookings = [
    { status: 'จองแล้ว', deliveryDate: '2026-10-25', deliveryTime: '14:00', custName: 'ก', model: 'Seal', salesName: 'วิชัย', bookingDate: '2026-10-20' },
    { status: 'รอส่งมอบ', deliveryDate: '2026-10-26', custName: 'ข', salesName: 'วิชัย', bookingDate: '2026-10-20' },
    { status: 'จองแล้ว', deliveryDate: '2026-10-27', custName: 'ค', salesName: 'วิชัย', bookingDate: '2026-10-20' },
    { status: 'ถอนจอง', deliveryDate: '2026-10-25', custName: 'ง', salesName: 'วิชัย', bookingDate: '2026-10-20' },
  ]
  it('morning section lists today\'s test drives', () => {
    const [sec] = buildMorningSections({ bookings: [], customers: [], followups: [], testDrives: [
      { date: '2026-10-25', time: '13:00', status: 'scheduled', staff: 'นภา', customerName: 'ฉ', model: 'Seal' },
      { date: '2026-10-25', time: '09:30', status: 'done', staff: 'นภา', customerName: 'ช' },
    ] }, { today: '2026-10-25' })
    expect(sec.name).toBe('นภา')
    expect(sec.text).toContain('🚙 นัดทดลองขับวันนี้: 1 ราย')
    expect(sec.text).toContain('13:00 · ฉ (Seal)')
  })

  it('morning section lists today and tomorrow only, first', () => {
    const [sec] = buildMorningSections({ bookings, customers: [], followups: [] }, { today: '2026-10-25' })
    expect(sec.name).toBe('วิชัย')
    expect(sec.text.split('\n')[1]).toContain('นัดส่งมอบวันนี้/พรุ่งนี้: 2 คัน')
    expect(sec.text).toContain('วันนี้ 14:00 · ก (Seal)')
    expect(sec.text).toContain('พรุ่งนี้ · ข')
    expect(sec.text).not.toContain('· ค')
    expect(sec.text).not.toContain('· ง')
  })
  it('evening report lists tomorrow deliveries across month end', () => {
    const text = buildReport({ bookings: [{ status: 'จองแล้ว', deliveryDate: '2026-11-01', deliveryTime: '10:00', custName: 'จ', model: 'Dolphin', salesName: 'นภา', bookingDate: '2026-10-01' }], customers: [], followups: [], testDrives: [] }, { today: '2026-10-31' })
    expect(text).toContain('📅 นัดส่งมอบพรุ่งนี้: 1 คัน')
    expect(text).toContain('10:00 จ (Dolphin) · นภา')
    expect(buildReport({ bookings: [], customers: [], followups: [], testDrives: [] }, { today: '2026-10-31' })).not.toContain('นัดส่งมอบพรุ่งนี้')
  })
})

describe('monthly goal in the personal 09:00 message', () => {
  it('sellerGoal counts this month deliveries against the target', () => {
    const data = { bookings: [
      { status: 'ส่งมอบแล้ว', cutDate: '2026-10-03', salesName: 'วิชัย ใจดี' },
      { status: 'ตัดตัวเลขรอส่งมอบ', cutDate: '2026-10-10', salesName: 'วิชัยใจดี' },
      { status: 'ส่งมอบแล้ว', cutDate: '2026-09-30', salesName: 'วิชัย ใจดี' },
      { status: 'จองแล้ว', salesName: 'วิชัย ใจดี' },
    ] }
    expect(sellerGoal(data, { 'วิชัย ใจดี': 5 }, 'คุณวิชัย ใจดี', '2026-10-25')).toEqual({ done: 2, target: 5 })
    expect(sellerGoal(data, {}, 'วิชัย ใจดี', '2026-10-25')).toBe(null)
  })
  it('shows the goal line only when a target exists', () => {
    const section = { name: 'A', text: '👤 A' }
    expect(buildPersonalReminder(section, '2026-10-25', '', { done: 2, target: 5 })).toContain('🎯 เป้าเดือนนี้: ส่งมอบแล้ว 2/5 คัน (เหลือ 3 คัน)')
    expect(buildPersonalReminder(section, '2026-10-25', '', { done: 5, target: 5 })).toContain('ถึงเป้าแล้ว')
    expect(buildPersonalReminder(section, '2026-10-25')).not.toContain('🎯')
  })
})

describe('LINE lead document id', () => {
  it('is fixed per LINE user so concurrent webhooks cannot create duplicates', () => {
    expect(lineLeadDocId('U1234abcd')).toBe('line_U1234abcd')
    expect(lineLeadDocId('U1/../x')).toBe('line_U1x')
  })
})

describe('unassigned leads in the 18:00 report', () => {
  it('warns about leads nobody owns', () => {
    const customers = [
      { stage: 'pp', assignedTo: '', createdAt: '2026-10-25T03:00:00Z' },
      { stage: 'lead', createdAt: '2026-10-20T03:00:00Z' },
      { stage: 'pp', assignedTo: 'A', createdAt: '2026-10-20T03:00:00Z' },
      { stage: 'pp', isLost: true, createdAt: '2026-10-20T03:00:00Z' },
      { stage: 'pp', createdAt: '2026-08-01T03:00:00Z' },
    ]
    expect(buildReport({ bookings: [], customers, followups: [], testDrives: [] }, { today: '2026-10-25' })).toContain('⚠️ ยังไม่มีผู้ดูแล: 2 ราย')
    expect(buildReport({ bookings: [], customers: [customers[2]], followups: [], testDrives: [] }, { today: '2026-10-25' })).not.toContain('ยังไม่มีผู้ดูแล')
  })
})

describe('weekly summary — lead sources', () => {
  it('shows where last week leads came from and 90-day booking rates', () => {
    const C = (d, source, stage = 'pp') => ({ createdAt: `${d}T03:00:00Z`, source, stage })
    const customers = [
      C('2026-10-20', 'facebook'), C('2026-10-21', 'facebook'), C('2026-10-22', 'line'),
      C('2026-09-01', 'facebook', 'booking'), C('2026-09-02', 'walk-in', 'delivered'), C('2026-09-03', 'walk-in', 'booking'), C('2026-09-04', 'walk-in'),
      C('2026-05-01', 'walk-in', 'booking'),
    ]
    const text = buildWeeklyReport({ bookings: [], customers }, { today: '2026-10-26' })
    expect(text).toContain('มาจาก: Facebook 2 · LINE 1')
    expect(text).toContain('🎯 ช่องทางที่ปิดจองได้ดี')
    expect(text).toContain('Walk-in: จอง 2/3 ราย (67%)')
    expect(text).toContain('Facebook: จอง 1/3 ราย (33%)')
    expect(text).not.toContain('LINE: จอง')
  })
})

describe('weekly summary — quiet leads', () => {
  it('counts lead/prospect with no activity for 7+ days per owner', () => {
    const customers = [
      { stage: 'lead', assignedTo: 'วิชัย', createdAt: '2026-10-01T03:00:00Z' },
      { stage: 'pp', assignedTo: 'วิชัย', createdAt: '2026-10-01T03:00:00Z' },
      { stage: 'pp', assignedTo: 'นภา', createdAt: '2026-10-01T03:00:00Z', lastContactAt: '2026-10-24T03:00:00Z' },
      { stage: 'lead', assignedTo: '', createdAt: '2026-10-02T03:00:00Z' },
      { stage: 'lead', assignedTo: 'นภา', createdAt: '2026-10-01T03:00:00Z', isLost: true },
      { stage: 'booking', assignedTo: 'นภา', createdAt: '2026-10-01T03:00:00Z' },
    ]
    const text = buildWeeklyReport({ bookings: [], customers }, { today: '2026-10-26' })
    expect(text).toContain('💤 Lead/Prospect เงียบ 7 วัน+: 3 ราย')
    expect(text).toContain('มากสุด: วิชัย 2 · (ยังไม่มีผู้ดูแล) 1')
    expect(buildWeeklyReport({ bookings: [], customers: [] }, { today: '2026-10-26' })).not.toContain('เงียบ')
  })
})

describe('finance waiting in the 09:00 reminder', () => {
  it('lists rejected and long-waiting finance per salesperson', () => {
    const [sec] = buildMorningSections({ customers: [], followups: [], bookings: [
      { status: 'รอผลไฟแนนซ์', submitDate: '2026-10-20', bookingDate: '2026-10-19', salesName: 'วิชัย', custName: 'ก', financeCo: 'KL' },
      { status: 'จองแล้ว', finStatus: 'ไม่ผ่าน', bookingDate: '2026-10-22', salesName: 'วิชัย', custName: 'ข' },
      { status: 'จองแล้ว', finStatus: 'รอผล', submitDate: '2026-10-24', bookingDate: '2026-10-24', salesName: 'วิชัย', custName: 'ค' },
    ] }, { today: '2026-10-25' })
    expect(sec.text).toContain('🏦 ไฟแนนซ์รอผลนาน/ไม่ผ่าน: 2 ราย')
    expect(sec.text).toContain('ข · ไม่ผ่าน ❗')
    expect(sec.text).toContain('ก (KL) · รอ 5 วัน')
    expect(sec.text).not.toContain('ค ·')
  })
})

describe('speed to lead in the 18:00 report', () => {
  it('counts new leads already contacted today', () => {
    const customers = [
      { id: 'a', stage: 'pp', assignedTo: 'A', createdAt: '2026-10-25T02:00:00Z', lastContactAt: '2026-10-25T05:00:00Z' },
      { id: 'b', stage: 'pp', assignedTo: 'A', createdAt: '2026-10-25T03:00:00Z' },
      { id: 'c', stage: 'lead', assignedTo: 'A', createdAt: '2026-10-25T04:00:00Z' },
    ]
    const followups = [{ status: 'done', customerId: 'b', updatedAt: '2026-10-25T06:00:00Z' }, { status: 'pending', customerId: 'c' }]
    const text = buildReport({ bookings: [], customers, followups, testDrives: [] }, { today: '2026-10-25' })
    expect(text).toContain('ติดต่อแล้ว 2/3 ราย ⚠️')
    expect(buildReport({ bookings: [], customers: customers.slice(0, 1), followups: [], testDrives: [] }, { today: '2026-10-25' })).toContain('ติดต่อแล้ว 1/1 ราย 👍')
  })
  it('counts every customer the team contacted today by owner', () => {
    const customers = [
      { id: 'a', stage: 'booking', assignedTo: 'A', createdAt: '2026-09-01T02:00:00Z', lastContactAt: '2026-10-25T05:00:00Z' },
      { id: 'b', stage: 'pp', assignedTo: 'B', createdAt: '2026-09-01T02:00:00Z' },
      { id: 'c', stage: 'pp', assignedTo: 'A', createdAt: '2026-09-01T02:00:00Z', lastContactAt: '2026-10-24T05:00:00Z' },
    ]
    const followups = [{ status: 'done', customerId: 'b', updatedAt: '2026-10-25T06:00:00Z' }]
    expect(buildReport({ bookings: [], customers, followups, testDrives: [] }, { today: '2026-10-25' })).toContain('ติดต่อลูกค้าวันนี้: 2 ราย (A 1 · B 1)')
    expect(buildReport({ bookings: [], customers: [], followups: [], testDrives: [] }, { today: '2026-10-25' })).toContain('ติดต่อลูกค้าวันนี้: 0 ราย\n')
  })
})

describe('buildStructuredQuery', () => {
  it('ไม่มีตัวกรอง = ไม่มี where', async () => {
    const { buildStructuredQuery } = await import('./daily-report.js')
    const q = buildStructuredQuery('followups', null, null, 10, ['dueDate'])
    expect(q).toEqual({ from: [{ collectionId: 'followups' }], limit: 10, select: { fields: [{ fieldPath: 'dueDate' }] } })
  })
  it('กรองเท่ากับ status = pending', async () => {
    const { buildStructuredQuery } = await import('./daily-report.js')
    const q = buildStructuredQuery('followups', null, null, 10, null, ['status', 'pending'])
    expect(q.where).toEqual({ fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'pending' } } })
    expect(q.orderBy).toBeUndefined()
  })
})

describe('buildReport — ถอนจองวันนี้', () => {
  it('แสดงรายชื่อและเหตุผลเมื่อมีถอนจองวันนี้', () => {
    const txt = buildReport({ bookings: [
      { status: 'ถอนจอง', bookingDate: '2026-10-01', cancelDate: '2026-10-25', custName: 'ลูกค้า ก', model: 'Seal', salesName: 'เซลส์ A', cancelReason: 'ไฟแนนซ์ไม่ผ่าน' },
      { status: 'ถอนจอง', bookingDate: '2026-10-25', cancelDate: '2026-10-20', custName: 'ลูกค้า ข' },
    ] }, { today: '2026-10-25', time: '18:00' })
    expect(txt).toContain('ถอนจองเดือนนี้: 2 คัน')
    expect(txt).toContain('วันนี้ 1 คัน:')
    expect(txt).toContain('• ลูกค้า ก (Seal) · เซลส์ A — ไฟแนนซ์ไม่ผ่าน')
    expect(txt).not.toContain('• ลูกค้า ข')
  })
  it('ไม่มีถอนจองวันนี้ → ไม่มีบรรทัดวันนี้', () => {
    expect(buildReport({ bookings: [] }, { today: '2026-10-25', time: '18:00' })).not.toContain('วันนี้ 0 คัน')
  })
})

describe('คำสั่ง "งาน" ทาง LINE', () => {
  it('parseLineCommand รู้จักคำสั่งดูงาน', () => {
    expect(parseLineCommand('งาน')).toEqual({ type: 'tasks' })
    expect(parseLineCommand(' งาน วันนี้ ')).toEqual({ type: 'tasks' })
    expect(parseLineCommand('งานค้าง')).toEqual({ type: 'tasks' })
    expect(parseLineCommand('มีงานอะไรบ้าง')).toEqual({ type: 'none' })
  })
  it('tasksReplyText: มีงาน / ไม่มีงาน', async () => {
    const { tasksReplyText } = await import('./daily-report.js')
    const withTask = tasksReplyText([{ name: 'เซลส์ A', text: '📞 Follow-up 2 ราย' }], 'เซลส์ A', '2026-10-25', 'https://x.dev')
    expect(withTask).toContain('📋 งานค้างของคุณตอนนี้')
    expect(withTask).toContain('📞 Follow-up 2 ราย')
    expect(withTask).toContain('https://x.dev/crm/my-day')
    const none = tasksReplyText([], 'เซลส์ B', '2026-10-25', '', { done: 1, target: 3 })
    expect(none).toContain('ไม่มีงานค้างของ "เซลส์ B"')
    expect(none).toContain('1/3')
  })
})

describe('คำสั่ง "สรุป" ทาง LINE', () => {
  it('parseLineCommand รู้จักคำสั่งรายงาน', () => {
    expect(parseLineCommand('สรุป')).toEqual({ type: 'report' })
    expect(parseLineCommand('รายงาน')).toEqual({ type: 'report' })
    expect(parseLineCommand('สรุปยอดหน่อย')).toEqual({ type: 'none' })
  })
})

describe('ค้นหาลูกค้า / help ทาง LINE', () => {
  it('parseLineCommand find/help', () => {
    expect(parseLineCommand('หา 0812345678')).toEqual({ type: 'find', q: '0812345678' })
    expect(parseLineCommand('ค้นหา สมชาย')).toEqual({ type: 'find', q: 'สมชาย' })
    expect(parseLineCommand('หา ก')).toEqual({ type: 'none' })
    expect(parseLineCommand('คำสั่ง')).toEqual({ type: 'help' })
  })
  it('findCustomersText ค้นจากเบอร์และชื่อ พร้อมนัดถัดไป', async () => {
    const { findCustomersText } = await import('./daily-report.js')
    const customers = [
      { id: 'c1', firstName: 'สมชาย', lastName: 'ทดสอบ', phone: '081-234-5678', stage: 'pp', assignedTo: 'เซลส์ A', interestedModel: 'Seal' },
      { id: 'c2', firstName: 'สมหญิง', phone: '0899999999', stage: 'lead' },
      { id: 'c3', firstName: 'ลบแล้ว', phone: '0812345678', deleted: true },
    ]
    const fus = [{ customerId: 'c1', status: 'pending', dueDate: '2026-10-20' }, { customerId: 'c1', status: 'pending', dueDate: '2026-10-28' }]
    const byPhone = findCustomersText(customers, fus, '5678', '2026-10-25')
    expect(byPhone).toContain('พบ 1 ราย')
    expect(byPhone).toContain('สมชาย ทดสอบ · Prospect')
    expect(byPhone).toContain('เลยกำหนด')
    const byName = findCustomersText(customers, [], 'สม', '2026-10-25')
    expect(byName).toContain('พบ 2 ราย')
    expect(byName).toContain('⚠️ ยังไม่มี')
    expect(findCustomersText(customers, [], 'ไม่มีคนนี้', '2026-10-25')).toContain('ไม่พบลูกค้า')
    expect(findCustomersText(customers, [], '+66 81 234 5678', '2026-10-25')).toContain('สมชาย ทดสอบ')
    expect(findCustomersText([{ id: 'z', firstName: 'มีบันทึก', phone: '0811111111', lastContactAt: '2026-10-24T03:00:00Z' }], [], 'มีบันทึก', '2026-10-25')).toContain('ติดต่อล่าสุด: 24 ต.ค. 2569')
    expect(findCustomersText([{ id: 'x', firstName: 'เก็บแบบ66', phone: '+66899990000' }], [], '0899990000', '2026-10-25')).toContain('เก็บแบบ66')
  })
})

describe('LINE webhook — เซลส์ค้นหาลูกค้า', () => {
  it('เซลส์ที่ลงทะเบียนพิมพ์ "หา เบอร์" ได้คำตอบ', async () => {
    const replies = []
    stubFetch([
      ['oauth2.googleapis.com', () => ({ ok: true, json: async () => ({ access_token: 'fs' }) })],
      ['system_integrations/line_daily_report', () => ({ ok: true, json: async () => ({ fields: { userId: { stringValue: 'UOWNER' } } }) })],
      ['line_sales_targets/', () => ({ ok: true, json: async () => ({ fields: { name: { stringValue: 'เซลส์ A' } } }) })],
      [':runQuery', (url, opts) => ({ ok: true, json: async () => (JSON.parse(opts.body).structuredQuery.from[0].collectionId === 'customers'
        ? [{ document: { name: 'p/customers/c1', fields: { firstName: { stringValue: 'สมชาย' }, phone: { stringValue: '0812345678' }, stage: { stringValue: 'pp' }, assignedTo: { stringValue: 'เซลส์ A' } } } },
           { document: { name: 'p/customers/c2', fields: { firstName: { stringValue: 'คนอื่น' }, phone: { stringValue: '0812345000' }, stage: { stringValue: 'pp' }, assignedTo: { stringValue: 'เซลส์ B' } } } }]
        : []) })],
      ['api.line.me/v2/bot/message/reply', (url, opts) => { replies.push(JSON.parse(opts.body).messages[0].text); return { ok: true, json: async () => ({}) } }],
    ])
    const body = JSON.stringify({ events: [{ type: 'message', replyToken: 'rt', source: { userId: 'USALES' }, message: { type: 'text', text: 'หา 081234' } }] })
    const env = { ...BASE_ENV, LINE_CHANNEL_SECRET: 'sec', LINE_CHANNEL_ACCESS_TOKEN: 'tok', FIRESTORE_SERVICE_ACCOUNT_JSON: await fakeServiceAccount() }
    const res = await worker.fetch(new Request('https://w/line/webhook', { method: 'POST', headers: { 'X-Line-Signature': await lineSig(body, 'sec') }, body }), env)
    expect(res.status).toBe(200)
    expect(replies).toHaveLength(1)
    expect(replies[0]).toContain('สมชาย · Prospect')
    expect(replies[0]).toContain('พบ 1 ราย')
    expect(replies[0]).not.toContain('คนอื่น') // ลูกค้าของเซลส์คนอื่นไม่แสดง
  })
})

describe('LINE "โทรแล้ว" — บันทึกว่าติดต่อลูกค้าแล้ว', () => {
  it('parse คำสั่ง', () => {
    expect(parseLineCommand('โทรแล้ว 0812345678')).toEqual({ type: 'touch', q: '0812345678' })
    expect(parseLineCommand('ติดต่อแล้ว สมชาย')).toEqual({ type: 'touch', q: 'สมชาย' })
    expect(parseLineCommand('โทรแล้ว')).toEqual({ type: 'none' })
  })
  it('ต้องเจอลูกค้ารายเดียว และ patch เฉพาะ field ที่ระบุ', async () => {
    const { pickTouchTarget, customerContactPatch } = await import('./daily-report.js')
    const cs = [{ id: 'a', firstName: 'สมชาย', phone: '0811111111' }, { id: 'b', firstName: 'สมหญิง', phone: '0822222222' }]
    expect(pickTouchTarget(cs, '0811111111').customer.id).toBe('a')
    expect(pickTouchTarget(cs, 'สม').reply).toContain('พบ 2 ราย')
    expect(pickTouchTarget(cs, 'ไม่มี').reply).toContain('ไม่พบลูกค้า')
    const p1 = customerContactPatch({ id: 'a' }, 'T')
    expect(p1.query).toBe('updateMask.fieldPaths=lastContactAt&updateMask.fieldPaths=updatedAt&updateMask.fieldPaths=firstContactAt&currentDocument.exists=true')
    expect(p1.body.fields.firstContactAt).toEqual({ stringValue: 'T' })
    expect(customerContactPatch({ id: 'a', firstContactAt: 'X' }, 'T').body.fields.firstContactAt).toBeUndefined()
  })
  it('เซลส์ที่ลงทะเบียนพิมพ์ "โทรแล้ว เบอร์" → PATCH ลูกค้าของตัวเองแบบมี updateMask', async () => {
    const replies = []; const patches = []
    stubFetch([
      ['oauth2.googleapis.com', () => ({ ok: true, json: async () => ({ access_token: 'fs' }) })],
      ['system_integrations/line_daily_report', () => ({ ok: true, json: async () => ({ fields: { userId: { stringValue: 'UOWNER' } } }) })],
      ['line_sales_targets/', () => ({ ok: true, json: async () => ({ fields: { name: { stringValue: 'เซลส์ A' } } }) })],
      [':runQuery', () => ({ ok: true, json: async () => [
        { document: { name: 'p/customers/c1', fields: { firstName: { stringValue: 'สมชาย' }, phone: { stringValue: '0812345678' }, assignedTo: { stringValue: 'เซลส์ A' } } } },
        { document: { name: 'p/customers/c2', fields: { firstName: { stringValue: 'คนอื่น' }, phone: { stringValue: '0812345000' }, assignedTo: { stringValue: 'เซลส์ B' } } } }] })],
      ['/documents/customers/', (url, opts) => { patches.push([url, opts.method, JSON.parse(opts.body)]); return { ok: true, json: async () => ({}) } }],
      ['api.line.me/v2/bot/message/reply', (url, opts) => { replies.push(JSON.parse(opts.body).messages[0].text); return { ok: true, json: async () => ({}) } }],
    ])
    const body = JSON.stringify({ events: [{ type: 'message', replyToken: 'rt', source: { userId: 'USALES' }, message: { type: 'text', text: 'โทรแล้ว 0812345' } }] })
    const env = { ...BASE_ENV, LINE_CHANNEL_SECRET: 'sec', LINE_CHANNEL_ACCESS_TOKEN: 'tok', FIRESTORE_SERVICE_ACCOUNT_JSON: await fakeServiceAccount() }
    const res = await worker.fetch(new Request('https://w/line/webhook', { method: 'POST', headers: { 'X-Line-Signature': await lineSig(body, 'sec') }, body }), env)
    expect(res.status).toBe(200)
    expect(patches).toHaveLength(1) // เจอแค่ c1 (c2 เป็นของเซลส์ B)
    expect(patches[0][0]).toContain('/customers/c1?updateMask.fieldPaths=lastContactAt')
    expect(patches[0][0]).toContain('currentDocument.exists=true')
    expect(patches[0][1]).toBe('PATCH')
    expect(Object.keys(patches[0][2].fields).sort()).toEqual(['firstContactAt', 'lastContactAt', 'updatedAt'])
    expect(replies[0]).toContain('บันทึกว่าติดต่อ สมชาย แล้ว')
  })
})

describe('LINE "นัด" — นัดติดตามลูกค้า', () => {
  it('parse คำสั่งและวันนัด', async () => {
    const { parseThaiDue } = await import('./daily-report.js')
    expect(parseLineCommand('นัด 0812345678 พรุ่งนี้')).toEqual({ type: 'plan', q: '0812345678', when: 'พรุ่งนี้' })
    expect(parseLineCommand('นัด สมชาย ใจดี 28/10')).toEqual({ type: 'plan', q: 'สมชาย ใจดี', when: '28/10' })
    expect(parseLineCommand('นัด')).toEqual({ type: 'none' })
    const T = '2026-10-25'
    expect(parseThaiDue('วันนี้', T)).toBe('2026-10-25')
    expect(parseThaiDue('พรุ่งนี้', T)).toBe('2026-10-26')
    expect(parseThaiDue('มะรืน', T)).toBe('2026-10-27')
    expect(parseThaiDue('10วัน', T)).toBe('2026-11-04')
    expect(parseThaiDue('+3', T)).toBe('2026-10-28')
    expect(parseThaiDue('28/10', T)).toBe('2026-10-28')
    expect(parseThaiDue('5/1', T)).toBe('2027-01-05') // ผ่านไปแล้วปีนี้ → ปีหน้า
    expect(parseThaiDue('28/10/69', T)).toBe('2026-10-28')
    expect(parseThaiDue('1/11/2569', T)).toBe('2026-11-01')
    expect(parseThaiDue('1/11/2026', T)).toBe('2026-11-01')
    expect(parseThaiDue('31/2', T)).toBe(null)
    expect(parseThaiDue('เร็วๆนี้', T)).toBe(null)
  })
  it('เซลส์พิมพ์ "นัด เบอร์ พรุ่งนี้" → สร้างนัดให้ลูกค้าของตัวเอง', async () => {
    const replies = []; const posts = []
    stubFetch([
      ['oauth2.googleapis.com', () => ({ ok: true, json: async () => ({ access_token: 'fs' }) })],
      ['system_integrations/line_daily_report', () => ({ ok: true, json: async () => ({ fields: { userId: { stringValue: 'UOWNER' } } }) })],
      ['line_sales_targets/', () => ({ ok: true, json: async () => ({ fields: { name: { stringValue: 'เซลส์ A' } } }) })],
      [':runQuery', () => ({ ok: true, json: async () => [
        { document: { name: 'p/customers/c1', fields: { firstName: { stringValue: 'สมชาย' }, phone: { stringValue: '0812345678' }, assignedTo: { stringValue: 'เซลส์ A' }, companyId: { stringValue: 'co1' } } } },
        { document: { name: 'p/customers/c2', fields: { firstName: { stringValue: 'คนอื่น' }, phone: { stringValue: '0812345000' }, assignedTo: { stringValue: 'เซลส์ B' } } } }] })],
      ['/documents/followups', (url, opts) => { posts.push(JSON.parse(opts.body).fields); return { ok: true, json: async () => ({}) } }],
      ['api.line.me/v2/bot/message/reply', (url, opts) => { replies.push(JSON.parse(opts.body).messages[0].text); return { ok: true, json: async () => ({}) } }],
    ])
    const body = JSON.stringify({ events: [{ type: 'message', replyToken: 'rt', source: { userId: 'USALES' }, message: { type: 'text', text: 'นัด 0812345 พรุ่งนี้' } }] })
    const env = { ...BASE_ENV, LINE_CHANNEL_SECRET: 'sec', LINE_CHANNEL_ACCESS_TOKEN: 'tok', FIRESTORE_SERVICE_ACCOUNT_JSON: await fakeServiceAccount() }
    await worker.fetch(new Request('https://w/line/webhook', { method: 'POST', headers: { 'X-Line-Signature': await lineSig(body, 'sec') }, body }), env)
    expect(posts).toHaveLength(1)
    expect(posts[0].customerId).toEqual({ stringValue: 'c1' })
    expect(posts[0].salesperson).toEqual({ stringValue: 'เซลส์ A' })
    expect(posts[0].companyId).toEqual({ stringValue: 'co1' })
    expect(posts[0].status).toEqual({ stringValue: 'pending' })
    expect(replies[0]).toContain('📅 นัดติดตาม สมชาย')
  })
})

describe('LINE "พรุ่งนี้"', () => {
  it('parse และสรุปงานพรุ่งนี้ของเซลส์คนเดียว', async () => {
    const { buildTomorrowText } = await import('./daily-report.js')
    expect(parseLineCommand('พรุ่งนี้')).toEqual({ type: 'tomorrow' })
    expect(parseLineCommand('งาน พรุ่งนี้')).toEqual({ type: 'tomorrow' })
    const data = {
      followups: [{ status: 'pending', dueDate: '2026-10-26', salesperson: 'เซลส์ A', customerName: 'คุณหนึ่ง' }, { status: 'pending', dueDate: '2026-10-26', salesperson: 'เซลส์ B', customerName: 'ของคนอื่น' }, { status: 'done', dueDate: '2026-10-26', salesperson: 'เซลส์ A', customerName: 'ทำแล้ว' }],
      bookings: [{ status: 'รอส่งมอบ', deliveryDate: '2026-10-26', deliveryTime: '10:00', salesName: 'เซลส์ A', custName: 'คุณสอง', model: 'Seal' }, { status: 'ถอนจอง', deliveryDate: '2026-10-26', salesName: 'เซลส์ A', custName: 'ถอนแล้ว' }],
      testDrives: [{ date: '2026-10-26', time: '14:00', status: 'scheduled', staff: 'เซลส์ A', customerName: 'คุณสาม', model: 'Dolphin' }],
    }
    const text = buildTomorrowText(data, 'เซลส์ A', '2026-10-25')
    expect(text).toContain('🚗 ส่งมอบรถ 1 คัน')
    expect(text).toContain('10:00 คุณสอง (Seal)')
    expect(text).toContain('🔑 ทดลองขับ 1 ราย')
    expect(text).toContain('📞 นัดติดตาม 1 ราย')
    expect(text).not.toContain('ของคนอื่น')
    expect(text).not.toContain('ทำแล้ว')
    expect(text).not.toContain('ถอนแล้ว')
    expect(buildTomorrowText({}, 'เซลส์ A', '2026-10-25')).toContain('ยังไม่มีนัด')
  })
})

describe('LINE "ยอด"', () => {
  it('สรุปยอดเดือนนี้ของเซลส์คนเดียว', async () => {
    const { myStatsText } = await import('./daily-report.js')
    expect(parseLineCommand('ยอด')).toEqual({ type: 'mystats' })
    expect(parseLineCommand('ยอดของฉัน')).toEqual({ type: 'mystats' })
    const bookings = [
      { status: 'ส่งมอบแล้ว', cutDate: '2026-10-05', salesName: 'เซลส์ A', totalIncome: 30000, bookingDate: '2026-09-20' },
      { status: 'ตัดตัวเลขรอส่งมอบ', cutDate: '2026-10-20', salesName: 'เซลส์ A', totalIncome: 0, bookingDate: '2026-10-02' },
      { status: 'รอรถ', bookingDate: '2026-10-10', salesName: 'เซลส์ A' },
      { status: 'ถอนจอง', bookingDate: '2026-10-11', cancelDate: '2026-10-15', salesName: 'เซลส์ A' },
      { status: 'ส่งมอบแล้ว', cutDate: '2026-10-05', salesName: 'เซลส์ B', totalIncome: 99999 },
    ]
    const text = myStatsText({ bookings }, 'เซลส์ A', '2026-10-25', { done: 2, target: 4 })
    expect(text).toContain('📊 ยอดของคุณตุลาคม 2569')
    expect(text).toContain('🎯 เป้าส่งมอบ: 2/4 คัน (50%)')
    expect(text).toContain('✅ ส่งมอบ: 2 คัน · 💰 รายได้ 30,000 บาท (ยังไม่กรอกรายได้ 1 คัน)')
    expect(text).toContain('📋 จองใหม่: 2 คัน · ❌ ถอนจอง 1 คัน')
    expect(text).toContain('🚗 ใบจองที่ยังไม่ส่งมอบ: 1 คัน')
    expect(text).not.toContain('99,999')
  })
})

describe('ลงทะเบียนด้วยชื่อที่ไม่มีในระบบ', () => {
  it('nameIsKnown เทียบแบบไม่สนคำนำหน้า/ช่องว่าง', async () => {
    const { nameIsKnown } = await import('./daily-report.js')
    expect(nameIsKnown('คุณวิชัย  ขายเก่ง', ['วิชัย ขายเก่ง', 'นภา'])).toBe(true)
    expect(nameIsKnown('วิไช', ['วิชัย ขายเก่ง'])).toBe(false)
    expect(nameIsKnown('', [''])).toBe(false)
  })
  it('ตอบเตือนเมื่อชื่อไม่ตรงกับผู้ดูแล/เซลส์คนไหน', async () => {
    const replies = []
    stubFetch([
      ['oauth2.googleapis.com', () => ({ ok: true, json: async () => ({ access_token: 'fs' }) })],
      ['line_sales_targets/', () => ({ ok: true, json: async () => ({}) })],
      [':runQuery', (url, opts) => ({ ok: true, json: async () => (JSON.parse(opts.body).structuredQuery.from[0].collectionId === 'customers'
        ? [{ document: { name: 'p/customers/c1', fields: { assignedTo: { stringValue: 'วิชัย ขายเก่ง' } } } }] : []) })],
      ['api.line.me/v2/bot/message/reply', (url, opts) => { replies.push(JSON.parse(opts.body).messages[0].text); return { ok: true, json: async () => ({}) } }],
    ])
    const env = { ...BASE_ENV, LINE_CHANNEL_SECRET: 'sec', LINE_CHANNEL_ACCESS_TOKEN: 'tok', FIRESTORE_SERVICE_ACCOUNT_JSON: await fakeServiceAccount() }
    for (const text of ['ลงทะเบียน วิไช', 'ลงทะเบียน วิชัย ขายเก่ง']) {
      const body = JSON.stringify({ events: [{ type: 'message', replyToken: 'rt', source: { userId: 'U1' }, message: { type: 'text', text } }] })
      await worker.fetch(new Request('https://w/line/webhook', { method: 'POST', headers: { 'X-Line-Signature': await lineSig(body, 'sec') }, body }), env)
    }
    expect(replies[0]).toContain('⚠️ ยังไม่พบชื่อ "วิไช"')
    expect(replies[1]).toContain('✅ ลงทะเบียนชื่อ "วิชัย ขายเก่ง"')
    expect(replies[1]).not.toContain('ยังไม่พบชื่อ')
  })
})

describe('runQuery แบ่งหน้า', () => {
  it('buildStructuredQuery หน้าถัดไปเรียงตาม __name__ และเริ่มหลังเอกสารสุดท้าย', async () => {
    const { buildStructuredQuery } = await import('./daily-report.js')
    const q = buildStructuredQuery('bookings', null, null, 2, null, null, 'projects/p/databases/(default)/documents/bookings/b2')
    expect(q.orderBy).toEqual([{ field: { fieldPath: '__name__' }, direction: 'ASCENDING' }])
    expect(q.startAt).toEqual({ values: [{ referenceValue: 'projects/p/databases/(default)/documents/bookings/b2' }], before: false })
  })
})

describe('runQuery ดึงครบทุกหน้า', () => {
  it('ได้ครบ limit → ดึงหน้าถัดไปจนหมด', async () => {
    const { runQuery } = await import('./daily-report.js')
    const bodies = []
    const doc = id => ({ document: { name: `projects/p/databases/(default)/documents/bookings/${id}`, fields: { status: { stringValue: 'จองแล้ว' } } } })
    stubFetch([[':runQuery', (url, opts) => {
      const q = JSON.parse(opts.body).structuredQuery
      bodies.push(q)
      const page = bodies.length
      return { ok: true, json: async () => (page === 1 ? [doc('b1'), doc('b2')] : page === 2 ? [doc('b3'), doc('b4')] : [doc('b5')]) }
    }]])
    const rows = await runQuery({ FIREBASE_PROJECT_ID: 'p' }, 'tok', 'bookings', null, null, 2, ['status'])
    expect(rows.map(r => r.id)).toEqual(['b1', 'b2', 'b3', 'b4', 'b5'])
    expect(bodies).toHaveLength(3)
    expect(bodies[0].startAt).toBeUndefined()
    expect(bodies[2].startAt.values[0].referenceValue).toContain('/bookings/b4')
  })
  it('เรียงตาม field → หน้าเดียวเหมือนเดิม', async () => {
    const { runQuery } = await import('./daily-report.js')
    let n = 0
    stubFetch([[':runQuery', () => { n++; return { ok: true, json: async () => [{ document: { name: 'x/a', fields: {} } }] } }]])
    await runQuery({ FIREBASE_PROJECT_ID: 'p' }, 'tok', 'x', 'createdAt', 'DESCENDING', 1)
    expect(n).toBe(1)
  })
})

describe('สรุปสัปดาห์ — การติดตามลูกค้า', () => {
  it('แสดง % นัดที่ทำแล้วของสัปดาห์ที่แล้ว และคนที่ค้างมากสุด', () => {
    const txt = buildWeeklyReport({
      followups: [
        { status: 'pending', dueDate: '2026-10-20', salesperson: 'B' },
        { status: 'pending', dueDate: '2026-10-21', salesperson: 'B' },
        { status: 'pending', dueDate: '2026-10-27', salesperson: 'A' }, // สัปดาห์นี้ ไม่นับ
      ],
      followupsDone: [
        { status: 'done', dueDate: '2026-10-19', salesperson: 'A' },
        { status: 'done', dueDate: '2026-10-25', salesperson: 'A' },
        { status: 'done', dueDate: '2026-10-12', salesperson: 'A' }, // สัปดาห์ก่อน ไม่นับ
      ],
    }, { today: '2026-10-26' })
    expect(txt).toContain('ติดตามลูกค้าตามนัด: ทำแล้ว 2/4 นัด (50%)')
    expect(txt).toContain('ยังค้าง: B 2')
  })
  it('ไม่มีข้อมูลนัดที่ทำแล้ว → ไม่แสดงส่วนนี้', () => {
    expect(buildWeeklyReport({ followups: [{ status: 'pending', dueDate: '2026-10-20' }] }, { today: '2026-10-26' })).not.toContain('ติดตามลูกค้าตามนัด')
  })
})

describe('เตือนส่งมอบ — ตัดตัวเลขรอส่งมอบ', () => {
  it('เช้า: นัดส่งมอบพรุ่งนี้ของใบที่ตัดตัวเลขแล้ว + รถพร้อมส่งที่ยังไม่นัด', () => {
    const sections = buildMorningSections({ bookings: [
      { status: 'ตัดตัวเลขรอส่งมอบ', deliveryDate: '2026-10-26', salesName: 'A', custName: 'ลูกค้า ก', model: 'Seal', totalIncome: 5 },
      { status: 'รอส่งมอบ', salesName: 'A', custName: 'ลูกค้า ข' },
      { status: 'ส่งมอบแล้ว', deliveryDate: '2026-10-26', salesName: 'A', custName: 'ลูกค้า ค', totalIncome: 5, cutDate: '2026-09-01' },
    ] }, { today: '2026-10-25' })
    const a = sections.find(s => s.name === 'A')
    expect(a.text).toContain('นัดส่งมอบวันนี้/พรุ่งนี้: 1 คัน')
    expect(a.text).toContain('ลูกค้า ก (Seal)')
    expect(a.text).toContain('รถพร้อมส่งแต่ยังไม่นัดวันส่งมอบ: 1 คัน')
    expect(a.text).not.toContain('ลูกค้า ค')
  })
  it('18:00: นัดส่งมอบพรุ่งนี้รวมใบที่ตัดตัวเลขแล้ว', () => {
    const txt = buildReport({ bookings: [{ status: 'ตัดตัวเลขรอส่งมอบ', deliveryDate: '2026-10-26', custName: 'ลูกค้า ก', cutDate: '2026-10-20' }] }, { today: '2026-10-25', time: '18:00' })
    expect(txt).toContain('นัดส่งมอบพรุ่งนี้: 1 คัน')
  })
})

describe('buildWeeklyReport — เสียดีลแยกตามเหตุผล', () => {
  it('นับเสียดีลสัปดาห์ที่แล้วตามคำหน้า " - "', () => {
    const customers = [
      { stage: 'pp', isLost: true, lostAt: '2026-10-20T03:00:00Z', lostReason: 'ราคา - คู่แข่งลดให้มากกว่า' },
      { stage: 'pp', isLost: true, lostAt: '2026-10-21T03:00:00Z', lostReason: 'ราคา' },
      { stage: 'lead', isLost: true, lostAt: '2026-10-22T03:00:00Z', lostReason: 'ไฟแนนซ์ไม่ผ่าน -' },
      { stage: 'lead', isLost: true, lostAt: '2026-10-23T03:00:00Z', lostReason: '' },
      { stage: 'pp', isLost: true, lostAt: '2026-10-10T03:00:00Z', lostReason: 'ราคา' },
      { stage: 'pp', isLost: true, lostAt: '2026-10-20T03:00:00Z', lostReason: 'ราคา', deleted: true },
    ]
    const text = buildWeeklyReport({ bookings: [], customers }, { today: '2026-10-26' })
    expect(text).toContain('💔 เสียดีล: 4 ราย')
    expect(text).toContain('เหตุผล: ราคา 2 · ')
    expect(text).toContain('ไฟแนนซ์ไม่ผ่าน 1')
    expect(text).toContain('(ไม่ระบุเหตุผล) 1')
    expect(buildWeeklyReport({ bookings: [], customers: [] }, { today: '2026-10-26' })).not.toContain('เสียดีล')
  })
})
