import { describe, it, expect } from 'vitest'
import { buildCustomerBrief, buildCloserPrompt, parseCloserReply, addDaysIso } from './salesAi.js'

const c = { firstName: 'สมชาย', lastName: 'ใจดี', phone: '0812345678', lineId: 'somchai', email: 'a@b.c', stage: 'pp', temperature: 'hot', interestedModel: 'S07', budget: 1200000, source: 'facebook', createdAt: '2026-10-01', lastContactAt: '2026-10-20T03:00:00Z' }

describe('AI ผู้ช่วยปิดการขาย', () => {
  it('brief มีสถานะ/ความสนใจ/ประวัติ แต่ไม่มีเบอร์ อีเมล LINE ID หรือนามสกุล', () => {
    const b = buildCustomerBrief(c, { today: '2026-10-25', history: [{ ts: '2026-10-20', label: 'โทรศัพท์', text: 'ถามเรื่องดาวน์' }], followups: [{ dueDate: '2026-10-26', purpose: 'ติดตาม Lead ใหม่' }] })
    expect(b).toContain('Prospect')
    expect(b).toContain('ร้อน')
    expect(b).toContain('S07')
    expect(b).toContain('1,200,000')
    expect(b).toContain('ติดต่อล่าสุด: 5 วันก่อน')
    expect(b).toContain('ถามเรื่องดาวน์')
    expect(b).toContain('2026-10-26')
    expect(b).not.toMatch(/0812345678|somchai|a@b\.c|ใจดี/)
  })
  it('ลูกค้าไม่มีประวัติ', () => {
    expect(buildCustomerBrief({ stage: 'lead' }, { today: '2026-10-25' })).toContain('ยังไม่มีบันทึกการติดต่อ')
  })
  it('prompt บังคับตอบ JSON และใส่ brief', () => {
    const p = buildCloserPrompt('BRIEF-X')
    expect(p).toContain('BRIEF-X')
    expect(p).toContain('lineMessage')
  })
  it('parseCloserReply อ่าน JSON ที่มี ```json ครอบ และจำกัดค่า', () => {
    const r = parseCloserReply('```json\n{"score": 140, "summary":"สนใจมาก","nextAction":"โทรนัดทดลองขับ","channel":"call","lineMessage":"สวัสดีครับ","objections":["ราคา"],"followUpDays":2}\n```')
    expect(r).toMatchObject({ score: 100, channel: 'call', followUpDays: 2, objections: ['ราคา'] })
    expect(parseCloserReply('{"channel":"fax","summary":"x","score":"abc"}')).toMatchObject({ channel: '', score: null })
    expect(parseCloserReply('ไม่ใช่ JSON')).toBeNull()
    expect(parseCloserReply('{"foo":1}')).toBeNull()
  })
  it('addDaysIso ข้ามเดือน', () => {
    expect(addDaysIso('2026-10-30', 3)).toBe('2026-11-02')
    expect(addDaysIso('2026-10-30', 0)).toBe('2026-10-30')
  })
})
