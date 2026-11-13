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

import { officeDigestLines } from './aiAgents.js'
describe('v1.0.1133 office digest for the 09:00 LINE', () => {
  it('lists only back-office work, urgent first, with a link', () => {
    const lines = officeDigestLines({
      today: '2026-11-14',
      threads: [{ needsHuman: true, name: 'คุณเอ' }],
      pdis: [{ status: 'failed', startDate: '2026-11-10', model: 'X' }],
      complaints: [],
      leaves: [{ status: 'approved', from: '2026-11-14', to: '2026-11-14', staff: 'บี', type: 'sick' }],
    }, { appUrl: 'https://app.example/' })
    expect(lines[0]).toContain('ทีม AI')
    expect(lines.filter(l => l.startsWith('🔴'))).toHaveLength(2)
    expect(lines.some(l => l.startsWith('🟡') && l.includes('ลา'))).toBe(true)
    expect(lines.at(-1)).toBe('👉 https://app.example/ai/team')
  })
  it('is empty when nothing is open or data is missing', () => {
    expect(officeDigestLines({ today: '2026-11-14' })).toEqual([])
  })
})

import { parseOpsSpec, OPS_LINKS, opsFollowUps } from './opsQuestions.js'
describe('v1.0.1136 LAMI asks the AI team', () => {
  it('routes team questions to the agent board', () => {
    for (const q of ['ทีม AI วันนี้มีงานอะไร', 'ทีมเอไอแจ้งอะไรบ้าง', 'งานค้างทุกแผนก', 'ทุกฝ่ายมีงานค้างไหม', 'AI agent วันนี้ว่าไง']) expect(parseOpsSpec(q)?.kind, q).toBe('aiteam')
    expect(OPS_LINKS.aiteam.path).toBe('/ai/team')
    expect(opsFollowUps({ kind: 'aiteam' })[0]).toBeTruthy()
  })
  it('leaves other questions alone', () => {
    for (const q of ['ใครลาวันนี้', 'เรื่องร้องเรียนค้างอยู่ไหม', 'มีลูกค้าทัก LINE รอตอบไหม']) expect(parseOpsSpec(q)?.kind).not.toBe('aiteam')
  })
})
