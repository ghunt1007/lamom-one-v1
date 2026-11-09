import { describe, it, expect } from 'vitest'
import { buildMorningSections, buildTomorrowText } from './daily-report.js'

const today = '2026-11-10'
const base = { bookings: [], customers: [], followups: [], testDrives: [] }

describe('showroom appointments in the 09:00 reminder (v1.0.1012)', () => {
  it('lists today\'s open appointments under the salesperson', () => {
    const appointments = [
      { date: today, time: '14:00', status: 'scheduled', salesperson: 'สมชาย', custName: 'คุณเอ', interestedIn: 'S07' },
      { date: today, time: '10:00', status: 'confirmed', salesperson: 'สมชาย', custName: 'คุณบี' },
      { date: today, time: '11:00', status: 'arrived', salesperson: 'สมชาย', custName: 'มาแล้ว' },
      { date: '2026-11-11', time: '11:00', status: 'scheduled', salesperson: 'สมชาย', custName: 'พรุ่งนี้' },
    ]
    const [sec] = buildMorningSections({ ...base, appointments }, { today })
    expect(sec.text).toContain('🏬 นัดเข้าโชว์รูมวันนี้: 2 ราย')
    expect(sec.text.indexOf('คุณบี')).toBeLessThan(sec.text.indexOf('คุณเอ'))
    expect(sec.text).toContain('(S07)')
    expect(sec.text).not.toContain('มาแล้ว')
    expect(sec.text).not.toContain('พรุ่งนี้')
  })
  it('works without the appointments collection', () => {
    expect(buildMorningSections(base, { today })).toEqual([])
  })
  it('shows tomorrow\'s showroom appointments in the "พรุ่งนี้" reply', () => {
    const t = buildTomorrowText({ ...base, appointments: [{ date: '2026-11-11', time: '13:00', status: 'scheduled', salesperson: 'สมชาย', custName: 'คุณซี' }] }, 'สมชาย', today)
    expect(t).toContain('🏬 นัดเข้าโชว์รูม 1 ราย')
    expect(t).toContain('13:00 คุณซี')
  })
})
