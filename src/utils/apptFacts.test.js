import { describe, it, expect } from 'vitest'
import { showroomVisitLine, serviceTodayLines, jobsAwaitingPickupLines, serviceJobsAnswer } from './apptFacts.js'

describe('apptFacts', () => {
  it('ignores deleted rows and other days', () => {
    expect(showroomVisitLine([{ date: '2026-11-10', status: 'arrived', deleted: true }, { date: '2026-11-09', status: 'arrived' }], '2026-11-10')).toBeNull()
    expect(serviceTodayLines([{ date: '2026-11-10', status: 'noshow' }], '2026-11-10')).toEqual([])
  })
  it('caps the service list', () => {
    const rows = Array.from({ length: 4 }, (_, i) => ({ date: '2026-11-10', time: `0${i + 8}:00`, custName: 'c' + i }))
    const out = serviceTodayLines(rows, '2026-11-10', 2)
    expect(out[0]).toContain('4 คัน')
    expect(out.at(-1)).toBe('  - …และอีก 2 คัน')
  })
})

describe('jobsAwaitingPickupLines', () => {
  const today = '2026-11-22'
  it('lists done jobs from before today, oldest first, skips today/undated/delivered', () => {
    const jobs = [
      { status: 'done', custName: 'A', plate: 'กข 1', updatedAt: '2026-11-21T03:00:00Z', lineReadySent: true },
      { status: 'done', custName: 'B', updatedAt: '2026-11-18T03:00:00Z' },
      { status: 'done', custName: 'Today', updatedAt: '2026-11-22T01:00:00Z' },
      { status: 'done', custName: 'NoDate' },
      { status: 'delivered', custName: 'C', updatedAt: '2026-11-10T03:00:00Z' },
      { status: 'done', custName: 'Del', deleted: true, updatedAt: '2026-11-10T03:00:00Z' },
    ]
    const l = jobsAwaitingPickupLines(jobs, today)
    expect(l[0]).toContain('2 คัน')
    expect(l[1]).toContain('B · เสร็จมา 4 วัน')
    expect(l[2]).toContain('A (กข 1) · เสร็จมา 1 วัน · แจ้ง LINE แล้ว')
    expect(l.length).toBe(3)
  })
  it('uses Bangkok date (late-evening UTC counts as next day)', () => {
    expect(jobsAwaitingPickupLines([{ status: 'done', updatedAt: '2026-11-21T18:00:00Z' }], today)).toEqual([])
  })
  it('empty when nothing waits', () => { expect(jobsAwaitingPickupLines([], today)).toEqual([]) })
})

describe('serviceJobsAnswer', () => {
  const today = '2026-11-22'
  it('summarises open jobs by status and lists done ones incl. today', () => {
    const t = serviceJobsAnswer([
      { status: 'inprogress', custName: 'A' }, { status: 'inprogress', custName: 'B' },
      { status: 'waiting_parts', custName: 'P', plate: 'กข 9', techName: 'ต้น' },
      { status: 'done', custName: 'D1', updatedAt: '2026-11-22T02:00:00Z' },
      { status: 'done', custName: 'D2', plate: 'ขค 1', updatedAt: '2026-11-19T02:00:00Z', lineReadySent: true },
      { status: 'delivered', custName: 'X' }, { status: 'inprogress', custName: 'Gone', deleted: true },
    ], today)
    expect(t).toContain('กำลังทำ 3 คัน · เสร็จรอรับ 2 คัน')
    expect(t).toContain('🔧 กำลังซ่อม 2 · 📦 รออะไหล่ 1')
    expect(t.indexOf('D2 (ขค 1) · เสร็จมา 3 วัน · แจ้ง LINE แล้ว')).toBeLessThan(t.indexOf('D1 · เสร็จวันนี้'))
    expect(t).toContain('P (กข 9) · ช่าง ต้น')
    expect(t).not.toContain('X')
  })
  it('says nothing is pending when empty', () => {
    expect(serviceJobsAnswer([{ status: 'delivered' }], today)).toContain('ไม่มีใบงานซ่อมที่ค้าง')
  })
})
