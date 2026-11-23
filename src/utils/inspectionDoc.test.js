import { describe, it, expect } from 'vitest'
import { inspectionHtml } from './inspectionDoc.js'

describe('inspectionHtml', () => {
  it('lists sections with pass/fail marks, notes and counts', () => {
    const h = inspectionHtml({ brand: 'DEEPAL', model: 'S07', vehiclePlate: 'กข <1>', mileage: 1500, date: '2026-11-23', overallResult: 'fail', notes: 'นัดซ่อม' },
      [{ label: 'ภายนอก', items: [{ text: 'ไฟหน้า', status: 'pass' }, { text: 'กระจก', status: 'fail', note: 'ร้าว' }, { text: 'ล้อ', status: 'na' }] }], { typeLabel: 'PDI' })
    expect(h).toContain('ใบรายงานผลตรวจสภาพรถ')
    expect(h).toContain('กข &lt;1&gt;')
    expect(h).toContain('✘ ไม่ผ่าน')
    expect(h).toContain('หมายเหตุ: ร้าว')
    expect(h).toContain('สรุปผล: ไม่ผ่าน')
    expect(h).toContain('ผ่าน 1 · ไม่ผ่าน 1 · ไม่ได้ตรวจ 1')
    expect(h).toContain('1,500 กม.')
    expect(h).toMatch(/23\/11\/(2026|2569)/)
  })
})
