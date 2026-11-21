import { describe, it, expect, vi } from 'vitest'
vi.mock('../core/db.js', () => ({ updateDocData: vi.fn() }))
vi.mock('../core/store.js', () => ({ showToast: vi.fn() }))
vi.mock('./qrModal.js', () => ({ openQrModal: vi.fn() }))
import { makeLinkCode, lineLinkUrl, lineLinkState } from './lineLink.js'
import { parseLinkCode } from '../../workers/lineLink.js'

describe('lineLink (app)', () => {
  it('codes match what the worker accepts', () => {
    for (let i = 0; i < 20; i++) { const c = makeLinkCode(); expect(parseLinkCode('ผูก ' + c)).toBe(c) }
  })
  it('builds the LINE oaMessage URL with the code prefilled', () => {
    const u = lineLinkUrl('@abc123', 'ABC234')
    expect(u).toBe('https://line.me/R/oaMessage/%40abc123/?' + encodeURIComponent('ผูก ABC234'))
    expect(parseLinkCode(decodeURIComponent(u.split('?')[1]))).toBe('ABC234')
    expect(lineLinkUrl('', 'ABC234')).toBe('')
    expect(lineLinkUrl('@x<y', 'ABC234')).toBe('')
  })
  it('labels link state', () => {
    expect(lineLinkState({}).linked).toBe(false)
    expect(lineLinkState({ lineUserId: 'U1', lineOptOut: true }).label).toContain('เลิกรับ')
    expect(lineLinkState({ lineUserId: 'U1', lineBlockedAt: 'x' }).label).toContain('บล็อก')
    expect(lineLinkState({ lineUserId: 'U1', lineLinkedAt: '2026-11-21T03:00:00Z' }).label).toMatch(/\d{2}\/\d{2}\/\d{4}/)
  })
})

describe('ลิงก์ผูก LINE ทาง SMS (v1.0.1235)', () => {
  it('smsHref + ข้อความชวน', async () => {
    const { smsHref } = await import('./callLink.js')
    const { lineLinkInvite } = await import('./lineLink.js')
    expect(smsHref('081-234-5678', 'สวัสดี')).toBe('sms:0812345678?body=' + encodeURIComponent('สวัสดี'))
    expect(smsHref('12')).toBe('')
    expect(lineLinkInvite('')).toBe('')
    expect(lineLinkInvite('https://line.me/R/oaMessage/@a/?x')).toContain('https://line.me/R/oaMessage/@a/?x')
  })
})

describe('needsLineLink', () => {
  it('เฉพาะใบจองเปิดที่ยังไม่ผูก', async () => {
    const { needsLineLink } = await import('./lineLink.js')
    expect(needsLineLink({ status: 'รอรถ' })).toBe(true)
    expect(needsLineLink({ status: 'รอรถ', lineUserId: 'U1' })).toBe(false)
    expect(needsLineLink({ status: 'ส่งมอบแล้ว' })).toBe(false)
    expect(needsLineLink({ status: 'ถอนจอง' })).toBe(false)
  })
})
