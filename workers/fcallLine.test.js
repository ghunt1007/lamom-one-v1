import { describe, it, expect } from 'vitest'
import { parseLineCommand, forecastOverviewLineText, LINE_HELP_TEXT } from './daily-report.js'

describe('LINE คาดการณ์เดือนนี้ (v1.0.1442)', () => {
  it('parses overview vs order forecast', () => {
    for (const t of ['คาดการณ์เดือนนี้', 'ภาพรวมคาดการณ์', 'คาดการณ์ ทั้งหมด', 'สิ้นเดือน']) expect(parseLineCommand(t), t).toEqual({ type: 'fcall' })
    expect(parseLineCommand('คาดการณ์')).toEqual({ type: 'forecast' })
    expect(LINE_HELP_TEXT).toContain('คาดการณ์เดือนนี้')
  })
  it('builds text from bookings history', () => {
    const bk = []
    for (const m of ['05', '06', '07', '08', '09', '10']) for (let i = 0; i < 10; i++) bk.push({ bookingDate: `2026-${m}-${String(i < 5 ? 1 + i : 15 + i).padStart(2, '0')}`, status: 'ส่งมอบแล้ว', cutDate: `2026-${m}-28` })
    for (let i = 0; i < 4; i++) bk.push({ bookingDate: `2026-11-0${1 + i}`, status: 'รอรถ' })
    const text = forecastOverviewLineText({ bookings: bk, today: '2026-11-10' })
    expect(text).toContain('🔮 คาดการณ์เดือนนี้ พ.ย. 2569')
    expect(text).toContain('🚚 ส่งมอบ:')
    expect(text).toContain('📝 ยอดจอง: แล้ว 4 ใบ')
    expect(text).toContain('ศูนย์คาดการณ์')
  })
})
