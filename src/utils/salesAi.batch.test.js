import { describe, it, expect } from 'vitest'
import { buildBatchNudgePrompt, parseBatchNudgeReply } from './salesAi.js'

describe('batch nudge', () => {
  it('prompt has first names and no phone numbers', () => {
    const p = buildBatchNudgePrompt([{ name: 'สมชาย ใจดี', phone: '0812345678', interestedModel: 'S05', days: 5, temperature: 'hot' }])
    expect(p).toContain('1. สมชาย · สนใจ S05 · เงียบ 5 วัน · สนใจมาก')
    expect(p).not.toContain('ใจดี')
    expect(p).not.toContain('081')
  })
  it('parses, drops bad rows and duplicates', () => {
    const r = parseBatchNudgeReply('```json\n[{"i":2,"msg":"สวัสดีค่ะ"},{"i":1,"msg":" hi "},{"i":1,"msg":"dup"},{"i":9,"msg":"x"},{"i":3}]\n```', 3)
    expect(r).toEqual([{ i: 1, msg: 'hi' }, { i: 2, msg: 'สวัสดีค่ะ' }])
  })
  it('returns [] for junk', () => { expect(parseBatchNudgeReply('nope', 2)).toEqual([]) })
})
