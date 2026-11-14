import { describe, it, expect, beforeEach } from 'vitest'
import { SECRET_KEYS, encryptValue, decryptValue, loadStoredSecrets, withStoredSecrets, secretsStatus, validateSecret, cleanLineChannel, nextChannelId, handleSecrets, testSecret, __resetSecretCache } from './secretStore.js'

const env = { FIREBASE_PROJECT_ID: 'p', FIRESTORE_SERVICE_ACCOUNT_JSON: JSON.stringify({ client_email: 'x@y', private_key: 'PRIVATE-KEY-ONE' }) }
const LINE_SECRET = 'a'.repeat(32), LINE_TOKEN = 'T'.repeat(120)

// Firestore ปลอมในหน่วยความจำ (เก็บ fields ของ system_integrations/secrets)
function fakeDb(initial = {}) {
  const db = { fields: { ...initial }, calls: [] }
  db.fetch = async (url, init = {}) => {
    db.calls.push({ url, method: init.method || 'GET' })
    if (url.includes('generativelanguage')) return { ok: init.headers['x-goog-api-key'] === 'GOOD-GEMINI-KEY-1234567890', json: async () => ({}) }
    if (url.includes('graph.facebook.com')) return { ok: false, json: async () => ({}) }
    if (!url.includes('system_integrations/secrets')) throw new Error('unexpected ' + url)
    if (init.method === 'PATCH') {
      const mask = [...new URL(url).searchParams.getAll('updateMask.fieldPaths')]
      const f = JSON.parse(init.body).fields
      for (const k of mask) { if (f[k]) db.fields[k] = f[k]; else delete db.fields[k] }
      return { ok: true, json: async () => ({}) }
    }
    return { ok: true, json: async () => ({ fields: db.fields }) }
  }
  return db
}
const opts = db => ({ getToken: async () => 'tok', by: 'owner@x', fetchImpl: db.fetch })

describe('secretStore encryption', () => {
  it('round-trips and is unreadable without the same service account', async () => {
    const c = await encryptValue(env, 'sk-secret-123')
    expect(c).toMatch(/^v1:/); expect(c).not.toContain('sk-secret-123')
    expect(await decryptValue(env, c)).toBe('sk-secret-123')
    expect(await encryptValue(env, 'sk-secret-123')).not.toBe(c)
    const other = { ...env, FIRESTORE_SERVICE_ACCOUNT_JSON: JSON.stringify({ private_key: 'PRIVATE-KEY-TWO' }) }
    expect(await decryptValue(other, c)).toBe('')
    expect(await decryptValue(env, 'plain-text')).toBe('')
    expect(await encryptValue({}, 'x')).toBe(null)
  })
})

describe('secretStore load + overlay', () => {
  beforeEach(() => __resetSecretCache())
  it('app values override Cloudflare values and other bindings stay reachable', async () => {
    const db = fakeDb({ GEMINI_API_KEY: { stringValue: await encryptValue(env, 'from-app') }, NOT_ALLOWED: { stringValue: await encryptValue(env, 'x') } })
    const base = { ...env, GEMINI_API_KEY: 'from-cf', LINE_CHANNEL_ACCESS_TOKEN: 'main', BUCKET: { put() {} } }
    const e2 = await withStoredSecrets(base, async () => 'tok', db.fetch)
    expect(e2.GEMINI_API_KEY).toBe('from-app'); expect(e2.LINE_CHANNEL_ACCESS_TOKEN).toBe('main'); expect(e2.BUCKET).toBe(base.BUCKET)
    expect(e2.NOT_ALLOWED).toBeUndefined(); expect(base.GEMINI_API_KEY).toBe('from-cf')
    await withStoredSecrets(base, async () => 'tok', db.fetch)
    expect(db.calls.length).toBe(1) // จำไว้ 60 วินาที
  })
  it('falls back to the plain env on any failure', async () => {
    const boom = async () => { throw new Error('down') }
    expect(await withStoredSecrets(env, async () => 'tok', boom)).toBe(env)
    expect(await withStoredSecrets(env, async () => null, boom)).toBe(env)
    expect(await withStoredSecrets({ GEMINI_API_KEY: 'k' }, boom, boom)).toEqual({ GEMINI_API_KEY: 'k' })
    expect(await loadStoredSecrets(env, boom, boom)).toEqual({})
  })
  it('status never contains values', () => {
    const st = secretsStatus({ META_APP_SECRET: 'cf-value' }, { GEMINI_API_KEY: 'app-value' })
    expect(st.GEMINI_API_KEY).toEqual({ set: true, from: 'app' }); expect(st.META_APP_SECRET).toEqual({ set: true, from: 'cloudflare' }); expect(st.LEAD_WEBHOOK_KEY).toEqual({ set: false, from: '' })
    expect(JSON.stringify(st)).not.toMatch(/app-value|cf-value/)
    expect(Object.keys(st)).toEqual(SECRET_KEYS)
  })
})

