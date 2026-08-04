// LAMOM ONE Comms Service — ส่ง SMS/Email/LINE/Push ผ่าน Cloudflare Worker Proxy
// เดิมปุ่ม "ส่ง" ใน Broadcast/SMS Marketing ไม่เรียกผู้ให้บริการจริงเลย (ดู CHANGELOG v1.0.247)
// ตอนนี้เรียก workers/comms-send.js จริง — pattern เดียวกับ src/utils/ai.js (ส่ง Firebase ID
// token ไปยืนยันตัวตน ไม่ส่ง credential ผู้ให้บริการให้ client เห็นเลย)
import { auth } from '../core/firebase.js'

const COMMS_URL = import.meta.env.VITE_COMMS_PROXY_URL || 'https://lamom-comms-send.ghunt1007.workers.dev'

async function authHeader() {
  const u = auth.currentUser
  if (!u) return null
  const token = await u.getIdToken()
  return { Authorization: `Bearer ${token}` }
}

async function callComms(path, payload) {
  const auth_ = await authHeader()
  if (!auth_) throw new Error('ต้องล็อกอินด้วยบัญชีจริงเพื่อส่งแคมเปญ')
  const res = await fetch(`${COMMS_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth_ },
    body: JSON.stringify(payload),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Comms Proxy Error ${res.status}`)
  return data
}

export function sendSms(recipients, message) {
  return callComms('/send/sms', { recipients, message })
}
export function sendEmail(recipients, subject, message) {
  return callComms('/send/email', { recipients, subject, message })
}
export function sendLineBroadcast(message) {
  return callComms('/send/line', { message })
}
export function getLineOaInsight() {
  return callComms('/line/insight', {})
}
export function sendPush(tokens, title, message) {
  return callComms('/send/push', { tokens, title, message })
}
