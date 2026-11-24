import { describe, it, expect } from 'vitest'
import { pickTomorrowConfirms, confirmPatch } from './tomorrowConfirm.js'

const T = '2026-11-25', TM = '2026-11-26'
const item = (kind, rec, extra = {}) => ({ key: kind + rec.id, kind, date: TM, time: rec.time || '', phone: rec.phone, done: false, rec, ...extra })

describe('pickTomorrowConfirms', () => {
  it('picks tomorrow appointments of the 4 kinds with a phone', () => {
    const out = pickTomorrowConfirms([
      item('appt', { id: 'a', phone: '0811111111', custName: 'เอ', time: '10:00' }),
      item('testdrive', { id: 't', phone: '0822222222', customerName: 'บี', model: 'S07', date: TM }),
      item('service', { id: 's', phone: '0833333333', custName: 'ซี' }),
      item('delivery', { id: 'b', phone: '0844444444', custName: 'ดี', model: 'S07', deliveryDate: TM, status: 'รอส่งมอบ' }),
      item('followup', { id: 'f', phone: '0855555555' }),
    ], T)
    expect(out.map(o => o.col).sort()).toEqual(['appointments', 'bookings', 'service_appointments', 'test_drives'])
    expect(out.find(o => o.col === 'test_drives').text).toContain('ขอเตือนนัดทดลองขับ S07 พรุ่งนี้')
  })
  it('skips done/cancelled, already reminded, other days and no phone', () => {
    const out = pickTomorrowConfirms([
      item('appt', { id: 'a', phone: '0811111111', status: 'cancelled' }),
      item('appt', { id: 'b', phone: '0811111112', lineRemindFor: TM }),
      item('appt', { id: 'c', phone: '0811111113', confirmSentFor: TM }),
      item('appt', { id: 'd', phone: '0811111114' }, { date: T }),
      item('appt', { id: 'e', phone: '' }),
      item('appt', { id: 'f', phone: '0811111115' }, { done: true }),
    ], T)
    expect(out).toEqual([])
  })
  it('sends one message per phone but records every appointment', () => {
    const out = pickTomorrowConfirms([
      item('testdrive', { id: 't', phone: '081-111-1111', time: '14:00' }),
      item('appt', { id: 'a', phone: '0811111111', time: '10:00' }),
    ], T)
    expect(out).toHaveLength(1)
    expect(out[0].col).toBe('appointments')
    expect(out[0].also).toEqual([{ col: 'test_drives', id: 't' }])
  })
  it('confirmPatch uses booking field names for bookings', () => {
    expect(confirmPatch('bookings', 'SMS', TM, 'X')).toEqual({ lineRemindFor: TM, confirmSentFor: TM, deliveryConfirmSentAt: 'X', deliveryConfirmVia: 'SMS' })
    expect(confirmPatch('test_drives', 'LINE', TM, 'X')).toEqual({ lineRemindFor: TM, confirmSentFor: TM, confirmSentAt: 'X', confirmSentVia: 'LINE' })
  })
})
