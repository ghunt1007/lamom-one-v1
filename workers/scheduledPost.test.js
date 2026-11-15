import { describe, it, expect } from 'vitest'
import { cleanPostSchedule, schedulePost, unschedulePost, listScheduledPosts, runScheduledPosts, summarizePostResult, POST_QUEUE_PREFIX, POST_LOG_PREFIX, LOG_KEEP_MS } from './scheduledPost.js'
import { MAX_LATE_MS, runScheduledSends } from './scheduledSend.js'

const NOW = Date.parse('2026-11-15T02:00:00Z')
const env = { FIREBASE_PROJECT_ID: 'p', META_SYSTEM_USER_TOKEN: 't' }
const ok = (body = {}) => ({ ok: true, json: async () => body })
const sv = v => ({ stringValue: v })
const base = { pageIds: ['111', '111', '222'], pageNames: ['Deepal EV Car', 'Deepal แคมเปญ'], message: ' โปรสิ้นปี ', at: new Date(NOW + 3600e3).toISOString() }
const doc = (docId, fields) => ({ name: `projects/p/databases/(default)/documents/system_integrations/${docId}`, updateTime: '2026-11-15T01:00:00Z', fields })
const qdoc = (id, at, extra = {}) => doc(POST_QUEUE_PREFIX + id, { kind: sv('meta-post'), message: sv('โพสต์'), imageUrl: sv(''), link: sv(''), at: sv(at), toInstagram: { booleanValue: false }, pageIds: { arrayValue: { values: [sv('111')] } }, pageNames: { arrayValue: { values: [sv('Deepal EV Car')] } }, by: sv('กอล์ฟ'), ...extra })

describe('cleanPostSchedule', () => {
  it('dedupes pages, trims text, normalises time', () => {
    expect(cleanPostSchedule(base, NOW)).toMatchObject({ pageIds: ['111', '222'], message: 'โปรสิ้นปี', toInstagram: false, at: new Date(NOW + 3600e3).toISOString() })
  })
  it('rejects bad input', () => {
    expect(() => cleanPostSchedule({ ...base, pageIds: [] }, NOW)).toThrow(/เลือกเพจ/)
    expect(() => cleanPostSchedule({ ...base, message: '' }, NOW)).toThrow(/พิมพ์ข้อความ/)
    expect(() => cleanPostSchedule({ ...base, toInstagram: true }, NOW)).toThrow(/Instagram/)
    expect(() => cleanPostSchedule({ ...base, at: new Date(NOW - 1).toISOString() }, NOW)).toThrow(/ผ่านไปแล้ว/)
    expect(() => cleanPostSchedule({ ...base, at: new Date(NOW + 61 * 864e5).toISOString() }, NOW)).toThrow(/60 วัน/)
    expect(() => cleanPostSchedule({ ...base, at: 'x' }, NOW)).toThrow(/ไม่ถูกต้อง/)
    expect(() => cleanPostSchedule({ ...base, link: 'javascript:1' }, NOW)).toThrow(/https/)
  })
})

describe('schedulePost / unschedulePost / list', () => {
  it('only managers, marketing and owner may schedule', async () => {
    await expect(schedulePost(env, 'tok', base, { role: 'sales', now: NOW })).rejects.toMatchObject({ status: 403 })
    await expect(unschedulePost(env, 'tok', { id: 'a' }, { role: 'sales' })).rejects.toMatchObject({ status: 403 })
  })
  it('reports not configured without a Meta token', async () => {
    expect(await schedulePost({ FIREBASE_PROJECT_ID: 'p' }, 'tok', base, { role: 'owner', now: NOW })).toMatchObject({ configured: false })
  })
  it('writes one queue doc in the owner-only collection', async () => {
    const calls = []
    const fetchImpl = async (url, init = {}) => { calls.push([init.method || 'GET', url, init.body]); return ok({ documents: [] }) }
    const r = await schedulePost(env, 'tok', base, { role: 'marketing', by: 'กอล์ฟ', now: NOW, fetchImpl, newId: () => 'abc/1' })
    expect(r).toMatchObject({ scheduled: true, id: 'abc1' })
    const [m, url, body] = calls[1]
    expect(m).toBe('PATCH'); expect(url).toContain('/system_integrations/sched_post_abc1')
    const f = JSON.parse(body).fields
    expect(f.kind.stringValue).toBe('meta-post'); expect(f.pageIds.arrayValue.values.map(v => v.stringValue)).toEqual(['111', '222']); expect(f.by.stringValue).toBe('กอล์ฟ')
  })
  it('caps the number of pending posts', async () => {
    const docs = Array.from({ length: 50 }, (_, i) => qdoc('x' + i, new Date(NOW + 3600e3).toISOString()))
    await expect(schedulePost(env, 'tok', base, { role: 'owner', now: NOW, fetchImpl: async () => ok({ documents: docs }) })).rejects.toThrow(/สูงสุด 50/)
  })
  it('lists pending by time and recent results, without other integration docs', async () => {
    const docs = [qdoc('b', '2026-11-16T03:00:00.000Z'), qdoc('a', '2026-11-15T03:00:00.000Z'), doc('secrets', { v: sv('x') }), doc('sched_BC1', { kind: sv('line-broadcast'), at: sv('2026-11-15T03:00:00.000Z') }), doc(POST_LOG_PREFIX + 'z', { kind: sv('meta-post-log'), status: sv('sent'), note: sv('Facebook 1/1 เพจ'), doneAt: sv('2026-11-14T03:00:00.000Z'), at: sv('2026-11-14T03:00:00.000Z') })]
    const r = await listScheduledPosts(env, 'tok', { fetchImpl: async () => ok({ documents: docs }) })
    expect(r.pending.map(x => x.id)).toEqual(['a', 'b'])
    expect(r.recent).toHaveLength(1); expect(r.recent[0]).toMatchObject({ id: 'z', status: 'sent' })
    expect(JSON.stringify(r)).not.toContain('secrets')
  })
})

