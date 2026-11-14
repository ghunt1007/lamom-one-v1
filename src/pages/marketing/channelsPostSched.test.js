import { describe, it, expect, vi } from 'vitest'
vi.mock('../../core/store.js', () => ({ showToast: vi.fn(), getState: () => 'sales' }))
vi.mock('../../utils/modal.js', () => ({ openModal: vi.fn(), confirmDialog: vi.fn() }))
vi.mock('../../utils/managerRole.js', () => ({ isManagerRole: () => false }))
vi.mock('../../utils/socialApi.js', () => ({ metaPostSchedule: vi.fn(), metaPostUnschedule: vi.fn(), metaPostScheduled: vi.fn(async () => ({ pending: [{ id: 'a', at: '2026-11-16T03:00:00.000Z', message: 'โปร <b>', pageNames: ['Deepal EV Car'], pages: 1 }], recent: [{ id: 'z', at: '2026-11-14T03:00:00.000Z', message: 'เก่า', status: 'sent', note: 'Facebook 1/1 เพจ', pageNames: [] , pages: 1 }] })) }))
import { draftProblem, createPostSched, canSchedulePosts } from './channelsPostSched.js'

const NOW = Date.parse('2026-11-15T02:00:00Z')
describe('draftProblem', () => {
  const ok = { pageIds: ['1'], message: 'x' }
  it('accepts a valid draft with a future time', () => expect(draftProblem({ ...ok, at: new Date(NOW + 3600e3).toISOString() }, NOW)).toBe(''))
  it('explains what is missing', () => {
    expect(draftProblem({ pageIds: [], message: 'x' }, NOW)).toMatch(/เลือกเพจ/)
    expect(draftProblem({ pageIds: ['1'], message: ' ' }, NOW)).toMatch(/พิมพ์ข้อความ/)
    expect(draftProblem({ ...ok, toInstagram: true }, NOW)).toMatch(/Instagram/)
    expect(draftProblem({ ...ok, at: '' }, NOW)).toMatch(/เลือกวัน/)
    expect(draftProblem({ ...ok, at: new Date(NOW).toISOString() }, NOW)).toMatch(/ผ่านไปแล้ว/)
    expect(draftProblem({ ...ok, at: new Date(NOW + 61 * 864e5).toISOString() }, NOW)).toMatch(/60 วัน/)
  })
})

describe('createPostSched', () => {
  it('sales staff see the list but no schedule or cancel buttons', async () => {
    expect(canSchedulePosts()).toBe(false)
    let renders = 0
    const s = createPostSched({ getDraft: () => ({}), getPages: () => [], rerender: () => { renders++ } })
    expect(s.buttonHtml()).toBe('')
    expect(s.html()).toContain('กำลังโหลด')
    await new Promise(r => setTimeout(r, 0))
    expect(renders).toBe(1)
    const h = s.html()
    expect(h).toContain('โปร &lt;b&gt;'); expect(h).toContain('✅ โพสต์แล้ว'); expect(h).not.toContain('data-sp-cancel')
    expect(h).toMatch(/16\/11\/\d{4} \d\d:00/)
  })
})
