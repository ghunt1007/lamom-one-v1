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
