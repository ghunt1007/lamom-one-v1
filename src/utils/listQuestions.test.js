import { describe, it, expect } from 'vitest'
import { parseListSpec, listTargets, listCommands, listIntro, listFollowUp, LIST_MAX } from './listQuestions.js'
import { parseBulkSpec } from './bulkCommands.js'
import { isCallListQuestion } from './callList.js'

const today = '2026-11-11'
const iso = d => new Date(d + 'T05:00:00Z').toISOString()
const cs = [
  { id: 'a', firstName: 'สมชาย', stage: 'lead', temperature: 'hot', phone: '0811111111', interestedModel: 'DEEPAL S05', lastContactAt: iso('2026-11-01'), createdAt: iso('2026-10-01') },
  { id: 'b', firstName: 'มานี', stage: 'pp', temperature: 'warm', phone: '', interestedModel: 'DEEPAL S07', lastContactAt: iso('2026-11-10'), createdAt: iso('2026-10-01') },
  { id: 'c', firstName: 'ปิติ', stage: 'lead', temperature: 'hot', phone: '0822222222', createdAt: iso('2026-11-11') },
  { id: 'd', firstName: 'วีระ', stage: 'lead', temperature: 'hot', isLost: true, createdAt: iso('2026-10-01') },
  { id: 'e', firstName: 'ชูใจ', stage: 'booked', bookingId: 'x', temperature: 'hot', createdAt: iso('2026-10-01') },
]
const fus = [{ customerId: 'a', status: 'pending' }]

describe('parseListSpec', () => {
  it('reads list questions', () => {
    expect(parseListSpec('ลูกค้า hot มีใครบ้าง')).toMatchObject({ temp: 'hot' })
    expect(parseListSpec('ใครเงียบเกิน 10 วัน')).toMatchObject({ quietDays: 10 })
    expect(parseListSpec('ใครเงียบไปบ้าง?')).toMatchObject({ quietDays: 7 })
    expect(parseListSpec('ใครยังไม่มีนัด')).toMatchObject({ noFu: true })
    expect(parseListSpec('ลีดใหม่วันนี้มีใครบ้าง')).toMatchObject({ newToday: true, leadsOnly: true })
    expect(parseListSpec('ลูกค้าสนใจ S05 มีใครบ้าง')).toMatchObject({ model: 's05' })
    expect(parseListSpec('ลูกค้า hot กี่คน')).toMatchObject({ temp: 'hot', countOnly: true })
  })
  it('ignores other sentences', () => {
    for (const q of ['นัดสมชายพรุ่งนี้ 10 โมง', 'สมชาย hot', 'วันนี้ควรโทรหาใคร', 'นัดลูกค้า hot ทุกคนพรุ่งนี้ 10 โมง', 'ยอดขายเดือนนี้กี่คัน', 'มีใครบ้าง', 'เซลส์คนไหนขายดี', ''])
      expect(parseListSpec(q)).toBe(null)
  })
  it('does not steal bulk commands or call-list questions', () => {
    expect(parseBulkSpec('ลูกค้า hot มีใครบ้าง', today)).toBe(null)
    expect(isCallListQuestion('ลูกค้า hot มีใครบ้าง')).toBe(false)
  })
})

describe('listTargets', () => {
  const run = q => listTargets({ customers: cs, followups: fus, today, spec: parseListSpec(q) })
  it('filters by temperature and skips lost/booked', () => {
    expect(run('ลูกค้า hot มีใครบ้าง').list.map(x => x.c.id)).toEqual(['a', 'c'])
  })
  it('quiet, no follow-up, model, new today', () => {
    expect(run('ใครเงียบเกิน 7 วัน').list.map(x => x.c.id)).toEqual(['a'])
    expect(run('ใครยังไม่มีนัด').list.map(x => x.c.id)).toEqual(['c', 'b'])
    expect(run('ลูกค้าสนใจ S07 มีใครบ้าง').list.map(x => x.c.id)).toEqual(['b'])
    expect(run('ลีดใหม่วันนี้มีใครบ้าง').list.map(x => x.c.id)).toEqual(['c'])
  })
  it('caps the list and keeps the total', () => {
    const many = [...Array(25)].map((_, i) => ({ id: 'm' + i, firstName: 'ก' + i, stage: 'lead', temperature: 'hot', createdAt: iso('2026-11-01') }))
    const r = listTargets({ customers: many, today, spec: parseListSpec('ลูกค้า hot มีใครบ้าง') })
    expect(r.list.length).toBe(LIST_MAX); expect(r.total).toBe(25)
    expect(listIntro(parseListSpec('ลูกค้า hot มีใครบ้าง'), r)).toContain('25 คน')
  })
})

describe('listCommands / intro', () => {
  it('call button when there is a phone, open otherwise', () => {
    const spec = parseListSpec('ใครยังไม่มีนัด')
    const r = listTargets({ customers: cs, followups: fus, today, spec })
    const cmds = listCommands(r.list)
    expect(cmds.map(c => c.kind)).toEqual(['tel', 'open'])
    expect(cmds[0].desc).toContain('ยังไม่มีนัด')
  })
  it('empty and follow-up', () => {
    const spec = parseListSpec('ลูกค้า cold มีใครบ้าง')
    const r = listTargets({ customers: cs, today, spec })
    expect(listIntro(spec, r)).toContain('ไม่มี')
    expect(listFollowUp(spec, r)).toBe('')
    const s2 = parseListSpec('ลูกค้า hot มีใครบ้าง')
    const f = listFollowUp(s2, listTargets({ customers: cs, today, spec: s2 }))
    expect(parseBulkSpec(f, today)).toMatchObject({ temp: 'hot' })
  })
})

describe('listFollowUp is a valid bulk command for every filter', () => {
  it.each(['ลูกค้า hot มีใครบ้าง', 'ใครเงียบเกิน 7 วัน', 'ใครยังไม่มีนัด', 'ลีดใหม่วันนี้มีใครบ้าง'])('%s', q => {
    const spec = parseListSpec(q)
    const f = listFollowUp(spec, { total: 3 })
    expect(parseBulkSpec(f, today)).not.toBe(null)
  })
})
