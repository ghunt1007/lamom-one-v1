import { describe, it, expect } from 'vitest'
import { parseOpsSpec, myCustomersAnswer, noPhoneAnswer, topScoreAnswer, deliveredAnswer, OPS_LINKS } from './opsQuestions.js'
import { parseBookingListSpec } from './bookingQuestions.js'
import { isMonthQuestion, isPrevMonthQuestion } from './monthBrief.js'
import { isTodayQuestion } from './todayBrief.js'

const today = '2026-11-12'
describe('v1.0.1092 salesperson questions', () => {
  it('routes', () => {
    expect(parseOpsSpec('ลูกค้าของฉันมีกี่คน')).toEqual({ kind: 'mycust' })
    expect(parseOpsSpec('ลูกค้าที่ยังไม่มีเบอร์โทร')).toEqual({ kind: 'nophone' })
    expect(parseOpsSpec('ลูกค้าคนไหนมีโอกาสปิดสูงสุด')).toEqual({ kind: 'topscore' })
    expect(parseOpsSpec('ลูกค้าที่ส่งมอบเดือนที่แล้ว')).toEqual({ kind: 'delivered', period: 'prevmonth' })
    expect(parseOpsSpec('ลูกค้าที่ซื้อรถไปแล้วปีนี้')).toEqual({ kind: 'delivered', period: 'year' })
    expect(parseOpsSpec('นัดส่งมอบพรุ่งนี้มีใครบ้าง').kind).toBe('delivery')
    expect(parseOpsSpec('นัดติดตามที่เลยกำหนดของฉัน').kind).toBe('overdue')
    expect(parseOpsSpec('นัดสมชายพรุ่งนี้ 10 โมง')).toBeNull()
    expect(parseOpsSpec('รถคันไหนจองแล้วแต่ยังไม่มาถึง')).toBeNull()
    expect(parseOpsSpec('ลูกค้าที่นัดแล้วไม่มา').kind).toBe('noshow')
    expect(isMonthQuestion('ลูกค้าที่ส่งมอบเดือนนี้')).toBe(false)
    expect(isPrevMonthQuestion('ลูกค้าที่ส่งมอบเดือนที่แล้ว')).toBe(false)
    expect(isPrevMonthQuestion('ยอดเดือนก่อนเป็นไง')).toBe(true)
    expect(isTodayQuestion('ฉันต้องทำอะไรบ้างวันนี้')).toBe(true)
    expect(isTodayQuestion('วันนี้ผมต้องทำอะไร')).toBe(true)
    expect(OPS_LINKS.topscore.path).toBe('/ai/lead-scoring')
  })
  it('booking: car not arrived / waiting longest', () => {
    expect(parseBookingListSpec('รถคันไหนจองแล้วแต่ยังไม่มาถึง').statuses).toEqual(['รอรถ'])
    expect(parseBookingListSpec('ลูกค้าที่รอรถนานสุด')).toMatchObject({ statuses: ['รอรถ'], stuck: true })
  })
  it('answers', () => {
    const cs = [{ stage: 'lead', temperature: 'hot', phone: '0811111111', createdAt: '2026-11-02' }, { stage: 'pp', temperature: 'warm', firstName: 'ไม่มีเบอร์' }, { stage: 'delivered', phone: '082' }, { isLost: true, stage: 'lead' }]
    const m = myCustomersAnswer(cs, { today })
    expect(m.text).toContain('ลูกค้าในความดูแล 4 คน (เสียดีล 1)')
    expect(m.text).toContain('🔥 HOT 1 · 🟡 WARM 1')
    const np = noPhoneAnswer(cs)
    expect(np.n).toBe(2)
    const ts = topScoreAnswer(cs, { scoreOf: c => ({ score: c.temperature === 'hot' ? 85 : 60, signals: [] }) })
    expect(ts.text).toMatch(/1\. ลูกค้า — 85%/)
    const d = deliveredAnswer([{ custName: 'ก', status: 'ส่งมอบแล้ว', deliveryDate: '2026-10-20' }, { custName: 'ข', status: 'ส่งมอบแล้ว', deliveryDate: '2026-11-03' }], { today, period: 'prevmonth' })
    expect(d.n).toBe(1); expect(d.text).toContain('20/10/2569 ก')
  })
})
