import { describe, it, expect } from 'vitest'
import { topPriorities, myDayDigest } from './myDay.js'

const base = { newLeads: [], deliveries: [], hotNoPlan: [], followups: [], finance: [], unscheduled: [], stale: [], income: [], stuck: [], total: 0 }

describe('topPriorities', () => {
  it('puts a new lead and today delivery ahead of routine work', () => {
    const d = { ...base,
      stuck: [{ id: 'b9', custName: 'เก่า', days: 40 }],
      newLeads: [{ id: 'c1', name: 'สมชาย ใจดี', firstName: 'สมชาย', createdAt: '2026-10-26' }],
      deliveries: [{ id: 'b1', custName: 'มานี', inDays: 0 }, { id: 'b2', custName: 'ปิติ', inDays: 3 }],
      income: [{ id: 'b3', custName: 'ชูใจ' }],
    }
    const top = topPriorities(d)
    expect(top.map(t => t.key)).toEqual(['new:c1', 'dlv:b1', 'inc:b3'])
  })
  it('does not list the same customer twice', () => {
    const d = { ...base,
      hotNoPlan: [{ id: 'c1', name: 'A' }],
      stale: [{ id: 'c1', name: 'A', days: 5, temperature: 'hot' }],
      followups: [{ id: 'f1', customerId: 'c2', customerName: 'B', late: 2 }],
    }
    expect(topPriorities(d, 5).map(t => t.key)).toEqual(['hot:c1', 'fu:f1'])
  })
  it('rejected finance outranks waiting finance', () => {
    const d = { ...base, finance: [{ id: 'x', custName: 'X', days: 9, rejected: false }, { id: 'y', custName: 'Y', days: 1, rejected: true }] }
    expect(topPriorities(d)[0].key).toBe('fin:y')
  })
  it('short mode drops last names', () => {
    const d = { ...base, hotNoPlan: [{ id: 'c1', name: 'สมชาย ใจดี', firstName: 'สมชาย' }] }
    expect(topPriorities(d, 3, { short: true })[0].title).not.toContain('ใจดี')
    expect(topPriorities(d)[0].title).toContain('ใจดี')
  })
  it('empty day gives empty list', () => {
    expect(topPriorities(base)).toEqual([])
  })
})

describe('myDayDigest', () => {
  it('summarizes counts without phone numbers or last names', () => {
    const d = { ...base, total: 2, contactedToday: 1,
      hotNoPlan: [{ id: 'c1', name: 'สมชาย ใจดี', firstName: 'สมชาย', phone: '0812345678' }],
      followups: [{ id: 'f1', customerId: 'c2', customerName: 'วิภา', late: 1, phone: '0899999999' }],
    }
    const s = myDayDigest(d)
    expect(s).toContain('งานค้างทั้งหมด 2')
    expect(s).toContain('สมชาย')
    expect(s).not.toContain('ใจดี')
    expect(s).not.toContain('081')
    expect(s).not.toContain('089')
  })
})
