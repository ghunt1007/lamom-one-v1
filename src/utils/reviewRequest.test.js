import { describe, it, expect } from 'vitest'
import { pickReviewTargets, reviewMessage, isHttpsLink } from './reviewRequest.js'

const NOW = Date.parse('2026-11-14T08:00:00Z')
const ago = d => new Date(NOW - d * 864e5).toISOString()
const c = (over = {}) => ({ id: 'c1', firstName: 'สมชาย', lastName: 'ใจดี', stage: 'delivered', lineUserId: 'U1', stageChangedAt: ago(10), ...over })

describe('pickReviewTargets', () => {
  it('keeps delivered LINE customers inside the window who were never asked and have no review', () => {
    const list = [c(), c({ id: 'old', firstName: 'เก่า', stageChangedAt: ago(90) }), c({ id: 'noLine', firstName: 'ไม่มีไลน์', lineUserId: '' }), c({ id: 'asked', firstName: 'ถามแล้ว', reviewAskedAt: ago(1) }),
      c({ id: 'lead', firstName: 'ลีด', stage: 'pp' }), c({ id: 'del', firstName: 'ลบ', deleted: true }), c({ id: 'rev', firstName: 'มานี', lastName: 'มีรีวิว' }), null]
    expect(pickReviewTargets(list, [{ customer: 'คุณมานี มีรีวิว' }], { now: NOW }).map(x => x.id)).toEqual(['c1'])
  })
  it('days 0 means no time limit; Firestore timestamps work', () => {
    expect(pickReviewTargets([c({ stageChangedAt: ago(400) })], [], { days: 0, now: NOW }).length).toBe(1)
    expect(pickReviewTargets([c({ stageChangedAt: { seconds: (NOW - 864e5) / 1000 } })], [], { now: NOW }).length).toBe(1)
    expect(pickReviewTargets([c({ stageChangedAt: null, updatedAt: null })], [], { now: NOW }).length).toBe(0)
  })
  it('a review under the first name alone also counts', () => expect(pickReviewTargets([c()], [{ customer: 'สมชาย' }], { now: NOW }).length).toBe(0))
})

describe('reviewMessage / isHttpsLink', () => {
  it('includes the link and showroom name when given', () => {
    const t = reviewMessage('https://g.page/r/abc/review', 'LAMOM')
    expect(t).toContain('ทีมงาน LAMOM'); expect(t).toContain('https://g.page/r/abc/review')
    expect(reviewMessage()).not.toContain('กดรีวิวได้ที่')
  })
  it('accepts only https links', () => {
    expect(isHttpsLink('https://g.page/r/abc')).toBe(true)
    expect(isHttpsLink('http://x.com')).toBe(false); expect(isHttpsLink('javascript:alert(1)')).toBe(false); expect(isHttpsLink('g.page')).toBe(false); expect(isHttpsLink('')).toBe(false)
  })
})
