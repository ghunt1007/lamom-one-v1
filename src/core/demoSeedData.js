// Demo seed data — โหลดแบบ lazy เฉพาะโหมด Demo เท่านั้น (แยกออกจาก db.js เพื่อลดขนาด bundle หลัก)
// แยกเป็นไฟล์ย่อยตามโมดูลใน ./seed/ เพื่อให้แก้ไข/เพิ่ม/ลบข้อมูลตัวอย่างของแต่ละโมดูลได้ง่ายโดยไม่ต้องไล่หาในไฟล์เดียวกันหมด
import { runSeed as runSeed_b2b } from './seed/b2b.js'
import { runSeed as runSeed_core } from './seed/core.js'
import { runSeed as runSeed_crm } from './seed/crm.js'
import { runSeed as runSeed_dms } from './seed/dms.js'
import { runSeed as runSeed_documents } from './seed/documents.js'
import { runSeed as runSeed_finance } from './seed/finance.js'
import { runSeed as runSeed_gamification } from './seed/gamification.js'
import { runSeed as runSeed_hr } from './seed/hr.js'
import { runSeed as runSeed_insurance } from './seed/insurance.js'
import { runSeed as runSeed_integrations } from './seed/integrations.js'
import { runSeed as runSeed_marketing } from './seed/marketing.js'
import { runSeed as runSeed_quality } from './seed/quality.js'
import { runSeed as runSeed_service } from './seed/service.js'
import { runSeed as runSeed_settings } from './seed/settings.js'
import { runSeed as runSeed_training } from './seed/training.js'

export function runSeed(demoCol) {
  runSeed_b2b(demoCol)
  runSeed_core(demoCol)
  runSeed_crm(demoCol)
  runSeed_dms(demoCol)
  runSeed_documents(demoCol)
  runSeed_finance(demoCol)
  runSeed_gamification(demoCol)
  runSeed_hr(demoCol)
  runSeed_insurance(demoCol)
  runSeed_integrations(demoCol)
  runSeed_marketing(demoCol)
  runSeed_quality(demoCol)
  runSeed_service(demoCol)
  runSeed_settings(demoCol)
  runSeed_training(demoCol)
}
