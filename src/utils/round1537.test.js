import { describe, it, expect } from 'vitest'
import { parseOpsSpec, myLinkAnswer } from './opsQuestions.js'

describe('LAMI ลิงก์ฟอร์มลีดของฉัน (v1.0.1537)', () => {
  it('routes link/QR questions', () => {
    for (const q of ['ลิงก์ฟอร์มลงทะเบียนลูกค้า', 'QR ลีดของฉัน', 'ขอลิงก์ของฉัน', 'ลิงค์นามบัตร']) expect(parseOpsSpec(q)?.kind).toBe('mylink')
    for (const q of ['ลิงก์ LINE OA', 'ลีดจาก QR กี่คน']) expect(parseOpsSpec(q)?.kind).not.toBe('mylink')
  })
  it('answers with a copyable link, or says plainly when the user is unknown', () => {
    const r = myLinkAnswer({ uid: 'u1', name: 'เซลส์', url: 'https://example.test/lead?seller=u1' })
    expect(r.copy).toBe('https://example.test/lead?seller=u1')
    expect(r.text).toContain('เซลส์')
    expect(myLinkAnswer({}).copy).toBeUndefined()
  })
})
