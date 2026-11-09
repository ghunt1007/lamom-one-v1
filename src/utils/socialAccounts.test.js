import { describe, it, expect } from 'vitest'
import { accountsForSource, defaultAccount, accountResults } from './socialAccounts.js'

const accs = [
  { id: 't', platform: 'facebook', level: 'team', name: 'เพจทีม' },
  { id: 's', platform: 'facebook', level: 'showroom', name: 'เพจโชว์รูม' },
  { id: 'm', platform: 'facebook', level: 'sales', name: 'เพจพี่เอ', owner: 'เซลส์ เอ' },
  { id: 'k', platform: 'tiktok', level: 'sales', name: 'tt เอ', owner: 'เซลส์ เอ' },
]
describe('socialAccounts', () => {
  it('บัญชีของฉันขึ้นก่อน แล้วโชว์รูม แล้วทีม', () => {
    expect(accountsForSource(accs, 'facebook', 'เซลส์ เอ').map(a => a.id)).toEqual(['m', 's', 't'])
    expect(accountsForSource(accs, 'facebook', 'เซลส์ บี').map(a => a.id)).toEqual(['m', 's', 't'])
    expect(accountsForSource(accs, 'walk-in', 'x')).toEqual([])
  })
  it('เลือกค่าเริ่มต้นให้เมื่อชัดเจน', () => {
    expect(defaultAccount(accountsForSource(accs, 'facebook', 'เซลส์ เอ'), 'เซลส์ เอ').id).toBe('m')
    expect(defaultAccount(accountsForSource(accs, 'facebook', 'เซลส์ บี'), 'เซลส์ บี')).toBe(null)
    expect(defaultAccount(accountsForSource(accs, 'tiktok', 'เซลส์ บี'), 'เซลส์ บี').id).toBe('k')
  })
  it('นับ Lead/จองต่อบัญชี', () => {
    const r = accountResults([
      { sourceAccountId: 'm', createdAt: '2026-11-03T03:00:00Z', stage: 'lead' },
      { sourceAccountId: 'm', createdAt: '2026-11-04T03:00:00Z', stage: 'booking' },
      { sourceAccountId: 'm', createdAt: '2026-10-04T03:00:00Z', stage: 'delivered' },
      { sourceAccountId: 's', createdAt: '2026-11-05T03:00:00Z', stage: 'lead', deleted: true },
      { createdAt: '2026-11-05T03:00:00Z' },
    ], '2026-11')
    expect(r).toEqual({ m: { leads: 2, booked: 1, allLeads: 3, allBooked: 2 } })
  })
})

import { accountSpend, withSpend, spendSummary } from './socialAccounts.js'
describe('ค่าโฆษณาต่อบัญชี (v1.0.996)', () => {
  it('accountSpend อ่านเฉพาะเดือนนั้น ค่าเสีย = 0', () => {
    expect(accountSpend({ spend: { '2026-11': 3000 } }, '2026-11')).toBe(3000)
    expect(accountSpend({ spend: { '2026-10': 3000 } }, '2026-11')).toBe(0)
    expect(accountSpend({ spend: { '2026-11': 'x' } }, '2026-11')).toBe(0)
    expect(accountSpend(null, '2026-11')).toBe(0)
  })
  it('withSpend ใส่/ลบเดือน โดยไม่ทับเดือนอื่น', () => {
    expect(withSpend({ spend: { '2026-10': 500 } }, '2026-11', '1200.4')).toEqual({ '2026-10': 500, '2026-11': 1200 })
    expect(withSpend({ spend: { '2026-11': 500 } }, '2026-11', '')).toEqual({})
  })
  it('spendSummary นับเฉพาะบัญชีที่ใส่ค่าโฆษณา', () => {
    const acc = [{ id: 'a', spend: { '2026-11': 3000 } }, { id: 'b' }, { id: 'c', spend: { '2026-11': 1000 }, deleted: true }]
    const res = { a: { leads: 6, booked: 2 }, b: { leads: 10, booked: 5 } }
    expect(spendSummary(acc, res, '2026-11')).toEqual({ spend: 3000, leads: 6, booked: 2, paid: 1, cpl: 500, cpb: 1500 })
    expect(spendSummary(acc, {}, '2026-11')).toMatchObject({ cpl: null, cpb: null })
  })
})

import { accountFacts } from './socialAccounts.js'
describe('accountFacts (v1.0.997)', () => {
  it('บอก Lead/จอง/ค่าโฆษณาต่อบัญชี ข้ามบัญชีที่ไม่มีอะไร', () => {
    const acc = [{ id: 'a', name: 'เพจทีม', platform: 'facebook', level: 'team', spend: { '2026-11': 3000 } }, { id: 'b', name: 'TikTok หนึ่ง', platform: 'tiktok', level: 'sales', owner: 'หนึ่ง' }, { id: 'c', name: 'เงียบ', platform: 'line' }]
    const f = accountFacts(acc, { a: { leads: 6, booked: 2 }, b: { leads: 9, booked: 1 } }, '2026-11')
    expect(f[0]).toBe('TikTok หนึ่ง (tiktok · ของเซลส์ · หนึ่ง): Lead 9 จอง 1')
    expect(f[1]).toBe('เพจทีม (facebook · ของทีม): Lead 6 จอง 2 · ค่าโฆษณา ฿3,000 = ฿500/Lead · ฿1,500/จอง')
    expect(f[2]).toContain('รวมบัญชีที่ยิงแอด 1 บัญชี')
    expect(f.join()).not.toContain('เงียบ')
  })
})
