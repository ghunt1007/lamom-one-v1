import { describe, it, expect } from 'vitest'
import { parseLineCommand, cancelRiskLineAnswer } from './daily-report.js'

const add = (d, n) => new Date(Date.parse(d) + n * 86400000).toISOString().slice(0, 10)
describe('LINE เสี่ยงถอน (v1.0.1456)', () => {
  it('parses and answers per seller', () => {
    expect(parseLineCommand('เสี่ยงถอน').type).toBe('cxrisk')
    expect(parseLineCommand('ใบจอง เสี่ยงถอน').type).toBe('cxrisk')
    const hist = [...Array.from({ length: 20 }, () => ({ bookingDate: '2026-05-01', status: 'ส่งมอบแล้ว', cutDate: add('2026-05-01', 20) })),
      ...Array.from({ length: 6 }, () => ({ bookingDate: '2026-05-01', status: 'ส่งมอบแล้ว', cutDate: add('2026-05-01', 70) })),
      ...Array.from({ length: 8 }, (_, i) => ({ bookingDate: '2026-05-01', status: 'ถอนจอง', cancelDate: add('2026-05-01', i < 2 ? 10 : 80) }))]
    const rows = [...hist, { bookingDate: '2026-09-01', status: 'รอรถ', custName: 'ลูกค้าเอ', model: 'ATTO 3', salesName: 'บี' }]
    expect(cancelRiskLineAnswer(rows, '2026-11-28')).toContain('• ลูกค้าเอ')
    expect(cancelRiskLineAnswer(rows, '2026-11-28', { seller: 'บี' })).toContain('• ลูกค้าเอ')
    expect(cancelRiskLineAnswer(rows, '2026-11-28', { seller: 'ซี' })).toContain('ตอนนี้ไม่มีใบจองที่ค้างนานถึงช่วงเสี่ยง')
  })
})
