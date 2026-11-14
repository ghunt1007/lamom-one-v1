import { describe, it, expect } from 'vitest'
import { pickStaleLeads, inNudgeHours, nudgeText, runLeadNudge } from './leadNudge.js'

const NOW = Date.parse('2026-11-14T08:00:00Z') // 15:00 ไทย
const ago = min => new Date(NOW - min * 60000).toISOString()
const lead = (over = {}) => ({ id: 'c1', autoLead: true, stage: 'pp', firstName: 'สมชาย', lastName: 'ใจดี', phone: '0812345678', interestedModel: 'S07', assignedTo: 'นภา', createdAt: ago(45), ...over })

describe('pickStaleLeads', () => {
  it('picks auto leads older than 30 minutes with no contact', () => {
    const list = [lead(), lead({ id: 'new', createdAt: ago(10) }), lead({ id: 'old', createdAt: ago(19 * 60) }), lead({ id: 'done', lastContactAt: ago(5) }),
      lead({ id: 'nudged', leadNudgedAt: ago(5) }), lead({ id: 'manual', autoLead: false }), lead({ id: 'lost', isLost: true }), lead({ id: 'booked', stage: 'booking' }), lead({ id: 'bad', createdAt: 'x' }), null]
    expect(pickStaleLeads(list, NOW).map(c => c.id)).toEqual(['c1'])
  })
  it('a lead from last night is still picked in the morning', () => expect(pickStaleLeads([lead({ createdAt: ago(10 * 60) })], NOW).length).toBe(1))
})

describe('inNudgeHours', () => {
  it('only 08:30–20:00 Thai time', () => {
    expect(inNudgeHours(Date.parse('2026-11-14T01:29:00Z'))).toBe(false) // 08:29
    expect(inNudgeHours(Date.parse('2026-11-14T01:30:00Z'))).toBe(true)
    expect(inNudgeHours(Date.parse('2026-11-14T12:59:00Z'))).toBe(true) // 19:59
    expect(inNudgeHours(Date.parse('2026-11-14T13:00:00Z'))).toBe(false)
  })
})

describe('nudgeText', () => {
  it('says how long, who, phone and link', () => {
    const t = nudgeText(lead(), { appUrl: 'https://a/', now: NOW })
    expect(t).toContain('45 นาที'); expect(t).toContain('081-234-5678'); expect(t).toContain('ผู้ดูแล: นภา'); expect(t).toContain('https://a/crm/customers?id=c1')
    expect(nudgeText(lead({ createdAt: ago(200), assignedTo: '' }), { now: NOW })).toContain('3 ชั่วโมง')
  })
})

describe('runLeadNudge', () => {
  const mk = (over = {}) => {
    const pushes = [], notes = [], marks = []
    return { pushes, notes, marks, deps: { now: NOW, appUrl: 'https://a', listRecent: async () => [lead(), lead({ id: 'c2', assignedTo: '' })], mark: async id => { marks.push(id); return true },
      salesTargets: () => [{ name: 'นภา', userId: 'UN' }], ownerTarget: () => 'UOWNER', pushLine: async (to, text) => { pushes.push([to, text]); return true }, notify: async b => { notes.push(b) }, ...over } }
  }
  it('marks first, then LINE to the assignee (or the owner) and notifies in-app', async () => {
    const h = mk()
    expect(await runLeadNudge(h.deps)).toEqual({ stale: 2, nudged: 2 })
    expect(h.marks).toEqual(['c1', 'c2']); expect(h.pushes.map(p => p[0])).toEqual(['UN', 'UOWNER'])
    expect(h.notes[0]).toMatchObject({ roles: ['manager'], names: ['นภา'] }); expect(h.notes[1].roles).toEqual(['manager', 'sales'])
  })
  it('sends nothing when the mark fails, outside hours, or when switched off', async () => {
    const a = mk({ mark: async () => false }); expect((await runLeadNudge(a.deps)).nudged).toBe(0); expect(a.pushes.length).toBe(0)
    const b = mk({ now: Date.parse('2026-11-14T15:00:00Z') }); expect(await runLeadNudge(b.deps)).toEqual({ stale: 0, nudged: 0 })
    const c = mk({ enabled: false }); expect(await runLeadNudge(c.deps)).toEqual({ stale: 0, nudged: 0 })
  })
  it('never throws', async () => {
    expect(await runLeadNudge({ now: NOW, listRecent: async () => { throw new Error('x') } })).toEqual({ stale: 0, nudged: 0 })
    const h = mk({ pushLine: async () => { throw new Error('y') }, notify: async () => { throw new Error('z') } })
    expect((await runLeadNudge(h.deps)).nudged).toBe(2)
  })
})
