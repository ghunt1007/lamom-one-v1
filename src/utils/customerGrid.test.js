import { describe, it, expect } from 'vitest'
import { customerColumns, customerPatch, withGridFields } from './customerGrid.js'
import { parseCell, displayCell, planPaste } from './sheetColumns.js'

const cols = customerColumns({
  stage: { lead: { label: '🧲 Lead' }, pp: { label: '📇 Prospect' } },
  temp: { hot: { label: '🔴 Hot' }, cold: { label: '🔵 Cold' } },
  source: { line: '💚 LINE', 'walk-in': '🚶 Walk-in' },
})
const col = f => cols.find(c => c.f === f)

describe('customerGrid', () => {
  it('select columns accept value or visible label, reject unknown', () => {
    expect(parseCell(col('temperature'), 'hot')).toBe('hot')
    expect(parseCell(col('temperature'), '🔴 Hot')).toBe('hot')
    expect(parseCell(col('temperature'), 'Cold')).toBe('cold')
    expect(parseCell(col('source'), 'walk-in')).toBe('walk-in')
    expect(parseCell(col('source'), 'LINE')).toBe('line')
    expect(parseCell(col('temperature'), 'อุ่นๆ')).toBeNull()
    expect(parseCell(col('temperature'), '')).toBe('')
    expect(displayCell(col('stage'), 'pp')).toBe('📇 Prospect')
    expect(displayCell(col('stage'), 'weird')).toBe('weird')
  })
  it('patch mirrors the full form: stage date, Lead → Prospect on first contact, empty temp = null', () => {
    const now = '2026-11-07T00:00:00.000Z'
    expect(customerPatch({ stage: 'lead' }, col('stage'), 'pp', now)).toEqual({ stage: 'pp', stageChangedAt: now })
    expect(customerPatch({ stage: 'lead' }, col('phone'), '0812345678', now)).toEqual({ phone: '0812345678', stage: 'pp', stageChangedAt: now })
    expect(customerPatch({ stage: 'lead', lineId: 'x' }, col('phone'), '0812345678', now)).toEqual({ phone: '0812345678' })
    expect(customerPatch({}, col('temperature'), '', now)).toEqual({ temperature: null })
  })
  it('computed fields are read-only and not spread into saves', () => {
    const rows = withGridFields([{ stage: 'lead', createdAt: '2026-11-01T20:00:00.000Z' }], '2026-11-07')
    expect(rows[0]._added).toBe('2026-11-02')
    expect(rows[0]._quiet).toBe(5)
    expect(Object.keys({ ...rows[0] })).toEqual(['stage', 'createdAt'])
    expect(col('_added').ro && col('_quiet').ro).toBe(true)
  })
  it('paste from Sheet fills name, phone and stage label across columns', () => {
    const rows = [{ firstName: '', lastName: '', phone: '', lineId: '', stage: 'lead' }]
    const { changes, bad } = planPaste([['สมชาย', 'ใจดี', '081-234-5678', 'som', 'Prospect']], rows, cols, 0, 0)
    expect(bad).toEqual([])
    expect(changes.map(c => [c.col.f, c.value])).toEqual([['firstName', 'สมชาย'], ['lastName', 'ใจดี'], ['phone', '0812345678'], ['lineId', 'som'], ['stage', 'pp']])
  })
})
