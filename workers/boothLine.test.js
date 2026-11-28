import { describe, it, expect } from 'vitest'
import { parseLineCommand, LINE_HELP_TEXT, BOOTH_EVENT_FIELDS } from './daily-report.js'

describe('LINE บูธ (v1.0.1523)', () => {
  it('parses', () => {
    expect(parseLineCommand('บูธ')).toEqual({ type: 'booth', day: 'week' })
    expect(parseLineCommand('เวรบูธ')).toEqual({ type: 'booth', day: 'week' })
    expect(parseLineCommand('บูธพรุ่งนี้')).toEqual({ type: 'booth', day: 'tomorrow' })
    expect(parseLineCommand('บูธ วันนี้')).toEqual({ type: 'booth', day: 'today' })
    expect(LINE_HELP_TEXT).toContain('• บูธ')
  })
  it('reads the fields boothShiftAnswer needs', () => {
    for (const f of ['title', 'venue', 'startDate', 'endDate', 'status', 'shifts', 'staff', 'deleted']) expect(BOOTH_EVENT_FIELDS).toContain(f)
  })
})
