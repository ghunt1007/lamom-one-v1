import { describe, it, expect } from 'vitest'
import { bodyLimit, MAX_IMAGE_BODY_BYTES } from './ai-proxy.js'

describe('ai-proxy body limit (v1.0.1237)', () => {
  it('คำขอที่มีรูปได้ 4MB · ข้อความล้วนยังจำกัด 200KB', () => {
    expect(bodyLimit(JSON.stringify({ contents: [{ parts: [{ text: 'x' }, { inlineData: { mimeType: 'image/jpeg', data: 'AAA' } }] }] }))).toBe(MAX_IMAGE_BODY_BYTES)
    expect(bodyLimit(JSON.stringify({ contents: [{ parts: [{ text: 'inlineData' }] }] }))).toBe(200_000)
  })
})
