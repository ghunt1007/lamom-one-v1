import { describe, it, expect } from 'vitest'
import { summarizeReportRun, saveReportStatus } from './reportStatus.js'

describe('report status (v1.0.1161)', () => {
  it('ok when at least one channel sent; keeps the other channel error', () => {
    expect(summarizeReportRun({ line: { configured: true, sent: true }, telegram: { configured: false } })).toEqual({ ok: true, error: '' })
    const r = summarizeReportRun({ line: { configured: true, sent: false, error: 'You have reached your monthly limit.' }, telegram: { configured: true, sent: true } })
    expect(r.ok).toBe(true); expect(r.error).toContain('LINE: You have reached')
  })
  it('fails when nothing was sent, or the run errored', () => {
    expect(summarizeReportRun({ line: { configured: true, sent: false, error: 'x' }, telegram: { configured: false } }).ok).toBe(false)
    expect(summarizeReportRun({ line: { configured: false }, telegram: { configured: false } }).error).toContain('ยังไม่ได้ตั้งค่า')
    expect(summarizeReportRun({ error: 'อ่าน Firestore ไม่ได้' })).toEqual({ ok: false, error: 'อ่าน Firestore ไม่ได้' })
    expect(summarizeReportRun(null).ok).toBe(false)
  })
  it('patches only this run\'s fields with an update mask', async () => {
    const calls = []
    const ok = await saveReportStatus({ FIREBASE_PROJECT_ID: 'p' }, 'tok', 'evening', { line: { configured: true, sent: true } }, { now: Date.UTC(2026, 10, 16, 11), fetchImpl: async (u, i) => { calls.push([u, JSON.parse(i.body)]); return { ok: true } } })
    expect(ok).toBe(true)
    expect(calls[0][0]).toContain('/system_integrations/report_status?updateMask.fieldPaths=kind&updateMask.fieldPaths=eveningAt')
    expect(calls[0][1].fields.eveningOk).toEqual({ booleanValue: true })
    expect(await saveReportStatus({}, '', 'evening', {})).toBe(false)
    expect(await saveReportStatus({}, 'tok', 'noon', {})).toBe(false)
  })
})
