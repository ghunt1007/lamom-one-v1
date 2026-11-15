import { describe, it, expect } from 'vitest'
import { readinessItems, readinessSummary } from './readiness.js'

const NOW = Date.UTC(2026, 10, 15, 6, 0, 0)
const full = { line: { configured: true, quota: { limited: true, limit: 300, used: 10, left: 290, pct: 3 } }, meta: { configured: true, pages: [{ id: '1' }] }, ai: { configured: true }, leadHook: { configured: true } }
const by = (items, id) => items.find(i => i.id === id)

describe('readinessItems', () => {
  it('ทุกอย่างพร้อม → ok ทั้งหมด', () => {
    const it2 = readinessItems({ status: full, auto: { publicForm: true, aiReply: true, leadAlert: true }, lastBackupMs: NOW - 3600e3, sheet: { ok: true }, now: NOW })
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
  it('Google Sheet: เปิดได้ → ok, ยังไม่แชร์ → todo พร้อมอีเมลที่ต้องแชร์, ตรวจไม่ได้ → unknown', () => {
    expect(by(readinessItems({ status: full, auto: {}, sheet: { ok: true }, now: NOW }), 'sheet').state).toBe('ok')
    const t = by(readinessItems({ status: full, auto: {}, sheet: { code: 'not_shared', shareWith: 'bot@demo.iam.gserviceaccount.com' }, now: NOW }), 'sheet')
    expect(t.state).toBe('todo'); expect(t.hint).toContain('bot@demo.iam.gserviceaccount.com')
    expect(by(readinessItems({ status: full, auto: {}, now: NOW }), 'sheet').state).toBe('unknown')
  })
})

describe('LINE quota readiness (v1.0.1160)', () => {
  const by = (items, id) => items.find(i => i.id === id)
  const NOW = Date.UTC(2026, 10, 16, 6, 0, 0)
  const st = quota => ({ line: { configured: true, quota }, meta: { configured: true, pages: [{ id: '1' }] }, ai: { configured: true }, leadHook: { configured: true } })
  it('ok under 80%, todo from 80%, unknown when unreadable, absent without LINE', () => {
    expect(by(readinessItems({ status: st({ limited: true, limit: 300, used: 30, left: 270, pct: 10 }), auto: {}, now: NOW }), 'linequota').state).toBe('ok')
    expect(by(readinessItems({ status: st({ limited: false, used: 5000 }), auto: {}, now: NOW }), 'linequota').state).toBe('ok')
    const t = by(readinessItems({ status: st({ limited: true, limit: 300, used: 290, left: 10, pct: 97 }), auto: {}, now: NOW }), 'linequota')
    expect(t.state).toBe('todo'); expect(t.hint).toContain('เหลือ 10')
    expect(by(readinessItems({ status: st(null), auto: {}, now: NOW }), 'linequota').state).toBe('unknown')
    expect(by(readinessItems({ status: { line: { configured: false } }, auto: {}, now: NOW }), 'linequota')).toBeUndefined()
  })
})
