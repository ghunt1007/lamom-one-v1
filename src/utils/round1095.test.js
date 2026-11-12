import { describe, it, expect, vi } from 'vitest'
import { parseLamiCommand, runLamiCommand } from './lamiCommands.js'

const today = '2026-11-12'
const cs = () => [{ id: 'a', firstName: 'สมชาย', lastName: 'ใจดี', phone: '0811111111', stage: 'lead', temperature: 'warm', assignedTo: 'เซลส์ หนึ่ง' }, { id: 'b', firstName: 'มานี', lastName: 'มีสุข', stage: 'pp', assignedTo: 'เซลส์ สอง' }]
describe('v1.0.1094 customer-edit commands', () => {
  it('lost with reason', () => {
    const [c] = parseLamiCommand('สมชายเสียดีล ซื้อยี่ห้ออื่น', cs(), today)
    expect(c).toMatchObject({ kind: 'lost', reason: 'ซื้อยี่ห้ออื่น' })
    expect(parseLamiCommand('สมชายซื้อที่อื่นแล้ว', cs(), today)[0].reason).toBe('ซื้อที่อื่นแล้ว')
    expect(parseLamiCommand('สมชายไม่ซื้อแล้วเหรอ?', cs(), today)).toEqual([])
  })
  it('phone, model, assign', () => {
    expect(parseLamiCommand('สมชายเบอร์ 082-222-2222', cs(), today)[0]).toMatchObject({ kind: 'phone', phone: '0822222222' })
    expect(parseLamiCommand('สมชายสนใจ AION V', cs(), today)[0]).toMatchObject({ kind: 'model', model: 'AION V' })
    expect(parseLamiCommand('สมชายสนใจผ่อน 60 งวด', cs(), today).map(x => x.kind)).not.toContain('model')
    expect(parseLamiCommand('มอบสมชายให้เซลส์ สอง', cs(), today)[0]).toMatchObject({ kind: 'assign', to: 'เซลส์ สอง' })
    expect(parseLamiCommand('ให้เซลส์ สอง ดูแลสมชาย', cs(), today)[0]).toMatchObject({ kind: 'assign', to: 'เซลส์ สอง' })
    expect(parseLamiCommand('มอบสมชายให้คนที่ไม่มีในระบบ', cs(), today)).toEqual([])
  })
  it('showroom visit follow-up type', () => {
    expect(parseLamiCommand('นัดสมชายมาโชว์รูมเสาร์ 10 โมง', cs(), today)[0].type).toBe('visit')
  })
  it('runs', async () => {
    const db = { updateDocData: vi.fn(async () => {}) }
    const [lost] = parseLamiCommand('สมชายเสียดีล ราคา', cs(), today)
    expect(await runLamiCommand(lost, { db })).toContain('เสียดีลแล้ว (ราคา)')
    expect(db.updateDocData.mock.calls[0][2]).toMatchObject({ isLost: true, lostReason: 'ราคา' })
    const [as] = parseLamiCommand('มอบสมชายให้เซลส์ สอง', cs(), today)
    await runLamiCommand(as, { db })
    expect(db.updateDocData.mock.calls.at(-1)[2]).toEqual({ assignedTo: 'เซลส์ สอง' })
  })
})
