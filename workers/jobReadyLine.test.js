import { describe, it, expect, vi } from 'vitest'
import { pickJobReady, runJobReady } from './jobReadyLine.js'

const U1 = 'U' + 'a'.repeat(32), U2 = 'U' + 'b'.repeat(32)
const now = Date.parse('2026-11-22T05:00:00Z')
const ago = h => new Date(now - h * 3600e3).toISOString()
const customers = [
  { id: 'c1', firstName: 'สมชาย', phone: '081-234-5678', lineUserId: U1 },
  { id: 'c2', firstName: 'มานี', phone: '0899999999', lineUserId: U2, lineBlockedAt: '2026-11-01' },
]

describe('pickJobReady (v1.0.1265)', () => {
  it('เฉพาะใบงานเสร็จที่เพิ่งแก้ใน 3 ชม. ลูกค้าผูก LINE · ไม่ส่งซ้ำ', () => {
    const send = pickJobReady({ nowMs: now, customers, jobs: [
      { id: 'j1', status: 'done', phone: '0812345678', brand: 'DEEPAL', model: 'S07', plate: 'กข 1', updatedAt: ago(1) },
      { id: 'j2', status: 'done', customerId: 'c1', updatedAt: ago(5) },
      { id: 'j3', status: 'inprogress', customerId: 'c1', updatedAt: ago(1) },
      { id: 'j4', status: 'done', customerId: 'c1', updatedAt: ago(1), lineReadySent: true },
      { id: 'j5', status: 'done', phone: '0899999999', updatedAt: ago(1) },
      { id: 'j6', status: 'done', phone: '0861111111', updatedAt: ago(1) },
    ] })
    expect(send).toHaveLength(1)
    expect(send[0]).toMatchObject({ id: 'j1', to: U1 })
    expect(send[0].text).toContain('สวัสดีครับคุณสมชาย รถ DEEPAL S07 ทะเบียน กข 1 ดำเนินการที่ศูนย์บริการเสร็จเรียบร้อยแล้ว')
  })
})

describe('runJobReady', () => {
  const deps = over => ({
    enabled: true, hour: 11, nowMs: now,
    list: async col => ({ customers, job_cards: [{ id: 'j1', status: 'done', customerId: 'c1', updatedAt: ago(0.5) }] })[col],
    pushLine: vi.fn(async () => true), mark: vi.fn(async () => true), ...over,
  })
  it('ปิด/นอกเวลา = ไม่ทำ · จดก่อนส่ง', async () => {
    expect((await runJobReady(deps({ enabled: false }))).skipped).toBe('off')
    expect((await runJobReady(deps({ hour: 21 }))).skipped).toBe('hour')
    const d = deps()
    expect(await runJobReady(d)).toEqual({ sent: 1, failed: 0 })
    expect(d.mark).toHaveBeenCalledWith('job_cards', 'j1', { lineReadySent: { booleanValue: true } })
    const d2 = deps({ mark: vi.fn(async () => false) })
    expect((await runJobReady(d2)).sent).toBe(0)
    expect(d2.pushLine).not.toHaveBeenCalled()
  })
})
