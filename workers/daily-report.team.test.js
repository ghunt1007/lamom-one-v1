import { describe, it, expect } from 'vitest'
import { teamScopeFor, sectionsForScope, teamTasksText } from './daily-report.js'

const staff = [
  { id: 's1', firstName: 'ทวีศักดิ์', lastName: 'สุขสมบัติเสถียร', uid: 'u1' },
  { id: 's2', firstName: 'สมหญิง', lastName: 'หัวหน้า', uid: 'u2' },
  { id: 's3', firstName: 'พิมพ์พันธุ์', lastName: 'โสอุดร', managerId: 's2' },
  { id: 's4', firstName: 'เอ', lastName: 'ลูกทีมชั้นสอง', managerIds: ['s3'] },
  { id: 's5', firstName: 'บี', lastName: 'ทีมอื่น' },
]
const users = [{ id: 'u1', role: 'owner' }, { id: 'u2', role: 'manager' }]
const sections = ['พิมพ์พันธุ์ โสอุดร', 'เอ ลูกทีมชั้นสอง', 'บี ทีมอื่น', 'สมหญิง หัวหน้า'].map(name => ({ name, text: `👤 ${name}` }))

describe('งานตามตำแหน่ง (LINE "งาน")', () => {
  it('เจ้าของ/แอดมินเห็นทั้งทีม', () => {
    expect(teamScopeFor('ทวีศักดิ์ สุขสมบัติเสถียร', staff, users)).toEqual({ all: true })
    expect(sectionsForScope(sections, { all: true })).toHaveLength(4)
  })
  it('หัวหน้าเห็นตัวเอง + ลูกทีมทุกระดับ ไม่เห็นทีมอื่น และของตัวเองขึ้นก่อน', () => {
    const mine = sectionsForScope(sections, teamScopeFor('สมหญิง หัวหน้า', staff, users), 'สมหญิง หัวหน้า')
    expect(mine.map(s => s.name)).toEqual(['สมหญิง หัวหน้า', 'พิมพ์พันธุ์ โสอุดร', 'เอ ลูกทีมชั้นสอง'])
  })
  it('เซลส์ที่ไม่มีลูกทีมเห็นแค่ของตัวเอง', () => {
    expect(sectionsForScope(sections, teamScopeFor('บี ทีมอื่น', staff, users)).map(s => s.name)).toEqual(['บี ทีมอื่น'])
  })
  it('ชื่อที่ไม่อยู่ในข้อมูลพนักงานเห็นเฉพาะชื่อตัวเอง', () => {
    expect(sectionsForScope(sections, teamScopeFor('ไม่มีใคร', staff, users))).toEqual([])
  })
  it('ข้อความทีม', () => {
    const t = teamTasksText(sections.slice(0, 2), '2026-10-25', 'https://x.dev/')
    expect(t).toContain('งานค้างของทีม')
    expect(t).toContain('👥 2 คน')
    expect(t).toContain('https://x.dev/crm/my-day')
    expect(teamTasksText([], '2026-10-25')).toContain('ไม่มีงานค้าง')
  })
})
