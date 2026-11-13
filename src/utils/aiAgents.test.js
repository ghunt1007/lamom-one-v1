import { describe, it, expect } from 'vitest'
import { runAgents, agentsSummary, needsHumanAnswer, AGENTS, bodyLines } from './aiAgents.js'

const today = '2026-11-14'
const data = {
  today,
  customers: [
    { id: 'c1', firstName: 'สมชาย', stage: 'pp', temperature: 'hot', lastContactAt: '2026-11-01', createdAt: '2026-10-01', assignedTo: 'เอ', phone: '0811111111' },
    { id: 'c2', firstName: 'สมหญิง', stage: 'lead', createdAt: '2026-11-13', lastContactAt: '2026-11-13' },
  ],
  bookings: [{ id: 'b1', customerName: 'ก', status: 'รอส่งมอบ', deliveryDate: '2026-11-16', salesName: 'เอ' }],
  drives: [], quotes: [], appts: [], pdis: [], complaints: [], leaves: [],
  threads: [{ id: 't1', platform: 'line', userId: 'U1', unread: true, lastDirection: 'in', lastText: 'สนใจ', name: 'ลูกค้า A' }, { id: 't2', needsHuman: true, name: 'B', channelName: 'เพจทีม' }],
}

describe('AI agent team', () => {
  it('each agent has a department and tasks with a link', () => {
    for (const a of AGENTS) { expect(a.dept).toBeTruthy(); for (const t of a.tasks) expect(t.go.startsWith('/')).toBe(true) }
  })
  it('finds real work per department', () => {
    const board = runAgents(data)
    const by = id => board.find(a => a.id === id)
    const silent = by('sam').results.find(r => r.key === 'silent')
    expect(silent.n).toBe(1)
    expect(silent.lines.join(' ')).toContain('สมชาย')
    expect(by('mika').results.find(r => r.key === 'chat').n).toBe(1)
    expect(by('mika').results.find(r => r.key === 'human').n).toBe(1)
    expect(by('mika').urgent).toBe(2)
    expect(by('aria').results.find(r => r.key === 'delivery').n).toBe(1)
  })
  it('one broken task does not break the board', () => {
    const board = runAgents({ ...data, bookings: null, pdis: undefined })
    expect(board).toHaveLength(AGENTS.length)
  })
  it('summary lists urgent first, or says all clear', () => {
    const s = agentsSummary(runAgents(data))
    expect(s.split('\n')[1]).toMatch(/^🔴/)
    expect(agentsSummary(runAgents({ today, customers: [], bookings: [], drives: [], quotes: [], appts: [], pdis: [], complaints: [], leaves: [], threads: [] }))).toContain('ไม่มีงานค้าง')
  })
  it('helpers', () => {
    expect(needsHumanAnswer([{ needsHuman: true, aiPaused: true }]).n).toBe(0)
    expect(bodyLines('หัว\n• ก\n\n• ข')).toEqual(['• ก', '• ข'])
  })
})
