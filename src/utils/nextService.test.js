import { describe, it, expect } from 'vitest'
import { nextServiceReminder, addMonthsYmd, plateKey } from './nextService.js'

const today = '2026-11-22'
const job = { id: 'j1', type: 'service', plate: 'กข-1234', custName: 'สมชาย', phone: '0812345678', brand: 'DEEPAL', model: 'S07', mileage: 9800, customerId: 'c1' }

describe('nextServiceReminder', () => {
  it('builds a reminder 6 months out with next 10,000 km', () => {
    const r = nextServiceReminder(job, today, [])
    expect(r.dueDate).toBe('2027-05-22')
    expect(r.detail).toContain('10,000 km')
    expect(r).toMatchObject({ customer: 'สมชาย', plate: 'กข-1234', model: 'DEEPAL S07', type: 'mileage', booked: false, customerId: 'c1', fromJobId: 'j1' })
  })
  it('exactly on a 10,000 boundary goes to the next one', () => {
    expect(nextServiceReminder({ ...job, mileage: 20000 }, today).detail).toContain('30,000 km')
  })
  it('no mileage → months only', () => {
    expect(nextServiceReminder({ ...job, mileage: 0 }, today).detail).not.toContain('km')
  })
  it('skips non-service jobs, missing plate, already set on this job', () => {
    expect(nextServiceReminder({ ...job, type: 'repair' }, today)).toBeNull()
    expect(nextServiceReminder({ ...job, plate: ' ' }, today)).toBeNull()
    expect(nextServiceReminder({ ...job, nextReminderId: 'x' }, today)).toBeNull()
  })
  it('skips when the same plate already has an open future reminder (spacing/case-insensitive)', () => {
    expect(nextServiceReminder(job, today, [{ plate: 'กข 1234', dueDate: '2027-01-01' }])).toBeNull()
    expect(nextServiceReminder(job, today, [{ plate: 'กข 1234', dueDate: '2026-01-01' }])).not.toBeNull()
    expect(nextServiceReminder(job, today, [{ plate: 'กข 1234', dueDate: '2027-01-01', booked: true }])).not.toBeNull()
    expect(nextServiceReminder(job, today, [{ plate: 'กข 1234', dueDate: '2027-01-01', deleted: true }])).not.toBeNull()
  })
  it('addMonthsYmd clamps month end', () => {
    expect(addMonthsYmd('2026-08-31', 6)).toBe('2027-02-28')
    expect(addMonthsYmd('2027-08-31', 6)).toBe('2028-02-29')
    expect(plateKey(' 1กข-99 ')).toBe('1กข99')
  })
})

import { mileageRate } from './nextService.js'
describe('mileage-based next service (v1.0.1418)', () => {
  const job = { id: 'j2', type: 'service', plate: 'กข 1234', mileage: 18000, createdAt: '2026-11-20T03:00:00Z' }
  const old = { id: 'j1', type: 'service', plate: 'กข-1234', mileage: 8000, createdAt: '2026-07-23T03:00:00Z' } // 120 วัน 10,000 km ≈ 83/วัน
  it('rate from same plate history', () => {
    expect(mileageRate(job, [old])).toBeCloseTo(10000 / 120, 1)
    expect(mileageRate(job, [])).toBeNull()
    expect(mileageRate(job, [{ ...old, createdAt: '2026-11-01' }])).toBeNull() // < 30 วัน
    expect(mileageRate(job, [{ ...old, plate: 'ขค 9' }])).toBeNull()
    expect(mileageRate(job, [{ ...old, mileage: 1, createdAt: '2016-01-01' }])).not.toBeNull()
    expect(mileageRate({ ...job, mileage: 900000 }, [old])).toBeNull() // แปลก
  })
  it('heavy user gets an earlier reminder (km reached before 6 months)', () => {
    const r = nextServiceReminder(job, '2026-11-20', [], [old])
    // ถึง 20,000 km อีก 2,000 km ÷ 83/วัน = 24 วัน → อย่างน้อย 30 วัน
    expect(r.dueDate).toBe('2026-12-20')
    expect(r.detail).toContain('km/วัน')
  })
  it('light user keeps 6 months', () => {
    const r = nextServiceReminder({ ...job, mileage: 10500 }, '2026-11-20', [], [{ ...old, mileage: 10000 }])
    expect(r.dueDate).toBe('2027-05-20')
  })
})
