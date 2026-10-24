import { describe, it, expect } from 'vitest'
import { pendingFollowupsFor, addDays, buildManualFollowup, FOLLOWUP_PURPOSES } from './customerFollowups.js'

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
