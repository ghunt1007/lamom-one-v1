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
