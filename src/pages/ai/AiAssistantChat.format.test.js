import { describe, it, expect, vi } from 'vitest'
vi.mock('../../core/db.js', () => ({}))
vi.mock('../../core/store.js', () => ({}))
vi.mock('../../utils/modal.js', () => ({}))
vi.mock('../../utils/ai.js', () => ({}))
vi.mock('./LeadScoring.js', () => ({}))
vi.mock('../../core/companyScope.js', () => ({}))
vi.mock('../../core/hierarchy.js', () => ({}))
vi.mock('../../utils/customerFollowups.js', () => ({}))
const { formatAiText } = await import('./AiAssistantChat.js')

describe('formatAiText', () => {
  it('bolds, bullets and line breaks', () => {
    expect(formatAiText('**โทรหา** สมชาย\n* ข้อ 1')).toBe('<b>โทรหา</b> สมชาย<br>• ข้อ 1')
  })
  it('never lets HTML from AI through', () => {
    expect(formatAiText('<img src=x onerror=alert(1)>')).not.toContain('<img')
  })
})

import { splitFollowups } from './AiAssistantChat.js'
describe('splitFollowups', () => {
  it('pulls suggested next questions off the last line', () => {
    const r = splitFollowups('ยอดเดือนนี้ 12 คัน\n\n**ถามต่อ:** เทียบเดือนก่อน | ใครขายเยอะสุด | "ควรเร่งรุ่นไหน"')
    expect(r.text).toBe('ยอดเดือนนี้ 12 คัน')
    expect(r.next).toEqual(['เทียบเดือนก่อน', 'ใครขายเยอะสุด', 'ควรเร่งรุ่นไหน'])
  })
  it('leaves answers without suggestions alone', () => {
    expect(splitFollowups('สวัสดีค่ะ')).toEqual({ text: 'สวัสดีค่ะ', next: [] })
  })
})
