import { describe, it, expect } from 'vitest'
import { renewalStatus, daysToExpiry, renewalNoticeText, policyStatusByDate } from './insuranceRenewal.js'

const T = '2026-11-25'
describe('renewalStatus', () => {
  it('derives status from the expiry date, not the saved value', () => {
    expect(renewalStatus({ status: 'renewed', expiryDate: '2026-12-10' }, T)).toBe('upcoming')
    expect(renewalStatus({ status: 'renewed', expiryDate: '2026-11-01' }, T)).toBe('expired')
    expect(renewalStatus({ status: 'upcoming', expiryDate: '2027-11-25' }, T)).toBe('renewed')
    expect(renewalStatus({ status: 'cancelled', expiryDate: '2026-11-01' }, T)).toBe('cancelled')
    expect(renewalStatus({ status: 'renewed' }, T)).toBe('renewed')
  })
  it('counts whole days', () => {
    expect(daysToExpiry('2026-11-26', T)).toBe(1)
    expect(daysToExpiry('', T)).toBe(null)
  })
})

describe('renewalNoticeText', () => {
  it('uses DD/MM/BE and the first name', () => {
    const t = renewalNoticeText({ customerName: 'คุณสมชาย ใจดี', type: 'class1', vehicleModel: 'S07', vehiclePlate: 'กข 1234', expiryDate: '2026-12-10' }, T)
    expect(t).toContain('สวัสดีครับคุณสมชาย ประกันชั้น 1 ของรถ S07 กข 1234 จะหมดอายุวันที่ 10/12/2569 (อีก 15 วัน)')
    expect(renewalNoticeText({ customerName: 'ลูกค้า', expiryDate: '2026-11-01' }, T)).toContain('หมดอายุแล้วเมื่อ 01/11/2569')
  })
})

describe('policyStatusByDate', () => {
  it('re-derives expiring/expired even when the saved status says otherwise', () => {
    expect(policyStatusByDate({ status: 'expiring', endDate: '2026-11-01' }, 'endDate', T)).toBe('expired')
    expect(policyStatusByDate({ status: 'active', endDate: '2026-12-20' }, 'endDate', T)).toBe('expiring')
    expect(policyStatusByDate({ status: 'expired', endDate: '2027-12-20' }, 'endDate', T)).toBe('active')
    expect(policyStatusByDate({ status: 'cancelled', endDate: '2026-11-01' }, 'endDate', T)).toBe('cancelled')
  })
})
