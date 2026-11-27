import { describe, it, expect } from 'vitest'
import { cancelRisk, cancelRiskText } from './cancelRisk.js'
import { parseOpsSpec } from './opsQuestions.js'

const T = '2026-11-28'
const add = (d, n) => new Date(Date.parse(d) + n * 86400000).toISOString().slice(0, 10)
const done = (start, days) => ({ bookingDate: start, status: 'ส่งมอบแล้ว', cutDate: add(start, days), model: 'ATTO 3' })
const cxl = (start, days) => ({ bookingDate: start, status: 'ถอนจอง', cancelDate: add(start, days), model: 'ATTO 3' })
describe('cancelRisk (v1.0.1453)', () => {
  // 20 ส่งมอบเร็ว (20 วัน) · 6 ส่งมอบช้า (70 วัน) · 2 ถอนเร็ว · 6 ถอนช้า (80 วัน) → ค้าง ≥ 60 วันถอน 50% vs เฉลี่ย 24%
  const hist = [...Array.from({ length: 20 }, () => done('2026-05-01', 20)), ...Array.from({ length: 6 }, () => done('2026-05-01', 70)),
    ...Array.from({ length: 2 }, () => cxl('2026-05-01', 10)), ...Array.from({ length: 6 }, () => cxl('2026-05-01', 80))]
  const open = [{ bookingDate: '2026-09-01', status: 'รอรถ', custName: 'ลูกค้าเอ', model: 'ATTO 3', salesName: 'บี' }, { bookingDate: '2026-11-20', status: 'รอรถ', custName: 'ลูกค้าซี' }]
  it('finds the risky age from history and lists open bookings past it', () => {
    const r = cancelRisk([...hist, ...open], T)
    expect(Math.round(r.overall * 100)).toBe(24)
    expect(r.threshold).toMatchObject({ age: 30, n: 12 })
    expect(r.risky.map(x => x.b.custName)).toEqual(['ลูกค้าเอ'])
    const t = cancelRiskText(r)
    expect(t).toContain('ใบจองที่ค้างเกิน 30 วัน ในอดีตถอน 50%')
    expect(t).toContain('• ลูกค้าเอ')
    expect(cancelRiskText(r, { mine: () => false })).toContain('ตอนนี้ไม่มีใบจองที่ค้างนานถึงช่วงเสี่ยง')
  })
  it('null / no threshold', () => {
    expect(cancelRisk(open, T)).toBeNull()
    expect(cancelRiskText(null)).toContain('ยังบอกไม่ได้')
    expect(cancelRisk(Array.from({ length: 25 }, () => done('2026-05-01', 20)), T).threshold).toBeNull()
  })
  it('routes', () => {
    expect(parseOpsSpec('ใบจองไหนเสี่ยงถอน')?.kind).toBe('cancelrisk')
    expect(parseOpsSpec('ใครถอนจองเดือนนี้')?.kind).toBe('withdrawn')
  })
})

describe('LAMI routing additions (v1.0.1462)', () => {
  it('routes future/worry phrasings and related gaps', () => {
    expect(parseOpsSpec('ใบจองไหนจะถอน')).toEqual({ kind: 'cancelrisk' })
    expect(parseOpsSpec('ลูกค้าคนไหนจะยกเลิกจอง')).toEqual({ kind: 'cancelrisk' })
    expect(parseOpsSpec('ใบจองที่น่าห่วง')).toEqual({ kind: 'cancelrisk' })
    expect(parseOpsSpec('ลูกค้าคนไหนยกเลิกจอง').kind).toBe('withdrawn')
    expect(parseOpsSpec('ยกเลิกจองกี่ใบ')).toEqual({ kind: 'withdrawn', prev: false })
    expect(parseOpsSpec('ถอนจองเดือนที่แล้วกี่ใบ')).toEqual({ kind: 'withdrawn', prev: true })
    expect(parseOpsSpec('ยกเลิกจอง สมชาย')).toBeNull()
    expect(parseOpsSpec('รุ่นไหนขายยาก')).toEqual({ kind: 'modelfunnel' })
    expect(parseOpsSpec('เดือนนี้จะส่งได้กี่คัน')).toEqual({ kind: 'dlvfc' })
    expect(parseOpsSpec('เดือนหน้าจะส่งได้กี่คัน')).toEqual({ kind: 'delivery', day: 'nextmonth' })
    expect(parseOpsSpec('คาดการณ์เดือนหน้า')).toEqual({ kind: 'fcall' })
    expect(parseOpsSpec('ลูกค้าคนไหนน่าจะซื้อ')).toEqual({ kind: 'topscore' })
    expect(parseOpsSpec('ใครน่าจะจองเร็วๆนี้')).toEqual({ kind: 'topscore' })
    expect(parseOpsSpec('ลูกค้าคนไหนน่าจะถอน')).toEqual({ kind: 'cancelrisk' })
    expect(parseOpsSpec('ลูกค้าเงียบไปนาน').kind).toBe('stale')
    expect(parseOpsSpec('แบงค์ไหนผ่านง่ายสุด')).toEqual({ kind: 'finbank' })
    expect(parseOpsSpec('ใครยังไม่มีผู้ดูแล').kind).toBe('unassigned')
    expect(parseOpsSpec('ลูกค้าบ่นเรื่องอะไรบ่อย')).toEqual({ kind: 'complaint' })
    expect(parseOpsSpec('รถคันไหนซ่อมนานสุด').kind).toBe('service')
    expect(parseOpsSpec('วันนี้ศูนย์รับรถกี่คัน').kind).toBe('service')
  })
})

describe('callsAnswer: sellers with no calls (v1.0.1464)', async () => {
  const { callsAnswer } = await import('./opsQuestions.js')
  const today = '2026-11-28'
  const logs = [{ type: 'call', createdAt: '2026-11-28T03:00:00Z', createdBy: 'สมชาย ใจดี', note: 'คุยแล้ว', customerId: 'c1' }]
  it('lists staff without calls when names match', () => {
    const t = callsAnswer(logs, { today, team: true, staff: ['สมชาย ใจดี', 'วิภา', 'อนันต์'] }).text
    expect(t).toContain('😶 ยังไม่มีบันทึกโทร: วิภา, อนันต์')
    expect(callsAnswer(logs, { today, team: true, staff: ['สมชาย ใจดี'] }).text).toContain('✅ เซลส์ทุกคนมีบันทึกโทรแล้ว')
  })
  it('stays quiet when log names do not match staff (e.g. emails)', () => {
    const t = callsAnswer([{ ...logs[0], createdBy: 'x@example.com' }], { today, team: true, staff: ['วิภา'] }).text
    expect(t).not.toContain('ยังไม่มีบันทึกโทร')
  })
  it('routes', () => {
    expect(parseOpsSpec('ใครยังไม่ได้โทรวันนี้')).toEqual({ kind: 'calls', day: 'today', team: true })
    expect(parseOpsSpec('วันนี้ฉันโทรไปกี่คนแล้ว').team).toBe(false)
  })
})
