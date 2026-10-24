import { describe, it, expect } from 'vitest'
import { buildMyDay, bangkokDate, daysBetween } from './myDay.js'

const today = '2026-10-25'

describe('myDay helpers', () => {
  it('bangkokDate converts ISO/Timestamp to Thai date', () => {
    expect(bangkokDate('2026-10-24T18:00:00.000Z')).toBe('2026-10-25')
    expect(bangkokDate({ toDate: () => new Date('2026-10-24T10:00:00Z') })).toBe('2026-10-24')
    expect(bangkokDate('2026-10-20')).toBe('2026-10-20')
    expect(bangkokDate(null)).toBe('')
    expect(daysBetween('2026-10-20', today)).toBe(5)
  })
})

describe('buildMyDay', () => {
  const data = {
    customers: [
      { id: 'c1', firstName: 'ใหม่', stage: 'lead', assignedTo: 'A', createdAt: '2026-10-25T02:00:00Z' },
      { id: 'c2', firstName: 'เก่า', stage: 'pp', assignedTo: 'A', createdAt: '2026-10-10T02:00:00Z', updatedAt: '2026-10-20T02:00:00Z' },
      { id: 'c3', firstName: 'เพิ่งคุย', stage: 'pp', assignedTo: 'A', createdAt: '2026-10-10T02:00:00Z', updatedAt: '2026-10-24T02:00:00Z' },
      { id: 'c4', firstName: 'จองแล้ว', stage: 'booking', assignedTo: 'A', createdAt: '2026-10-01T02:00:00Z' },
      { id: 'c5', firstName: 'เสีย', stage: 'pp', isLost: true, assignedTo: 'A', createdAt: '2026-10-01T02:00:00Z' },
      { id: 'c6', firstName: 'ของ B', stage: 'pp', assignedTo: 'B', createdAt: '2026-10-01T02:00:00Z' },
    ],
    followups: [
      { id: 'f1', status: 'pending', dueDate: '2026-10-23', salesperson: 'A', customerName: 'x' },
      { id: 'f2', status: 'pending', dueDate: '2026-10-25', salesperson: 'A' },
      { id: 'f3', status: 'pending', dueDate: '2026-10-26', salesperson: 'A' },
      { id: 'f4', status: 'done', dueDate: '2026-10-20', salesperson: 'A' },
      { id: 'f5', status: 'pending', dueDate: '2026-10-24', salesperson: 'A', autoLead: true, customerId: 'c4' },
    ],
    bookings: [
      { id: 'b1', status: 'ส่งมอบแล้ว', cutDate: '2026-10-05', salesName: 'A' },
      { id: 'b2', status: 'ส่งมอบแล้ว', cutDate: '2026-10-05', salesName: 'A', totalIncome: 5000 },
      { id: 'b3', status: 'จองแล้ว', bookingDate: '2026-10-01', deliveryDate: '2026-10-27', salesName: 'A' },
      { id: 'b4', status: 'ถอนจอง', bookingDate: '2026-09-01', salesName: 'A' },
      { id: 'b5', status: 'จองแล้ว', bookingDate: '2026-10-20', deliveryDate: '2026-11-10', salesName: 'A' },
    ],
  }

  it('collects today\'s work for one salesperson', () => {
    const d = buildMyDay(data, { today, mine: n => n === 'A' })
    expect(d.followups.map(f => f.id)).toEqual(['f1', 'f2'])
    expect(d.followups[0].late).toBe(2)
    expect(d.newLeads.map(c => c.id)).toEqual(['c1'])
    expect(d.stale.map(c => c.id)).toEqual(['c2'])
    expect(d.stale[0].days).toBe(5)
    expect(d.income.map(b => b.id)).toEqual(['b1'])
    expect(d.stuck.map(b => b.id)).toEqual(['b3'])
    expect(d.deliveries.map(b => b.id)).toEqual(['b3'])
    expect(d.deliveries[0].inDays).toBe(2)
    expect(d.total).toBe(2 + 1 + 1 + 1)
  })

  it('shows everyone when mine is not limited', () => {
    const d = buildMyDay(data, { today })
    expect(d.stale.map(c => c.id).sort()).toEqual(['c2', 'c6'])
  })

  it('works with empty data', () => {
    expect(buildMyDay({}, { today }).total).toBe(0)
  })
})
