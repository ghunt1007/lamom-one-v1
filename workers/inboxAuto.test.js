import { describe, it, expect, beforeEach } from 'vitest'
import { normalizeInboxAuto, shouldAiReply, inWorkingHours, channelAllowed, nextAiCounter, buildAiReplyPrompt, cleanAiReply, aiAutoReply, __resetInboxCache, HANDOFF_TAG, bangkokHHMM } from './inboxAuto.js'

const on = normalizeInboxAuto({ aiReply: true })
const at = iso => new Date(iso)

describe('inbox auto settings', () => {
  it('defaults off; env vars still turn on lead capture', () => {
    expect(normalizeInboxAuto({}).aiReply).toBe(false)
    expect(normalizeInboxAuto({}).autoLead).toBe(false)
    expect(normalizeInboxAuto({}, { AUTO_LEAD_FROM_LINE: '1' }).autoLead).toBe(true)
    expect(normalizeInboxAuto({ autoLead: false }, { AUTO_LEAD_FROM_LINE: '1' }).autoLead).toBe(false)
    expect(normalizeInboxAuto({ aiStart: '25:00' }).aiStart).toBe('08:30')
  })
  it('working hours are Bangkok time', () => {
    expect(bangkokHHMM(at('2026-11-13T02:00:00Z'))).toBe('09:00')
    expect(inWorkingHours(on, at('2026-11-13T02:00:00Z'))).toBe(true)
    expect(inWorkingHours(on, at('2026-11-13T13:00:00Z'))).toBe(false) // 20:00
    expect(inWorkingHours({ aiStart: '22:00', aiEnd: '06:00' }, at('2026-11-13T16:00:00Z'))).toBe(true) // 23:00
  })
  it('channel filter', () => {
    expect(channelAllowed(on, 'team')).toBe(true)
    expect(channelAllowed({ aiChannels: 'main, fb' }, 'team')).toBe(false)
    expect(channelAllowed({ aiChannels: 'main, fb' }, 'FB')).toBe(true)
  })
})

describe('shouldAiReply', () => {
  const now = at('2026-11-13T13:00:00Z')
  it('blocks when off, no key, non-text, paused, human recently, offhours in hours, rate', () => {
    expect(shouldAiReply(normalizeInboxAuto({}), { now }).why).toBe('off')
    expect(shouldAiReply(on, { now, hasKey: false }).why).toBe('no-key')
    expect(shouldAiReply(on, { now, isText: false }).why).toBe('not-text')
    expect(shouldAiReply(on, { now, thread: { aiPaused: true } }).why).toBe('paused')
    expect(shouldAiReply(on, { now, thread: { lastHumanAt: '2026-11-13T12:45:00Z' } }).why).toBe('human')
    expect(shouldAiReply(on, { now, thread: { lastHumanAt: '2026-11-13T12:00:00Z' } }).ok).toBe(true)
    const off = normalizeInboxAuto({ aiReply: true, aiMode: 'offhours' })
    expect(shouldAiReply(off, { now: at('2026-11-13T03:00:00Z') }).why).toBe('hours')
    expect(shouldAiReply(off, { now }).ok).toBe(true)
    expect(shouldAiReply(on, { now, thread: { aiWindowAt: '2026-11-13T12:30:00Z', aiCount: 6 } }).why).toBe('rate')
    expect(shouldAiReply(on, { now, thread: { aiWindowAt: '2026-11-13T11:30:00Z', aiCount: 6 } }).ok).toBe(true)
  })
  it('counter resets after an hour', () => {
    expect(nextAiCounter({ aiWindowAt: '2026-11-13T12:30:00Z', aiCount: 2 }, now).aiCount).toBe(3)
    expect(nextAiCounter({ aiWindowAt: '2026-11-13T11:00:00Z', aiCount: 5 }, now).aiCount).toBe(1)
  })
})

describe('prompt + cleaning', () => {
  it('maps history to user/model and starts with user', () => {
    const p = buildAiReplyPrompt({ settings: { ...on, aiInfo: 'เปิด 08:30–18:00' }, history: [{ direction: 'out', text: 'สวัสดี' }, { direction: 'in', text: 'S07 ราคาเท่าไหร่' }], promos: ['- โปร A'] })
    expect(p.contents).toEqual([{ role: 'user', parts: [{ text: 'S07 ราคาเท่าไหร่' }] }])
    expect(p.systemInstruction.parts[0].text).toContain('เปิด 08:30–18:00')
    expect(p.systemInstruction.parts[0].text).toContain('- โปร A')
  })
  it('detects handoff tag and strips markdown', () => {
    expect(cleanAiReply(`**ได้เลยค่ะ** เดี๋ยวให้พนักงานโทรกลับนะคะ ${HANDOFF_TAG}`)).toEqual({ text: 'ได้เลยค่ะ เดี๋ยวให้พนักงานโทรกลับนะคะ', handoff: true })
  })
})

