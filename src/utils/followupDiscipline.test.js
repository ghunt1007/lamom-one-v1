import { describe, it, expect } from 'vitest'
import { followupDiscipline, monthRange } from './followupDiscipline.js'

describe('followupDiscipline', () => {
  const fus = [
    { salesperson: 'A', dueDate: '2026-10-02', status: 'done' },
    { salesperson: 'A', dueDate: '2026-10-03', status: 'done' },
    { salesperson: 'A', dueDate: '2026-10-04', status: 'pending' },
    { salesperson: 'A', dueDate: '2026-10-05', status: 'skipped' },
    { salesperson: 'A', dueDate: '2026-10-25', status: 'pending' }, // วันนี้ ยังไม่นับว่าค้าง
    { salesperson: 'A', dueDate: '2026-10-30', status: 'pending' }, // อนาคต ไม่นับ
    { salesperson: 'B', dueDate: '2026-10-10', status: 'pending' },
    { salesperson: 'B', dueDate: '2026-09-30', status: 'pending' }, // เดือนอื่น
    { salesperson: 'B', dueDate: '2026-10-11', status: 'done', deleted: true },
  ]
  it('นับทำแล้ว/ค้าง/ข้าม และเรียงคนที่ทำได้น้อยก่อน', () => {
    const r = followupDiscipline(fus, '2026-10', '2026-10-25')
    expect(r[0]).toMatchObject({ name: 'B', due: 1, done: 0, overdue: 1, rate: 0 })
    expect(r[1]).toMatchObject({ name: 'A', due: 5, done: 2, overdue: 1, skipped: 1, rate: 67 })
  })
  it('monthRange', () => {
    expect(monthRange('2026-02')).toEqual(['2026-02-01', '2026-02-28'])
    expect(monthRange('2026-12')).toEqual(['2026-12-01', '2026-12-31'])
  })
})
