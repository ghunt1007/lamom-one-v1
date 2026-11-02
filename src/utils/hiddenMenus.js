// (2026-11-02) ซ่อนเมนูที่ไม่ได้ใช้ — เจ้าของโปรแกรมเลือกจากหน้า "หน้าไหนมีข้อมูลจริง" (settings/PageUsage.js)
// ซ่อนจากแถบเมนูซ้ายของทุกคน แต่หน้า/ข้อมูลยังอยู่ครบ (เปิดผ่านลิงก์/ค้นหา Ctrl+K ได้ กดเลิกซ่อนได้ทุกเมื่อ)
// เก็บใน whitelabel_settings.hiddenMenus (เขียนได้เฉพาะเจ้าของโปรแกรมตาม firestore.rules)
import { getState } from '../core/store.js'
import { basePath } from './pageUsage.js'

// หน้าที่ห้ามซ่อน — ไม่งั้นจะกลับมาเลิกซ่อนไม่ได้ หรือหาทางไปหน้าหลักไม่เจอ
export const NEVER_HIDE = ['/', '/settings', '/settings/page-usage', '/settings/my-account', '/help']

export function cleanHiddenMenus(list) {
  return [...new Set((Array.isArray(list) ? list : []).filter(p => typeof p === 'string' && p.startsWith('/')).map(basePath))]
    .filter(p => !NEVER_HIDE.includes(p)).sort()
}

export function hiddenMenuSet(brand = getState('brand')) {
  return new Set(cleanHiddenMenus(brand?.hiddenMenus))
}
