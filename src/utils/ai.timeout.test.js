import { describe, it, expect } from 'vitest'
import { withTimeout } from './ai.js'

describe('withTimeout', () => {
  it('returns the result when it is fast', async () => {
    expect(await withTimeout(Promise.resolve(['a']), 50, [])).toEqual(['a'])
  })
  it('returns the fallback when it is slow', async () => {
    expect(await withTimeout(new Promise(r => setTimeout(() => r(['late']), 200)), 20, [])).toEqual([])
  })
})

import { aiErrorText } from './ai.js'
describe('aiErrorText', () => {
  it('turns network failures into plain Thai', () => {
    expect(aiErrorText(new Error('Failed to fetch'))).toMatch(/อินเทอร์เน็ต/)
    expect(aiErrorText(new Error('AI Proxy Error 503'))).toMatch(/ขัดข้องชั่วคราว/)
    expect(aiErrorText(new Error('429 RESOURCE_EXHAUSTED'))).toMatch(/รอสักครู่/)
  })
  it('keeps messages that are already readable', () => {
    expect(aiErrorText(new Error('ต้องล็อกอินด้วยบัญชีจริง'))).toBe('ต้องล็อกอินด้วยบัญชีจริง')
    expect(aiErrorText(null)).toMatch(/ลองใหม่/)
  })
})
