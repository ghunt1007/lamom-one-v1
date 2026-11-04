import { describe, it, expect } from 'vitest'
import { pickOverflow } from './headerActions.js'

describe('pickOverflow', () => {
  const g = 'btn btn-ghost btn-sm'
  it('groups 3+ plain buttons, keeps primary/secondary outside', () => {
    expect(pickOverflow([{ cls: g }, { cls: g }, { cls: 'btn btn-secondary' }, { cls: g }, { cls: 'btn btn-primary' }])).toEqual([0, 1, 3])
  })
  it('leaves short headers alone', () => {
    expect(pickOverflow([{ cls: g }, { cls: g }, { cls: 'btn btn-primary' }])).toEqual([])
  })
  it('skips hidden buttons when counting', () => {
    expect(pickOverflow([{ cls: g }, { cls: g, hidden: true }, { cls: g }])).toEqual([])
  })
  it('uses the page own .pa-more marks when it has a ⋯ button', () => {
    const items = [{ cls: g + ' pa-more' }, { cls: g + ' pa-more' }, { cls: g + ' pa-more' }, { cls: g + ' pa-more-btn' }, { cls: g }, { cls: 'btn btn-primary' }]
    expect(pickOverflow(items, { ownMenu: true })).toEqual([0, 1, 2])
  })
})
