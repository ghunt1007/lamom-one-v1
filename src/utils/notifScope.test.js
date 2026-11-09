import { describe, it, expect } from 'vitest'
import { notifFilters } from './notifScope.js'

describe('notifFilters (v1.0.1003)', () => {
  it('เจ้าของ/แอดมินเห็นทั้งหมด', () => {
    expect(notifFilters({ uid: 'u1' }, 'owner')).toEqual([])
    expect(notifFilters({ uid: 'u1', role: 'admin' }, null)).toEqual([])
  })
  it('คนอื่นเห็นเฉพาะของตัวเอง', () => {
    expect(notifFilters({ uid: 'u2' }, 'sales')).toEqual([['userId', '==', 'u2']])
    expect(notifFilters({ uid: 'u3', role: 'manager' }, null)).toEqual([['userId', '==', 'u3']])
  })
  it('ยังไม่ล็อกอิน = null', () => {
    expect(notifFilters(null, null)).toBeNull()
  })
})
