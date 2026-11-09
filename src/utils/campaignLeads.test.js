import { describe, it, expect } from 'vitest'
import { campaignLeads, campaignMessage, promoLines } from './campaignLeads.js'
import { normalizeProgram } from './salesPrograms.js'

const P = (o) => ({ ...normalizeProgram(o), id: o.id })
const programs = [
  P({ id: 'a', type: 'brand', title: 'ลด S07', brand: 'DEEPAL', models: ['S07'], dateFrom: '2026-11-01', dateTo: '2026-11-12', amount: 30000, gift: 'ฟิล์ม', status: 'active' }),
  P({ id: 'b', type: 'bonus', title: 'รางวัล', brand: '', models: [], dateFrom: '2026-11-01', dateTo: '2026-11-10', amount: 5000, targetUnits: 2, status: 'active' }),
  P({ id: 'c', type: 'showroom', title: 'โปรใหม่ L07', brand: 'DEEPAL', models: ['L07'], dateFrom: '2026-11-08', dateTo: '2026-11-30', amount: 10000, status: 'active' }),
  P({ id: 'd', type: 'showroom', title: 'โปรยาว G318', brand: 'DEEPAL', models: ['G318'], dateFrom: '2026-10-01', dateTo: '2026-12-31', amount: 10000, status: 'active' }),
]
const cust = (id, model, extra = {}) => ({ id, firstName: 'ชื่อ' + id, stage: 'lead', interestedModel: model, assignedTo: 'เอ', ...extra })
const brandOf = () => 'DEEPAL'

describe('campaignLeads', () => {
  const today = '2026-11-09'
  it('picks leads whose campaign ends within 7 days or just started, ignoring internal bonuses', () => {
    const rows = campaignLeads(programs, [cust('1', 'DEEPAL S07'), cust('2', 'DEEPAL L07'), cust('3', 'DEEPAL G318')], { today, brandOf })
    expect(rows.map(r => [r.c.id, r.reason])).toEqual([['1', 'ending'], ['2', 'new']])
    expect(rows[0].left).toBe(3)
    expect(rows[0].lines).toEqual(['ส่วนลดรวม 30,000 บาท', 'แถม ฟิล์ม'])
  })
  it('skips lost, booked, deleted and other people', () => {
    const rows = campaignLeads(programs, [cust('1', 'S07', { isLost: true }), cust('2', 'S07', { bookingId: 'x' }), cust('3', 'S07', { deleted: true }), cust('4', 'S07', { stage: 'customer' }), cust('6', 'S07', { lastContactAt: '2026-11-09T03:00:00Z' }), cust('5', 'S07', { assignedTo: 'ซี' })], { today, brandOf, mine: n => n !== 'ซี' })
    expect(rows).toEqual([])
  })
  it('builds a customer message without internal info', () => {
    const [row] = campaignLeads(programs, [cust('1', 'DEEPAL S07')], { today, brandOf })
    const m = campaignMessage(row)
    expect(m).toContain('สวัสดีครับคุณชื่อ1')
    expect(m).toContain('อีก 3 วัน')
    expect(m).not.toContain('รางวัล')
    expect(promoLines([])).toEqual([])
  })
})
