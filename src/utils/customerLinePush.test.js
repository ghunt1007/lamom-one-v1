import { describe, it, expect, vi } from 'vitest'
vi.mock('./socialApi.js', () => ({ lineReply: vi.fn(async () => ({ ok: true })) }))
import { canPushLine, lineThreadOf, pushLineToCustomer, lineSendBtnHtml } from './customerLinePush.js'
import { lineReply } from './socialApi.js'

const U = 'U' + 'a'.repeat(32)
describe('customerLinePush', () => {
  it('canPushLine only for linked customers who still accept LINE', () => {
    expect(canPushLine({ lineUserId: U })).toBe(true)
    expect(canPushLine({ lineUserId: 'someLineId' })).toBe(false)
    expect(canPushLine({})).toBe(false)
    expect(canPushLine({ lineUserId: U, lineOptOut: true })).toBe(false)
    expect(canPushLine({ lineUserId: U, lineBlockedAt: '2026-11-01' })).toBe(false)
    expect(canPushLine({ lineUserId: U, marketingConsent: 'no' })).toBe(false)
    expect(canPushLine({ lineUserId: U, deleted: true })).toBe(false)
  })
  it('thread id and button', () => {
    expect(lineThreadOf({ lineUserId: U })).toBe('line_' + U)
    expect(lineSendBtnHtml({ lineUserId: U }, 'x')).toContain('id="x"')
    expect(lineSendBtnHtml({}, 'x')).toBe('')
  })
  it('pushes text and refuses when not allowed', async () => {
    await pushLineToCustomer({ lineUserId: U }, ' สวัสดี ')
    expect(lineReply).toHaveBeenCalledWith('line_' + U, 'สวัสดี')
    await expect(pushLineToCustomer({ lineUserId: U, lineOptOut: true }, 'x')).rejects.toThrow()
    await expect(pushLineToCustomer({ lineUserId: U }, '  ')).rejects.toThrow()
  })
})
