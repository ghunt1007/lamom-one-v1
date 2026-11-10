import { describe, it, expect, vi } from 'vitest'
import { quickChips, commandHref, bookingStageIn, parseLamiCommand, runLamiCommand, timeIn, scopedCommand, isCommandHelp, commandHelpText, exampleName } from './lamiCommands.js'

const T = '2026-11-10' // อังคาร
const cs = [
  { id: 'a', firstName: 'สมชาย', lastName: 'ใจดี', phone: '0811111111', stage: 'lead', temperature: 'warm', companyId: 'c1' },
  { id: 'b', firstName: 'มานี', lastName: 'มีสุข', phone: '0822222222', stage: 'pp' },
  { id: 'c', firstName: 'ปิติ', lastName: 'ศรีสุข', stage: 'booking' },
]

describe('LAMI สั่งงาน', () => {
  it('เวลาแบบไทย → 24 ชม.', () => {
    expect(timeIn('พรุ่งนี้ 10 โมง')).toBe('10:00')
    expect(timeIn('บ่าย 2 ครึ่ง')).toBe('14:30')
    expect(timeIn('4 โมงเย็น')).toBe('16:00')
    expect(timeIn('2 ทุ่ม')).toBe('20:00')
    expect(timeIn('เวลา 9.15')).toBe('09:15')
    expect(timeIn('เที่ยง')).toBe('12:00')
    expect(timeIn('พรุ่งนี้')).toBe('')
    // พิมพ์ด้วยเสียง / เลขไทย
    expect(timeIn('พรุ่งนี้บ่ายสองโมง')).toBe('14:00')
    expect(timeIn('สิบโมงครึ่ง')).toBe('10:30')
    expect(timeIn('สองทุ่ม')).toBe('20:00')
    expect(timeIn('๑๐ โมง')).toBe('10:00')
    expect(timeIn('สิบเอ็ดโมง')).toBe('11:00')
    expect(timeIn('สองคน')).toBe('')
  })
  it('นัดติดตาม: วัน + เวลา + ช่องทาง', () => {
    const [c] = parseLamiCommand('นัดสมชายพรุ่งนี้ 10 โมง ทักไลน์เรื่องไฟแนนซ์', cs, T)
    expect(c).toMatchObject({ kind: 'fu', dueDate: '2026-11-11', time: '10:00', type: 'line' })
    expect(c.customer.id).toBe('a')
    expect(c.label).toContain('11/11/2569 10:00')
    expect(parseLamiCommand('ตามมานี วันเสาร์', cs, T)[0]).toMatchObject({ kind: 'fu', dueDate: '2026-11-14', type: 'call' })
  })
  it('ปรับความสนใจ', () => {
    expect(parseLamiCommand('มานี hot', cs, T)[0]).toMatchObject({ kind: 'temp', temp: 'hot' })
    expect(parseLamiCommand('ปรับ สมชาย เป็น cold', cs, T)[0]).toMatchObject({ kind: 'temp', temp: 'cold' })
  })
  it('ลองขับ / โทร', () => {
    expect(parseLamiCommand('นัดลองขับ ปิติ เสาร์นี้บ่าย 2', cs, T)[0].kind).toBe('td')
    expect(parseLamiCommand('โทรหา มานี', cs, T)[0]).toMatchObject({ kind: 'tel', phone: '0822222222' })
  })
  it('คำถามทั่วไป/ไม่มีชื่อลูกค้า → ไม่ใช่คำสั่ง (ให้ AI ตอบ)', () => {
    expect(parseLamiCommand('สมชายจองรถหรือยัง?', cs, T)).toEqual([])
    expect(parseLamiCommand('นัดลูกค้าพรุ่งนี้', cs, T)).toEqual([])
    expect(parseLamiCommand('สมชายสนใจรุ่นไหน', cs, T)).toEqual([])
    expect(parseLamiCommand('นัดสมชาย ไม่สนใจแล้ว', cs, T)).toEqual([])
  })
  it('ทำเลย: สร้างนัด / แก้ความสนใจ', async () => {
    const db = { createDoc: vi.fn(async () => 'x'), updateDocData: vi.fn(async () => {}) }
    const [fu] = parseLamiCommand('นัดสมชายพรุ่งนี้ 10 โมง', cs, T)
    const msg = await runLamiCommand(fu, { me: 'เซลส์ หนึ่ง', db, companyId: 'c9' })
    expect(db.createDoc).toHaveBeenCalledWith('followups', expect.objectContaining({ customerId: 'a', dueDate: '2026-11-11', time: '10:00', status: 'pending', companyId: 'c1', purpose: 'ติดตาม Lead ใหม่' }))
    expect(msg).toContain('11/11/2569')
    const [tp] = parseLamiCommand('มานี hot', cs, T)
    await runLamiCommand(tp, { db })
    expect(db.updateDocData).toHaveBeenCalledWith('customers', 'b', { temperature: 'hot' })
  })
})
describe('LAMI สั่งงาน: โทรตอนไหน', () => {
  it('โทรหา X พรุ่งนี้ = นัดติดตาม', () => {
    expect(parseLamiCommand('โทรหา มานี พรุ่งนี้บ่าย 3', [{ id: 'b', firstName: 'มานี', phone: '08' }], '2026-11-10')[0]).toMatchObject({ kind: 'fu', time: '15:00' })
  })
  it('จดโน้ต → ลงไทม์ไลน์ ไม่สร้างนัด แม้มีคำว่าพรุ่งนี้', () => {
    const r = parseLamiCommand('จด สมชาย ชอบสีขาว จะมาพรุ่งนี้', cs, T)
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ kind: 'note', text: 'ชอบสีขาว จะมาพรุ่งนี้', type: 'internal' })
    expect(parseLamiCommand('บันทึกว่า สมชาย ทักไลน์มาถามดอกเบี้ย', cs, T)[0]).toMatchObject({ kind: 'note', type: 'chat', text: 'ทักไลน์มาถามดอกเบี้ย' })
    expect(parseLamiCommand('จด สมชาย', cs, T)).toEqual([])
  })
  it('runLamiCommand note → customer_notes', async () => {
    const calls = []
    const db = { createDoc: async (col, d) => calls.push([col, d]) }
    const [cmd] = parseLamiCommand('โน้ต สมชาย รอโบนัสสิ้นปี', cs, T)
    const msg = await runLamiCommand(cmd, { me: 'A', db, companyId: 'c1' })
    expect(calls[0][0]).toBe('customer_notes')
    expect(calls[0][1]).toMatchObject({ text: 'รอโบนัสสิ้นปี', type: 'internal', staff: 'A' })
    expect(msg).toMatch(/จดไว้/)
  })
  it('ลีดใหม่ → เปิดฟอร์ม Lead (ไม่ชนลูกค้าเดิม)', () => {
    const r = parseLamiCommand('ลีดใหม่ สมศักดิ์ 0899999999 สนใจ S07', cs, T)
    expect(r).toEqual([expect.objectContaining({ kind: 'lead', name: 'สมศักดิ์' })])
    // ชื่อซ้ำลูกค้าเดิม แต่บอกชัดว่า "ลีดใหม่" → ยังเป็น lead
    expect(parseLamiCommand('ลีดใหม่ สมชาย 0899999999', cs, T)[0].kind).toBe('lead')
    // เบอร์ที่มีอยู่แล้ว → ไม่เสนอเพิ่มซ้ำ
    expect(parseLamiCommand('ลีดใหม่ 0811111111 สมชาย', cs, T).every(c => c.kind !== 'lead')).toBe(true)
    // คำถาม → ไม่ใช่คำสั่ง
    expect(parseLamiCommand('ลูกค้าใหม่เดือนนี้กี่คน', cs, T)).toEqual([])
  })
  it('เย็นนี้ = เวลา ไม่ใช่ Cold · ชื่อขึ้นก่อน + hot + นัด = คำสั่งเดียว', async () => {
    const a = parseLamiCommand('นัดสมชายเย็นนี้', cs, T)
    expect(a[0]).toMatchObject({ kind: 'fu', dueDate: '2026-11-10' })
    expect(a[0].temp).toBeUndefined()
    const b = parseLamiCommand('สมชาย hot นัดพรุ่งนี้ 10 โมง', cs, T)
    expect(b).toEqual([expect.objectContaining({ kind: 'fu', dueDate: '2026-11-11', time: '10:00', temp: 'hot' })])
    const calls = []
    const db = { createDoc: async (...x) => calls.push(['c', ...x]), updateDocData: async (...x) => calls.push(['u', ...x]) }
    await runLamiCommand({ ...b[0], customer: { ...cs[0] } }, { db })
    expect(calls.map(x => x[0] + x[1])).toEqual(['cfollowups', 'ucustomers'])
    expect(parseLamiCommand('ปิติ เป็นเย็น', cs, T)[0]).toMatchObject({ kind: 'temp', temp: 'cold' })
    expect(parseLamiCommand('มานี hot', cs, T)[0]).toMatchObject({ kind: 'temp', temp: 'hot' })
  })
  it('ยกเลิก/เลื่อนนัด → ไม่ใช่คำสั่งสร้างนัด', () => {
    expect(parseLamiCommand('ยกเลิกนัดสมชายพรุ่งนี้', cs, T)).toEqual([])
    expect(parseLamiCommand('เลื่อนนัดสมชายไปศุกร์', cs, T)).toEqual([])
  })
  it('สั่งในหน้าลูกค้า ไม่ต้องพิมพ์ชื่อ', () => {
    const c = cs[0]
    expect(scopedCommand('พรุ่งนี้ 10 โมง', c, T)[0]).toMatchObject({ kind: 'fu', dueDate: '2026-11-11', time: '10:00' })
    expect(scopedCommand('พรุ่งนี้บ่าย 2 hot', c, T)[0]).toMatchObject({ kind: 'fu', time: '14:00', temp: 'hot' })
    expect(scopedCommand('hot', c, T)[0]).toMatchObject({ kind: 'temp', temp: 'hot' })
    expect(scopedCommand('พรุ่งนี้บ่ายสองโมง hot', c, T)).toEqual([expect.objectContaining({ kind: 'fu', time: '14:00', temp: 'hot' })])
    expect(scopedCommand('จด ชอบสีขาว', c, T)[0]).toMatchObject({ kind: 'note', text: 'ชอบสีขาว' })
    expect(scopedCommand('ลองขับ เสาร์บ่าย 2', c, T)[0]).toMatchObject({ kind: 'td' })
    expect(scopedCommand('ทักไลน์ศุกร์นี้', c, T)[0]).toMatchObject({ kind: 'fu', type: 'line' })
    expect(scopedCommand('สบายดี', c, T)).toEqual([])
    expect(scopedCommand('โทรแล้ว สนใจผ่อน', c, T)[0]).toMatchObject({ kind: 'log', contacted: true })
    expect(scopedCommand('ไม่รับสาย', c, T)[0]).toMatchObject({ kind: 'log', contacted: false })
  })
  it('เลขไทย/คำอ่าน ในประโยคสั่งงาน', () => {
    expect(parseLamiCommand('นัดสมชาย ๑๕/๑๑ บ่ายสองโมง', cs, T)[0]).toMatchObject({ kind: 'fu', dueDate: '2026-11-15', time: '14:00' })
  })
  it('ติดต่อแล้ว → log (ไม่สร้างนัดผิด) · ไม่รับสาย · นัดต่อในประโยคเดียว', () => {
    const a = parseLamiCommand('โทรหาสมชายแล้ว สนใจผ่อน 0%', cs, T)
    expect(a).toEqual([expect.objectContaining({ kind: 'log', type: 'call', contacted: true, next: null })])
    expect(a[0].text).toContain('สนใจผ่อน 0%')
    expect(parseLamiCommand('มานี ไม่รับสาย', cs, T)[0]).toMatchObject({ kind: 'log', contacted: false })
    expect(parseLamiCommand('ทักไลน์ปิติแล้ว ส่งโปรไป', cs, T)[0]).toMatchObject({ kind: 'log', type: 'line' })
    const b = parseLamiCommand('วันนี้คุยกับสมชายแล้ว นัดใหม่ศุกร์นี้ 10 โมง hot', cs, T)[0]
    expect(b).toMatchObject({ kind: 'log', next: { dueDate: '2026-11-13', time: '10:00' }, temp: 'hot' })
    // ยังเป็นนัดปกติ
    expect(parseLamiCommand('โทรหาสมชายพรุ่งนี้', cs, T)[0].kind).toBe('fu')
  })
  it('runLamiCommand log: ปิดนัดที่ถึงกำหนด ไม่ปิดนัดอนาคต', async () => {
    const calls = []
    const rows = [
      { id: 'f1', customerId: 'a', status: 'pending', dueDate: '2026-11-08' },
      { id: 'f2', customerId: 'a', status: 'pending', dueDate: '2026-11-20' },
      { id: 'f3', customerId: 'b', status: 'pending', dueDate: '2026-11-08' },
    ]
    const db = { listDocs: async () => rows, updateDocData: async (...x) => calls.push(['u', ...x]), createDoc: async (...x) => calls.push(['c', ...x]) }
    const [cmd] = parseLamiCommand('โทรหาสมชายแล้ว สนใจผ่อน 0%', cs, T)
    const msg = await runLamiCommand({ ...cmd, today: T, customer: { ...cs[0] } }, { db, me: 'A' })
    expect(calls.filter(x => x[1] === 'followups').map(x => x[2])).toEqual(['f1'])
    expect(calls.some(x => x[0] === 'c' && x[1] === 'comm_logs')).toBe(false)
    expect(calls.some(x => x[1] === 'customers' && x[3].lastContactAt)).toBe(true)
    expect(msg).toMatch(/ปิดนัด 1/)
    // ไม่มีนัดค้าง → comm_logs · ไม่รับสาย → ไม่อัปเดตวันติดต่อ
    calls.length = 0
    const [c2] = parseLamiCommand('มานี ไม่รับสาย', cs, T)
    await runLamiCommand({ ...c2, today: T, customer: { ...cs[1] } }, { db: { ...db, listDocs: async () => [] } })
    expect(calls.map(x => x[0] + x[1])).toEqual(['ccomm_logs'])
  })
  it('จอง → เปิดฟอร์มจอง · มีใบจองแล้ว → เปิดหน้าลูกค้า · นัดลองขับยังเป็นลองขับ', () => {
    expect(parseLamiCommand('สมชาย จองแล้ว', cs, T)[0]).toMatchObject({ kind: 'book' })
    expect(parseLamiCommand('เปิดใบจอง มานี', cs, T)[0]).toMatchObject({ kind: 'book' })
    expect(parseLamiCommand('จอง ปิติ', [{ ...cs[2], bookingId: 'bk1' }], T)[0]).toMatchObject({ kind: 'open' })
    expect(parseLamiCommand('โทรหาสมชายแล้ว ตกลงจอง', cs, T)[0].kind).toBe('book')
    expect(parseLamiCommand('นัดลองขับ สมชาย เสาร์นี้', cs, T)[0].kind).toBe('td')
    expect(parseLamiCommand('สมชายจะจองไหม', cs, T)).toEqual([])
  })
  it('สั่งอะไรได้บ้าง → คำตอบในเครื่อง', () => {
    expect(isCommandHelp('LAMI สั่งอะไรได้บ้าง')).toBe(true)
    expect(isCommandHelp('สั่งงานยังไง')).toBe(true)
    expect(isCommandHelp('ยอดขายเดือนนี้')).toBe(false)
    expect(commandHelpText('มานี')).toContain('นัดมานีพรุ่งนี้ 10 โมง')
  })
  it('ชื่อตัวอย่าง: Hot ก่อน ไม่เอาชื่อแบบ "ลูกค้า…"', () => {
    expect(exampleName([{ firstName: 'ลูกค้างาน' }, { firstName: 'มานี' }, { firstName: 'ปิติ', temperature: 'hot' }])).toBe('ปิติ')
    expect(exampleName([{ firstName: 'ลูกค้า ทดสอบ' }])).toBe('สมชาย')
  })
})

