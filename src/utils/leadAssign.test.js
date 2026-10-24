import { describe, it, expect, vi, beforeEach } from 'vitest'

const calls = []
vi.mock('../core/db.js', () => ({
  updateDocData: vi.fn(async (c, id, d) => { calls.push(['update', c, id, d]) }),
  createDoc: vi.fn(async (c, d) => { calls.push(['create', c, d]); return 'n' + calls.length }),
  listDocs: vi.fn(async () => []),
}))
vi.mock('../core/companyScope.js', () => ({ myEffectiveCompanyId: () => 'mine', companyScopeFilters: () => [] }))

const { staffChoices, findStaffCompany, assignCustomer, followupsToMove } = await import('./leadAssign.js')

beforeEach(() => { calls.length = 0 })

describe('lead assignment', () => {
  const staff = [
    { firstName: 'วิชัย', lastName: 'ใจดี', nickname: 'ชัย', companyIds: ['c1'] },
    { firstName: 'นภา', lastName: '', companyId: 'c2' },
    { firstName: 'ลบแล้ว', deleted: true },
  ]
  it('lists staff and finds their company by name or nickname', () => {
    const ch = staffChoices(staff)
    expect(ch.map(s => s.name)).toEqual(['นภา', 'วิชัย ใจดี'])
    expect(findStaffCompany(ch, 'คุณวิชัย ใจดี')).toBe('c1')
    expect(findStaffCompany(ch, 'ชัย')).toBe('c1')
    expect(findStaffCompany(ch, 'ไม่มี')).toBe(null)
  })

  it('assigns a LINE lead, gives it the seller company and creates 3 follow-ups', async () => {
    const c = { id: 'L1', firstName: 'ลูกค้า', stage: 'pp', companyId: null }
    const n = await assignCustomer(c, 'วิชัย ใจดี', 'c1', [])
    expect(calls[0]).toEqual(['update', 'customers', 'L1', { assignedTo: 'วิชัย ใจดี', companyId: 'c1' }])
    expect(n).toBe(3)
    const fu = calls.filter(x => x[0] === 'create')
    expect(fu).toHaveLength(3)
    expect(fu[0][2]).toMatchObject({ salesperson: 'วิชัย ใจดี', companyId: 'c1', customerId: 'L1' })
    expect(c.assignedTo).toBe('วิชัย ใจดี')
  })

  it('moves existing pending follow-ups instead of creating new ones and keeps the customer company', async () => {
    const c = { id: 'C2', stage: 'pp', companyId: 'c9' }
    const fus = [{ id: 'f1', customerId: 'C2', status: 'pending', companyId: 'c9' }, { id: 'f2', customerId: 'C2', status: 'done' }, { id: 'f3', customerId: 'X', status: 'pending' }]
    const n = await assignCustomer(c, 'นภา', 'c2', fus)
    expect(n).toBe(0)
    expect(calls).toEqual([
      ['update', 'customers', 'C2', { assignedTo: 'นภา' }],
      ['update', 'followups', 'f1', { salesperson: 'นภา' }],
    ])
    expect(fus[0].salesperson).toBe('นภา')
  })
})

describe('ย้ายนัดเมื่อเปลี่ยนผู้ดูแล', () => {
  const fus = [
    { id: 'a', customerId: 'C1', status: 'pending', salesperson: 'วิชัย' },
    { id: 'b', customerId: 'C1', status: 'pending', salesperson: '' },
    { id: 'c', customerId: 'C1', status: 'pending', salesperson: 'ฝ่ายบริการ' },
    { id: 'd', customerId: 'C1', status: 'done', salesperson: 'วิชัย' },
    { id: 'e', customerId: 'C2', status: 'pending', salesperson: 'วิชัย' },
    { id: 'f', customerId: 'C1', status: 'pending', salesperson: 'วิชัย', deleted: true },
  ]
  it('ย้ายเฉพาะนัดค้างของคนเดิม/ไม่มีผู้ดูแล ของลูกค้ารายนี้', () => {
    expect(followupsToMove(fus, 'C1', 'วิชัย', 'นภา').map(f => f.id)).toEqual(['a', 'b'])
  })
  it('ไม่ย้ายถ้าไม่มีผู้ดูแลคนใหม่ หรือไม่มีลูกค้า', () => {
    expect(followupsToMove(fus, 'C1', 'วิชัย', '')).toEqual([])
    expect(followupsToMove(fus, '', 'วิชัย', 'นภา')).toEqual([])
  })
})
