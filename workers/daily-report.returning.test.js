import { describe, it, expect } from 'vitest'
import { buildMorningSections } from './daily-report.js'

const today = '2026-11-16'
const base = { bookings: [], followups: [], testDrives: [] }

describe('returning customers in the 09:00 reminder (v1.0.1208)', () => {
  it('lists re-enquiries from the last 3 days that nobody called back, once', () => {
    const customers = [
      { id: 'a', firstName: 'กลับมา', stage: 'pp', assignedTo: 'สมชาย', createdAt: '2026-09-01T02:00:00Z', lastContactAt: '2026-09-02T02:00:00Z', reEnquiredAt: '2026-11-15T18:00:00Z', reEnquiredModel: 'Seal' },
      { id: 'b', firstName: 'โทรแล้ว', stage: 'lead', assignedTo: 'สมชาย', createdAt: '2026-09-01T02:00:00Z', reEnquiredAt: '2026-11-15T02:00:00Z', lastContactAt: '2026-11-15T03:00:00Z' },
      { id: 'c', firstName: 'เก่าไป', stage: 'lead', assignedTo: 'สมชาย', createdAt: '2026-09-01T02:00:00Z', reEnquiredAt: '2026-11-10T02:00:00Z' },
      { id: 'd', firstName: 'เคยเสีย', stage: 'lead', isLost: true, assignedTo: 'สมชาย', createdAt: '2026-08-01T02:00:00Z', reEnquiredAt: '2026-11-14T02:00:00Z' },
    ]
    const [sec] = buildMorningSections({ ...base, customers }, { today })
    expect(sec.text).toContain('📣 ลูกค้าเดิมทักกลับมา รอโทรกลับ: 2 ราย')
    expect(sec.text).toContain('กลับมา (Seal) · ทักมาเมื่อคืน/เช้านี้')
    expect(sec.text).toContain('เคยเสีย · ทักมา 2 วันก่อน · เคยเสียดีล')
    expect(sec.text).not.toContain('โทรแล้ว ·')
    // ไม่ขึ้นซ้ำในหัวข้อ Lead เงียบ
    expect(sec.text.split('กลับมา (Seal)').length).toBe(2)
    expect(sec.focus.join('\n')).toContain('โทรกลับ กลับมา')
  })
})

describe('09:00 customer query fields', () => {
  it('fetches every customer field the morning sections read', async () => {
    const { MORNING_CUSTOMER_FIELDS } = await import('./daily-report.js')
    const fs = await import('node:fs')
    const src = fs.readFileSync(new URL('./daily-report.js', import.meta.url), 'utf8')
    const body = src.slice(src.indexOf('export function buildMorningSections'), src.indexOf('export function focusLines'))
    const used = new Set([...body.matchAll(/\bc\.([a-zA-Z]+)/g)].map(m => m[1]))
    const missing = [...used].filter(f => !MORNING_CUSTOMER_FIELDS.includes(f) && !['id'].includes(f))
    expect(missing).toEqual([])
  })
})

describe('18:00 customer query fields', () => {
  it('includes every field entryPointOf reads', async () => {
    const { EVENING_CUSTOMER_FIELDS } = await import('./daily-report.js')
    const fs = await import('node:fs')
    const src = fs.readFileSync(new URL('../src/utils/entryPoints.js', import.meta.url), 'utf8')
    const used = new Set([...src.matchAll(/\bc\.([a-zA-Z]+)/g)].map(m => m[1]))
    expect([...used].filter(f => !EVENING_CUSTOMER_FIELDS.includes(f))).toEqual([])
  })
})
