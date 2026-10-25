import { describe, it, expect, vi } from 'vitest'
vi.mock('../core/db.js', () => ({ createDoc: vi.fn(), listDocs: vi.fn() }))
vi.mock('../core/store.js', () => ({ getState: () => ({}), showToast: vi.fn() }))
vi.mock('../core/companyScope.js', () => ({ companyScopeFilters: () => [], myEffectiveCompanyId: () => null }))
vi.mock('./modal.js', () => ({ openModal: vi.fn() }))
vi.mock('../data/vehicleDatabase.js', () => ({ getVehicles: () => [] }))
vi.mock('../data/masterData.js', () => ({ getSalesStaff: () => [] }))
import { mentionsTestDrive, guessTestDriveSlot, pickVehicleOption, upcomingTestDriveFor, testDrivesFor } from './testDriveForm.js'

// 2026-10-26 เป็นวันจันทร์
const TODAY = '2026-10-26'

describe('mentionsTestDrive', () => {
  it('จับคำว่าทดลองขับหลายแบบ', () => {
    expect(mentionsTestDrive('สนใจ นัดทดลองขับเสาร์นี้')).toBe(true)
    expect(mentionsTestDrive('ขอลองขับก่อน')).toBe(true)
    expect(mentionsTestDrive('อยากเทสไดรฟ์')).toBe(true)
    expect(mentionsTestDrive('Test Drive พรุ่งนี้')).toBe(true)
    expect(mentionsTestDrive('ขอคิดดูก่อน')).toBe(false)
    expect(mentionsTestDrive('')).toBe(false)
  })
})

describe('guessTestDriveSlot', () => {
  it('วันในสัปดาห์ + บ่ายกี่โมง', () => {
    expect(guessTestDriveSlot('นัดทดลองขับเสาร์นี้บ่าย 2', TODAY)).toEqual({ date: '2026-10-31', time: '14:00' })
  })
  it('เวลาแบบมีนาที', () => {
    expect(guessTestDriveSlot('ลองขับพรุ่งนี้ 10.30', TODAY)).toEqual({ date: '2026-10-27', time: '10:30' })
    expect(guessTestDriveSlot('ลองขับวันที่ 5 13:15', TODAY)).toEqual({ date: '2026-11-05', time: '13:15' })
  })
  it('ไม่บอกวัน → พรุ่งนี้ 10 โมง', () => {
    expect(guessTestDriveSlot('สนใจลองขับ', TODAY)).toEqual({ date: '2026-10-27', time: '10:00' })
    expect(guessTestDriveSlot('', TODAY)).toEqual({ date: '2026-10-27', time: '10:00' })
  })
  it('ช่วงเวลาคร่าวๆ', () => {
    expect(guessTestDriveSlot('ลองขับมะรืนช่วงเย็น', TODAY)).toEqual({ date: '2026-10-28', time: '16:00' })
    expect(guessTestDriveSlot('ลองขับ 11 โมง', TODAY).time).toBe('11:00')
    expect(guessTestDriveSlot('ลองขับ 3 โมง', TODAY).time).toBe('15:00')
  })
  it('ไม่เอาวันที่ 2/11 ไปเป็นเวลา', () => {
    expect(guessTestDriveSlot('ลองขับ 2/11', TODAY)).toEqual({ date: '2026-11-02', time: '10:00' })
  })
})

describe('pickVehicleOption', () => {
  const opts = ['DEEPAL S05', 'DEEPAL S07', 'DEEPAL L07']
  it('จับคู่รุ่นแบบไม่สนตัวพิมพ์/ช่องว่าง', () => {
    expect(pickVehicleOption(opts, 's07')).toBe('DEEPAL S07')
    expect(pickVehicleOption(opts, 'Deepal L07')).toBe('DEEPAL L07')
    expect(pickVehicleOption(opts, 'DEEPAL S07 Max')).toBe('DEEPAL S07')
  })
  it('ไม่มีรุ่น/ไม่ตรง → ว่าง', () => {
    expect(pickVehicleOption(opts, '')).toBe('')
    expect(pickVehicleOption(opts, 'Camry')).toBe('')
  })
})

describe('upcomingTestDriveFor', () => {
  const tds = [
    { id: 'a', customerId: 'c1', date: '2026-10-30', time: '14:00', status: 'scheduled' },
    { id: 'b', customerId: 'c1', date: '2026-10-27', time: '10:00', status: 'scheduled' },
    { id: 'c', customerId: 'c1', date: '2026-10-20', status: 'scheduled' },
    { id: 'd', phone: '081-234-5678', date: '2026-10-28', status: 'scheduled' },
    { id: 'e', customerId: 'c3', date: '2026-10-28', status: 'cancelled' },
  ]
  it('เอานัดที่ใกล้ที่สุดที่ยังไม่ถึง', () => {
    expect(upcomingTestDriveFor({ id: 'c1' }, tds, TODAY).id).toBe('b')
  })
  it('นัดเก่าที่ไม่มี id จับด้วยเบอร์', () => {
    expect(upcomingTestDriveFor({ id: 'c2', phone: '0812345678' }, tds, TODAY).id).toBe('d')
  })
  it('ยกเลิกแล้ว/ไม่มีนัด → null', () => {
    expect(upcomingTestDriveFor({ id: 'c3' }, tds, TODAY)).toBe(null)
    expect(upcomingTestDriveFor({ id: 'zz', phone: '' }, tds, TODAY)).toBe(null)
  })
})

describe('testDrivesFor', () => {
  it('ทั้งหมดของลูกค้า ใหม่สุดก่อน', () => {
    const r = testDrivesFor({ id: 'c1', phone: '081-234-5678' }, [
      { id: 'a', customerId: 'c1', date: '2026-10-01' },
      { id: 'b', phone: '0812345678', date: '2026-10-20' },
      { id: 'c', customerId: 'c9', date: '2026-10-25' },
      { id: 'd', customerId: 'c1', date: '2026-10-10', deleted: true },
    ])
    expect(r.map(t => t.id)).toEqual(['b', 'a'])
  })
})
