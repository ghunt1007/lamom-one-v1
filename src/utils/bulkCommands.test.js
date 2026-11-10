import { describe, it, expect } from 'vitest'
import { parseBulkSpec, bulkTargets, bulkCommands, bulkIntro } from './bulkCommands.js'

const T = '2026-11-10' // อังคาร
const cs = [
  { id: 'a', firstName: 'สมชาย', stage: 'lead', temperature: 'hot', lastContactAt: '2026-11-01T03:00:00Z', createdAt: '2026-10-20T03:00:00Z' },
  { id: 'b', firstName: 'มานี', stage: 'pp', temperature: 'hot', lastContactAt: '2026-11-09T03:00:00Z' },
  { id: 'c', firstName: 'ปิติ', stage: 'lead', temperature: 'warm', createdAt: '2026-11-10T02:00:00Z' },
  { id: 'd', firstName: 'ชูใจ', stage: 'lead', temperature: 'hot', isLost: true },
  { id: 'e', firstName: 'วีระ', stage: 'booking', temperature: 'hot', bookingId: 'bk' },
  { id: 'f', firstName: 'ดวงใจ', stage: 'lead', temperature: 'hot' },
]
const fus = [{ customerId: 'f', status: 'pending', dueDate: '2026-11-12' }, { customerId: 'a', status: 'done', dueDate: '2026-11-01' }]

describe('คำสั่งกลุ่ม (v1.0.1039)', () => {
  it('อ่านประโยค', () => {
    expect(parseBulkSpec('นัดโทรลูกค้า hot ทุกคนพรุ่งนี้ 10 โมง', T)).toMatchObject({ temp: 'hot', dueDate: '2026-11-11', time: '10:00', type: 'call' })
    expect(parseBulkSpec('นัดลูกค้าที่เงียบเกิน 7 วันทั้งหมด พรุ่งนี้', T)).toMatchObject({ quietDays: 7, dueDate: '2026-11-11' })
    expect(parseBulkSpec('ทักไลน์ลีดใหม่วันนี้ทุกคน พรุ่งนี้บ่ายสอง', T)).toMatchObject({ newToday: true, type: 'line', dueDate: '2026-11-11', time: '14:00' })
    expect(parseBulkSpec('นัดสมชายพรุ่งนี้', T)).toBe(null)
    expect(parseBulkSpec('ลูกค้า hot ทุกคนมีกี่คน', T)).toBe(null)
    expect(parseBulkSpec('นัดลูกค้า hot ทุกคน', T)).toBe(null)
  })
  it('เลือกคนถูก: ข้ามเสียดีล/จองแล้ว/มีนัดค้าง', () => {
    const r = bulkTargets({ customers: cs, followups: fus, today: T, spec: parseBulkSpec('นัดโทรลูกค้า hot ทุกคนพรุ่งนี้ 10 โมง', T) })
    expect(r.list.map(c => c.id)).toEqual(['a', 'b'])
    expect(r.skipped).toBe(1)
    const q = bulkTargets({ customers: cs, followups: fus, today: T, spec: parseBulkSpec('นัดลูกค้าที่เงียบเกิน 7 วันทั้งหมด พรุ่งนี้', T) })
    expect(q.list.map(c => c.id)).toEqual(['a'])
    const n = bulkTargets({ customers: cs, followups: fus, today: T, spec: parseBulkSpec('โทรลีดใหม่วันนี้ทุกคน พรุ่งนี้ 9 โมง', T) })
    expect(n.list.map(c => c.id)).toEqual(['c'])
  })
  it('คำสั่ง + ข้อความ', () => {
    const spec = parseBulkSpec('นัดโทรลูกค้า hot ทุกคนพรุ่งนี้ 10 โมง', T)
    const r = bulkTargets({ customers: cs, followups: fus, today: T, spec })
    const cmds = bulkCommands(r.list, spec)
    expect(cmds[0]).toMatchObject({ kind: 'fu', dueDate: '2026-11-11', time: '10:00' })
    expect(bulkIntro(spec, r)).toContain('2 คน')
    expect(bulkIntro(spec, { list: [], skipped: 3, more: 0 })).toContain('3 คน')
  })
})
