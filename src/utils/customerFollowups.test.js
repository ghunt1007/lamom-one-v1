import { describe, it, expect } from 'vitest'
import { pendingFollowupsFor, addDays, buildManualFollowup, FOLLOWUP_PURPOSES, quietDays, matchFollowupFilter, QUIET_DAYS } from './customerFollowups.js'

describe('pendingFollowupsFor', () => {
  const rows = [
    { id: 'a', customerId: 'c1', status: 'pending', dueDate: '2026-10-28' },
    { id: 'b', customerId: 'c1', status: 'pending', dueDate: '2026-10-20' },
    { id: 'c', customerId: 'c1', status: 'done', dueDate: '2026-10-21' },
    { id: 'd', customerId: 'c2', status: 'pending', dueDate: '2026-10-21' },
    { id: 'e', customerId: 'c1', status: 'pending', dueDate: '2026-10-22', deleted: true },
    { id: 'f', customerId: 'c1', status: 'pending', dueDate: '' },
  ]
  it('เฉพาะนัดค้างของลูกค้ารายนี้ เรียงตามวัน พร้อมจำนวนวันที่เลย', () => {
    const r = pendingFollowupsFor(rows, 'c1', '2026-10-25')
    expect(r.map(x => x.id)).toEqual(['b', 'a'])
    expect(r[0].late).toBe(5)
    expect(r[1].late).toBe(-3)
  })
  it('ไม่มี customerId → ว่าง', () => {
    expect(pendingFollowupsFor(rows, '', '2026-10-25')).toEqual([])
    expect(pendingFollowupsFor(null, 'c1', '2026-10-25')).toEqual([])
  })
})

describe('addDays / buildManualFollowup', () => {
  it('บวกวันข้ามเดือน', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02')
  })
  it('ผู้ดูแลมาจากลูกค้าก่อน ถ้าไม่มีใช้ผู้กด', () => {
    const c = { id: 'c1', firstName: 'สมชาย', lastName: 'ทดสอบ', phone: '0800000000', interestedModel: 'รุ่น A' }
    const f = buildManualFollowup(c, { dueDate: '2026-10-26', purpose: 'ติดตามใบเสนอราคา', note: ' โทรหลังเที่ยง ', me: 'เซลส์ ก' })
    expect(f).toMatchObject({ customerId: 'c1', customerName: 'สมชาย ทดสอบ', salesperson: 'เซลส์ ก', dueDate: '2026-10-26', status: 'pending', note: 'โทรหลังเที่ยง', vehicleModel: 'รุ่น A' })
    expect(buildManualFollowup({ ...c, assignedTo: 'เซลส์ ข' }, { dueDate: '2026-10-26' })).toMatchObject({ salesperson: 'เซลส์ ข', purpose: 'ทั่วไป' })
    expect(FOLLOWUP_PURPOSES).toContain('ทั่วไป')
  })
})

describe('followupWindowFilters', () => {
  it('ดึงนัดย้อนหลังไม่เกิน 120 วัน (ค่าเริ่มต้น)', async () => {
    const { followupWindowFilters } = await import('./customerFollowups.js')
    expect(followupWindowFilters('2026-10-25')).toEqual([['dueDate', '>=', '2026-06-27']])
    expect(followupWindowFilters('2026-10-25', 30)).toEqual([['dueDate', '>=', '2026-09-25']])
  })
})

describe('followupStatusByCustomer / matchFollowupFilter', () => {
  it('นับนัดค้าง เลยกำหนด และนัดถัดไป', async () => {
    const { followupStatusByCustomer, matchFollowupFilter } = await import('./customerFollowups.js')
    const m = followupStatusByCustomer([
      { customerId: 'c1', status: 'pending', dueDate: '2026-10-20' },
      { customerId: 'c1', status: 'pending', dueDate: '2026-10-28' },
      { customerId: 'c1', status: 'pending', dueDate: '2026-10-26' },
      { customerId: 'c2', status: 'done', dueDate: '2026-10-20' },
    ], '2026-10-25')
    expect(m.get('c1')).toEqual({ pending: 3, late: 1, next: '2026-10-26' })
    expect(m.has('c2')).toBe(false)
    expect(matchFollowupFilter({ id: 'c2', stage: 'pp' }, 'none', m)).toBe(true)
    expect(matchFollowupFilter({ id: 'c2', stage: 'pp', isLost: true }, 'none', m)).toBe(false)
    expect(matchFollowupFilter({ id: 'c2', stage: 'booking' }, 'none', m)).toBe(false)
    expect(matchFollowupFilter({ id: 'c1', stage: 'pp' }, 'none', m)).toBe(false)
    expect(matchFollowupFilter({ id: 'c1' }, 'late', m)).toBe(true)
    expect(matchFollowupFilter({ id: 'c2' }, 'late', m)).toBe(false)
    expect(matchFollowupFilter({ id: 'x' }, '', m)).toBe(true)
  })
})

describe('ตัวกรองลูกค้าเงียบ (quiet)', () => {
  const today = '2026-10-25'
  it('นับวันจากความเคลื่อนไหวล่าสุด รวม lastContactAt', () => {
    expect(quietDays({ createdAt: '2026-10-01T03:00:00Z', lastContactAt: '2026-10-20T03:00:00Z' }, today)).toBe(5)
    expect(quietDays({}, today)).toBe(null)
  })
  it('เลือกเฉพาะ Lead/Prospect ที่ยังไม่เสียดีลและเงียบตั้งแต่ QUIET_DAYS วัน', () => {
    const old = { stage: 'lead', createdAt: '2026-10-01T03:00:00Z' }
    expect(matchFollowupFilter(old, 'quiet', null, today)).toBe(true)
    expect(matchFollowupFilter({ ...old, lastContactAt: '2026-10-24T03:00:00Z' }, 'quiet', null, today)).toBe(false)
    expect(matchFollowupFilter({ ...old, isLost: true }, 'quiet', null, today)).toBe(false)
    expect(matchFollowupFilter({ ...old, stage: 'customer' }, 'quiet', null, today)).toBe(false)
    expect(matchFollowupFilter({ stage: 'pp', createdAt: `2026-10-${25 - QUIET_DAYS}T03:00:00Z` }, 'quiet', null, today)).toBe(true)
  })
})
