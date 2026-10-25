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
