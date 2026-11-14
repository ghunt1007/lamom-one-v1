import { describe, it, expect } from 'vitest'
import { cleanSchedule, splitQueue, queueId, scheduleSend, unscheduleSend, runScheduledSends, MAX_LATE_MS, SEND_CRON } from './scheduledSend.js'

const NOW = Date.parse('2026-11-14T08:00:00Z')
const U1 = 'U' + 'a'.repeat(32), U2 = 'U' + 'b'.repeat(32)
const env = { FIREBASE_PROJECT_ID: 'p', LINE_CHANNEL_ACCESS_TOKEN: 't' }
const ok = (body = {}) => ({ ok: true, json: async () => body })
const sv = v => ({ stringValue: v })
const qdoc = (id, at, extra = {}) => ({
  name: `projects/p/databases/(default)/documents/system_integrations/sched_${id}`, updateTime: '2026-11-14T07:00:00Z',
  fields: { kind: sv('line-broadcast'), broadcastId: sv(id), text: sv('สวัสดี'), at: sv(at), all: { booleanValue: false }, userIds: { arrayValue: { values: [sv(U1), sv(U2)] } }, ...extra },
})

describe('cleanSchedule', () => {
  const base = { id: 'BC-1', text: ' โปรสิ้นปี ', at: new Date(NOW + 3600e3).toISOString(), userIds: [U1, U1, 'bad', U2] }
  it('trims, dedupes and keeps only LINE ids', () => {
    const q = cleanSchedule(base, NOW)
    expect(q).toMatchObject({ id: 'BC-1', text: 'โปรสิ้นปี', all: false, userIds: [U1, U2] })
  })
  it('all:true needs no ids', () => expect(cleanSchedule({ ...base, userIds: undefined, all: true }, NOW).all).toBe(true))
  it('rejects past, far future, empty text, no recipients, bad date', () => {
    expect(() => cleanSchedule({ ...base, at: new Date(NOW - 1000).toISOString() }, NOW)).toThrow(/ผ่านไปแล้ว/)
    expect(() => cleanSchedule({ ...base, at: new Date(NOW + 61 * 864e5).toISOString() }, NOW)).toThrow(/60 วัน/)
    expect(() => cleanSchedule({ ...base, text: '  ' }, NOW)).toThrow(/ข้อความว่าง/)
    expect(() => cleanSchedule({ ...base, userIds: ['x'] }, NOW)).toThrow(/ไม่มีลูกค้า/)
    expect(() => cleanSchedule({ ...base, at: 'เมื่อวาน' }, NOW)).toThrow(/ไม่ถูกต้อง/)
    expect(() => cleanSchedule({ ...base, id: '' }, NOW)).toThrow()
  })
})

describe('splitQueue / queueId', () => {
  it('separates due, missed and future', () => {
    const r = splitQueue([{ id: 'a', at: new Date(NOW - 60e3).toISOString() }, { id: 'b', at: new Date(NOW - MAX_LATE_MS - 1).toISOString() }, { id: 'c', at: new Date(NOW + 60e3).toISOString() }, { id: 'd', at: 'x' }], NOW)
    expect(r.due.map(x => x.id)).toEqual(['a']); expect(r.missed.map(x => x.id)).toEqual(['b'])
  })
  it('makes a safe doc id', () => expect(queueId('BC/1 ก')).toBe('sched_BC_1__'))
  it('cron runs every 10 minutes', () => expect(SEND_CRON).toBe('*/10 * * * *'))
})

describe('scheduleSend / unscheduleSend', () => {
  const body = { id: 'BC-1', text: 'hi', at: new Date(NOW + 3600e3).toISOString(), userIds: [U1] }
  it('refuses sales staff', async () => {
    await expect(scheduleSend(env, 'tok', body, { role: 'sales', now: NOW, fetchImpl: async () => ok() })).rejects.toMatchObject({ status: 403 })
    await expect(unscheduleSend(env, 'tok', { id: 'BC-1' }, { role: 'sales', fetchImpl: async () => ok() })).rejects.toMatchObject({ status: 403 })
  })
  it('says not configured without a LINE token', async () => {
    expect(await scheduleSend({ FIREBASE_PROJECT_ID: 'p' }, 'tok', body, { role: 'owner', now: NOW, fetchImpl: async () => ok() })).toMatchObject({ configured: false })
  })
  it('writes the queue doc into the owner-only collection', async () => {
    const calls = []
    const r = await scheduleSend(env, 'tok', body, { role: 'owner', by: 'กอล์ฟ', now: NOW, fetchImpl: async (u, i) => { calls.push([u, i]); return ok() } })
    expect(r).toMatchObject({ scheduled: true, recipients: 1 })
    expect(calls[0][0]).toContain('/system_integrations/sched_BC-1'); expect(calls[0][1].method).toBe('PATCH')
    expect(JSON.parse(calls[0][1].body).fields.kind.stringValue).toBe('line-broadcast')
  })
  it('deletes the queue doc on cancel', async () => {
    const calls = []
    await unscheduleSend(env, 'tok', { id: 'BC-1' }, { role: 'manager', fetchImpl: async (u, i) => { calls.push([u, i.method]); return ok() } })
    expect(calls[0]).toEqual([expect.stringContaining('/system_integrations/sched_BC-1'), 'DELETE'])
  })
})

