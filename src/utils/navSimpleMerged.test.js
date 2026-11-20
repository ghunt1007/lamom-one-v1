// (v1.0.1228) เมนูหลักแบบย่อต้องไม่ทำเมนูหายเงียบๆ — หน้าที่ถูกรวมเป็นแท็บของหน้าอื่น (linkedViews) ก็ต้องขึ้นในเมนูหลักได้
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { NAV } from '../data/navMenu.js'
import { ROLE_ESSENTIALS, essentialsFor, buildSimpleNav } from './navSimple.js'
import { isMergedPath } from './linkedViews.js'

describe('เมนูหลักแบบย่อ', () => {
  it('ทุกเมนูในเมนูหลักของทุกบทบาทมีอยู่ในเมนูเต็ม', () => {
    const all = new Set(NAV.flatMap(g => g.items.map(i => i.path)))
    for (const r of [...Object.keys(ROLE_ESSENTIALS), '']) for (const p of essentialsFor(r).flatMap(g => g.paths)) expect(all.has(p), `${r}:${p}`).toBe(true)
  })
  it('Sidebar สร้างเมนูหลักจากเมนูที่ไม่ตัดหน้าแท็บทิ้ง (keepMerged)', () => {
    const src = readFileSync(new URL('../components/layout/Sidebar.js', import.meta.url), 'utf8')
    expect(src).toMatch(/buildSimpleNav\(visibleNav\([^)]*keepMerged: true/)
  })
  it('เจ้าของเห็น "ต้องสั่งรถ (รุ่น/สี)" และหน้าที่เป็นแท็บ เช่น รายงานส่ง LINE', () => {
    const items = buildSimpleNav(NAV, {}, { role: 'owner' }).flatMap(g => g.items)
    expect(items.find(i => i.path === '/dms/color-matrix')?.label).toBe('ต้องสั่งรถ (รุ่น/สี)')
    expect(isMergedPath('/settings/daily-report')).toBe(true)
    expect(items.some(i => i.path === '/settings/daily-report')).toBe(true)
  })
  it('ต้องสั่งรถ ไม่ถูกรวมเป็นแท็บ (หาเจอในเมนูเต็มและช่องหาเมนู)', () => {
    expect(isMergedPath('/dms/color-matrix')).toBe(false)
  })
})
