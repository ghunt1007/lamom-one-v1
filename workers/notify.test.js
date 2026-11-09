import { describe, it, expect } from 'vitest'
import { cleanNotify, notifyTargets, notificationWrites, handleNotify } from './notify.js'

const users = [
  { id: 'own', role: 'owner', displayName: 'เจ้าของ' },
  { id: 'fin1', role: 'finance', displayName: 'บัญชี หนึ่ง' },
  { id: 'fin2', role: 'finance', displayName: 'บัญชี สอง', active: false },
  { id: 's1', role: 'sales', displayName: 'สมชาย ใจดี' },
  { id: 's2', role: 'sales', displayName: 'Sales B' },
  { id: 'hr1', role: 'hr', displayName: 'HR' },
  { id: 'p1', role: 'pending', displayName: 'สมชาย' },
]
const staff = [{ uid: 's2', firstName: 'วิชัย', lastName: 'ขายดี', nickname: 'บอย' }]

describe('cleanNotify', () => {
  it('needs a title and at least one recipient group', () => {
    expect(cleanNotify({ title: '', roles: ['finance'] })).toBe(null)
    expect(cleanNotify({ title: 'x' })).toBe(null)
    expect(cleanNotify({ title: 'x', roles: ['owner', 'admin'] })).toBe(null)
  })
  it('keeps only allowed roles, safe links, trimmed text', () => {
    const n = cleanNotify({ title: ' t ', roles: ['finance', 'owner'], link: '//evil.com', body: 'b'.repeat(2000), exclude: ['a', ''] })
    expect(n.roles).toEqual(['finance'])
    expect(n.link).toBe('')
    expect(n.body.length).toBe(1000)
    expect(n.title).toBe('t')
    expect(n.exclude).toEqual(['a'])
    expect(cleanNotify({ title: 't', names: ['A'], link: '/crm/bookings' }).link).toBe('/crm/bookings')
  })
})

describe('notifyTargets', () => {
  it('picks everyone in the role except owner/admin, inactive, pending and the sender', () => {
    expect(notifyTargets(users, [], { roles: ['finance'] }, 'x')).toEqual(['fin1'])
    expect(notifyTargets(users, [], { roles: ['finance'] }, 'fin1')).toEqual([])
  })
  it('matches names by display name, first word, nickname or full staff name', () => {
    expect(notifyTargets(users, staff, { names: ['สมชาย'] })).toEqual(['s1'])
    expect(notifyTargets(users, staff, { names: ['คุณสมชาย ใจดี'] })).toEqual(['s1'])
    expect(notifyTargets(users, staff, { names: ['บอย'] })).toEqual(['s2'])
    expect(notifyTargets(users, staff, { names: ['วิชัย ขายดี'] })).toEqual(['s2'])
    expect(notifyTargets(users, staff, { names: ['ไม่มีคนนี้'] })).toEqual([])
  })
  it('skips uids already notified directly', () => {
    expect(notifyTargets(users, staff, { names: ['สมชาย'], roles: ['hr'], exclude: ['s1'] })).toEqual(['hr1'])
  })
})

describe('notificationWrites + handleNotify', () => {
  it('builds one create per recipient with userId', () => {
    let i = 0
    const w = notificationWrites('p', ['a', 'b'], { type: 'finance', title: 't', body: 'b', link: '/x' }, '2026-11-10T00:00:00.000Z', () => 'id' + (++i))
    expect(w).toHaveLength(2)
    expect(w[0].update.name).toBe('projects/p/databases/(default)/documents/notifications/id1')
    expect(w[1].update.fields.userId.stringValue).toBe('b')
    expect(w[0].update.fields.read.booleanValue).toBe(false)
    expect(w[0].currentDocument).toEqual({ exists: false })
  })
  it('queries users and commits notifications', async () => {
    const calls = []
    const r = await handleNotify({ title: 'โอนแล้ว', roles: ['finance'], link: '/crm/bookings' }, {
      uid: 's1', projectId: 'p', getAccessToken: async () => 'tok',
      runQuery: async (tok, c) => (c === 'users' ? users : staff),
      fetch: async (url, opt) => { calls.push(JSON.parse(opt.body)); return { ok: true } },
    })
    expect(r).toEqual({ status: 200, body: { sent: 1 } })
    expect(calls[0].writes[0].update.fields.userId.stringValue).toBe('fin1')
  })
  it('rejects empty requests and sends nothing when nobody matches', async () => {
    expect((await handleNotify({}, {})).status).toBe(400)
    const r = await handleNotify({ title: 't', names: ['ไม่มี'] }, { uid: 'x', projectId: 'p', getAccessToken: async () => 't', runQuery: async (t, c) => (c === 'users' ? users : []), fetch: async () => { throw new Error('should not call') } })
    expect(r.body.sent).toBe(0)
  })
})
