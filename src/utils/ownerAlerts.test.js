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
