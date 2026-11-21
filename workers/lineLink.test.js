import { describe, it, expect, vi } from 'vitest'
import { parseLinkCode, parseOptCommand, newLinkCode, codeFresh, pickStatusSends, runStatusLine, linkByCode, setOptOut, markFollow, linkedReply } from './lineLink.js'

const env = { FIREBASE_PROJECT_ID: 'p' }
const U = 'U' + 'a'.repeat(32)
const fsDoc = (coll, id, o) => ({ document: { name: `projects/p/databases/(default)/documents/${coll}/${id}`, fields: Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'boolean' ? { booleanValue: v } : { stringValue: String(v) }])) } })

describe('parseLinkCode / parseOptCommand', () => {
  it('reads link codes', () => {
    expect(parseLinkCode('ผูก ABC234')).toBe('ABC234')
    expect(parseLinkCode('ผูก:abc234')).toBe('ABC234')
    expect(parseLinkCode('  LINK abc234 ')).toBe('ABC234')
    expect(parseLinkCode('ผูกLINE ABC234')).toBe('ABC234')
    expect(parseLinkCode('ผูก ABC23')).toBe('')
    expect(parseLinkCode('อยากผูก ABC234 ครับ')).toBe('')
    expect(parseLinkCode('')).toBe('')
  })
  it('reads opt in/out only as whole message', () => {
    expect(parseOptCommand('เลิกรับ')).toBe('out')
    expect(parseOptCommand(' STOP ')).toBe('out')
    expect(parseOptCommand('เลิก รับ ข่าว')).toBe('out')
    expect(parseOptCommand('รับข่าว')).toBe('in')
    expect(parseOptCommand('ผมจะเลิกรับรถ')).toBe('')
    expect(parseOptCommand('ยกเลิก')).toBe('')
  })
  it('makes 6-char codes the parser accepts', () => {
    const c = newLinkCode(() => 0.5)
    expect(c).toMatch(/^[A-Z2-9]{6}$/)
    expect(parseLinkCode('ผูก ' + c)).toBe(c)
  })
  it('expires codes after 30 days', () => {
    const now = Date.parse('2026-11-21T00:00:00Z')
    expect(codeFresh({ lineLinkCodeAt: '2026-11-01T00:00:00Z' }, now)).toBe(true)
    expect(codeFresh({ lineLinkCodeAt: '2026-10-01T00:00:00Z' }, now)).toBe(false)
    expect(codeFresh({}, now)).toBe(false)
  })
})

