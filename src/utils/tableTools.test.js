import { describe, it, expect } from 'vitest'
import { isShortCellText } from './tableTools.js'

describe('isShortCellText', () => {
  it('treats dates, money and names as short', () => {
    expect(isShortCellText('21 ต.ค. 2569')).toBe(true)
    expect(isShortCellText('  ฿1,124,000 ')).toBe(true)
    expect(isShortCellText('DEEPAL S07 Max')).toBe(true)
  })
  it('lets long text and empty cells wrap', () => {
    expect(isShortCellText('ลูกค้าขอเลื่อนส่งมอบไปสัปดาห์หน้าเพราะติดธุระ')).toBe(false)
    expect(isShortCellText('   ')).toBe(false)
  })
})
