import { describe, it, expect } from 'vitest'
import { parseLeadText, maskContacts, parseLeadNameReply } from './leadText.js'

describe('parseLeadText', () => {
  it('finds phone, model, source, hot', () => {
    const r = parseLeadText('สวัสดีครับ เห็นเพจ Facebook สนใจ Deepal S07 ขอราคาหน่อย เบอร์ 081-234-5678', ['DEEPAL S07', 'DEEPAL L07'])
    expect(r).toEqual({ contact: '0812345678', model: 'DEEPAL S07', source: 'facebook', hot: true, name: '' })
  })
  it('handles +66 and LINE id', () => {
    expect(parseLeadText('โทร +66 81 234 5678').contact).toBe('0812345678')
    expect(parseLeadText('แอดไลน์ line: @somchai99 นะคะ').contact).toBe('@somchai99')
  })
  it('nothing found', () => {
    expect(parseLeadText('สนใจครับ')).toEqual({ contact: '', model: '', source: '', hot: false, name: '' })
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

describe('parseLeadText — spoken input', () => {
  it('matches model by name without brand and spoken facebook', () => {
    const r = parseLeadText('คุณสมชาย 081 234 5678 สนใจ s05 มาจากเฟซบุ๊ก', ['DEEPAL S07', 'DEEPAL S05'])
    expect(r.model).toBe('DEEPAL S05')
    expect(r.contact).toBe('0812345678')
    expect(r.source).toBe('facebook')
  })
})

describe('parseLeadText — name', () => {
  it('reads explicit names', () => {
    expect(parseLeadText('คุณสมชาย 081 234 5678').name).toBe('สมชาย')
    expect(parseLeadText('สวัสดีค่ะ ชื่อ วิภา ค่ะ สนใจรถ').name).toBe('วิภา')
    expect(parseLeadText('ชื่อนิดค่ะ').name).toBe('นิด')
  })
  it('leaves name empty when unclear', () => {
    expect(parseLeadText('สนใจรถครับ ราคาเท่าไหร่').name).toBe('')
  })
})
