import { describe, it, expect } from 'vitest'
import { trackPageWatcher, stopPageWatchers, activePageWatcherCount } from './pageWatchers.js'

describe('pageWatchers', () => {
  it('stops every tracked watcher once, and manual stop is idempotent', () => {
    let a = 0, b = 0
    const sa = trackPageWatcher(() => a++)
    trackPageWatcher(() => b++)
    expect(activePageWatcherCount()).toBe(2)
    sa(); sa()
    expect(a).toBe(1)
    stopPageWatchers(); stopPageWatchers()
    expect(b).toBe(1)
    expect(a).toBe(1)
    expect(activePageWatcherCount()).toBe(0)
  })
})
