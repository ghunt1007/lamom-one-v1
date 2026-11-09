import { describe, it, expect, vi } from 'vitest'
vi.mock('../core/db.js', () => ({ createDoc: vi.fn(), updateDocData: vi.fn() }))
vi.mock('../core/companyScope.js', () => ({ myEffectiveCompanyId: () => 'co' }))
import { buildNoShowFollowup } from './showroomFollowup.js'

describe('buildNoShowFollowup', () => {
  it('creates a call-today task for the appointment owner', () => {
    const f = buildNoShowFollowup({ id: 'a1', custName: 'สมชาย', phone: '081', interestedIn: 'S07', salesperson: 'บี', date: '2026-11-10', time: '14:00' }, { customerId: 'c1', today: '2026-11-10' })
    expect(f).toMatchObject({ customerId: 'c1', sourceAppointmentId: 'a1', salesperson: 'บี', dueDate: '2026-11-10', status: 'pending', type: 'call', vehicleModel: 'S07' })
    expect(f.note).toContain('2026-11-10 14:00')
  })
  it('only once per appointment', () => {
    expect(buildNoShowFollowup({ id: 'a1', noshowFollowupAt: 'x' })).toBeNull()
    expect(buildNoShowFollowup(null)).toBeNull()
  })
})
