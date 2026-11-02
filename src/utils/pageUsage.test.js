import { describe, it, expect } from 'vitest'
import { classifyPages, collectionsToCount, lastActivityByCollection, basePath } from './pageUsage.js'

const nav = [
  { group: 'AI', items: [
    { icon: 'a', label: 'Own', path: '/ai/own' },
    { icon: 'b', label: 'Core only', path: '/ai/core?tab=1' },
    { icon: 'c', label: 'Empty', path: '/ai/empty' },
  ] },
]
const pageCols = { '/ai/own': ['customers', 'notes'], '/ai/core': ['customers', 'chat_ai_assistant'], '/ai/empty': ['voice_notes'] }

describe('page usage', () => {
  it('sorts pages into own data / core data only / empty', () => {
    const counts = { customers: 259, notes: 3, chat_ai_assistant: 0, voice_notes: 0 }
    const [g] = classifyPages(nav, pageCols, counts, { notes: '2026-11-01T10:00:00Z', customers: '2026-11-02T00:00:00Z' })
    expect(g.items.map(i => i.usage.key)).toEqual(['own', 'core', 'empty'])
    expect(g.items[0].own).toBe(3)
    expect(g.items[0].last).toBe('2026-11-01T10:00:00Z') // ไม่นับการแก้ข้อมูลหลัก
    expect(g.summary).toEqual({ total: 3, own: 1, core: 1, empty: 1 })
  })

  it('lists each collection once and finds the latest edit per collection', () => {
    expect(collectionsToCount(nav, pageCols)).toEqual(['chat_ai_assistant', 'customers', 'notes', 'voice_notes'])
    expect(lastActivityByCollection([{ module: 'notes', ts: '2026-11-01' }, { module: 'notes', ts: '2026-11-02' }, { ts: 'x' }])).toEqual({ notes: '2026-11-02' })
    expect(basePath('/a/b?x=1#y')).toBe('/a/b')
  })
})

describe('page → collection map', () => {
  it('is up to date (run: node scripts/gen-page-collections.mjs)', async () => {
    const { buildPageCollections } = await import('../../scripts/gen-page-collections.mjs')
    const { PAGE_COLLECTIONS } = await import('../data/pageCollections.js')
    expect(PAGE_COLLECTIONS).toEqual(buildPageCollections())
  })
})
