import { describe, it, expect } from 'vitest'
import { detectLeadIntent, matchMenuPages } from './searchIntent.js'

describe('detectLeadIntent', () => {
  it('name + phone = new lead', () => {
    expect(detectLeadIntent('สมชาย ใจดี 0812345678 สนใจ S07')).toEqual({ kind: 'lead', text: 'สมชาย ใจดี 0812345678 สนใจ S07', name: 'สมชาย ใจดี' })
  })
  it('lead keyword strips the command word', () => {
    expect(detectLeadIntent('เพิ่มลีด คุณมาลี LINE @mali')).toEqual({ kind: 'lead', text: 'คุณมาลี LINE @mali', name: 'มาลี' })
    expect(detectLeadIntent('ลีดใหม่ วิภา สนใจ S05').name).toBe('วิภา')
    expect(detectLeadIntent('ลูกค้าใหม่ วิชัย')?.text).toBe('วิชัย')
  })
  it('a bare phone or name is a normal search', () => {
    expect(detectLeadIntent('0812345678')).toBeNull()
    expect(detectLeadIntent('081-234-5678')).toBeNull()
    expect(detectLeadIntent('สมชาย')).toBeNull()
    expect(detectLeadIntent('')).toBeNull()
  })
  it('does not offer a duplicate when the phone already exists', () => {
    expect(detectLeadIntent('สมชาย 081-234-5678', d => d === '0812345678')).toBeNull()
  })
})

describe('matchMenuPages', () => {
  const NAV = [
    { group: 'การขาย', items: [{ path: '/crm/testdrive', label: 'Test Drive' }, { path: '/crm/followup', label: 'Follow-up' }] },
    { group: 'โชว์รูม', items: [{ path: '/dms/testdrive-schedule', label: 'TD Schedule' }, { path: '/crm/testdrive', label: 'Test Drive' }] },
  ]
  it('finds pages by Thai keyword without duplicates', () => {
    expect(matchMenuPages(NAV, 'ทดลองขับ').map(p => p.path)).toEqual(['/crm/testdrive', '/dms/testdrive-schedule'])
    expect(matchMenuPages(NAV, 'ติดตาม')[0].group).toBe('การขาย')
  })
})
