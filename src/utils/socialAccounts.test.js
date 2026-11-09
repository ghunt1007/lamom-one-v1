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
