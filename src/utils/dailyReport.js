// LAMOM ONE Daily Report — เรียก workers/daily-report.js (คนละตัวกับ comms.js เพราะรายงานนี้ต้องทำงาน
// เองทุกวันผ่าน Cron Trigger โดยไม่มีใครล็อกอินอยู่เลย — endpoint /test-send กับ /preview ในไฟล์นี้ใช้แค่
// ตอนพนักงานกดทดสอบเองในหน้า Settings เท่านั้น ยืนยันตัวตนด้วย Firebase ID token แบบเดียวกับ comms.js
import { auth } from '../core/firebase.js'

const DAILY_REPORT_URL = import.meta.env.VITE_DAILY_REPORT_URL || 'https://lamom-daily-report.ghunt1007.workers.dev'

async function authHeader() {
  const u = auth.currentUser
  if (!u) return null
  const token = await u.getIdToken()
  return { Authorization: `Bearer ${token}` }
}

async function call(path) {
  const auth_ = await authHeader()
  if (!auth_) throw new Error('ต้องล็อกอินด้วยบัญชีจริงก่อน')
  const res = await fetch(`${DAILY_REPORT_URL}${path}`, { headers: auth_ })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Daily Report Worker Error ${res.status}`)
  return data
}

export function previewDailyReport() {
  return call('/preview')
}
export function sendDailyReportNow() {
  return call('/test-send')
}
export function getDailyReportWebhookUrl() {
  return `${DAILY_REPORT_URL}/line/webhook`
}
