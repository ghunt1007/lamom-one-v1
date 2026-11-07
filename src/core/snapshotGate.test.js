import { describe, it, expect, beforeEach, vi } from 'vitest'
import { makeChangeFilter, deliverWhenIdle, isTypingNow, __resetTypingGate } from './snapshotGate.js'

const snap = changes => ({ docChanges: () => changes.map(([type, id, data]) => ({ type, doc: { id, data: () => data } })) })

describe('makeChangeFilter', () => {
  it('skips the second snapshot that only fills in the server timestamp', () => {
    const f = makeChangeFilter()
    expect(f(snap([['added', 'a', { n: 1, updatedAt: { seconds: 1 } }]]))).toBe(true)
    expect(f(snap([['modified', 'a', { n: 2, updatedAt: null }]]))).toBe(true) // own write, local
    expect(f(snap([['modified', 'a', { n: 2, updatedAt: { seconds: 9 } }]]))).toBe(false) // server ack
    expect(f(snap([['modified', 'a', { n: 3, updatedAt: { seconds: 9 } }]]))).toBe(true)
    expect(f(snap([['removed', 'a', {}]]))).toBe(true)
  })
  it('always delivers the first (even empty) snapshot', () => {
    expect(makeChangeFilter()(snap([]))).toBe(true)
  })
})

describe('deliverWhenIdle', () => {
  beforeEach(() => { __resetTypingGate(); vi.useRealTimers() })
  const fakeDoc = active => {
    const h = {}
    return { activeElement: active, addEventListener: (t, fn) => { (h[t] ||= []).push(fn) }, fire: t => (h[t] || []).forEach(fn => fn({})) }
  }
  it('runs right away when nobody is typing', () => {
    const d = fakeDoc(null); const fn = vi.fn()
    deliverWhenIdle({}, fn, d)
    expect(fn).toHaveBeenCalledTimes(1)
  })
  it('holds updates while typing and delivers only the latest one after', async () => {
    vi.useFakeTimers()
    const input = { tagName: 'INPUT', getAttribute: () => 'text' }
    const d = fakeDoc(input)
    const key = {}, a = vi.fn(), b = vi.fn()
    deliverWhenIdle({}, () => {}, d) // install listeners
    d.fire('keydown')
    expect(isTypingNow(Date.now(), d)).toBe(true)
    deliverWhenIdle(key, a, d)
    deliverWhenIdle(key, b, d)
    expect(a).not.toHaveBeenCalled(); expect(b).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(600)
    expect(b).not.toHaveBeenCalled() // ยังพิมพ์อยู่ (ไม่ถึง 1.2 วิ)
    await vi.advanceTimersByTimeAsync(1000)
    expect(a).not.toHaveBeenCalled()
    expect(b).toHaveBeenCalledTimes(1)
  })
})
