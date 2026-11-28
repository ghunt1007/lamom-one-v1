import { describe, it, expect } from 'vitest'
import { parseOpsSpec } from './opsQuestions.js'
import { parseListSpec } from './listQuestions.js'

describe('v1.0.1524 more plain questions', () => {
  it('temperature lists with ทั้งหมด', () => {
    expect(parseListSpec('ลูกค้าเย็นทั้งหมด')).toMatchObject({ temp: 'cold' })
    expect(parseListSpec('ลูกค้า hot ทั้งหมดมีใครบ้าง')).toMatchObject({ temp: 'hot' })
  })
  it('withdrawn bookings phrased as ใบจองที่ถอน', () => {
    expect(parseOpsSpec('ใบจองที่ถอนเดือนนี้')).toMatchObject({ kind: 'withdrawn', prev: false })
    expect(parseOpsSpec('ใบจองที่ยกเลิกเดือนก่อน')).toMatchObject({ kind: 'withdrawn', prev: true })
  })
  it('who gets the car = delivery', () => {
    expect(parseOpsSpec('ใครจะได้รถสัปดาห์หน้า')).toEqual({ kind: 'delivery', day: 'nextweek' })
    expect(parseOpsSpec('ลูกค้ารับรถพรุ่งนี้')).toEqual({ kind: 'delivery', day: 'tomorrow' })
    expect(parseOpsSpec('ใครรับรถวันเสาร์')).toMatchObject({ kind: 'delivery', day: 'wd', wd: 6 })
  })
})
