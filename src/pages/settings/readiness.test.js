import { describe, it, expect } from 'vitest'
import { readinessItems, readinessSummary } from './readiness.js'

const NOW = Date.UTC(2026, 10, 15, 6, 0, 0)
const full = { line: { configured: true }, meta: { configured: true, pages: [{ id: '1' }] }, ai: { configured: true }, leadHook: { configured: true } }
const by = (items, id) => items.find(i => i.id === id)

describe('readinessItems', () => {
  it('ทุกอย่างพร้อม → ok ทั้งหมด', () => {
    const it2 = readinessItems({ status: full, auto: { publicForm: true, aiReply: true, leadAlert: true }, lastBackupMs: NOW - 3600e3, now: NOW })
    expect(readinessSummary(it2)).toEqual({ ok: it2.length, todo: 0, unknown: 0, total: it2.length })
  })
  it('ไม่มีสถานะจาก worker → unknown ไม่เดาว่าผ่าน', () => {
    const r = readinessItems({ status: null, auto: { publicForm: false }, now: NOW })
    expect(by(r, 'line').state).toBe('unknown')
    expect(by(r, 'publicform').state).toBe('todo')
  })
  it('Meta ต้องมีเพจอย่างน้อย 1 เพจ', () => {
    const r = readinessItems({ status: { ...full, meta: { configured: true, pages: [] } }, auto: {}, now: NOW })
    expect(by(r, 'meta').state).toBe('todo')
  })
  it('สวิตช์: อ่านสิทธิ์ไม่ได้ → unknown, leadAlert ค่าเริ่มต้นเปิด', () => {
    expect(by(readinessItems({ status: full, auto: { _noAccess: true }, now: NOW }), 'aireply').state).toBe('unknown')
    expect(by(readinessItems({ status: full, auto: {}, now: NOW }), 'leadalert').state).toBe('ok')
    expect(by(readinessItems({ status: full, auto: { leadAlert: false }, now: NOW }), 'leadalert').state).toBe('todo')
  })
  it('สำรองข้อมูลเก่าเกิน 36 ชม. → todo, ไม่มีประวัติ → unknown', () => {
    expect(by(readinessItems({ status: full, auto: {}, lastBackupMs: NOW - 40 * 3600e3, now: NOW }), 'backup').state).toBe('todo')
    expect(by(readinessItems({ status: full, auto: {}, now: NOW }), 'backup').state).toBe('unknown')
  })
})
