import { describe, it, expect } from 'vitest'
import { matchesSearch, searchTokens } from './customerSearch.js'

const c = { firstName: 'สมชาย', lastName: 'ใจดี', phone: '0812345678', lineId: '@somchai', interestedModel: 'DEEPAL S07', assignedTo: 'เซลส์ เอ' }

describe('matchesSearch', () => {
  it('empty query matches', () => { expect(matchesSearch(c, '  ')).toBe(true) })
  it('all words must match', () => {
    expect(matchesSearch(c, 's07 สมชาย')).toBe(true)
    expect(matchesSearch(c, 's05 สมชาย')).toBe(false)
  })
  it('phone with dashes or spaces', () => {
    expect(matchesSearch(c, '081-234')).toBe(true)
    expect(matchesSearch(c, '081 234 5678')).toBe(true)
    expect(matchesSearch(c, '+66812345678')).toBe(true)
    expect(matchesSearch(c, '099')).toBe(false)
  })
  it('line id, salesperson', () => {
    expect(matchesSearch(c, '@SOMCHAI')).toBe(true)
    expect(matchesSearch(c, 'เซลส์ เอ')).toBe(true)
  })
  it('tokens', () => { expect(searchTokens(' A  b ')).toEqual(['a', 'b']) })
})

import { parseSmartQuery } from './customerSearch.js'
describe('smart search words', () => {
  const people = [
    { id: 1, firstName: 'สมชาย', temperature: 'hot', stage: 'lead', interestedModel: 'DEEPAL S07', phone: '0812345678', assignedTo: 'เอ' },
    { id: 2, firstName: 'วิภา', temperature: 'warm', stage: 'pp', interestedModel: 'DEEPAL S05', phone: '', assignedTo: '' },
    { id: 3, firstName: 'มานะ', temperature: 'hot', stage: 'pp', isLost: true, interestedModel: 'DEEPAL S07', phone: '0899999999', assignedTo: 'บี' },
  ]
  const run = (q, o) => people.filter(c => matchesSearch(c, q, null, o)).map(c => c.id)
  it('ร้อน + รุ่น', () => { expect(run('ร้อน s07')).toEqual([1, 3]) })
  it('สถานะ + เสียดีล', () => { expect(run('prospect')).toEqual([2]); expect(run('หลุด')).toEqual([3]) })
  it('ไม่มีเบอร์ / ไม่มีผู้ดูแล', () => { expect(run('ไม่มีเบอร์')).toEqual([2]); expect(run('ไม่มีผู้ดูแล')).toEqual([2]) })
  it('เงียบ ใช้ฟังก์ชันจากหน้าเรียก', () => { expect(run('เงียบ', { isQuiet: c => c.id === 2 })).toEqual([2]) })
  it('ป้ายบอกว่าเข้าใจอะไร', () => {
    expect(parseSmartQuery('ร้อน s07 lead')).toMatchObject({ labels: ['🔴 ลูกค้าร้อน', '🧲 Lead'], text: ['s07'] })
  })
})
