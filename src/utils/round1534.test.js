import { describe, it, expect } from 'vitest'
import { commandIntro } from './lamiCommandCard.js'

describe('v1.0.1534 command intro', () => {
  it('open-only cards do not ask to press ✅ ทำเลย', () => {
    expect(commandIntro([{ kind: 'quote' }])).toBe('🪄 เข้าใจว่าจะทำแบบนี้ครับ — กดปุ่มด้านล่างเพื่อเปิด')
    expect(commandIntro([{ kind: 'log' }])).toContain('✅ ทำเลย')
  })
})

import { parseOpsSpec, leaveAnswer } from './opsQuestions.js'
describe('v1.0.1535 leave ranking', () => {
  it('ranks staff by leave count', () => {
    expect(parseOpsSpec('พนักงานคนไหนลาเยอะสุดเดือนนี้')).toEqual({ kind: 'leave', day: 'month', rank: true })
    const rows = [{ staff: 'ก', status: 'approved', from: '2026-11-03', type: 'sick' }, { staff: 'ก', status: 'approved', from: '2026-11-10' }, { staff: 'ข', status: 'pending', from: '2026-11-20' }, { staff: 'ค', status: 'approved', from: '2026-10-05' }]
    const r = leaveAnswer(rows, { today: '2026-11-28', day: 'month', rank: true })
    expect(r.text).toBe('👥 การลาเดือนนี้ (01/11/2569–30/11/2569) — 3 ใบ (รออนุมัติ 1)\n1. ก — 2 ครั้ง\n2. ข — 1 ครั้ง')
    expect(leaveAnswer(rows, { today: '2026-11-28', day: 'month', rank: true, prev: true }).text).toContain('เดือนก่อน (01/10/2569–31/10/2569) — 1 ใบ')
  })
})
