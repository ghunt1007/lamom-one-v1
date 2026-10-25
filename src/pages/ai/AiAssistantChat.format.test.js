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

describe('formatAiText tables', () => {
  it('turns markdown tables into real tables', () => {
    const h = formatAiText('สรุป\n\n| เซลส์ | ยอด |\n|---|---|\n| **เอ** | 5 |\n| บี | 2 |\nจบ')
    expect(h).toContain('<div class="ai-tbl"><table><thead><tr><th>เซลส์</th><th>ยอด</th></tr></thead><tbody><tr><td><b>เอ</b></td><td>5</td></tr><tr><td>บี</td><td>2</td></tr></tbody></table></div>')
    expect(h.startsWith('สรุป<br><br><div')).toBe(true)
    expect(h.endsWith('</div>จบ')).toBe(true)
  })
  it('leaves lone pipes alone and escapes cells', () => {
    expect(formatAiText('a | b')).toBe('a | b')
    expect(formatAiText('| <x> |\n|---|\n| y |')).not.toContain('<x>')
  })
  it('headings become bold', () => {
    expect(formatAiText('### หัวข้อ\nข้อความ')).toBe('<b>หัวข้อ</b><br>ข้อความ')
  })
})
