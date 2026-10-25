import { describe, it, expect } from 'vitest'
import { focusLines, buildPersonalReminder } from './daily-report.js'

const empty = { deliver: [], unsched: [], td: [], fin: [], stale: [], fu: [], income: [], stuck: [] }
describe('focusLines', () => {
  it('orders delivery today, hot lead, late follow-up first', () => {
    const p = { ...empty,
      stuck: [{ name: 'ก', days: 30 }],
      fu: [{ name: 'ข', late: true }],
      stale: [{ name: 'ค', days: 4, hot: true }, { name: 'ง', days: 9, hot: false }],
      deliver: [{ name: 'จ', inDays: 0, time: '10:00' }, { name: 'ฉ', inDays: 1 }],
    }
    expect(focusLines(p)).toEqual(['ส่งมอบรถ จ เวลา 10:00 วันนี้', 'ทักลูกค้า Hot ค (เงียบมา 4 วัน)', 'ติดต่อ ข (เลยกำหนดแล้ว)'])
  })
  it('same customer only once', () => {
    const p = { ...empty, stale: [{ name: 'ค', days: 4, hot: true }], fu: [{ name: 'ค', late: true }, { name: 'ง', late: false }] }
    expect(focusLines(p)).toEqual(['ทักลูกค้า Hot ค (เงียบมา 4 วัน)', 'ติดต่อ ง ตามนัดวันนี้'])
  })
  it('empty gives none', () => { expect(focusLines(empty)).toEqual([]) })
})
describe('buildPersonalReminder focus', () => {
  it('shows the focus block when present', () => {
    const t = buildPersonalReminder({ name: 'A', text: '👤 A', focus: ['ติดต่อ ข (เลยกำหนดแล้ว)'] }, '2026-10-26')
    expect(t).toContain('⭐ เริ่มจาก 1 อย่างนี้ก่อน:')
    expect(t).toContain('  1. ติดต่อ ข (เลยกำหนดแล้ว)')
  })
})
