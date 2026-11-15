import { describe, it, expect } from 'vitest'
import { CHANGELOG } from './changelogData.js'
import { formatDate } from '../../utils/format.js'

// หน้า "เกี่ยวกับ" แสดงวันที่ด้วย formatDate ซึ่งรับ 'YYYY-MM-DD' — รูปแบบอื่นจะขึ้น "-"
describe('changelog dates', () => {
  it('every entry uses YYYY-MM-DD so the About page can show it as DD/MM/YYYY', () => {
    const bad = CHANGELOG.filter(c => !/^\d{4}-\d{2}-\d{2}$/.test(c.date) || formatDate(c.date) === '-').map(c => c.ver)
    expect(bad).toEqual([])
  })
})
