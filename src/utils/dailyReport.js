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

// (2026-11-02) สำรองข้อมูลอัตโนมัติ (workers/nightly-backup.js) — เจ้าของโปรแกรมเท่านั้น
export async function runCloudBackup() {
  const h = await authHeader()
  if (!h) throw new Error('ต้องล็อกอินด้วยบัญชีจริงก่อน')
  const res = await fetch(`${DAILY_REPORT_URL}/backup/run`, { method: 'POST', headers: h })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.ok) throw new Error(data.error || `Backup Error ${res.status}`)
  return data
}

export async function downloadLatestCloudBackup() {
  const h = await authHeader()
  if (!h) throw new Error('ต้องล็อกอินด้วยบัญชีจริงก่อน')
  const res = await fetch(`${DAILY_REPORT_URL}/backup/latest`, { headers: h })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || `Backup Error ${res.status}`)
  }
  const date = res.headers.get('X-Backup-Date') || ''
  const blob = await res.blob()
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `lamom-backup-auto-${date || 'latest'}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  return date
}

// (2026-11-02) ไฟล์ DATA Booking จาก Google Drive (workers/sheet-pull.js) — เจ้าของโปรแกรมเท่านั้น
// error ที่โยนออกไปมี .code ('not_shared' | 'drive_api_off') .shareWith .link ให้หน้าจอบอกวิธีแก้ได้ตรงจุด
async function sheetCall(path) {
  const h = await authHeader()
  if (!h) throw new Error('ต้องล็อกอินด้วยบัญชีจริงก่อน')
  const res = await fetch(`${DAILY_REPORT_URL}${path}`, { headers: h, cache: 'no-store' })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    const err = new Error(data.message || data.error || `Sheet Error ${res.status}`)
    Object.assign(err, { code: data.error || '', shareWith: data.shareWith || '', link: data.link || '', fileId: data.fileId || '' })
    throw err
  }
  return res
}

export async function getSheetStatus() {
  return (await sheetCall('/sheet/status')).json()
}

export async function fetchSheetFile() {
  const res = await sheetCall('/sheet/latest')
  let name = 'DATA Booking.xlsx'
  try { name = decodeURIComponent(res.headers.get('X-Sheet-Name') || '') || name } catch {}
  return { buffer: await res.arrayBuffer(), name, modifiedTime: res.headers.get('X-Sheet-Modified') || '' }
}
