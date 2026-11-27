import { describe, it, expect } from 'vitest'
import { stockGroups, stockLineAnswer } from './stockList.js'

const V = [
  { brand: 'DEEPAL', model: 'S07', color: 'ขาว', status: 'available' },
  { brand: 'DEEPAL', model: 'S07', color: 'ขาว', status: 'pdi' },
  { brand: 'DEEPAL', model: 'S07', color: 'ดำ', status: 'transit' },
  { brand: 'DEEPAL', model: 'S07', color: 'เทา', status: 'reserved' },
  { brand: 'DEEPAL', model: 'L07', color: 'ขาว', status: 'sold' },
  { brand: 'DEEPAL', model: 'L07', color: 'ขาว', status: 'demo' },
  { brand: 'DEEPAL', model: 'L07', status: 'available', deleted: true },
]

describe('stockLine', () => {
  it('groups by model and colour, skipping sold/demo/deleted', () => {
    const g = stockGroups(V)
    expect(g).toHaveLength(1)
    expect(g[0]).toMatchObject({ name: 'DEEPAL S07', readyN: 2, transitN: 1, reserved: 1, ready: { ขาว: 2 }, transit: { ดำ: 1 } })
  })
  it('answers with totals and filters by query', () => {
    const t = stockLineAnswer(V)
    expect(t).toContain('พร้อมขาย 2 คัน · กำลังมา 1 · จองแล้ว 1')
    expect(t).toContain('✅ พร้อมขาย: ขาว ×2')
    expect(stockLineAnswer(V, { q: 'l07' })).toContain('ไม่พบรถรุ่น')
    expect(stockLineAnswer(V, { q: 's07' })).toContain('DEEPAL S07')
    expect(stockLineAnswer([])).toContain('ยังไม่มีรถในสต็อก')
  })
})

import { leadCountByModel } from './stockLeads.js'
describe('สต็อก + interested leads (v1.0.1424)', () => {
  it('adds lead count under ready models only', () => {
    const lc = leadCountByModel([{ stage: 'lead', interestedModel: 'Deepal S07' }, { stage: 'pp', interestedModel: 'S07' }, { stage: 'lead', interestedModel: 'S07', isLost: true }])
    expect(stockLineAnswer(V, { leadCounts: lc })).toContain('🎯 ลูกค้าสนใจรุ่นนี้ 2 คน')
    expect(stockLineAnswer(V)).not.toContain('🎯')
  })
})
