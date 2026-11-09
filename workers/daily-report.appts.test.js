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

describe('18:00 showroom visit line (v1.0.1014)', async () => {
  const { showroomVisitLine, buildReport } = await import('./daily-report.js')
  it('counts arrived/no-show/not updated, skips cancelled', () => {
    const a = [
      { date: today, status: 'arrived' }, { date: today, status: 'done' }, { date: today, status: 'noshow' },
      { date: today, status: 'scheduled' }, { date: today, status: 'cancelled' }, { date: '2026-11-09', status: 'arrived' },
    ]
    expect(showroomVisitLine(a, today)).toBe('  • นัดเข้าโชว์รูมวันนี้: 4 ราย · มาแล้ว 2 · ไม่มา 1 · ยังไม่อัปเดต 1')
    expect(showroomVisitLine([], today)).toBeNull()
  })
  it('appears in the report only when there were appointments', () => {
    const r0 = buildReport({ ...base, teamTargets: [] }, { today, time: '18:00' })
    expect(r0).not.toContain('นัดเข้าโชว์รูม')
    const r1 = buildReport({ ...base, teamTargets: [], appointments: [{ date: today, status: 'arrived' }] }, { today, time: '18:00' })
    expect(r1).toContain('นัดเข้าโชว์รูมวันนี้: 1 ราย · มาแล้ว 1')
  })
})

describe('service appointments in the 09:00 group reminder (v1.0.1015)', async () => {
  const { serviceTodayLines, buildMorningReminder, focusLines } = await import('./daily-report.js')
  const svc = [
    { date: today, time: '13:00', status: 'scheduled', custName: 'ก', model: 'S07', plate: '1กข 123', type: 'เช็กระยะ', tech: 'ช่างเอ' },
    { date: today, time: '09:00', status: 'confirmed', custName: 'ข' },
    { date: today, time: '10:00', status: 'cancelled', custName: 'ยกเลิก' },
    { date: '2026-11-11', status: 'scheduled', custName: 'พรุ่งนี้' },
  ]
  it('lists today\'s service visits by time', () => {
    expect(serviceTodayLines(svc, today)).toEqual([
      '🔧 นัดเข้าศูนย์บริการวันนี้: 2 คัน',
      '  - 09:00 · ข',
      '  - 13:00 · ก (S07 1กข 123) · เช็กระยะ · ช่าง ช่างเอ',
    ])
    expect(serviceTodayLines([], today)).toEqual([])
  })
  it('shows in the group reminder', () => {
    expect(buildMorningReminder({ ...base, serviceAppts: svc }, { today })).toContain('🔧 นัดเข้าศูนย์บริการวันนี้: 2 คัน')
  })
  it('showroom visits count as a top focus', () => {
    const p = { deliver: [], stale: [], fu: [], fin: [], unsched: [], td: [], appt: [{ name: 'คุณดี', time: '10:00' }], promo: [], income: [], stuck: [] }
    expect(focusLines(p)).toContain('รับลูกค้านัดเข้าโชว์รูม คุณดี เวลา 10:00')
  })
})
