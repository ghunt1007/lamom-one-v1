import { describe, it, expect } from 'vitest'
import { commandIntro } from './lamiCommandCard.js'

describe('v1.0.1534 command intro', () => {
  it('open-only cards do not ask to press ✅ ทำเลย', () => {
    expect(commandIntro([{ kind: 'quote' }])).toBe('🪄 เข้าใจว่าจะทำแบบนี้ครับ — กดปุ่มด้านล่างเพื่อเปิด')
    expect(commandIntro([{ kind: 'log' }])).toContain('✅ ทำเลย')
  })
})
