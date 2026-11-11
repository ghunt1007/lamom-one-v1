import { describe, it, expect } from 'vitest'
import { maybePayQuestion, parsePaySpec, payAnswer, payFollowUps } from './payQuestions.js'
import { parseLamiCommand } from './lamiCommands.js'
import { parseStockSpec } from './stockQuestions.js'
import { isMonthQuestion } from './monthBrief.js'

const vs = [
  { brand: 'DEEPAL', model: 'S07', variant: 'Max', price: 1399000 },
  { brand: 'DEEPAL', model: 'S07', variant: 'Pro', price: 1299000 },
  { brand: 'AION', model: 'AION V', variant: '', price: 899000 },
]

describe('parsePaySpec', () => {
  it('reads model, down, months, rate', () => {
    expect(parsePaySpec('S07 ดาวน์ 20% ผ่อน 60 งวดเท่าไหร่', vs)).toEqual({ price: 1299000, car: 'DEEPAL S07 Pro (รุ่นเริ่มต้น)', months: 60, rate: null, downPct: 20 })
    expect(parsePaySpec('ผ่อน s07 max 5 ปี ดอก 2.5', vs)).toMatchObject({ price: 1399000, car: 'DEEPAL S07 Max', months: 60, rate: 2.5, downPct: null })
    expect(parsePaySpec('ผ่อน AION V เดือนละเท่าไหร่?', vs)).toMatchObject({ price: 899000, car: 'AION V', months: null, downPct: null })
  })
  it('reads an explicit price and a down amount', () => {
    expect(parsePaySpec('ราคา 899,000 ดาวน์ 25% 72 งวด ผ่อนเท่าไหร่', [])).toMatchObject({ price: 899000, car: '', months: 72, downPct: 25 })
    expect(parsePaySpec('รถ 1.2 ล้าน ดาวน์ 2 แสน ผ่อน 84 งวด', [])).toMatchObject({ price: 1200000, months: 84, downPct: 16.7 })
    expect(parsePaySpec('ค่างวด 899000 ดาวน์ 100000 60 งวด', [])).toMatchObject({ price: 899000, downPct: 11.1 })
    expect(parsePaySpec('ผ่อน 0% aion v 48 งวด', vs)).toMatchObject({ rate: 0, months: 48 })
  })
  it('leaves commands and other questions alone', () => {
    for (const q of ['โทรหาสมชายแล้ว สนใจผ่อน 0%', 'ลูกค้าคนไหนสนใจผ่อน', 'ผ่อนเท่าไหร่', 'S07 สีขาวมีไหม', 'ผ่อน 899000 ดาวน์ 900000', 'ใครผ่อนไม่ผ่าน', '']) expect(parsePaySpec(q, vs), q).toBeNull()
    expect(maybePayQuestion('วันนี้มีอะไรบ้าง')).toBe(false)
    const yrs = [{ brand: 'Deepal', model: 'S07 (2024)', variant: 'Std', price: 1119000, year: 2024 }, { brand: 'Deepal', model: 'S07 (2026)', variant: 'New', price: 1199000, year: 2026 }]
    expect(parsePaySpec('ผ่อน S07 60 งวด', yrs)).toMatchObject({ price: 1199000, car: 'Deepal S07 (2026) New' })
    expect(parsePaySpec('ผ่อน S07 (2024) 60 งวด', yrs)).toMatchObject({ price: 1119000 })
    for (const q of ['S07 ดาวน์ 20% ผ่อน 60 งวดเท่าไหร่', 'ผ่อน AION V เดือนละเท่าไหร่']) {
      expect(parseStockSpec(q, vs)).toBeNull(); expect(isMonthQuestion(q)).toBe(false)
      expect(parseLamiCommand(q, [{ id: 'a', firstName: 'สมชาย', stage: 'lead' }], '2026-11-11')).toEqual([])
    }
  })
})

describe('payAnswer', () => {
  it('computes one plan', () => {
    const t = payAnswer(parsePaySpec('ราคา 899,000 ดาวน์ 25% 72 งวด ผ่อนเท่าไหร่', []))
    expect(t).toContain('🧮 ราคา ฿899,000')
    expect(t).toContain('ดาวน์ 25% = ฿224,750 · ยอดจัด ฿674,250')
    expect(t).toContain('• 72 งวด → ฿10,932/เดือน')
    expect(t).toContain('ดอกเบี้ยคงที่ 2.79% ต่อปี (ค่าเริ่มต้น')
  })
  it('shows a grid when down or months are not given', () => {
    const t = payAnswer(parsePaySpec('ผ่อน AION V เดือนละเท่าไหร่', vs))
    expect(t).toContain('🧮 AION V · ราคา ฿899,000')
    expect(t.split('\n').filter(l => l.startsWith('• ดาวน์')).length).toBe(3)
    expect(t).toContain('• ดาวน์ 20% (฿179,800) → 48 งวด')
    const m = payAnswer(parsePaySpec('ผ่อน AION V 60 งวด', vs))
    expect(m.split('\n').filter(l => l.startsWith('• ดาวน์')).length).toBe(5)
    expect(m).toContain('/เดือน (60 งวด)')
    const d = payAnswer(parsePaySpec('ผ่อน AION V ดาวน์ 20% ดอก 2.5', vs))
    expect(d.split('\n').filter(l => /^• \d+ งวด/.test(l)).length).toBe(4)
    expect(d).not.toContain('ค่าเริ่มต้น')
  })
  it('offers follow-ups that parse again', () => {
    const s = parsePaySpec('S07 ดาวน์ 20% ผ่อน 60 งวดเท่าไหร่', vs)
    const next = payFollowUps(s)
    expect(next).toEqual(['ผ่อน DEEPAL S07 Pro ดาวน์ 25% 60 งวด', 'ผ่อน DEEPAL S07 Pro ดาวน์ 20% 72 งวด'])
    next.forEach(q => expect(parsePaySpec(q, vs)).toMatchObject({ price: 1299000 }))
    expect(payFollowUps(parsePaySpec('ผ่อน 899000 เท่าไหร่', []))).toEqual(['ผ่อน ราคา 899000 ดาวน์ 25% 72 งวด'])
  })
})
