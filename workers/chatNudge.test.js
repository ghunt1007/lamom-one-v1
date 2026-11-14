import { describe, it, expect } from 'vitest'
import { pickWaitingChats, chatNudgeText, runChatNudge, CHAT_NUDGE_AFTER_MS } from './chatNudge.js'

const NOW = Date.parse('2026-11-15T03:00:00Z') // 10:00 เวลาไทย
const ago = m => new Date(NOW - m * 60000).toISOString()
const t = (id, extra = {}) => ({ id, name: 'คุณเอ', channelName: 'Deepal EV Car', lastDirection: 'in', unread: true, lastAt: ago(20), lastText: 'สนใจ S07 ครับ', ...extra })

describe('pickWaitingChats', () => {
  it('picks customer messages unanswered for 15+ minutes', () => {
    const rows = [t('a'), t('fresh', { lastAt: ago(5) }), t('answered', { lastDirection: 'out', unread: false }), t('read', { unread: false }), t('old', { lastAt: ago(19 * 60) }), t('gone', { deleted: true }), t('nodate', { lastAt: '' })]
    expect(pickWaitingChats(rows, NOW).map(x => x.id)).toEqual(['a'])
    expect(CHAT_NUDGE_AFTER_MS).toBe(15 * 60 * 1000)
  })
  it('includes AI hand-offs even though the last message is ours', () => {
    expect(pickWaitingChats([t('h', { lastDirection: 'out', unread: false, needsHuman: true })], NOW).map(x => x.id)).toEqual(['h'])
  })
  it('nudges once per latest message, again after a newer one', () => {
    expect(pickWaitingChats([t('a', { chatNudgedAt: ago(18) })], NOW)).toHaveLength(0)
    expect(pickWaitingChats([t('a', { chatNudgedAt: ago(60) })], NOW)).toHaveLength(1)
  })
})

describe('chatNudgeText', () => {
  it('lists rooms with wait time and a link', () => {
    const txt = chatNudgeText([t('a'), t('b', { lastAt: ago(150), needsHuman: true, lastDirection: 'out' })], { appUrl: 'https://app.example/', now: NOW })
    expect(txt).toContain('รอตอบ 2 ห้อง'); expect(txt).toContain('รอ 20 นาที'); expect(txt).toContain('รอ 2 ชม.'); expect(txt).toContain('AI ส่งต่อให้คน')
    expect(txt).toContain('"สนใจ S07 ครับ"'); expect(txt.split('\n').pop()).toBe('👉 https://app.example/marketing/channels')
  })
  it('caps the list at five rooms', () => {
    const txt = chatNudgeText(Array.from({ length: 8 }, (_, i) => t('x' + i)), { now: NOW })
    expect(txt).toContain('และอีก 3 ห้อง')
  })
})

describe('runChatNudge', () => {
  const mk = (over = {}) => {
    const sent = [], notes = [], marks = []
    const deps = { now: NOW, appUrl: 'https://app.example', listThreads: async () => [t('a'), t('b')], mark: async (id, iso) => { marks.push([id, iso]); return true }, ownerTarget: async () => 'Uowner', pushLine: async (to, text) => { sent.push([to, text]); return true }, notify: async b => { notes.push(b) }, ...over }
    return { deps, sent, notes, marks }
  }
  it('sends one LINE and one in-app notice for all waiting rooms', async () => {
    const { deps, sent, notes, marks } = mk()
    expect(await runChatNudge(deps)).toEqual({ waiting: 2, nudged: 2 })
    expect(marks.map(m => m[0])).toEqual(['a', 'b'])
    expect(sent).toHaveLength(1); expect(sent[0][0]).toBe('Uowner')
    expect(notes).toHaveLength(1); expect(notes[0]).toMatchObject({ title: '💬 มีแชตลูกค้ารอตอบ 2 ห้อง', link: '/marketing/channels', roles: ['manager', 'sales'] })
  })
  it('links straight to the room when only one waits', async () => {
    const { deps, notes } = mk({ listThreads: async () => [t('fb_1__2')] })
    await runChatNudge(deps)
    expect(notes[0].link).toBe('/marketing/channels?open=fb_1__2')
  })
  it('stays silent outside 08:30–20:00, when switched off, or when the mark fails', async () => {
    for (const over of [{ now: Date.parse('2026-11-15T15:00:00Z') }, { enabled: false }, { mark: async () => false }]) {
      const { deps, sent, notes } = mk(over)
      const r = await runChatNudge(deps)
      expect(r.nudged).toBe(0); expect(sent).toHaveLength(0); expect(notes).toHaveLength(0)
    }
  })
  it('never throws', async () => {
    expect(await runChatNudge({ now: NOW, listThreads: async () => { throw new Error('x') } })).toEqual({ waiting: 0, nudged: 0 })
  })
})
