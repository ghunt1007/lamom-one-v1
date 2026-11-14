import { describe, it, expect } from 'vitest'
import { Timestamp } from 'firebase/firestore'
import { reviveBackupDoc, isTimestampLike } from './backupRevive.js'
import { backupDecodeValue } from '../../workers/nightly-backup.js'

describe('backupRevive', () => {
  it('turns the app backup timestamp shape back into a Timestamp', () => {
    const t = Timestamp.fromDate(new Date('2026-11-13T10:00:00Z'))
    const json = JSON.parse(JSON.stringify({ createdAt: t, nested: { at: t }, list: [t, 'x'] }))
    const out = reviveBackupDoc(json)
    expect(out.createdAt).toBeInstanceOf(Timestamp)
    expect(out.createdAt.toDate().toISOString()).toBe('2026-11-13T10:00:00.000Z')
    expect(out.nested.at).toBeInstanceOf(Timestamp)
    expect(out.list[0]).toBeInstanceOf(Timestamp)
    expect(out.list[1]).toBe('x')
  })
  it('keeps plain strings (Excel-imported ISO dates stay strings) and other maps', () => {
    const out = reviveBackupDoc({ createdAt: '2026-10-01T00:00:00.000Z', price: { seconds: 5 }, n: 3, z: null })
    expect(out.createdAt).toBe('2026-10-01T00:00:00.000Z')
    expect(out.price).toEqual({ seconds: 5 })
    expect(out.n).toBe(3)
    expect(out.z).toBe(null)
  })
  it('does not treat a map with extra fields as a timestamp', () => {
    expect(isTimestampLike({ seconds: 1, nanoseconds: 0, label: 'a' })).toBe(false)
  })
  it('round-trips the nightly backup encoding', () => {
    const fsDoc = {
      createdAt: { timestampValue: '2026-11-13T10:00:00.123456Z' },
      name: { stringValue: 'สมชาย' },
      tags: { arrayValue: { values: [{ stringValue: 'a' }, { timestampValue: '2026-01-02T03:04:05Z' }] } },
      sale: { mapValue: { fields: { total: { integerValue: '950000' }, at: { timestampValue: '2026-11-01T00:00:00Z' } } } },
    }
    const decoded = Object.fromEntries(Object.entries(fsDoc).map(([k, v]) => [k, backupDecodeValue(v)]))
    const out = reviveBackupDoc(JSON.parse(JSON.stringify(decoded)))
    expect(out.createdAt).toBeInstanceOf(Timestamp)
    expect(out.createdAt.toDate().toISOString()).toBe('2026-11-13T10:00:00.123Z')
    expect(out.createdAt.nanoseconds).toBe(123456000)
    expect(out.name).toBe('สมชาย')
    expect(out.tags[1]).toBeInstanceOf(Timestamp)
    expect(out.sale.total).toBe(950000)
    expect(out.sale.at).toBeInstanceOf(Timestamp)
  })
})