describe('LAMI สั่งงาน: ขั้นของใบจอง (v1.0.1036)', () => {
  const T = '2026-11-10'
  const bk = [...cs.slice(0, 2), { ...cs[2], bookingId: 'bk1' }]
  it('ตัดตัวเลข / ส่งมอบ / ไฟแนนซ์ผ่าน / ถอนจอง', () => {
    expect(parseLamiCommand('ปิติ ตัดตัวเลขแล้ว', bk, T)[0]).toMatchObject({ kind: 'stage', status: 'ตัดตัวเลขรอส่งมอบ' })
    expect(parseLamiCommand('ปิติ ส่งมอบแล้ว', bk, T)[0]).toMatchObject({ kind: 'stage', status: 'ส่งมอบแล้ว' })
    expect(parseLamiCommand('ปิติ ไฟแนนซ์ผ่านแล้ว', bk, T)[0]).toMatchObject({ kind: 'stage', status: 'ผ่านไฟแนนซ์รอเบิก' })
    expect(parseLamiCommand('ปิติ ถอนจองแล้ว', bk, T)[0]).toMatchObject({ kind: 'stage', status: 'ถอนจอง' })
    expect(parseLamiCommand('ปิติ ยกเลิกจอง', bk, T)[0]).toMatchObject({ kind: 'stage', status: 'ถอนจอง' })
    expect(parseLamiCommand('ยกเลิกนัดปิติ', bk, T)).toEqual([])
    expect(parseLamiCommand('ปิติ รถมาแล้ว', bk, T)[0]).toMatchObject({ kind: 'stage', status: 'รอส่งมอบ' })
  })
  it('ลิงก์ไปหน้าใบจองพร้อมสถานะ', () => {
    const c = parseLamiCommand('ปิติ ส่งมอบแล้ว', bk, T)[0]
    expect(commandHref(c)).toBe('/crm/bookings?id=bk1&status=' + encodeURIComponent('ส่งมอบแล้ว'))
    expect(commandHref({ kind: 'book', customer: { id: 'a' } })).toBe('/crm/customers?id=a&book=1')
    expect(commandHref({ kind: 'fu', customer: { id: 'a' } })).toBe('')
  })
  it('ไม่มีใบจอง → ไม่เป็นคำสั่ง · คำถามไม่ใช่คำสั่ง · โทรแล้ว+ไฟแนนซ์ผ่าน = 2 การ์ด', () => {
    expect(parseLamiCommand('สมชาย ส่งมอบแล้ว', bk, T)).toEqual([])
    expect(parseLamiCommand('ปิติ ส่งมอบแล้วหรือยัง', bk, T)).toEqual([])
    expect(parseLamiCommand('โทรหาปิติแล้ว ไฟแนนซ์ผ่านแล้ว', bk, T).map(c => c.kind)).toEqual(['stage', 'log'])
    expect(bookingStageIn('รอรถมา')).toBe(null)
  })
})