describe('runScheduledSends', () => {
  function harness(docs, { delOk = true } = {}) {
    const calls = []
    const fetchImpl = async (u, i = {}) => {
      calls.push({ u, method: i.method || 'GET', body: i.body ? JSON.parse(i.body) : null })
      if (!i.method) return ok({ documents: docs })
      if (i.method === 'DELETE') return delOk ? ok() : { ok: false, json: async () => ({}) }
      return ok()
    }
    return { calls, fetchImpl }
  }
  const other = { name: 'projects/p/databases/(default)/documents/system_integrations/secrets', fields: { GEMINI_API_KEY: sv('v1:x') } }

  it('sends due items once, deleting the queue doc first, then records the result', async () => {
    const h = harness([other, qdoc('BC-1', new Date(NOW - 60e3).toISOString()), qdoc('BC-2', new Date(NOW + 3600e3).toISOString())])
    const sent = []
    const out = await runScheduledSends(env, 'tok', { fetchImpl: h.fetchImpl, now: NOW, send: async it => { sent.push(it.broadcastId); return { configured: true, sent: 2, failed: 0 } } })
    expect(out).toMatchObject({ checked: 2, sent: 1, failed: 0, missed: 0 })
    expect(sent).toEqual(['BC-1'])
    const order = h.calls.map(c => c.method)
    expect(order).toEqual(['GET', 'DELETE', 'PATCH'])
    expect(h.calls[1].u).toContain('currentDocument.updateTime=')
    const patch = h.calls[2]
    expect(patch.u).toContain('/broadcasts/BC-1'); expect(patch.u).toContain('currentDocument.exists=true')
    expect(patch.body.fields).toMatchObject({ status: sv('sent'), sentBy: sv('auto'), recipients: { integerValue: '2' }, sent: { integerValue: '2' } })
  })
  it('does not send when another run already claimed the item', async () => {
    const h = harness([qdoc('BC-1', new Date(NOW - 60e3).toISOString())], { delOk: false })
    let n = 0
    const out = await runScheduledSends(env, 'tok', { fetchImpl: h.fetchImpl, now: NOW, send: async () => { n++; return {} } })
    expect(n).toBe(0); expect(out.sent).toBe(0)
  })
  it('never sends an item more than 6 hours late; puts it back to draft with a note', async () => {
    const h = harness([qdoc('BC-9', new Date(NOW - MAX_LATE_MS - 60e3).toISOString())])
    let n = 0
    const out = await runScheduledSends(env, 'tok', { fetchImpl: h.fetchImpl, now: NOW, send: async () => { n++; return {} } })
    expect(n).toBe(0); expect(out.missed).toBe(1)
    expect(h.calls[2].body.fields.status).toEqual(sv('draft'))
  })
  it('marks failed when sending throws', async () => {
    const h = harness([qdoc('BC-1', new Date(NOW - 60e3).toISOString())])
    const out = await runScheduledSends(env, 'tok', { fetchImpl: h.fetchImpl, now: NOW, send: async () => { throw new Error('โควตาหมด') } })
    expect(out.failed).toBe(1)
    expect(h.calls[2].body.fields.status).toEqual(sv('failed'))
    expect(h.calls[2].body.fields.scheduleNote.stringValue).toContain('โควตาหมด')
  })
  it('ignores non-queue docs and does nothing without a token or when listing fails', async () => {
    const h = harness([other])
    expect((await runScheduledSends(env, 'tok', { fetchImpl: h.fetchImpl, now: NOW })).checked).toBe(0)
    expect((await runScheduledSends(env, '', { fetchImpl: h.fetchImpl, now: NOW })).checked).toBe(0)
    expect((await runScheduledSends(env, 'tok', { fetchImpl: async () => null, now: NOW })).checked).toBe(0)
  })
})
