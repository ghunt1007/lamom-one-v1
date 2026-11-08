// ผู้จัดการขึ้นไป (เจ้าของโปรแกรม / owner / admin / manager) — ใช้ซ่อนข้อมูลภายใน เช่น มาร์จิ้น ค่าบริหาร จากเซลส์
// เป็นการซ่อนที่หน้าจอ (ข้อมูลอยู่ใน collection ที่พนักงานอ่านได้ตามกฎเดิม)
import { getState } from '../core/store.js'
import { isProgramOwner } from '../core/hierarchy.js'

export function isManagerRole() {
  return isProgramOwner() || ['owner', 'admin', 'manager'].includes(getState('role') || getState('user')?.role)
}
