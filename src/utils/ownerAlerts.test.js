import { describe, it, expect } from 'vitest'
import { ownerAlertItems } from './ownerAlerts.js'

const NOW = Date.UTC(2026, 10, 16, 12, 0, 0)
describe('ownerAlertItems (v1.0.1163)', () => {
  it('nothing when all fine or unknown', () => {
    expect(ownerAlertItems({ now: NOW })).toEqual([])
    const fresh = new Date(NOW - 3600e3).toISOString()
    expect(ownerAlertItems({ reports: { morningAt: fresh, morningOk: true, eveningAt: fresh, eveningOk: true }, lastBackupMs: NOW - 3600e3, now: NOW })).toEqual([])
  })
  it('lists failed report and stale backup only', () => {
    const fresh = new Date(NOW - 3600e3).toISOString()
    const r = ownerAlertItems({ reports: { morningAt: fresh, morningOk: true, eveningAt: fresh, eveningOk: false, eveningError: 'LINE: limit' }, lastBackupMs: NOW - 50 * 3600e3, now: NOW })
    expect(r.map(i => i.id)).toEqual(['report_evening', 'backup'])
    expect(r[0].hint).toContain('LINE: limit')
  })
})

describe('public form off but links handed out (v1.0.1181)', async () => {
  const { formOffItem } = await import('./ownerAlerts.js')
  it('warns only when the form is off AND something points at it', () => {
    expect(formOffItem(true, { referrers: 3 })).toBeNull()
    expect(formOffItem(undefined, { referrers: 3 })).toBeNull() // อ่านสวิตช์ไม่ได้ → ไม่เดา
    expect(formOffItem(false, {})).toBeNull()
    const it2 = formOffItem(false, { referrers: 2, showroom: 1, utm: 0 })
    expect(it2.id).toBe('publicform'); expect(it2.hint).toContain('ลิงก์แนะนำเพื่อน 2'); expect(it2.hint).toContain('QR ติดรถ 1'); expect(it2.hint).not.toContain('UTM')
  })
  it('comes first in the owner card', () => {
    const r = ownerAlertItems({ now: NOW, lastBackupMs: NOW - 50 * 3600e3, publicForm: false, links: { events: 1 } })
    expect(r.map(i => i.id)).toEqual(['publicform', 'backup'])
  })
})
