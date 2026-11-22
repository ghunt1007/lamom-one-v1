import { describe, it, expect, vi } from 'vitest'
vi.mock('../core/db.js', () => ({ updateDocData: vi.fn() }))
vi.mock('../core/store.js', () => ({ showToast: vi.fn() }))
vi.mock('./qrModal.js', () => ({ openQrModal: vi.fn() }))
import { pickLineInviteTargets, lineInviteSmsText } from './lineLink.js'

describe('pickLineInviteTargets (v1.0.1262)', () => {
  const now = Date.parse('2026-11-22T03:00:00Z')
  it('เลือกเฉพาะใบจองค้างที่ยังไม่ผูก มีเบอร์มือถือ ไม่ซ้ำ ไม่เพิ่งส่ง', () => {
    const r = pickLineInviteTargets([
      { id: 'a', status: 'รอรถ', phone: '081-234-5678' },
      { id: 'b', status: 'รอรถ', phone: '0812345678' },
      { id: 'c', status: 'รอรถ', phone: '02-123-4567' },
      { id: 'd', status: 'รอรถ', phone: '0899999999', lineUserId: 'Uxxx' },
      { id: 'e', status: 'ส่งมอบแล้ว', phone: '0861111111' },
      { id: 'f', status: 'รอรถ', phone: '0862222222', lineInviteSmsAt: '2026-11-20T00:00:00Z' },
      { id: 'g', status: 'รอรถ', phone: '+66 63 333 3333', lineInviteSmsAt: '2026-11-01T00:00:00Z' },
    ], now)
    expect(r.map(x => x.b.id)).toEqual(['a', 'g'])
    expect(r[1].phone).toBe('0633333333')
  })
  it('ข้อความ', () => {
    const t = lineInviteSmsText('คุณสมชาย ใจดี', 'https://line.me/R/oaMessage/@x/?a')
    expect(t).toMatch(/^สวัสดีครับ คุณสมชาย ขอบคุณที่จองรถกับเรา/)
    expect(t).toContain('https://line.me/R/oaMessage/@x/?a')
  })
})
