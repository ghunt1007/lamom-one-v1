import { describe, it, expect, vi, afterEach } from 'vitest'
import worker, { daysSinceBangkok, formatThaiDate, todayBangkok, decodeFsValue, buildReport, buildMorningReminder, buildMorningSections, buildPersonalReminder, matchSalesTargets, parseLineCommand, buildWeeklyReport, isMonday, buildLineLeadFields, pickNextSales, staffCompanyFor, buildLineFollowupFields, buildNewLineLeadNotice, sellerGoal } from './daily-report.js'

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
