import { describe, it, expect } from 'vitest'
import { orgFromCompany } from './print.js'

describe('orgFromCompany (v1.0.1323)', () => {
  it('maps company profile to print header fields, skipping blanks', () => {
    expect(orgFromCompany({ nameTh: ' บริษัท ก ', name: 'A Co', address: 'ถนน 1\nเขต 2', phone: '02-111-2222', taxId: '0105555555555', brand: 'Deepal' }))
      .toEqual({ name: 'บริษัท ก', addr: 'ถนน 1 เขต 2', phone: '02-111-2222', taxId: '0105555555555', sub: 'ตัวแทนจำหน่าย Deepal' })
    expect(orgFromCompany({ name: 'A Co', phone: ' ' })).toEqual({ name: 'A Co' })
    expect(orgFromCompany(null)).toEqual({})
  })
})

describe('getOrgInfo fallback (v1.0.1334)', () => {
  it('uses the real showroom details when the company profile is not filled', async () => {
    const { getOrgInfo, showroomOrg } = await import('./print.js')
    const o = getOrgInfo()
    expect(o.name).toBe(showroomOrg().name)
    expect(o.taxId).toBe(showroomOrg().taxId)
    expect(o.name).not.toBe('LAMOM ONE')
  })
})
