import { describe, it, expect } from 'vitest'
import { mentionedCustomers, customerActionsFor } from './aiActions.js'

const cs = [
  { id: 'a', firstName: 'สมชาย', lastName: 'ใจดี', phone: '081-234-5678' },
  { id: 'b', firstName: 'มา', phone: '' },
  { id: 'c', firstName: 'มานะ', phone: '0899999999' },
  { id: 'd', firstName: 'วิภา', deleted: true },
]

describe('mentionedCustomers', () => {
  it('จับชื่อในประโยคไทยที่ไม่มีวรรค', () => {
    expect(mentionedCustomers('นัดลองขับสมชายพรุ่งนี้', cs).map(c => c.id)).toEqual(['a'])
  })
  it('ชื่อยาวก่อน ไม่สับสนชื่อสั้น และไม่เอาคนที่ลบแล้ว', () => {
    expect(mentionedCustomers('โทรหามานะ', cs).map(c => c.id)).toEqual(['c'])
    expect(mentionedCustomers('วิภาเป็นยังไง', cs)).toEqual([])
  })
})

describe('customerActionsFor', () => {
  it('ลองขับ → ปุ่มนัดลองขับ + เปิดลูกค้า', () => {
    expect(customerActionsFor('นัดลองขับสมชาย', cs).map(a => a.kind)).toEqual(['td', 'open'])
  })
  it('ถามทั่วไป → โทร + เปิด, เบอร์ตัดขีด', () => {
    const r = customerActionsFor('สมชายควรคุยอะไรดี', cs)
    expect(r.map(a => a.kind)).toEqual(['tel', 'open'])
    expect(r[0].phone).toBe('0812345678')
  })
  it('ไม่เอ่ยชื่อใคร → ไม่มีปุ่ม', () => { expect(customerActionsFor('ยอดขายเดือนนี้', cs)).toEqual([]) })
})