describe('aiAutoReply end to end (fake Firestore + Gemini)', () => {
  beforeEach(() => __resetInboxCache())
  function fakeFetch(state) {
    return async (url, init = {}) => {
      const u = String(url)
      const ok = body => ({ ok: true, json: async () => body })
      if (u.includes('system_integrations/inbox_auto')) return ok({ name: 'x/inbox_auto', fields: { aiReply: { booleanValue: true }, aiName: { stringValue: 'ลามิ' } } })
      if (u.includes('/social_threads/') && (!init.method || init.method === 'GET')) return ok({ name: 'x/t1', fields: state.thread || {} })
      if (u.endsWith(':runQuery')) return ok([{ document: { name: 'x/m1', fields: { direction: { stringValue: 'in' }, text: { stringValue: 'มีโปรไหม' }, at: { timestampValue: '2026-11-13T12:59:00Z' } } } }])
      if (u.includes('/sales_programs')) return ok({ documents: [] })
      if (u.includes('generativelanguage')) { state.prompt = JSON.parse(init.body); return ok({ candidates: [{ content: { parts: [{ text: 'ตอนนี้เซลส์จะแจ้งโปรล่าสุดให้ค่ะ ขอชื่อและเบอร์โทรได้ไหมคะ' }] } }] }) }
      if (u.endsWith('/social_messages')) { state.msg = JSON.parse(init.body); return ok({}) }
      if (u.includes('/social_threads/') && init.method === 'PATCH') { state.patch = JSON.parse(init.body); return ok({}) }
      return { ok: false, json: async () => ({}) }
    }
  }
  it('replies, records the AI message and updates the thread', async () => {
    const state = {}
    const sent = []
    const r = await aiAutoReply({ FIREBASE_PROJECT_ID: 'p', GEMINI_API_KEY: 'k' }, 'tok', { threadId: 'line_Uabc1234567', send: async t => { sent.push(t); return true } }, { fetch: fakeFetch(state), now: at('2026-11-13T13:00:00Z') })
    expect(r.replied).toBe(true)
    expect(sent[0]).toContain('ขอชื่อและเบอร์โทร')
    expect(state.prompt.contents[0].parts[0].text).toBe('มีโปรไหม')
    expect(state.msg.fields.by.stringValue).toBe('🤖 ลามิ')
    expect(state.msg.fields.ai.booleanValue).toBe(true)
    expect(state.patch.fields.lastByAi.booleanValue).toBe(true)
    expect(state.patch.fields.aiCount.integerValue).toBe('1')
  })
  it('stays quiet when a staff member replied 10 minutes ago', async () => {
    const state = { thread: { lastHumanAt: { timestampValue: '2026-11-13T12:50:00Z' } } }
    const r = await aiAutoReply({ FIREBASE_PROJECT_ID: 'p', GEMINI_API_KEY: 'k' }, 'tok', { threadId: 't1', send: async () => true }, { fetch: fakeFetch(state), now: at('2026-11-13T13:00:00Z') })
    expect(r).toEqual({ replied: false, why: 'human' })
    expect(state.prompt).toBeUndefined()
  })
  it('does nothing without the Gemini key', async () => {
    const r = await aiAutoReply({ FIREBASE_PROJECT_ID: 'p' }, 'tok', { threadId: 't1', send: async () => true }, { fetch: fakeFetch({}), now: at('2026-11-13T13:00:00Z') })
    expect(r.why).toBe('no-key')
  })
})

import { aiReplyTest } from './inboxAuto.js'
describe('v1.0.1135 aiReplyTest (preview, never sends)', () => {
  beforeEach(() => __resetInboxCache())
  const env = { GEMINI_API_KEY: 'k', FIREBASE_PROJECT_ID: 'p' }
  it('asks Gemini with the draft settings and returns the cleaned reply', async () => {
    const calls = []
    const fetchImpl = async (url, init) => {
      calls.push({ url, body: init?.body })
      if (url.includes('generativelanguage')) return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: `ได้เลยค่ะ ${HANDOFF_TAG}` }] } }] }) }
      return { ok: true, json: async () => ({}) }
    }
    const r = await aiReplyTest(env, 'tok', { text: 'ขอคุยกับเซลส์', draft: { aiName: 'น้องทดสอบ', aiInfo: 'เปิด 08:30–18:00' } }, { fetch: fetchImpl })
    expect(r).toEqual({ ok: true, text: 'ได้เลยค่ะ', handoff: true })
    const g = JSON.parse(calls.find(c => c.url.includes('generativelanguage')).body)
    expect(g.systemInstruction.parts[0].text).toContain('น้องทดสอบ')
    expect(g.contents[0].parts[0].text).toBe('ขอคุยกับเซลส์')
    expect(calls.some(c => /messages|reply|push/.test(c.url) && !c.url.includes('generativelanguage'))).toBe(false)
  })
  it('reports a missing key and rejects empty questions', async () => {
    expect(await aiReplyTest({}, null, { text: 'สวัสดี' })).toEqual({ ok: false, reason: 'nokey' })
    await expect(aiReplyTest(env, null, { text: '  ' })).rejects.toThrow('พิมพ์คำถาม')
  })
})