describe('pickStatusSends', () => {
  const cust = { id: 'c1', lineUserId: U, lineLinkedAt: '2026-11-10T00:00:00Z' }
  it('sends when status changed since last notice', () => {
    const r = pickStatusSends([{ id: 'b1', customerId: 'c1', status: 'รอส่งมอบ', statusLineSent: 'รอรถ', custName: 'สมชาย ใจดี', model: 'S07' }], [cust])
    expect(r.send).toHaveLength(1)
    expect(r.send[0].to).toBe(U)
    expect(r.send[0].text).toContain('คุณสมชาย')
  })
  it('does not resend the same status', () => {
    expect(pickStatusSends([{ id: 'b1', customerId: 'c1', status: 'รอรถ', statusLineSent: 'รอรถ' }], [cust]).send).toHaveLength(0)
  })
  it('baselines old bookings with no notice yet (no backlog blast)', () => {
    const r = pickStatusSends([{ id: 'b1', customerId: 'c1', status: 'รอรถ', createdAt: '2026-11-01T00:00:00Z' }], [cust])
    expect(r.send).toHaveLength(0)
    expect(r.baseline.map(b => b.id)).toEqual(['b1'])
  })
  it('sends first notice for bookings created after the customer linked', () => {
    const r = pickStatusSends([{ id: 'b1', customerId: 'c1', status: 'รอผลไฟแนนซ์', createdAt: '2026-11-12T00:00:00Z' }], [cust])
    expect(r.send).toHaveLength(1)
  })
  it('skips opted-out, blocked, unlinked and deleted', () => {
    const bs = [
      { id: 'b1', customerId: 'c1', status: 'รอส่งมอบ', statusLineSent: 'รอรถ' },
      { id: 'b2', customerId: 'c2', status: 'รอส่งมอบ', statusLineSent: 'รอรถ' },
      { id: 'b3', customerId: 'c3', status: 'รอส่งมอบ', statusLineSent: 'รอรถ' },
      { id: 'b4', customerId: 'c1', status: 'รอส่งมอบ', statusLineSent: 'รอรถ', deleted: true },
    ]
    const cs = [{ ...cust, lineOptOut: true }, { id: 'c2', lineUserId: U, lineBlockedAt: '2026-11-11' }, { id: 'c3' }]
    expect(pickStatusSends(bs, cs).send).toHaveLength(0)
  })
  it('uses the booking own lineUserId and customer.bookingId link', () => {
    expect(pickStatusSends([{ id: 'b9', status: 'ส่งมอบแล้ว', statusLineSent: 'รอส่งมอบ', lineUserId: U }], []).send).toHaveLength(1)
    expect(pickStatusSends([{ id: 'b9', status: 'ส่งมอบแล้ว', statusLineSent: 'รอส่งมอบ' }], [{ id: 'cx', bookingId: 'b9', lineUserId: U }]).send).toHaveLength(1)
  })
  it('statuses without a message are only baselined', () => {
    const r = pickStatusSends([{ id: 'b1', customerId: 'c1', status: 'ถอนจอง', statusLineSent: 'รอรถ' }], [cust])
    expect(r.send).toHaveLength(0)
    expect(r.baseline).toHaveLength(1)
  })
  it('caps sends per run', () => {
    const bs = Array.from({ length: 50 }, (_, i) => ({ id: 'b' + i, lineUserId: U, status: 'รอรถ', statusLineSent: 'รอผลไฟแนนซ์' }))
    expect(pickStatusSends(bs, [], { max: 30 }).send).toHaveLength(30)
  })
})

describe('runStatusLine', () => {
  const bookings = [{ id: 'b1', lineUserId: U, status: 'รอรถ', statusLineSent: 'รอผลไฟแนนซ์' }]
  it('does nothing when switched off', async () => {
    const push = vi.fn()
    const r = await runStatusLine({ enabled: false, pushLine: push, listBookings: async () => bookings, listCustomers: async () => [], mark: async () => true })
    expect(r.skipped).toBe('off')
    expect(push).not.toHaveBeenCalled()
  })
  it('marks before sending and never sends when mark fails', async () => {
    const push = vi.fn(async () => true)
    const order = []
    const ok = await runStatusLine({ enabled: true, pushLine: async (...a) => { order.push('push'); return push(...a) }, listBookings: async () => bookings, listCustomers: async () => [], mark: async () => { order.push('mark'); return true } })
    expect(ok.sent).toBe(1)
    expect(order).toEqual(['mark', 'push'])
    const push2 = vi.fn(async () => true)
    const bad = await runStatusLine({ enabled: true, pushLine: push2, listBookings: async () => bookings, listCustomers: async () => [], mark: async () => false })
    expect(bad.sent).toBe(0)
    expect(push2).not.toHaveBeenCalled()
  })
})

// fetch ปลอม: runQuery ตามคอลเลกชัน/ฟิลด์ + จด PATCH
function fakeFs(data) {
  const patches = []
  const f = vi.fn(async (url, init = {}) => {
    if (url.endsWith(':runQuery')) {
      const q = JSON.parse(init.body).structuredQuery
      const coll = q.from[0].collectionId, ff = q.where.fieldFilter
      const rows = (data[coll] || []).filter(d => d[ff.field.fieldPath] === ff.value.stringValue).map(d => fsDoc(coll, d.id, (({ id, ...o }) => o)(d)))
      return { ok: true, json: async () => rows }
    }
    if (init.method === 'PATCH') { patches.push({ url, fields: JSON.parse(init.body).fields }); return { ok: true, json: async () => ({}) } }
    const m = url.match(/documents\/(\w+)\/([^?]+)$/)
    if (m) { const d = (data[m[1]] || []).find(x => x.id === decodeURIComponent(m[2])); return d ? { ok: true, json: async () => fsDoc(m[1], d.id, (({ id, ...o }) => o)(d)).document } : { ok: false, status: 404, json: async () => ({}) } }
    return { ok: false, status: 404, json: async () => ({}) }
  })
  return { f, patches }
}

