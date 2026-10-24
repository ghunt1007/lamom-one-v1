import { describe, it, expect } from 'vitest'
import { speedToLead } from './speedToLead.js'

describe('speedToLead', () => {
  const C = (created, first, who = 'วิชัย', extra = {}) => ({ createdAt: created, firstContactAt: first, assignedTo: who, ...extra })
  it('ยังไม่มีใครมี firstContactAt → ไม่แสดง', () => {
    expect(speedToLead([C('2026-10-26T03:00:00Z', null)], '2026-10')).toEqual([])
  })
  it('แยก ภายใน 24 ชม. / ช้ากว่า / ยังไม่ติดต่อ และไม่นับ Lead ก่อนเริ่มบันทึก', () => {
    const rows = speedToLead([
      C('2026-10-01T03:00:00Z', null), // ก่อนเริ่มบันทึก — ไม่นับ
      C('2026-10-26T03:00:00Z', '2026-10-26T05:00:00Z'),
      C('2026-10-26T03:00:00Z', '2026-10-28T05:00:00Z'),
      C('2026-10-27T03:00:00Z', null),
      C('2026-10-27T03:00:00Z', '2026-10-27T04:00:00Z', 'นภา'),
      C('2026-10-27T03:00:00Z', null, 'นภา', { deleted: true }),
      C('2026-11-01T03:00:00Z', null, 'นภา'), // คนละเดือน
      C('2026-10-31T10:00:00Z', null, 'นภา'), // ยังไม่ครบ 24 ชม. — ไม่นับ
    ], '2026-10', { now: Date.parse('2026-10-31T12:00:00Z') })
    expect(rows).toEqual([
      { name: 'วิชัย', total: 3, fast: 1, slow: 1, none: 1, rate: 33 },
      { name: 'นภา', total: 1, fast: 1, slow: 0, none: 0, rate: 100 },
    ])
  })
  it('รองรับ Firestore Timestamp และ Lead ที่ยังไม่มีผู้ดูแล', () => {
    const ts = iso => ({ toDate: () => new Date(iso) })
    const rows = speedToLead([C(ts('2026-10-26T03:00:00Z'), '2026-10-26T03:30:00Z', '')], '2026-10', { now: Date.parse('2026-11-01T00:00:00Z') })
    expect(rows[0]).toMatchObject({ name: '(ยังไม่มีผู้ดูแล)', fast: 1, rate: 100 })
  })
})
