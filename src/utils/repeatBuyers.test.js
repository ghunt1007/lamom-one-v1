import { describe, it, expect } from 'vitest'
import { parseOpsSpec, repeatAnswer } from './opsQuestions.js'

describe('repeat buyers (v1.0.1475)', () => {
  it('routes', () => {
    expect(parseOpsSpec('ใครซื้อรถหลายคัน')).toEqual({ kind: 'repeat' })
    expect(parseOpsSpec('ลูกค้าคนไหนจองเยอะสุด')).toEqual({ kind: 'repeat' })
    expect(parseOpsSpec('เซลส์คนไหนจองเยอะสุด')).toBeNull()
  })
  it('groups by phone, ignores withdrawn', () => {
    const bk = [
      { custName: 'ลูกค้าเอ', phone: '081-111-1111', model: 'S07', status: 'ส่งมอบแล้ว', salesName: 'บี' },
      { custName: 'ลูกค้าเอ', phone: '+66811111111', model: 'L07', status: 'รอรถ' },
      { custName: 'ลูกค้าซี', phone: '0822222222', model: 'S05', status: 'ส่งมอบแล้ว' },
      { custName: 'ลูกค้าซี', phone: '0822222222', model: 'S05', status: 'ถอนจอง' },
    ]
    const r = repeatAnswer(bk)
    expect(r.n).toBe(1)
    expect(r.text).toContain('• ลูกค้าเอ — 2 คัน')
    expect(repeatAnswer(bk.slice(2)).n).toBe(0)
  })
})

describe('walk-in / anniversary phrasing (v1.0.1476)', () => {
  it('routes', () => {
    expect(parseOpsSpec('ลูกค้าที่มาดูรถวันนี้')).toEqual({ kind: 'walkin', day: 'today' })
    expect(parseOpsSpec('เมื่อวานมีลูกค้ามาดูรถกี่คน')).toEqual({ kind: 'walkin', day: 'yesterday' })
    expect(parseOpsSpec('ลูกค้าใหม่มาจากไหน').kind).toBe('newcust')
    expect(parseOpsSpec('ลูกค้าที่ซื้อไปครบ 1 ปี').kind).toBe('anniv')
  })
})

describe('service revenue vs sales income (v1.0.1481)', async () => {
  const { isIncomeQuestion } = await import('./incomeBrief.js')
  it('routes service-centre revenue away from sales income', () => {
    expect(isIncomeQuestion('รายได้ศูนย์เดือนนี้เทียบเดือนก่อน')).toBe(false)
    expect(isIncomeQuestion('รายได้เดือนนี้')).toBe(true)
    expect(parseOpsSpec('รายได้ศูนย์เดือนนี้เทียบเดือนก่อน')).toEqual({ kind: 'servicerev', prev: false })
    expect(parseOpsSpec('รายได้ศูนย์เดือนที่แล้ว')).toEqual({ kind: 'servicerev', prev: true })
  })
})

describe('serviceRevAnswer without labour amounts (v1.0.1481)', async () => {
  const { serviceRevAnswer } = await import('./opsQuestions.js')
  it('says amounts are missing instead of ฿0', () => {
    const jobs = [{ status: 'done', createdAt: '2026-11-10', updatedAt: '2026-11-11' }]
    const t = serviceRevAnswer(jobs, { today: '2026-11-28' }).text
    expect(t).toContain('ยังไม่มีงานไหนใส่ค่าแรง')
    expect(t).not.toContain('฿0')
    expect(serviceRevAnswer([{ ...jobs[0], labor: 1500 }], { today: '2026-11-28' }).text).toContain('1,500')
  })
})