describe('linkByCode', () => {
  const now = Date.parse('2026-11-21T03:00:00Z')
  it('links the customer and their bookings, baselines status, replies with current status', async () => {
    const { f, patches } = fakeFs({
      customers: [{ id: 'c1', firstName: 'สมชาย', lastName: 'ใจดี', lineLinkCode: 'ABC234', lineLinkCodeAt: '2026-11-20T00:00:00Z' }],
      bookings: [{ id: 'b1', customerId: 'c1', status: 'รอรถ', model: 'S07', custName: 'สมชาย ใจดี' }],
    })
    const r = await linkByCode(env, 'tok', { code: 'ABC234', userId: U, nowMs: now }, f)
    expect(r.linked).toBe(true)
    expect(r.reply).toContain('ผูก LINE เรียบร้อย')
    expect(r.reply).toContain('ไฟแนนซ์อนุมัติ')
    expect(r.reply).toContain('เลิกรับ')
    const cp = patches.find(p => p.url.includes('/customers/c1'))
    expect(cp.fields.lineUserId.stringValue).toBe(U)
    expect(cp.fields.lineLinkCode.stringValue).toBe('')
    expect(cp.fields.lineConsentAt.stringValue).toBe(new Date(now).toISOString())
    const bp = patches.find(p => p.url.includes('/bookings/b1'))
    expect(bp.fields.statusLineSent.stringValue).toBe('รอรถ')
    expect(bp.url).toContain('currentDocument.exists=true')
  })
  it('rejects unknown or expired codes', async () => {
    const { f, patches } = fakeFs({ customers: [{ id: 'c1', lineLinkCode: 'ABC234', lineLinkCodeAt: '2026-09-01T00:00:00Z' }], bookings: [] })
    const r = await linkByCode(env, 'tok', { code: 'ABC234', userId: U, nowMs: now }, f)
    expect(r.linked).toBe(false)
    expect(r.reply).toContain('หมดอายุ')
    expect(patches).toHaveLength(0)
  })
  it('linking from a booking also links its customer', async () => {
    const { f, patches } = fakeFs({ customers: [], bookings: [{ id: 'b1', customerId: 'c9', status: 'รอส่งมอบ', lineLinkCode: 'ZZZ999', lineLinkCodeAt: '2026-11-20T00:00:00Z', custName: 'มานี' }] })
    const r = await linkByCode(env, 'tok', { code: 'ZZZ999', userId: U, nowMs: now }, f)
    expect(r.linked).toBe(true)
    expect(patches.some(p => p.url.includes('/customers/c9'))).toBe(true)
    expect(r.reply).toContain('คุณมานี')
  })
})

describe('setOptOut / markFollow', () => {
  it('opts out every doc with this LINE and replies', async () => {
    const { f, patches } = fakeFs({ customers: [{ id: 'c1', lineUserId: U }], bookings: [{ id: 'b1', lineUserId: U }] })
    const t = await setOptOut(env, 'tok', { userId: U, out: true }, f)
    expect(t).toContain('หยุดส่งข้อความอัตโนมัติ')
    expect(patches).toHaveLength(2)
    expect(patches.every(p => p.fields.lineOptOut.booleanValue === true)).toBe(true)
  })
  it('returns empty for people who are not linked customers (e.g. staff)', async () => {
    const { f } = fakeFs({ customers: [], bookings: [] })
    expect(await setOptOut(env, 'tok', { userId: U, out: true }, f)).toBe('')
  })
  it('records block / unblock', async () => {
    const { f, patches } = fakeFs({ customers: [{ id: 'c1', lineUserId: U }], bookings: [] })
    expect(await markFollow(env, 'tok', { userId: U, follow: false }, f)).toBe(1)
    expect(patches[0].fields.lineBlockedAt.stringValue).toBeTruthy()
    await markFollow(env, 'tok', { userId: U, follow: true }, f)
    expect(patches[1].fields.lineBlockedAt.nullValue).toBe(null)
  })
  it('linkedReply mentions opt-out', () => {
    expect(linkedReply({ name: 'ก ข' })).toContain('คุณก')
  })
})
