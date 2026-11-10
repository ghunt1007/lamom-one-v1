import { describe, it, expect } from 'vitest'
import { PRESETS, SURFACE_IDS, themeVars, themeCss, contrast, fitContrast, colorsFor } from './themeEngine.js'
import { normalizeUi, LOOKS, randomLook, UI_OPTIONS } from './appearance.js'

// สีตัวหนังสือรองของ themes.css (ไม่เปลี่ยนตามธีม) — ต้องอ่านได้บนพื้นทุกแบบ
const MUTED = { dark: '#9AA6BC', light: '#4B5568' }
const TEXT = { dark: '#E8EDF7', light: '#0F172A' }

describe('ธีมหลายแบบ — อ่านง่ายทุกชุด', () => {
  const themes = [...PRESETS.map(t => t.id), 'custom']
  for (const theme of themes) {
    for (const surface of SURFACE_IDS) {
      it(`${theme} + ${surface}: สีหลัก/ตัวหนังสือ/ปุ่ม ผ่าน 4.5:1`, () => {
        const v = themeVars({ theme, custom: '#FFEE00', surface })
        for (const mode of ['dark', 'light']) {
          const o = v[mode]
          const s2 = o['--surface-2'] || (mode === 'dark' ? '#17223A' : '#F1F4F9')
          const s3 = o['--surface-3'] || (mode === 'dark' ? '#1F2C47' : '#E6EBF3')
          if (o['--primary']) {
            expect(contrast(o['--primary'], s2)).toBeGreaterThanOrEqual(4.5)
            const [g1, g2] = o['--grad-primary'].match(/#[0-9A-F]{6}/g)
            expect(contrast(g1, '#FFFFFF')).toBeGreaterThanOrEqual(4.5)
            expect(contrast(g2, '#FFFFFF')).toBeGreaterThanOrEqual(4.5)
          }
          expect(contrast(MUTED[mode], s3)).toBeGreaterThanOrEqual(4.5)
          expect(contrast(TEXT[mode], o['--bg'] || (mode === 'dark' ? '#0B1220' : '#F4F6FA'))).toBeGreaterThanOrEqual(7)
        }
      })
    }
  }
  it('ธีมมาตรฐาน + พื้นผิวมาตรฐาน = ไม่เปลี่ยนอะไร (ใช้ themes.css เดิม)', () => {
    expect(themeCss({ theme: 'ocean', surface: 'default' })).toBe('')
  })
  it('fitContrast ปรับเฉพาะความสว่าง', () => {
    expect(contrast(fitContrast('#FFFF00', '#FFFFFF'), '#FFFFFF')).toBeGreaterThanOrEqual(4.5)
    expect(contrast(fitContrast('#000080', '#111A2E'), '#111A2E')).toBeGreaterThanOrEqual(4.5)
  })
  it('สีเลือกเอง: สร้างสีรองให้อัตโนมัติ', () => {
    const c = colorsFor('custom', '#E11D48')
    expect(c.p).toBe('#E11D48')
    expect(c.a).toMatch(/^#[0-9A-F]{6}$/)
  })
  it('ค่าที่เก็บไว้เสียหาย → กลับเป็นค่าเริ่มต้น', () => {
    expect(normalizeUi({ theme: 'custom', custom: 'zzz' }).theme).toBe('ocean')
    expect(normalizeUi({ theme: 'custom', custom: '#123456' })).toMatchObject({ theme: 'custom', custom: '#123456' })
    expect(normalizeUi({ card: 'glass', bg: 'aurora', family: 'kanit' })).toMatchObject({ card: 'glass', bg: 'aurora', family: 'kanit' })
  })
  it('ชุดสำเร็จรูป/สุ่ม ใช้ค่าที่มีจริงทั้งหมด', () => {
    for (const l of [...LOOKS, randomLook(() => 0.99), randomLook(() => 0)]) {
      for (const [k, v] of Object.entries(l.ui)) expect(UI_OPTIONS[k].some(([x]) => x === v)).toBe(true)
    }
  })
})
