import { describe, it, expect } from 'vitest'
import { defaultSalesperson } from './defaultSalesperson.js'

describe('defaultSalesperson', () => {
  const opts = ['สมชาย ใจดี', 'บี', 'ยังไม่ระบุ']
  it('picks my own name (full or first word)', () => {
    expect(defaultSalesperson(opts, 'สมชาย ใจดี').selected).toBe('สมชาย ใจดี')
    expect(defaultSalesperson(opts, 'สมชาย').selected).toBe('สมชาย ใจดี')
  })
  it('adds me on top when missing, keeps list when unknown', () => {
    expect(defaultSalesperson(opts, 'ซี')).toEqual({ options: ['ซี', ...opts], selected: 'ซี' })
    expect(defaultSalesperson(opts, '')).toEqual({ options: opts, selected: '' })
    expect(defaultSalesperson(opts, 'เจ้าของ', { addIfMissing: false })).toEqual({ options: opts, selected: '' })
  })
})
