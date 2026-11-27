import { describe, it, expect } from 'vitest'
import { bestCallTimes, callTimeLine, callTimeAnswer } from './callTimes.js'
import { parseOpsSpec } from './opsQuestions.js'

const now = Date.parse('2026-11-28T12:00:00Z')
// ชั่วโมงไทย h → ISO (UTC = h-7)
const at = (day, h) => new Date(Date.UTC(2026, 10, day, h - 7, 15)).toISOString()
const log = (day, h, ok) => ({ type: 'call', note: ok ? 'คุยแล้ว สนใจ' : 'ไม่รับสาย', createdAt: at(day, h) })
const sample = () => {
  const out = []
  for (let i = 0; i < 20; i++) out.push(log(1 + (i % 20), 17, i < 16)) // 17–18 น. รับ 80%
  for (let i = 0; i < 20; i++) out.push(log(1 + (i % 20), 13, i < 8))  // 13–14 น. รับ 40%
  return out
}

describe('callTimes (v1.0.1437)', () => {
  it('ranks blocks by answer rate in Bangkok time', () => {
    const r = bestCallTimes([...sample(), { type: 'call', note: 'โทรแล้ว', createdAt: at(5, 9) }, { type: 'line', note: 'คุยแล้ว สนใจ', createdAt: at(5, 9) }], { now })
    expect(r.total).toBe(40)
    expect(r.best).toMatchObject({ from: 16, to: 18, n: 20, answered: 16 })
    expect(r.worst).toMatchObject({ from: 12, to: 14 })
    expect(callTimeLine(r)).toBe('⏰ ช่วงที่ลูกค้ารับสายมากสุด 16:00–18:00 น. (รับ 80%) · น้อยสุด 12:00–14:00 น. (40%)')
  })
  it('null / explains when too few calls', () => {
    expect(bestCallTimes(sample().slice(0, 30), { now })).toBeNull()
    expect(callTimeLine(null)).toBe('')
    expect(callTimeAnswer([], { now }).text).toContain('ยังบอกไม่ได้')
    expect(callTimeAnswer(sample(), { now }).text).toContain('• 16:00–18:00 น. รับ 80% (16/20) ⭐')
  })
  it('routes', () => {
    for (const q of ['ควรโทรช่วงไหน', 'โทรเวลาไหนลูกค้ารับสาย', 'ลูกค้ารับสายช่วงไหนบ้าง']) expect(parseOpsSpec(q)?.kind, q).toBe('calltime')
    expect(parseOpsSpec('วันนี้ควรโทรหาใคร')?.kind).not.toBe('calltime')
  })
})

import { customerCallHint, customerBestBlock } from './callTimes.js'
import { customerBrief } from './customerBrief.js'
describe('customerCallHint (v1.0.1448)', () => {
  const now = Date.parse('2026-11-28T12:00:00Z')
  const log = (iso, note) => ({ type: 'call', createdAt: iso, note })
  it('best answered block (Bangkok time) or 3 misses in a row', () => {
    // 11:30Z = 18:30 น.
    expect(customerCallHint([log('2026-11-20T11:30:00Z', 'คุยแล้ว'), log('2026-11-10T12:10:00Z', 'ขอคิดก่อน'), log('2026-11-05T03:00:00Z', 'ไม่รับสาย')], { now }))
      .toBe('⏰ เคยรับสายช่วง 18:00–20:00 น. (2 ครั้ง) — โทรช่วงนี้ติดง่ายสุด')
    expect(customerCallHint([log('2026-11-20T03:00:00Z', 'ไม่รับสาย'), log('2026-11-19T03:30:00Z', 'ไม่รับสาย'), log('2026-11-18T07:00:00Z', 'ไม่รับสาย'), log('2026-10-01T11:00:00Z', 'คุยแล้ว')], { now }))
      .toBe('📵 โทรไม่ติด 3 ครั้งล่าสุด (ช่วง 10:00–12:00 น., 14:00–16:00 น.) — ลองทักไลน์ หรือโทรช่วงเวลาอื่น')
    expect(customerCallHint([log('2026-11-20T11:30:00Z', 'คุยแล้ว'), log('2026-11-20T11:40:00Z', 'โน้ตพิมพ์เอง')], { now })).toBe('')
  })
  it('short block for call list', () => {
    expect(customerBestBlock([log('2026-11-20T11:30:00Z', 'คุยแล้ว'), log('2026-11-10T12:10:00Z', 'ขอคิดก่อน')], { now })).toBe('18–20 น.')
    expect(customerBestBlock([log('2026-11-20T11:30:00Z', 'คุยแล้ว')], { now })).toBe('')
  })
  it('brief shows the hint', () => {
    expect(customerBrief({ customer: { firstName: 'ทดสอบ', stage: 'lead' }, today: '2026-11-28', callHint: '⏰ X' })).toContain('\n⏰ X\n')
  })
})
