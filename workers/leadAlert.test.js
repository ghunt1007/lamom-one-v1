import { describe, it, expect } from 'vitest'
import { leadAlertText, salesLineId, alertNewLead, fmtPhone } from './leadAlert.js'

const lead = { first: 'สมชาย', last: 'ใจดี', phone: '0812345678', model: 'DEEPAL S07', note: 'ขอใบเสนอราคา', source: 'tiktok', assignedTo: 'นภา' }

describe('leadAlertText', () => {
  it('has name, formatted phone, model, source and a link to the customer', () => {
    const t = leadAlertText(lead, { id: 'c1', appUrl: 'https://app.example/' })
    expect(t).toContain('ลีดใหม่เข้ามา (TikTok)'); expect(t).toContain('สมชาย ใจดี'); expect(t).toContain('081-234-5678')
    expect(t).toContain('DEEPAL S07'); expect(t).toContain('https://app.example/crm/customers?id=c1'); expect(t).toContain('โทรกลับภายใน 5 นาที')
    expect(t).not.toContain('ผู้ดูแล')
  })
  it('owner copy says who looks after it, or that nobody does', () => {
    expect(leadAlertText(lead, { forOwner: true })).toContain('ผู้ดูแล: นภา')
    expect(leadAlertText({ ...lead, assignedTo: '' }, { forOwner: true })).toContain('ยังไม่มีผู้ดูแล')
  })
  it('returning customer and chat-only lead wording', () => {
    expect(leadAlertText(lead, { duplicate: true })).toContain('ลูกค้าเดิมติดต่อเข้ามาอีกครั้ง')
    const t = leadAlertText({ first: '', source: 'facebook', note: 'สนใจครับ' })
    expect(t).toContain('ไม่ระบุชื่อ'); expect(t).toContain('รีบตอบแชต'); expect(t).not.toContain('📞')
  })
  it('fmtPhone leaves odd numbers alone', () => expect(fmtPhone('02-123')).toBe('02123'))
})

describe('salesLineId', () => {
  const targets = [{ name: 'คุณนภา ศรีสุข', userId: 'UN' }, { name: 'วิชัย', userId: 'UV' }, { name: 'ไม่มีไอดี' }]
  it('matches full name, first name and ignores คุณ', () => {
    expect(salesLineId(targets, 'นภา')).toBe('UN'); expect(salesLineId(targets, 'คุณวิชัย')).toBe('UV')
    expect(salesLineId(targets, 'ไม่มีไอดี')).toBe(''); expect(salesLineId(targets, '')).toBe(''); expect(salesLineId(targets, 'ใครไม่รู้')).toBe('')
  })
})

describe('alertNewLead', () => {
  const mk = (over = {}) => {
    const pushes = [], notes = []
    return { pushes, notes, deps: { appUrl: 'https://a', salesTargets: () => [{ name: 'นภา', userId: 'UN' }], ownerTarget: () => 'UOWNER', pushLine: async (to, text) => { pushes.push([to, text]); return true }, notify: async b => { notes.push(b) }, ...over } }
  }
  it('pushes to the assigned salesperson and the owner, and notifies in-app', async () => {
    const h = mk()
    const out = await alertNewLead(lead, { created: true, id: 'c1' }, h.deps)
    expect(out).toEqual({ line: 2, app: true })
    expect(h.pushes.map(p => p[0])).toEqual(['UN', 'UOWNER'])
    expect(h.pushes[1][1]).toContain('ผู้ดูแล: นภา')
    expect(h.notes[0]).toMatchObject({ roles: ['manager'], names: ['นภา'], link: '/crm/customers?id=c1', type: 'lead' })
  })
  it('unassigned lead goes to the owner and to all sales in-app', async () => {
    const h = mk()
    await alertNewLead({ ...lead, assignedTo: '' }, { created: true, id: 'c2' }, h.deps)
    expect(h.pushes.map(p => p[0])).toEqual(['UOWNER'])
    expect(h.notes[0].roles).toEqual(['manager', 'sales']); expect(h.notes[0].body).toContain('ยังไม่มีผู้ดูแล')
  })
  it('does not push twice when the owner is also the salesperson', async () => {
    const h = mk({ ownerTarget: () => 'UN' })
    const out = await alertNewLead(lead, { created: true, id: 'c1' }, h.deps)
    expect(out.line).toBe(1)
  })
  it('stays silent when switched off, on errors, or without an id', async () => {
    const h = mk({ enabled: false })
    expect(await alertNewLead(lead, { created: true, id: 'c1' }, h.deps)).toEqual({ line: 0, app: false })
    const h2 = mk()
    expect(await alertNewLead(lead, { error: 'x' }, h2.deps)).toEqual({ line: 0, app: false })
    expect(await alertNewLead(lead, { created: true }, h2.deps)).toEqual({ line: 0, app: false })
    expect(h2.pushes.length).toBe(0)
  })
  it('never throws when a dependency fails', async () => {
    const h = mk({ salesTargets: () => { throw new Error('x') }, pushLine: async () => { throw new Error('y') }, notify: async () => { throw new Error('z') } })
    expect(await alertNewLead(lead, { duplicate: true, id: 'c1' }, h.deps)).toEqual({ line: 0, app: false })
  })
})
