// เป้าส่งมอบรายเซลส์ต่อเดือน — เก็บเป็นเอกสารเดียวต่อเดือน: sales_targets/{YYYY-MM} = { targets: { "ชื่อเซลส์": จำนวนคัน } }
// (เอกสารเดียว อ่านด้วย id ตรงๆ ไม่ต้องใช้ query/index เพิ่ม) ใช้ในหน้ารายได้รายเซลส์, งานของฉันวันนี้ และเตือน 9 โมงเช้า
// แยกจาก team_targets (เป้าระดับฝ่าย/ทีม) ที่ Dashboard/Gamification ใช้อยู่ เพื่อไม่ให้ยอดเป้ารวมนับซ้ำ
import { normName } from '../core/hierarchy.js'

export const SALES_TARGETS_COLLECTION = 'sales_targets'

export function targetFor(targets, name) {
  const key = normName(name)
  if (!key || !targets) return 0
  for (const [n, v] of Object.entries(targets)) if (normName(n) === key) return Number(v) || 0
  return 0
}

export function goalProgress(done, target) {
  const pct = target > 0 ? Math.round((done / target) * 100) : 0
  return { done, target, pct, left: Math.max(0, target - done), color: pct >= 100 ? 'success' : pct >= 70 ? 'warning' : 'danger' }
}
