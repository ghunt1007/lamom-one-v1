// เทสเรนเดอร์หน้า "งานของฉันวันนี้" แบบไม่มีเบราว์เซอร์ — แค่ยืนยันว่า HTML สร้างได้ไม่พังและมีการ์ด "ทำ 3 อย่างนี้ก่อน"
import { describe, it, expect, vi } from 'vitest'

const today = '2026-10-26'
vi.mock('../../utils/format.js', async (orig) => ({ ...(await orig()), todayBangkok: () => today }))
vi.mock('../../core/db.js', () => ({
  listAllDocs: async (col) => col === 'customers'
    ? [{ id: 'c1', firstName: 'สมชาย', lastName: 'ทดสอบ', stage: 'lead', createdAt: today + 'T02:00:00Z', phone: '0800000000', assignedTo: 'เซลส์ A' },
       { id: 'c2', firstName: 'วิภา', stage: 'pp', temperature: 'hot', createdAt: '2026-10-01T02:00:00Z', assignedTo: 'เซลส์ A' }]
    : col === 'bookings' ? [{ id: 'b1', custName: 'มานี', status: 'รอส่งมอบ', deliveryDate: today, salesName: 'เซลส์ A' }] : [],
  listDocs: async () => [],
  updateDocData: async () => {},
  readDoc: async () => null,
}))
vi.mock('../../core/companyScope.js', () => ({ companyScopeFilters: () => [], myEffectiveCompanyId: () => null }))
vi.mock('../../core/hierarchy.js', () => ({ getVisibilityScope: async () => ({ unrestricted: true }), scopeIncludesRecord: () => true, normName: s => String(s || '').trim() }))
vi.mock('../../core/store.js', () => ({ showToast: () => {}, getState: () => ({ displayName: 'เซลส์ A' }) }))
vi.mock('../../utils/modal.js', () => ({ openModal: () => {} }))
vi.mock('../../core/router.js', () => ({ navigate: () => {} }))
vi.mock('../../utils/addFollowupModal.js', () => ({ openAddFollowup: () => {}, offerNextFollowup: () => {} }))
vi.mock('../../utils/customerContact.js', () => ({ touchCustomerContact: async () => true }))

const el = () => ({ addEventListener() {}, value: '', disabled: false })
describe('MyDay page render', () => {
  it('renders the focus card', async () => {
    const { default: MyDayPage } = await import('./MyDay.js')
    const container = { __routerGen: 1, innerHTML: '', querySelector: () => el(), querySelectorAll: () => [] }
    await MyDayPage(container)
    expect(container.innerHTML).toContain('อย่างนี้ก่อน')
    expect(container.innerHTML).toContain('โทรหา Lead ใหม่ สมชาย ทดสอบ')
    expect(container.innerHTML).toContain('ทักลูกค้า Hot วิภา')
  })
})
