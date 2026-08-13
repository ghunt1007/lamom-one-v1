// LAMOM ONE Webhook Test-Send — เรียก workers/webhook-test.js ยิง HTTP แทน browser (กัน CORS/SSRF)
// ปุ่ม "⚡ Test" ใน WebhookBuilder.js เรียกไฟล์นี้แทนการ fetch() ตรงจากหน้าเว็บ
import { auth } from '../core/firebase.js'

const WEBHOOK_TEST_URL = import.meta.env.VITE_WEBHOOK_TEST_URL || 'https://lamom-webhook-test.ghunt1007.workers.dev'

export async function testSendWebhook({ url, method, secret, event }) {
  const u = auth.currentUser
  if (!u) throw new Error('ต้องล็อกอินด้วยบัญชีจริงก่อน')
  const token = await u.getIdToken()
  const res = await fetch(`${WEBHOOK_TEST_URL}/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ url, method, secret, event }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Webhook Test Worker Error ${res.status}`)
  return data
}
