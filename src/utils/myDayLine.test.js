import { describe, it, expect } from 'vitest'
import { buildMyDay } from './myDay.js'

describe('My Day: customers waiting on LINE (v1.0.1026)', () => {
  const customers = [
    { id: 'c1', firstName: 'เอ', assignedTo: 'เซลส์ หนึ่ง', lineUserId: 'U1', stage: 'pp' },
    { id: 'c2', firstName: 'บี', assignedTo: 'เซลส์ สอง', lineUserId: 'U2', stage: 'pp' },
    { id: 'c3', firstName: 'ซี', assignedTo: 'เซลส์ หนึ่ง', lineUserId: 'U3', stage: 'pp', isLost: true },
  ]
  const lineThreads = [
    { id: 'line_U1', platform: 'line', userId: 'U1', unread: true, lastDirection: 'in', lastText: 'ราคาเท่าไหร่' },
    { id: 'line_U2', platform: 'line', userId: 'U2', unread: true, lastDirection: 'in', lastText: 'x' },
    { id: 'line_U3', platform: 'line', userId: 'U3', unread: true, lastDirection: 'in', lastText: 'x' },
    { id: 'line_U9', platform: 'line', userId: 'U9', unread: true, lastDirection: 'in', lastText: 'ไม่รู้จัก' },
  ]
  it('lists only my, not-lost customers with an unanswered inbound LINE', () => {
    const d = buildMyDay({ customers, lineThreads }, { today: '2026-11-10', mine: n => n === 'เซลส์ หนึ่ง' })
    expect(d.lineWaiting).toEqual([expect.objectContaining({ id: 'line_U1', customerId: 'c1', name: 'เอ', text: 'ราคาเท่าไหร่' })])
  })
  it('ignores answered or read threads', () => {
    const t = [{ ...lineThreads[0], lastDirection: 'out' }, { ...lineThreads[1], unread: false }]
    expect(buildMyDay({ customers, lineThreads: t }, { today: '2026-11-10' }).lineWaiting).toEqual([])
  })
})
