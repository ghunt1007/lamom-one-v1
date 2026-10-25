import { describe, it, expect } from 'vitest'
import { parseLeadText, maskContacts, parseLeadNameReply } from './leadText.js'

describe('parseLeadText', () => {
  it('finds phone, model, source, hot', () => {
    const r = parseLeadText('สวัสดีครับ เห็นเพจ Facebook สนใจ Deepal S07 ขอราคาหน่อย เบอร์ 081-234-5678', ['DEEPAL S07', 'DEEPAL L07'])
    expect(r).toEqual({ contact: '0812345678', model: 'DEEPAL S07', source: 'facebook', hot: true })
  })
  it('handles +66 and LINE id', () => {
    expect(parseLeadText('โทร +66 81 234 5678').contact).toBe('0812345678')
    expect(parseLeadText('แอดไลน์ line: @somchai99 นะคะ').contact).toBe('@somchai99')
  })
  it('nothing found', () => {
    expect(parseLeadText('สนใจครับ')).toEqual({ contact: '', model: '', source: '', hot: false })
  })
})
describe('maskContacts', () => {
  it('hides phone and line', () => {
    const m = maskContacts('ชื่อเอ 0812345678 ไลน์ @abc123')
    expect(m).not.toContain('081')
    expect(m).not.toContain('abc123')
  })
})
describe('parseLeadNameReply', () => {
  it('reads json', () => { expect(parseLeadNameReply('```json\n{"name":"สมชาย","model":"S07","summary":"ขอราคา"}\n```')).toEqual({ name: 'สมชาย', model: 'S07', summary: 'ขอราคา' }) })
  it('bad', () => { expect(parseLeadNameReply('no')).toBeNull() })
})
