import { describe, it, expect, vi } from 'vitest'

const calls = []
vi.mock('./firebase.js', () => ({ db: {} }))
vi.mock('firebase/firestore', () => {
  const mk = (t) => (...a) => ({ t, a })
  return {
    collection: mk('col'), doc: mk('doc'), where: mk('where'), orderBy: mk('orderBy'), limit: mk('limit'), startAfter: mk('sa'),
    query: (...a) => ({ t: 'query', a }),
    getDocs: async (q) => {
      calls.push(q)
      if (q.a.some(c => c?.t === 'orderBy')) { const e = new Error('The query requires an index'); e.code = 'failed-precondition'; throw e }
      return { docs: [{ id: '1', data: () => ({ d: '2026-01-01' }) }, { id: '2', data: () => ({ d: '2026-05-01' }) }] }
    },
    onSnapshot: () => () => {}, addDoc: vi.fn(), setDoc: vi.fn(), updateDoc: vi.fn(), deleteDoc: vi.fn(), getDoc: vi.fn(),
    serverTimestamp: () => null, Timestamp: { now: () => null }, increment: () => null, deleteField: () => null,
  }
})

describe('listDocs missing-index fallback', () => {
  it('retries without orderBy and sorts locally', async () => {
    const { listDocs } = await import('./db.js')
    const rows = await listDocs('trade_ins', [['companyId', 'in', ['x']]], 'd', 'desc', 10)
    expect(rows.map(r => r.id)).toEqual(['2', '1'])
    expect(calls.length).toBe(2)
  })
  it('still throws without filters (nothing to fall back to)', async () => {
    const { listDocs } = await import('./db.js')
    await expect(listDocs('trade_ins', [], 'd')).rejects.toThrow(/index/)
  })
})
