import { describe, it, expect } from 'vitest'
import { breadcrumbFor } from './breadcrumb.js'

const NAV = [
  { group: 'ภาพรวม', groupEn: 'Overview', groupZh: '总览', items: [{ label: 'Dashboard', path: '/' }] },
  { group: 'การขาย', groupEn: 'Sales', groupZh: '销售', items: [
    { label: 'Customers', path: '/crm/customers' },
    { label: 'Test Drive', path: '/crm/testdrive' },
    { label: 'จองรถ', labelEn: 'Bookings', labelZh: '订车', path: '/crm/bookings' },
  ] },
]

describe('breadcrumbFor', () => {
  it('uses the friendly Thai menu name', () => {
    expect(breadcrumbFor(NAV, '/')).toEqual(['ภาพรวม', 'ภาพรวมบริษัท'])
    expect(breadcrumbFor(NAV, '/crm/testdrive')).toEqual(['การขาย', 'ทดลองขับ'])
  })
  it('translates group and label for en/zh', () => {
    expect(breadcrumbFor(NAV, '/crm/bookings', 'en')).toEqual(['Sales', 'Bookings'])
    expect(breadcrumbFor(NAV, '/crm/bookings', 'zh')).toEqual(['销售', '订车'])
  })
  it('falls back to the parent page, then to nothing', () => {
    expect(breadcrumbFor(NAV, '/crm/customers/abc')).toEqual(['การขาย', 'ลูกค้า / Lead'])
    expect(breadcrumbFor(NAV, '/crm/customers?id=1')[1]).toBe('ลูกค้า / Lead')
    expect(breadcrumbFor(NAV, '/nope/page')).toEqual([])
  })
})

describe('breadcrumbFor aliases', () => {
  it('/crm/leads shows the customers page name', () => {
    expect(breadcrumbFor(NAV, '/crm/leads')).toEqual(['การขาย', 'ลูกค้า / Lead'])
  })
})
