// (v1.0.1003) แจ้งเตือน: กฎ Firestore ให้อ่านได้เฉพาะของตัวเอง (userId) — เจ้าของ/แอดมินอ่านได้ทั้งหมด
// เดิมทุกหน้าดึงแบบไม่กรอง → พนักงานที่ไม่ใช่แอดมินโดนปฏิเสธทั้งชุด กระดิ่ง 🔔 กดแล้วไม่เปิด หน้าแจ้งเตือนว่าง
import { getState } from '../core/store.js'

// คืนตัวกรองสำหรับ listDocs/watchDocs · null = ยังไม่รู้ว่าเป็นใคร (ไม่ต้องดึง)
export function notifFilters(user = getState('user'), role = getState('role')) {
  const r = role || user?.role
  if (['owner', 'admin'].includes(r)) return []
  return user?.uid ? [['userId', '==', user.uid]] : null
}
