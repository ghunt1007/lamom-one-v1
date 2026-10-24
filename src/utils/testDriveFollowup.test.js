import { describe, it, expect, vi } from 'vitest'
vi.mock('../core/db.js', () => ({ createDoc: vi.fn(async () => 'x') }))
vi.mock('../core/companyScope.js', () => ({ myEffectiveCompanyId: () => null }))
const { buildTestDriveFollowup } = await import('./testDriveFollowup.js')

describe('test drive follow-up', () => {
  const td = { id: 'T1', customerName: 'ก', phone: '081', model: 'Seal', staff: 'วิชัย' }
  it('calls back the next day after a test drive', () => {
    const f = buildTestDriveFollowup(td, { status: 'done', result: 'interested' }, '2026-10-31')
    expect(f).toMatchObject({ dueDate: '2026-11-01', salesperson: 'วิชัย', type: 'call', sourceTestDriveId: 'T1' })
    expect(f.note).toContain('สนใจมาก')
    expect(buildTestDriveFollowup(td, { status: 'no_show' }, '2026-10-31').note).toContain('ไม่มา')
    expect(buildTestDriveFollowup(td, { status: 'done', result: null }, '2026-10-31')).not.toBe(null)
  })
  it('skips booked, not interested and cancelled', () => {
    expect(buildTestDriveFollowup(td, { status: 'done', result: 'booked' })).toBe(null)
    expect(buildTestDriveFollowup(td, { status: 'done', result: 'notinterested' })).toBe(null)
    expect(buildTestDriveFollowup(td, { status: 'cancelled' })).toBe(null)
  })
})