describe('secretStore validation', () => {
  it('checks keys and shapes', () => {
    expect(() => validateSecret('FIRESTORE_SERVICE_ACCOUNT_JSON', 'x')).toThrow('ไม่รู้จัก')
    expect(() => validateSecret('GEMINI_API_KEY', 'short')).toThrow('สั้น')
    expect(() => validateSecret('GEMINI_API_KEY', 'has space in the middle of key')).toThrow('ช่องว่าง')
    expect(() => validateSecret('LEAD_WEBHOOK_KEY', 'abc')).toThrow('12')
    expect(validateSecret('LEAD_WEBHOOK_KEY', ' abcdefghijkl ')).toBe('abcdefghijkl')
    expect(validateSecret('GEMINI_API_KEY', '')).toBe('')
    expect(() => validateSecret('LINE_EXTRA_CHANNELS', '{bad')).toThrow('รูปแบบ')
    expect(() => cleanLineChannel({ id: 'oa1', name: 'x', secret: 'short', token: LINE_TOKEN })).toThrow('32')
    expect(() => cleanLineChannel({ id: 'main', name: 'x', secret: LINE_SECRET, token: LINE_TOKEN })).toThrow('รหัส')
    expect(cleanLineChannel({ id: 'Team-1!', name: ' ทีม <b> ', secret: LINE_SECRET, token: LINE_TOKEN }).id).toBe('team-1')
    expect(nextChannelId([{ id: 'oa1' }, { id: 'oa2' }])).toBe('oa3')
  })
})

describe('handleSecrets (owner endpoint)', () => {
  beforeEach(() => __resetSecretCache())
  it('saves encrypted, reports status without values, tests the key, and clears', async () => {
    const db = fakeDb()
    const r = await handleSecrets({ ...env, META_APP_SECRET: 'cf' }, { op: 'set', key: 'GEMINI_API_KEY', value: 'GOOD-GEMINI-KEY-1234567890' }, opts(db))
    expect(r.keys.GEMINI_API_KEY).toEqual({ set: true, from: 'app' }); expect(r.keys.META_APP_SECRET.from).toBe('cloudflare')
    expect(r.test.ok).toBe(true)
    expect(db.fields.GEMINI_API_KEY.stringValue).toMatch(/^v1:/); expect(JSON.stringify(db.fields)).not.toContain('GOOD-GEMINI')
    expect(db.fields.updatedBy.stringValue).toBe('owner@x'); expect(JSON.stringify(r)).not.toContain('GOOD-GEMINI')
    const bad = await handleSecrets(env, { op: 'set', key: 'GEMINI_API_KEY', value: 'WRONG-GEMINI-KEY-1234567890' }, opts(db))
    expect(bad.test.ok).toBe(false)
    const c = await handleSecrets(env, { op: 'clear', key: 'GEMINI_API_KEY' }, opts(db))
    expect(c.keys.GEMINI_API_KEY.set).toBe(false); expect(db.fields.GEMINI_API_KEY).toBeUndefined()
    await expect(handleSecrets(env, { op: 'set', key: 'GEMINI_API_KEY', value: '' }, opts(db))).rejects.toThrow('วางกุญแจ')
    await expect(handleSecrets(env, { op: 'nope' }, opts(db))).rejects.toThrow('ไม่รู้จักคำสั่ง')
    await expect(handleSecrets({}, { op: 'status' }, opts(db))).rejects.toThrow('ฐานข้อมูล')
  })
  it('adds and removes LINE OAs one at a time, starting from the Cloudflare list', async () => {
    const db = fakeDb()
    const base = { ...env, LINE_EXTRA_CHANNELS: JSON.stringify([{ id: 'showroom', name: 'โชว์รูม', secret: LINE_SECRET, token: LINE_TOKEN }]) }
    const a = await handleSecrets(base, { op: 'line-add', name: 'เซลส์ เอ', secret: LINE_SECRET, token: LINE_TOKEN }, opts(db))
    expect(a.added).toEqual({ id: 'oa1', name: 'เซลส์ เอ' }); expect(a.lineExtra.map(c => c.id)).toEqual(['showroom', 'oa1'])
    expect(JSON.stringify(a)).not.toContain(LINE_TOKEN)
    const e2 = await withStoredSecrets(base, async () => 'tok', db.fetch)
    expect(JSON.parse(e2.LINE_EXTRA_CHANNELS).map(c => c.id)).toEqual(['showroom', 'oa1'])
    const r = await handleSecrets(base, { op: 'line-remove', id: 'showroom' }, opts(db))
    expect(r.lineExtra.map(c => c.id)).toEqual(['oa1'])
    const r2 = await handleSecrets(base, { op: 'line-remove', id: 'oa1' }, opts(db))
    expect(r2.lineExtra).toEqual([]) // ลบหมดแล้วบัญชีจาก Cloudflare ไม่กลับมา
    await expect(handleSecrets(base, { op: 'line-remove', id: 'ghost' }, opts(db))).rejects.toThrow('ไม่พบ')
    await expect(handleSecrets(base, { op: 'line-add', name: 'x', secret: 'bad', token: LINE_TOKEN }, opts(db))).rejects.toThrow('32')
  })
  it('testSecret returns null for keys it cannot check', async () => {
    expect(await testSecret('LEAD_WEBHOOK_KEY', 'abcdefghijkl')).toBe(null)
  })
})
