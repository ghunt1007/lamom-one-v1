import { describe, it, expect, vi, afterEach } from 'vitest'
import { runNightlyBackup, handleLatestBackup, keysToPrune, backupKey, BACKUP_SKIP } from './nightly-backup.js'

const decode = v => (v.stringValue ?? (v.integerValue !== undefined ? Number(v.integerValue) : null))

function fakeBucket() {
  const store = new Map()
  return {
    store,
    async put(key, body, opts) { store.set(key, { body, uploaded: new Date(Date.now() + store.size), ...opts }) },
    async list({ prefix }) { return { objects: [...store.entries()].filter(([k]) => k.startsWith(prefix)).map(([key, v]) => ({ key, uploaded: v.uploaded })) } },
    async delete(keys) { [].concat(keys).forEach(k => store.delete(k)) },
    async get(key) { const v = store.get(key); return v ? { body: new Blob([v.body]).stream() } : null },
  }
}

function fakeFirestore(collections, logs) {
  return vi.fn(async (url, init = {}) => {
    if (url.endsWith(':listCollectionIds')) return new Response(JSON.stringify({ collectionIds: Object.keys(collections) }))
    if (url.endsWith('/system_backups') && init.method === 'POST') { logs.push(JSON.parse(init.body).fields); return new Response('{}') }
    const col = decodeURIComponent(new URL(url).pathname.split('/').pop())
    if (col === 'broken') return new Response('no', { status: 403 })
    const docs = (collections[col] || []).map(d => ({ name: `projects/p/databases/(default)/documents/${col}/${d.id}`, fields: { name: { stringValue: d.name } } }))
    return new Response(JSON.stringify({ documents: docs }))
  })
}

const gunzipText = async bytes => new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text()

afterEach(() => vi.unstubAllGlobals())

describe('nightly backup', () => {
  it('backs up every collection with data into R2 in the app restore format and logs it', async () => {
    const logs = []
    vi.stubGlobal('fetch', fakeFirestore({ bookings: [{ id: 'b1', name: 'A' }, { id: 'b2', name: 'B' }], customers: [{ id: 'c1', name: 'C' }], audit_log: [{ id: 'x', name: 'x' }], empty: [] }, logs))
    const env = { FIREBASE_PROJECT_ID: 'p', BACKUP_BUCKET: fakeBucket() }
    const notify = vi.fn(async () => {})
    const r = await runNightlyBackup(env, { getToken: async () => 't', decode, notify, today: '2026-11-03' })
    expect(r).toMatchObject({ ok: true, totalDocs: 3, collections: 2, skipped: 0 })
    expect(r.key).toMatch(/^backups\/2026-11-03-[0-9a-f-]{36}\.json\.gz$/)
    const saved = JSON.parse(await gunzipText(env.BACKUP_BUCKET.store.get(r.key).body))
    expect(Object.keys(saved.data).sort()).toEqual(['bookings', 'customers'])
    expect(saved.data.bookings[0]).toEqual({ id: 'b1', name: 'A' })
    expect(logs[0].status.stringValue).toBe('success')
    expect(notify).not.toHaveBeenCalled()
    expect(BACKUP_SKIP).toContain('audit_log')
  })

  it('reports a partial backup and tells the owner', async () => {
    const logs = []
    vi.stubGlobal('fetch', fakeFirestore({ bookings: [{ id: 'b1', name: 'A' }], broken: [] }, logs))
    const notify = vi.fn(async () => {})
    const r = await runNightlyBackup({ FIREBASE_PROJECT_ID: 'p', BACKUP_BUCKET: fakeBucket() }, { getToken: async () => 't', decode, notify, today: '2026-11-03' })
    expect(r).toMatchObject({ ok: true, skipped: 1 })
    expect(logs[0].status.stringValue).toBe('partial')
    expect(notify.mock.calls[0][0]).toContain('broken')
  })

  it('tells the owner when it cannot run', async () => {
    const notify = vi.fn(async () => {})
    const r = await runNightlyBackup({ FIREBASE_PROJECT_ID: 'p' }, { getToken: async () => 't', decode, notify, today: '2026-11-03' })
    expect(r.ok).toBe(false)
    expect(notify.mock.calls[0][0]).toContain('ไม่สำเร็จ')
  })

  it('keeps only the newest 30 backups', () => {
    const objs = Array.from({ length: 32 }, (_, i) => ({ key: `k${i}`, uploaded: new Date(2026, 0, i + 1) }))
    expect(keysToPrune(objs)).toEqual(['k1', 'k0'])
    expect(backupKey('2026-11-03', 'abc')).toBe('backups/2026-11-03-abc.json.gz')
  })

  it('serves the latest backup only to the program owner', async () => {
    const env = { FIREBASE_PROJECT_ID: 'p', BACKUP_BUCKET: fakeBucket() }
    const gz = new Uint8Array(await new Response(new Blob(['{"data":{}}']).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer())
    await env.BACKUP_BUCKET.put('backups/2026-11-02-a.json.gz', gz)
    expect((await handleLatestBackup(env, { email: 'someone@x.com' }, {})).status).toBe(403)
    const res = await handleLatestBackup(env, { email: 'GHUNT1007@gmail.com' }, {})
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Disposition')).toContain('lamom-backup-auto-2026-11-02.json')
    expect(await res.text()).toBe('{"data":{}}')
  })
})
