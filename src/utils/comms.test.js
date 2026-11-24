import { describe, it, expect, vi } from 'vitest'
vi.mock('../core/firebase.js', () => ({ auth: { currentUser: null } }))
import { assertDelivered } from './comms.js'

describe('assertDelivered', () => {
  it('throws when provider is not configured', () => {
    expect(() => assertDelivered({ configured: false, error: 'SMS ยังไม่ได้ตั้งค่า' })).toThrow('SMS ยังไม่ได้ตั้งค่า')
  })
  it('throws when nothing was delivered', () => {
    expect(() => assertDelivered({ configured: true, sent: 0, failed: 1, errors: [{ error: 'bad number' }] }, 'SMS ')).toThrow('bad number')
  })
  it('passes full and partial success, and empty sends', () => {
    expect(assertDelivered({ configured: true, sent: 2, failed: 0 })).toEqual({ configured: true, sent: 2, failed: 0 })
    expect(assertDelivered({ configured: true, sent: 1, failed: 1 }).sent).toBe(1)
    expect(assertDelivered({ configured: true, sent: 0, failed: 0 }).sent).toBe(0)
  })
})
