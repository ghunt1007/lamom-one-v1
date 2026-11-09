import { describe, it, expect } from 'vitest'
import { buildMorningSections } from './daily-report.js'

const today = '2026-11-10'
const base = { bookings: [], followups: [], testDrives: [] }

describe('customers waiting on LINE in the 09:00 reminder (v1.0.1027)', () => {
  it('lists unanswered inbound LINE chats under the customer owner and puts them in focus', () => {
    const customers = [
      { id: 'c1', firstName: 'เอ', assignedTo: 'สมชาย', lineUserId: 'U1', stage: 'booking' },
      { id: 'c2', firstName: 'บี', assignedTo: 'สมชาย', lineUserId: 'U2', stage: 'booking', isLost: true },
    ]
    const lineThreads = [
      { platform: 'line', userId: 'U1', unread: true, lastDirection: 'in', lastText: 'ราคาเท่าไหร่ครับ' },
      { platform: 'line', userId: 'U2', unread: true, lastDirection: 'in', lastText: 'x' },
      { platform: 'line', userId: 'U9', unread: true, lastDirection: 'in', lastText: 'ไม่รู้จัก' },
    ]
    const s = buildMorningSections({ ...base, customers, lineThreads }, { today })
    const me = s.find(x => x.name === 'สมชาย')
    expect(me.text).toContain('💬 ลูกค้าทัก LINE รอตอบ: 1 ราย')
    expect(me.text).toContain('เอ · "ราคาเท่าไหร่ครับ"')
    expect(me.focus[0]).toContain('ตอบ LINE เอ')
  })
  it('skips answered threads', () => {
    const customers = [{ id: 'c1', firstName: 'เอ', assignedTo: 'สมชาย', lineUserId: 'U1', stage: 'booking' }]
    const s = buildMorningSections({ ...base, customers, lineThreads: [{ platform: 'line', userId: 'U1', unread: true, lastDirection: 'out' }] }, { today })
    expect(s.find(x => x.name === 'สมชาย')).toBeUndefined()
  })
})
