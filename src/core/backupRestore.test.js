import { describe, it, expect, vi, beforeEach } from 'vitest'

const state = { commits: 0, singles: 0, failBatch: false, badIds: new Set() }
vi.mock('./firebase.js', () => ({ db: {} }))
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(), getDocs: vi.fn(), query: vi.fn(), orderBy: vi.fn(), limit: vi.fn(), startAfter: vi.fn(), documentId: vi.fn(),
  serverTimestamp: () => 'TS',
  doc: (_db, col, id) => ({ col, id }),
  Timestamp: class { constructor(s, n) { this.seconds = s; this.nanoseconds = n } },
  writeBatch: () => {
    const ops = []
    return { set: (ref, data) => ops.push([ref, data]), commit: async () => { if (state.failBatch && ops.some(([r]) => state.badIds.has(r.id))) throw new Error('denied'); state.commits++ } }
  },
  setDoc: async (ref) => { state.singles++; if (state.badIds.has(ref.id)) throw new Error('denied ' + ref.id) },
}))

const { restoreFromBackupData } = await import('./backup.js')
const mk = (n, p = 'd') => Array.from({ length: n }, (_, i) => ({ id: `${p}${i}`, name: 'x' }))

describe('restoreFromBackupData (batched)', () => {
  beforeEach(() => { state.commits = 0; state.singles = 0; state.failBatch = false; state.badIds = new Set() })
  it('writes in batches instead of one call per document', async () => {
    const r = await restoreFromBackupData({ data: { bookings: mk(900), customers: mk(10) } })
    expect(r).toEqual({ restored: 910, failed: 0, errors: [] })
    expect(state.commits).toBe(4); expect(state.singles).toBe(0)
  })
  it('falls back to single writes only for a failing batch and reports the bad documents', async () => {
    state.failBatch = true; state.badIds = new Set(['d5'])
    const r = await restoreFromBackupData({ data: { bookings: mk(12) } }, null, { batchSize: 5 })
    expect(r.restored).toBe(11); expect(r.failed).toBe(1)
    expect(r.errors[0]).toMatchObject({ colName: 'bookings', id: 'd5' })
    expect(state.commits).toBe(2); expect(state.singles).toBe(5)
  })
  it('reports progress per batch and skips rows without an id', async () => {
    const seen = []
    const r = await restoreFromBackupData({ data: { a: [...mk(3), { name: 'no id' }] } }, p => seen.push(p.docIndex + '/' + p.docTotal), { batchSize: 2 })
    expect(r.restored).toBe(3); expect(seen).toEqual(['2/3', '3/3'])
  })
})
