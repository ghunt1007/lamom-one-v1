import { describe, it, expect, vi } from 'vitest'
vi.mock('../core/db.js', () => ({ listDocs: vi.fn(), createDoc: vi.fn() }))
vi.mock('../core/companyScope.js', () => ({ companyScopeFilters: () => [], myEffectiveCompanyId: () => null }))
const { splitContact, buildQuickLead, findDuplicate } = await import('./quickLead.js')

describe('splitContact', () => {
  it('reads Thai phone numbers in any common format', () => {
    expect(splitContact('081-234-5678')).toEqual({ phone: '0812345678', lineId: '' })
    expect(splitContact('081 234 5678')).toEqual({ phone: '0812345678', lineId: '' })
    expect(splitContact('+66 81 234 5678')).toEqual({ phone: '0812345678', lineId: '' })
    expect(splitContact('02-123-4567')).toEqual({ phone: '021234567', lineId: '' })
  })
  it('treats anything else as a LINE ID', () => {
    expect(splitContact('@somchai')).toEqual({ phone: '', lineId: '@somchai' })
    expect(splitContact('somchai99')).toEqual({ phone: '', lineId: 'somchai99' })
    expect(splitContact('')).toEqual({ phone: '', lineId: '' })
  })
})

describe('buildQuickLead', () => {
  it('splits the name, assigns the person entering it, and becomes a Prospect when a phone is given', () => {
    const c = buildQuickLead({ name: ' สมชาย  ใจ ดี ', contact: '0812345678', model: 'BYD Seal', source: 'facebook' }, { assignedTo: 'วิชัย' })
    expect(c).toMatchObject({ firstName: 'สมชาย', lastName: 'ใจ ดี', phone: '0812345678', lineId: '', interestedModel: 'BYD Seal', source: 'facebook', assignedTo: 'วิชัย', stage: 'pp', isLost: false })
  })
  it('stays a Lead when there is no phone or LINE yet', () => {
    expect(buildQuickLead({ name: 'คุณเอ' }).stage).toBe('lead')
    expect(buildQuickLead({ name: 'คุณเอ' }).lastName).toBe('')
  })
})

describe('findDuplicate', () => {
  const customers = [
    { id: 'a', firstName: 'ก', phone: '081-234-5678' },
    { id: 'b', firstName: 'ข', lineId: '@BeeLine' },
    { id: 'c', firstName: 'ค', phone: '0899999999', deleted: true },
  ]
  it('matches on phone digits or LINE ID (ignoring case and @)', () => {
    expect(findDuplicate({ phone: '0812345678' }, customers)?.id).toBe('a')
    expect(findDuplicate({ lineId: 'beeline' }, customers)?.id).toBe('b')
  })
  it('ignores deleted customers and empty contacts', () => {
    expect(findDuplicate({ phone: '0899999999' }, customers)).toBeNull()
    expect(findDuplicate({ phone: '', lineId: '' }, customers)).toBeNull()
  })
})

describe('topModels', () => {
  it('lists the most requested models with their usual spelling', async () => {
    const { topModels } = await import('./quickLead.js')
    const cs = [{ interestedModel: 'BYD Seal' }, { interestedModel: 'byd  seal' }, { interestedModel: 'BYD Seal' }, { interestedModel: 'Dolphin' }, { interestedModel: '' }, { interestedModel: 'Atto 3', deleted: true }]
    expect(topModels(cs)).toEqual(['BYD Seal', 'Dolphin'])
    expect(topModels(cs, 1)).toEqual(['BYD Seal'])
    expect(topModels(null)).toEqual([])
  })
})
