// (v1.0.931) ชื่อคนที่ล็อกอินอยู่ สำหรับบันทึกว่า "ใครทำรายการ" — ที่เดียวทั้งแอป (เดิมเขียนซ้ำ 21 หน้า)
import { getState } from '../core/store.js'

export function myName(fallback = 'ผู้ใช้ปัจจุบัน') {
  const me = getState('user') || {}
  return me.displayName || me.email || fallback
}