describe('summarizePostResult', () => {
  it('sent, partial and failed', () => {
    expect(summarizePostResult({ results: [{ name: 'A', facebook: { ok: true } }] })).toMatchObject({ status: 'sent', note: 'Facebook 1/1 เพจ' })
    expect(summarizePostResult({ results: [{ name: 'A', facebook: { ok: true }, instagram: { ok: false, error: 'รูปเล็กไป' } }] }).status).toBe('partial')
    expect(summarizePostResult({ results: [{ name: 'A', facebook: { ok: false, error: 'หมดอายุ' } }] })).toMatchObject({ status: 'failed' })
    expect(summarizePostResult({ results: [] }).status).toBe('failed')
  })
})

describe('runScheduledPosts', () => {
  const run = async (docs, { delOk = true, post } = {}) => {
    const calls = []
    const fetchImpl = async (url, init = {}) => {
      calls.push([init.method || 'GET', url, init.body])
      if (!init.method) return ok({ documents: docs })
      if (init.method === 'DELETE') return { ok: delOk }
      return ok()
    }
    const posted = []
    const out = await runScheduledPosts(env, 'tok', { now: NOW, fetchImpl, post: post || (async p => { posted.push(p); return { configured: true, results: [{ name: 'Deepal EV Car', facebook: { ok: true } }] } }) })
    return { out, calls, posted }
  }
  it('posts due items once: deletes the queue doc first, then logs the result', async () => {
    const { out, calls, posted } = await run([qdoc('a', new Date(NOW - 60e3).toISOString()), qdoc('later', new Date(NOW + 3600e3).toISOString())])
    expect(out).toMatchObject({ checked: 2, sent: 1, failed: 0, missed: 0 })
    expect(posted).toEqual([{ pageIds: ['111'], message: 'โพสต์', imageUrl: '', link: '', toInstagram: false }])
    const kinds = calls.map(c => c[0])
    expect(kinds).toEqual(['GET', 'DELETE', 'PATCH'])
    expect(calls[1][1]).toContain('sched_post_a?currentDocument.updateTime=')
    expect(calls[2][1]).toContain('/system_integrations/postlog_a')
    expect(JSON.parse(calls[2][2]).fields.status.stringValue).toBe('sent')
  })
  it('does not post when another run already claimed the item', async () => {
    const { out, posted } = await run([qdoc('a', new Date(NOW - 60e3).toISOString())], { delOk: false })
    expect(posted).toHaveLength(0); expect(out.sent).toBe(0)
  })
  it('never posts something more than 6 hours late', async () => {
    const { out, posted, calls } = await run([qdoc('old', new Date(NOW - MAX_LATE_MS - 60e3).toISOString())])
    expect(posted).toHaveLength(0); expect(out.missed).toBe(1)
    expect(JSON.parse(calls[2][2]).fields.status.stringValue).toBe('missed')
  })
  it('logs a failure when posting throws', async () => {
    const { out, calls } = await run([qdoc('a', new Date(NOW - 60e3).toISOString())], { post: async () => { throw new Error('token หมดอายุ') } })
    expect(out.failed).toBe(1)
    expect(JSON.parse(calls[2][2]).fields.note.stringValue).toContain('token หมดอายุ')
  })
  it('removes result logs older than 14 days', async () => {
    const { out } = await run([doc(POST_LOG_PREFIX + 'z', { kind: sv('meta-post-log'), doneAt: sv(new Date(NOW - LOG_KEEP_MS - 1000).toISOString()) })])
    expect(out.cleaned).toBe(1)
  })
  it('LINE broadcast runner ignores post queue docs', async () => {
    let sent = 0
    const fetchImpl = async (url, init = {}) => (!init.method ? ok({ documents: [qdoc('a', new Date(NOW - 60e3).toISOString())] }) : ok())
    const out = await runScheduledSends({ ...env, LINE_CHANNEL_ACCESS_TOKEN: 'x' }, 'tok', { now: NOW, fetchImpl, send: async () => { sent++; return {} } })
    expect(sent).toBe(0); expect(out.checked).toBe(0)
  })
})
