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

// (v1.0.1368) Worker ตอบ { configured:false } หรือ { sent:0, failed:n } ด้วย HTTP 200 — เดิมหน้าที่ส่งรายคน
// (ใบเสร็จ, แจ้งลิงก์ผูก LINE, ตอบกล่องข้อความ, CSAT, ส่งลูกค้าทาง SMS ฯลฯ) เข้าใจว่าส่งสำเร็จทั้งที่ไม่มีอะไรออกไป
// → ถือว่าล้มเหลว (throw) เมื่อยังไม่ตั้งค่า หรือไม่สำเร็จเลยสักรายการ · สำเร็จบางส่วน = คืนผลให้ผู้เรียกดูตัวเลขเอง
export function assertDelivered(r, what = 'ส่ง') {
  if (r?.configured === false) throw new Error(r.error || `${what}ยังไม่ได้ตั้งค่า`)
  if (r && Number(r.sent) === 0 && Number(r.failed) > 0) throw new Error(`${what}ไม่สำเร็จ: ${r.errors?.[0]?.error || 'ผู้ให้บริการปฏิเสธ'}`)
  return r
}
export async function sendSms(recipients, message) {
  return assertDelivered(await callComms('/send/sms', { recipients, message }), 'SMS ')
}
export async function sendEmail(recipients, subject, message) {
  return assertDelivered(await callComms('/send/email', { recipients, subject, message }), 'อีเมล ')
}
export function sendLineBroadcast(message) {
  return callComms('/send/line', { message })
}
export function getLineOaInsight() {
  return callComms('/line/insight', {})
}
// (v1.0.350) IP Whitelist ต้องรู้ IP จริงของผู้ login มาเทียบ — Firestore Rules มองไม่เห็น IP ผู้เรียกเลย
// (ไม่มี request.ip) ต้องผ่าน Worker นี้ที่เห็น header CF-Connecting-IP จริงจาก Cloudflare เท่านั้น
export async function getClientIp() {
  const { ip } = await callComms('/whoami', {})
  return ip
}
export function sendPush(tokens, title, message) {
  return callComms('/send/push', { tokens, title, message })
}
