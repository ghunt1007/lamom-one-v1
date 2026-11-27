import { describe, it, expect } from 'vitest'
import { forecastOverview, isOverviewForecastQuestion } from './forecastOverview.js'
import { parseOpsSpec } from './opsQuestions.js'

const T = '2026-11-10'
// จองเดือนละ 10 ใบ (วันที่ 1–10 ครึ่งหนึ่ง) 6 เดือนก่อน + เดือนนี้ 4 ใบ
const bk = []
for (const m of ['05', '06', '07', '08', '09', '10']) for (let i = 0; i < 10; i++) bk.push({ bookingDate: `2026-${m}-${String(i < 5 ? 1 + i : 15 + i).padStart(2, '0')}`, status: 'รอรถ' })
for (let i = 0; i < 4; i++) bk.push({ bookingDate: `2026-11-0${1 + i}`, status: 'รอรถ' })

describe('forecastOverview (v1.0.1434)', () => {
  it('routes only topic-less forecast questions', () => {
    for (const q of ['คาดการณ์เดือนนี้', 'สรุปคาดการณ์ทั้งหมด', 'เดือนนี้จะเป็นยังไง', 'สิ้นเดือนจะได้เท่าไหร่']) {
      expect(isOverviewForecastQuestion(q), q).toBe(true)
      expect(parseOpsSpec(q)?.kind, q).toBe('fcall')
    }
    for (const q of ['คาดการณ์สั่งรถเดือนหน้า', 'เดือนนี้จะส่งมอบได้กี่คัน', 'คาดรายได้ศูนย์บริการเดือนหน้า']) expect(isOverviewForecastQuestion(q), q).toBe(false)
  })
  it('combines available forecasts, skips ones without history', () => {
    const fc = { delivered: 3, expected: 9, worst: 7, best: 11, target: 12, targetPct: 75 }
    const r = forecastOverview({ fc, bookings: bk, today: T })
    expect(r.text).toContain('🔮 คาดการณ์เดือนนี้ พ.ย. 2569')
    expect(r.text).toContain('🚚 ส่งมอบ: แล้ว 3 คัน → คาด ≈ 9 คัน (7–11) · เป้า 12 (75%)')
    expect(r.text).toContain('📝 ยอดจอง: แล้ว 4 ใบ → คาด ≈ 8 ใบ')
    expect(r.text).not.toContain('ลูกค้าใหม่')
    expect(r.text).not.toContain('รถเข้าศูนย์')
  })
  it('explains when nothing is forecastable', () => {
    expect(forecastOverview({ today: T }).text).toContain('ยังคาดการณ์ไม่ได้')
  })
})

import { forecastCards } from './forecastOverview.js'
import { forecastHubHtml } from './forecastHubView.js'
describe('forecast hub cards (v1.0.1439)', () => {
  it('returns every topic, ok or with a reason; money hidden when not allowed', () => {
    const fc = { delivered: 3, expected: 9, worst: 7, best: 11, target: 12, targetPct: 75 }
    const next = { ym: '2026-12', expected: 4, worst: 2, best: 6, count: 10 }
    const cards = forecastCards({ fc, next, bookings: bk, today: T })
    expect(cards.map(c => c.key)).toEqual(['delivery', 'booking', 'lead', 'income', 'next', 'service'])
    expect(cards.find(c => c.key === 'lead')).toMatchObject({ ok: false })
    expect(cards.find(c => c.key === 'next')).toMatchObject({ ok: true, value: 4, unit: 'คัน' })
    expect(forecastCards({ fc, bookings: bk, today: T, money: false }).some(c => c.key === 'income')).toBe(false)
    const html = forecastHubHtml(cards)
    expect(html).toContain('≈ 9<small>คัน</small>')
    expect(html).toContain('ยังคาดไม่ได้: ต้องมีลูกค้าย้อนหลังอย่างน้อย 3 เดือน')
    expect(html).toContain('data-nav="/analytics/delivery-forecast"')
  })
})

import { insightCards } from './forecastOverview.js'
describe('insight cards (v1.0.1441)', () => {
  it('five topics, each ok or with reason', () => {
    const cards = insightCards({ today: T })
    expect(cards.map(c => c.key)).toEqual(['tdconv', 'calltime', 'source', 'speed', 'turnaround'])
    expect(cards.every(c => c.ok === false && c.why)).toBe(true)
    const done = [1, 1, 2, 2, 3].map(n => ({ status: 'delivered', createdAt: '2026-11-01T00:00:00Z', doneAt: new Date(Date.UTC(2026, 10, 1 + n)).toISOString() }))
    const ta = insightCards({ jobs: done, today: T }).find(c => c.key === 'turnaround')
    expect(ta).toMatchObject({ ok: true, display: '2 วัน' })
    expect(forecastHubHtml([ta])).toContain('2 วัน')
  })
})
