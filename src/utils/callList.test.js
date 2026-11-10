import { describe, it, expect } from 'vitest'
import { callList, isCallListQuestion, callListCommands } from './callList.js'

const T = '2026-11-10'
const NOW = Date.UTC(2026, 10, 10, 3)
const cs = [
  { id: 'a', firstName: 'เลย', stage: 'pp', temperature: 'warm', phone: '081-111-1111', lastContactAt: '2026-11-01T03:00:00Z' },
  { id: 'b', firstName: 'วันนี้', stage: 'lead', temperature: 'cold', phone: '0822222222', lastContactAt: '2026-11-09T03:00:00Z' },
  { id: 'c', firstName: 'เงียบ', stage: 'lead', temperature: 'hot', phone: '0833333333', lastContactAt: '2026-11-05T03:00:00Z' },
  { id: 'd', firstName: 'เพิ่งคุย', stage: 'lead', temperature: 'hot', phone: '0844444444', lastContactAt: '2026-11-09T03:00:00Z' },
  { id: 'e', firstName: 'มีนัดอนาคต', stage: 'pp', temperature: 'hot', phone: '0855555555', lastContactAt: '2026-10-01T03:00:00Z' },
  { id: 'f', firstName: 'เสีย', stage: 'lead', temperature: 'hot', isLost: true, lastContactAt: '2026-10-01T03:00:00Z' },
  { id: 'g', firstName: 'ไม่มีเบอร์', stage: 'lead', temperature: 'warm', lastContactAt: '2026-10-20T03:00:00Z' },
]
const fs = [
  { customerId: 'a', status: 'pending', dueDate: '2026-11-07', purpose: 'ติดตาม Lead ใหม่' },
  { customerId: 'b', status: 'pending', dueDate: '2026-11-10', time: '14:00' },
  { customerId: 'e', status: 'pending', dueDate: '2026-11-20' },
  { customerId: 'f', status: 'pending', dueDate: '2026-11-01' },
  { customerId: 'c', status: 'done', dueDate: '2026-11-01' },
]

describe('วันนี้ควรโทรหาใคร', () => {
  it('เรียง: เลยนัด → นัดวันนี้ → Hot เงียบ → Warm เงียบ · ข้ามคนที่มีนัดอนาคต/เพิ่งคุย/เสียดีล', () => {
    const r = callList({ customers: cs, followups: fs, today: T, now: NOW, limit: 10 })
    expect(r.map(x => x.customer.id)).toEqual(['a', 'b', 'c', 'g'])
    expect(r[0].why).toMatch(/เลยนัด 3 วัน/)
    expect(r[1].why).toMatch(/นัดวันนี้ 14:00/)
    expect(r[2].why).toMatch(/เงียบ 5 วัน/)
    expect(r[0].phone).toBe('0811111111')
  })
  it('การ์ด: มีเบอร์ = โทร · ไม่มีเบอร์ = เปิดหน้าลูกค้า', () => {
    const cmds = callListCommands(callList({ customers: cs, followups: fs, today: T, now: NOW, limit: 10 }))
    expect(cmds[0]).toMatchObject({ kind: 'tel', phone: '0811111111' })
    expect(cmds[3].kind).toBe('open')
  })
  it('จับคำถาม', () => {
    expect(isCallListQuestion('วันนี้ควรโทรหาใคร')).toBe(true)
    expect(isCallListQuestion('จากรายชื่อลูกค้าบนหน้าจอ วันนี้ควรโทรหาใครก่อน 5 คน')).toBe(true)
    expect(isCallListQuestion('ต้องตามใครบ้าง')).toBe(true)
    expect(isCallListQuestion('ใครต้องโทรวันนี้')).toBe(true)
    expect(isCallListQuestion('ยอดจองเดือนนี้')).toBe(false)
    expect(isCallListQuestion('โทรหาสมชาย')).toBe(false)
  })
})