describe('ปุ่มลัดในหน้าลูกค้า (v1.0.1037)', () => {
  it('เลือกตามสถานะ และทุกปุ่มกลายเป็นคำสั่งจริง (ยกเว้น "จด " ที่รอพิมพ์ต่อ)', () => {
    const T = '2026-11-10'
    const lead = { id: 'x', firstName: 'สมชาย', stage: 'lead', temperature: 'warm', phone: '0811111111' }
    const booked = { id: 'y', firstName: 'ปิติ', stage: 'booking', bookingId: 'bk1' }
    expect(quickChips(lead)).toContain('พรุ่งนี้ 10 โมง')
    expect(quickChips(lead)).not.toContain('จองแล้ว')
    expect(quickChips({ ...lead, temperature: 'hot' })).toContain('จองแล้ว')
    expect(quickChips(booked)).toContain('ตัดตัวเลขแล้ว')
    expect(quickChips({ ...lead, isLost: true })).toEqual([])
    for (const c of [lead, { ...lead, temperature: 'hot' }, booked, { ...lead, stage: 'delivered' }])
      for (const t of quickChips(c).filter(t => !/\s$/.test(t))) expect(scopedCommand(t, c, T).length, `${c.firstName}: ${t}`).toBeGreaterThan(0)
  })
})
