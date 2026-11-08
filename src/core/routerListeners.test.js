import { describe, it, expect, vi } from 'vitest'
import { trackPageListeners, dropPageListeners } from './pageListeners.js'

describe('page listeners on the shared page container', () => {
  it('are removed when the page changes, so revisiting a page does not double-fire', () => {
    const el = new EventTarget()
    trackPageListeners(el)
    const first = vi.fn(), second = vi.fn()
    el.addEventListener('click', first)
    dropPageListeners(el)           // navigate away and back
    el.addEventListener('click', second)
    el.dispatchEvent(new Event('click'))
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
    trackPageListeners(el)          // idempotent
    el.dispatchEvent(new Event('click'))
    expect(second).toHaveBeenCalledTimes(2)
  })
})
