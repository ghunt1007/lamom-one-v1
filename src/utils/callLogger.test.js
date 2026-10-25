import { describe, it, expect, vi } from 'vitest'
vi.mock('../core/db.js', () => ({ createDoc: async () => 'x' }))
vi.mock('../core/store.js', () => ({ getState: () => ({}), showToast: () => {} }))
vi.mock('../core/companyScope.js', () => ({ myEffectiveCompanyId: () => null }))
vi.mock('./modal.js', () => ({ openModal: () => ({}) }))
vi.mock('./customerContact.js', () => ({ touchCustomerContact: async () => true }))
vi.mock('./addFollowupModal.js', () => ({ offerNextFollowup: () => {} }))
const { callLogText, shouldAsk } = await import('./callLogger.js')
import { suggestNextDue } from './nextFollowup.js'

describe('callLogText', () => {
  it('no answer → not contacted, retry tomorrow', () => {
    const t = callLogText('noanswer')
    expect(t.contacted).toBe(false)
    expect(t.log).toBe('ไม่รับสาย')
    expect(suggestNextDue(t.nextHint, '2026-10-26').dueDate).toBe('2026-10-27')
  })
  it('not interested → skip next follow-up', () => {
    expect(suggestNextDue(callLogText('notinterested').nextHint, '2026-10-26').skip).toBe(true)
  })
  it('note is kept', () => {
    expect(callLogText('interested', 'นัดเสาร์นี้').log).toBe('คุยแล้ว สนใจ — นัดเสาร์นี้')
  })
})
describe('shouldAsk', () => {
  it('only after a real call', () => {
    expect(shouldAsk({ at: 0 }, 1000)).toBe(false)
    expect(shouldAsk({ at: 0 }, 60000)).toBe(true)
    expect(shouldAsk({ at: 0 }, 3 * 3600e3)).toBe(false)
    expect(shouldAsk(null, 60000)).toBe(false)
  })
})
