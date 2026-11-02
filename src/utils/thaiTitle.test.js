import { describe, it, expect } from 'vitest'
import { thaiPageTitle } from './thaiTitle.js'

describe('thaiPageTitle', () => {
  it('replaces an English title with the Thai menu label, keeping the emoji', () => {
    expect(thaiPageTitle('🚛 Vehicle Transfer', 'โอนรถ')).toBe('🚛 โอนรถ')
    expect(thaiPageTitle('Bay Management', 'จัดการช่องซ่อม')).toBe('จัดการช่องซ่อม')
  })
  it('leaves Thai or mixed titles and missing labels alone', () => {
    expect(thaiPageTitle('📊 รายงานประจำวัน', 'รายงาน')).toBe('')
    expect(thaiPageTitle('🔧 Technician KPI', '')).toBe('')
    expect(thaiPageTitle('🔧 Technician KPI', 'Technician KPI')).toBe('')
    expect(thaiPageTitle('📅 2569', 'ปฏิทิน')).toBe('')
  })
})
