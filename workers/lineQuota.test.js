import { describe, it, expect } from 'vitest'
import { fetchLineQuota, lineQuotaLine } from './lineQuota.js'

const ok = d => ({ ok: true, json: async () => d })
const fx = (quota, usage) => async u => u.endsWith('/consumption') ? ok(usage) : ok(quota)

describe('LINE quota', () => {
  it('limited plan → used / left / pct', async () => {
    expect(await fetchLineQuota('t', fx({ type: 'limited', value: 300 }, { totalUsage: 255 }))).toEqual({ limited: true, limit: 300, used: 255, left: 45, pct: 85 })
  })
  it('unlimited plan, no token, API error → no warning', async () => {
    const u = await fetchLineQuota('t', fx({ type: 'none' }, { totalUsage: 9000 }))
    expect(u.limited).toBe(false); expect(lineQuotaLine(u)).toBe('')
    expect(await fetchLineQuota('', fx({}, {}))).toBe(null)
    expect(await fetchLineQuota('t', async () => ({ ok: false }))).toBe(null)
    expect(await fetchLineQuota('t', async () => { throw new Error('net') })).toBe(null)
    expect(lineQuotaLine(null)).toBe('')
  })
  it('warns from 80%, says when it is used up', () => {
    expect(lineQuotaLine({ limited: true, limit: 300, used: 200, left: 100, pct: 67 })).toBe('')
    expect(lineQuotaLine({ limited: true, limit: 300, used: 240, left: 60, pct: 80 })).toContain('เหลือ 60 ข้อความ')
    expect(lineQuotaLine({ limited: true, limit: 300, used: 300, left: 0, pct: 100 })).toContain('หมดแล้ว')
  })
})
