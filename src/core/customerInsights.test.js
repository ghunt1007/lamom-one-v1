import { describe, it, expect } from 'vitest'
import {
  daysSince, deriveInitialStage, shouldAutoPromoteToPP,
  getFollowUpRecommendation, getBookingDiagnosis, isModelInStock,
} from './customerInsights.js'

function daysAgoIso(n) {
  return new Date(Date.now() - n * 86400000).toISOString()
}

describe('daysSince', () => {
  it('returns null for empty/missing input', () => {
    expect(daysSince(null)).toBeNull()
    expect(daysSince('')).toBeNull()
    expect(daysSince(undefined)).toBeNull()
  })

  it('returns null for an unparseable date string', () => {
    expect(daysSince('not-a-date')).toBeNull()
  })

  it('returns 0 for a timestamp from just now', () => {
    expect(daysSince(new Date().toISOString())).toBe(0)
  })

  it('returns the correct whole-day count for a past date', () => {
    expect(daysSince(daysAgoIso(3))).toBe(3)
  })

  it('clamps to 0 for a future date (never negative)', () => {
    expect(daysSince(new Date(Date.now() + 5 * 86400000).toISOString())).toBe(0)
  })
})

describe('deriveInitialStage', () => {
  it('returns "pp" when the customer has a phone number', () => {
    expect(deriveInitialStage({ phone: '0812345678' })).toBe('pp')
  })

  it('returns "pp" when the customer has a LINE ID', () => {
    expect(deriveInitialStage({ lineId: '@someone' })).toBe('pp')
  })

  it('returns "lead" when neither phone nor LINE ID is set', () => {
    expect(deriveInitialStage({})).toBe('lead')
    expect(deriveInitialStage(undefined)).toBe('lead')
  })
})

describe('shouldAutoPromoteToPP', () => {
  it('returns false when there is no existing customer', () => {
    expect(shouldAutoPromoteToPP(null, { phone: '0812345678' })).toBe(false)
  })

  it('returns false when the existing customer is not in the "lead" stage', () => {
    expect(shouldAutoPromoteToPP({ stage: 'pp' }, { phone: '0812345678' })).toBe(false)
  })

  it('returns false when the lead already had contact info before the edit', () => {
    expect(shouldAutoPromoteToPP({ stage: 'lead', phone: '0812345678' }, { lineId: '@x' })).toBe(false)
  })

  it('returns true when a contactless lead gains a phone number', () => {
    expect(shouldAutoPromoteToPP({ stage: 'lead' }, { phone: '0812345678' })).toBe(true)
  })

  it('returns true when a contactless lead gains a LINE ID', () => {
    expect(shouldAutoPromoteToPP({ stage: 'lead' }, { lineId: '@x' })).toBe(true)
  })

  it('returns false when a contactless lead is edited without adding contact info', () => {
    expect(shouldAutoPromoteToPP({ stage: 'lead' }, { notes: 'called, no answer' })).toBe(false)
  })
})

describe('getFollowUpRecommendation', () => {
  it('returns a low-urgency empty recommendation when there is no customer', () => {
    expect(getFollowUpRecommendation(null)).toEqual({ urgency: 'low', recommendation: '', diagnosedProblem: null })
  })

  it('flags a lost deal as low urgency and surfaces the lost reason', () => {
    const r = getFollowUpRecommendation({ isLost: true, lostReason: 'ราคาสูงเกินไป' })
    expect(r.urgency).toBe('low')
    expect(r.diagnosedProblem).toBe('ราคาสูงเกินไป')
    expect(r.recommendation).toContain('ราคาสูงเกินไป')
  })

  it('is high urgency within 7 days of delivery (post-sale follow-up window)', () => {
    const r = getFollowUpRecommendation({ stage: 'delivered', stageChangedAt: daysAgoIso(2) })
    expect(r.urgency).toBe('high')
    expect(r.recommendation).toContain('2 วัน')
  })

  it('is low urgency more than 7 days after delivery', () => {
    const r = getFollowUpRecommendation({ stage: 'delivered', stageChangedAt: daysAgoIso(30) })
    expect(r.urgency).toBe('low')
  })

  it('is high urgency for a hot-temperature active customer', () => {
    const r = getFollowUpRecommendation({ stage: 'pp', temperature: 'hot' })
    expect(r.urgency).toBe('high')
  })

  it('is medium urgency for a warm-temperature active customer', () => {
    const r = getFollowUpRecommendation({ stage: 'pp', temperature: 'warm' })
    expect(r.urgency).toBe('medium')
  })

  it('escalates to high urgency once idle for 7+ days, regardless of temperature', () => {
    const r = getFollowUpRecommendation(
      { stage: 'pp', temperature: 'cold', createdAt: daysAgoIso(20) },
      [{ createdAt: daysAgoIso(8) }]
    )
    expect(r.urgency).toBe('high')
    expect(r.recommendation).toContain('8 วัน')
  })

  it('escalates a low-urgency customer to medium once idle for 3-6 days', () => {
    const r = getFollowUpRecommendation(
      { stage: 'pp', temperature: 'cold', createdAt: daysAgoIso(20) },
      [{ createdAt: daysAgoIso(4) }]
    )
    expect(r.urgency).toBe('medium')
  })

  it('flags missing stock and bumps a low-urgency customer to medium', () => {
    const r = getFollowUpRecommendation(
      { stage: 'pp', temperature: 'cold', interestedModel: 'BYD Seal', createdAt: daysAgoIso(1) },
      [],
      { stockAvailable: false }
    )
    expect(r.diagnosedProblem).toBe('รถไม่มีสต็อก')
    expect(r.urgency).toBe('medium')
  })

  it('mentions in-stock availability for a prospect without raising urgency', () => {
    const r = getFollowUpRecommendation(
      { stage: 'pp', interestedModel: 'BYD Seal', createdAt: daysAgoIso(1) },
      [],
      { stockAvailable: true }
    )
    expect(r.recommendation).toContain('มีในสต็อกพร้อมขาย')
    expect(r.urgency).toBe('low')
  })

  it('flags over-budget with its own diagnosedProblem', () => {
    const r = getFollowUpRecommendation(
      { stage: 'pp', createdAt: daysAgoIso(1) },
      [],
      { overBudget: true }
    )
    expect(r.diagnosedProblem).toBe('งบประมาณไม่พอ')
    expect(r.urgency).toBe('medium')
  })

  // Documents actual current behavior: the overBudget branch unconditionally sets
  // urgency to 'medium', even when the customer was already 'high' from temperature/
  // idle-days — a hot lead who is also over-budget gets *downgraded* to medium. This
  // may or may not be intentional; flagged separately rather than silently changed here.
  it('currently downgrades an already-high-urgency customer to medium when also over-budget', () => {
    const r = getFollowUpRecommendation(
      { stage: 'pp', temperature: 'hot', createdAt: daysAgoIso(1) },
      [],
      { overBudget: true }
    )
    expect(r.urgency).toBe('medium')
  })
})

