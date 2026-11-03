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

describe('wide table tag (replaces slow table:has(th:nth-child(N)) CSS)', () => {
  it('tags 10/12/13+ columns, nothing below 10', async () => {
    const { wideColsTag } = await import('./tableTools.js')
    expect(wideColsTag(9)).toBe('')
    expect(wideColsTag(10)).toBe('10')
    expect(wideColsTag(11)).toBe('10')
    expect(wideColsTag(12)).toBe('12')
    expect(wideColsTag(13)).toBe('13')
    expect(wideColsTag(65)).toBe('13')
  })
})