describe('getBookingDiagnosis', () => {
  it('reports no booking when none is given', () => {
    expect(getBookingDiagnosis(null)).toEqual({ blockerType: 'none', message: 'ยังไม่มีใบจอง', suggestedAction: '' })
  })

  it('reports a withdrawn booking and points to refund follow-up when refund is pending', () => {
    const r = getBookingDiagnosis({ status: 'ถอนจอง', refundStatus: 'รอคืนเงิน' })
    expect(r.blockerType).toBe('none')
    expect(r.suggestedAction).toContain('คืนเงิน')
  })

  it('reports a cancelled booking with no action when there is no pending refund', () => {
    const r = getBookingDiagnosis({ status: 'ยกเลิก' })
    expect(r.suggestedAction).toBe('-')
  })

  it('flags a fresh delivery (within 7 days) for a satisfaction check', () => {
    const r = getBookingDiagnosis({ status: 'ส่งมอบแล้ว', actualDeliveryDate: daysAgoIso(3) })
    expect(r.blockerType).toBe('none')
    expect(r.suggestedAction).toContain('เช็คความพึงพอใจ')
  })

  it('has no follow-up action for an old delivery', () => {
    const r = getBookingDiagnosis({ status: 'ส่งมอบแล้ว', actualDeliveryDate: daysAgoIso(30) })
    expect(r.suggestedAction).toBe('-')
  })

  it('flags rejected finance as a hard blocker', () => {
    const r = getBookingDiagnosis({ status: 'ยอดจองคงค้าง', finStatus: 'ไม่ผ่าน' })
    expect(r.blockerType).toBe('finance_rejected')
  })

  it('flags pending finance as overdue after 7+ days', () => {
    const r = getBookingDiagnosis({ finStatus: 'รอผล', submitDate: daysAgoIso(10) })
    expect(r.blockerType).toBe('finance_pending')
    expect(r.suggestedAction).toContain('ล่าช้าเกิน 7 วัน')
  })

  it('flags pending finance as routine follow-up before 7 days', () => {
    const r = getBookingDiagnosis({ finStatus: 'รอผล', submitDate: daysAgoIso(2) })
    expect(r.blockerType).toBe('finance_pending')
    expect(r.suggestedAction).not.toContain('ล่าช้าเกิน')
  })

  it('flags stock shortage', () => {
    expect(getBookingDiagnosis({ status: 'รอรถ' }).blockerType).toBe('stock_shortage')
  })

  it('flags delivery-prep for pre-delivery statuses', () => {
    expect(getBookingDiagnosis({ status: 'รอส่งมอบ' }).blockerType).toBe('awaiting_delivery_prep')
    expect(getBookingDiagnosis({ status: 'ตัดตัวเลขรอส่งมอบ' }).blockerType).toBe('awaiting_delivery_prep')
  })

  it('flags delivery-prep for pending-paperwork statuses', () => {
    expect(getBookingDiagnosis({ status: 'ยอดจองคงค้าง' }).blockerType).toBe('awaiting_delivery_prep')
    expect(getBookingDiagnosis({ status: 'จัดไฟแนนซ์ก่อนจอง' }).blockerType).toBe('awaiting_delivery_prep')
  })

  it('falls back to reporting the raw status with no blocker for anything unrecognized', () => {
    const r = getBookingDiagnosis({ status: 'สถานะแปลกใหม่' })
    expect(r).toEqual({ blockerType: 'none', message: 'สถานะแปลกใหม่', suggestedAction: '-' })
  })
})

describe('isModelInStock', () => {
  const vehicles = [
    { brand: 'BYD', model: 'Seal', variant: 'AWD', status: 'available' },
    { brand: 'BYD', model: 'Atto 3', variant: '', status: 'sold' },
  ]

  it('returns null when no model is specified', () => {
    expect(isModelInStock('', vehicles)).toBeNull()
    expect(isModelInStock(null, vehicles)).toBeNull()
  })

  it('returns true when a matching vehicle is available', () => {
    expect(isModelInStock('BYD Seal', vehicles)).toBe(true)
  })

  it('returns false when the only matching vehicle is not available', () => {
    expect(isModelInStock('Atto 3', vehicles)).toBe(false)
  })

  it('returns false when nothing matches at all', () => {
    expect(isModelInStock('Tesla Model 3', vehicles)).toBe(false)
  })

  it('returns false for an empty vehicle list', () => {
    expect(isModelInStock('BYD Seal', [])).toBe(false)
  })
})
