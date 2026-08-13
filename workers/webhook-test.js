/**
 * LAMOM ONE — Webhook Test-Send Worker
 * Deploy: wrangler deploy --config wrangler-webhook-test.toml
 *
 * ทำไมต้องมี Worker นี้: WebhookBuilder.js (/integrations/webhooks) ปุ่ม "⚡ Test" เดิมแค่โชว์ toast
 * ว่า "ยังไม่รองรับ" เพราะยิง HTTP ตรงจาก browser ไปยัง URL ปลายทางที่ผู้ใช้กรอกเองไม่ได้ทั้ง CORS (เบราว์เซอร์
 * บล็อก cross-origin fetch ที่ปลายทางไม่ได้ตั้ง CORS header ให้เรา) และความเสี่ยง SSRF (ถ้ายอมให้ browser ยิง
 * URL อะไรก็ได้ที่ผู้ใช้พิมพ์ตรงๆ ผ่าน proxy ฝั่งเรา อาจถูกใช้สแกน/โจมตี network ภายในของเราเองได้) — Worker
 * นี้เป็นตัวกลางที่ยิงแทน พร้อมกันปลายทางที่เป็น private/internal address ก่อนยิงเสมอ
 *
 * หมายเหตุสำคัญ (ขอบเขตที่ตั้งใจ): Worker นี้แก้ได้แค่ "ทดสอบยิง Webhook ตามที่ผู้ใช้กดเอง" เท่านั้น —
 * ไม่ได้ทำให้ระบบยิง Webhook อัตโนมัติเมื่อเกิด Event จริง (sale.created ฯลฯ) ซึ่งต้อง hook เข้าทุกจุดที่
 * เขียนข้อมูลทั่วทั้งแอป เป็นงานคนละสเกล ยังไม่ทำในรอบนี้ (ดู banner ในหน้า WebhookBuilder.js)
 *
 * Binding/vars ที่ต้องตั้ง:
 *   Var: FIREBASE_API_KEY, FIREBASE_PROJECT_ID, ALLOWED_ORIGIN (เหมือน comms-send.js/daily-report.js)
 * ไม่ต้องมี secret เพิ่มเติม — ไม่ได้เก็บ credential ผู้ให้บริการภายนอกใดๆ ไว้ที่นี่
 */

const STAFF_ROLES = ['owner', 'admin', 'manager', 'sales', 'service', 'finance', 'hr', 'staff']
const FETCH_TIMEOUT_MS = 8000

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const origin = env.ALLOWED_ORIGIN || '*'
    const cors = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors })
    if (request.method !== 'POST' || url.pathname !== '/test') return json({ error: 'Not found' }, 404, cors)

    const authHeader = request.headers.get('Authorization') || ''
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    if (!idToken) return json({ error: 'Unauthorized — missing token' }, 401, cors)
    const verified = await verifyFirebaseToken(idToken, env.FIREBASE_API_KEY)
    if (!verified) return json({ error: 'Unauthorized — invalid token' }, 401, cors)
    if (!(await isAuthorizedStaff(idToken, verified.localId, env))) {
      return json({ error: 'Unauthorized — บัญชีนี้ยังไม่ได้รับอนุมัติให้เป็นพนักงาน' }, 403, cors)
    }

    let body
    try { body = await request.json() } catch { body = {} }
    const targetUrl = String(body.url || '')
    const method = (String(body.method || 'POST')).toUpperCase()
    const event = String(body.event || 'webhook.test')
    const secret = typeof body.secret === 'string' ? body.secret : ''

    let parsed
    try { parsed = new URL(targetUrl) } catch { return json({ error: 'URL ปลายทางไม่ถูกต้อง' }, 400, cors) }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return json({ error: 'รองรับเฉพาะ http:// หรือ https:// เท่านั้น' }, 400, cors)
    }
    const blockReason = await isBlockedTarget(parsed.hostname)
    if (blockReason) return json({ error: `ปฏิเสธการยิงไปยังปลายทางนี้ — ${blockReason}` }, 400, cors)

    const payload = {
      event,
      test: true,
      firedAt: new Date().toISOString(),
      firedBy: verified.email || verified.localId,
      sample: sampleDataFor(event),
    }
    const bodyStr = JSON.stringify(payload)
    const headers = { 'Content-Type': 'application/json', 'User-Agent': 'LAMOM-ONE-Webhook/1.0' }
    if (secret) headers['X-Webhook-Signature'] = await hmacSha256Hex(secret, bodyStr)

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    const startedAt = Date.now()
    try {
      const res = await fetch(parsed.toString(), { method, headers, body: method === 'GET' ? undefined : bodyStr, signal: controller.signal })
      clearTimeout(timer)
      const text = await res.text().catch(() => '')
      return json({
        ok: res.ok,
        status: res.status,
        durationMs: Date.now() - startedAt,
        responsePreview: text.slice(0, 500),
        payloadSent: payload,
      }, 200, cors)
    } catch (err) {
      clearTimeout(timer)
      const timedOut = err.name === 'AbortError'
      return json({ ok: false, status: 0, error: timedOut ? `หมดเวลารอ (${FETCH_TIMEOUT_MS / 1000} วินาที)` : (err.message || 'ยิง Webhook ไม่สำเร็จ'), payloadSent: payload }, 200, cors)
    }
  },
}

function sampleDataFor(event) {
  if (event.startsWith('sale.')) return { bookingNo: 'SK000000', custName: 'ทดสอบระบบ', model: 'ตัวอย่างรุ่นรถ', price: 1000000 }
  if (event.startsWith('service.')) return { jobNo: 'JOB-TEST-000', custName: 'ทดสอบระบบ', plate: 'ทท-0000' }
  if (event.startsWith('lead.')) return { name: 'ทดสอบระบบ', source: 'test' }
  if (event.startsWith('payment.') || event.startsWith('invoice.')) return { amount: 10000, currency: 'THB' }
  if (event.startsWith('customer.')) return { name: 'ทดสอบระบบ' }
  if (event.startsWith('stock.')) return { model: 'ตัวอย่างรุ่นรถ', qty: 1 }
  return { note: 'ข้อมูลตัวอย่างสำหรับทดสอบ Webhook' }
}

// ── กัน SSRF — ปฏิเสธ private/internal/loopback/link-local address ก่อนยิงเสมอ ──
export async function isBlockedTarget(hostname) {
  const h = hostname.toLowerCase()
  if (h === 'localhost' || h.endsWith('.localhost') || h === '0.0.0.0' || h.endsWith('.local')) return 'เป็น localhost/internal hostname'
  if (h === '169.254.169.254') return 'เป็น cloud metadata endpoint'
  // เป็น IPv4 literal ตรงๆ (ไม่ resolve DNS — เพียงพอสำหรับกันกรณีทั่วไปที่มักถูกใช้โจมตี ไม่ครอบคลุม DNS rebinding
  // แบบซับซ้อนซึ่งเกินขอบเขตของ webhook test-send tool ธรรมดา)
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (m) {
    const [a, b] = m.slice(1).map(Number)
    if (a === 127) return 'เป็น loopback address'
    if (a === 10) return 'เป็น private network address'
    if (a === 172 && b >= 16 && b <= 31) return 'เป็น private network address'
    if (a === 192 && b === 168) return 'เป็น private network address'
    if (a === 169 && b === 254) return 'เป็น link-local address'
  }
  if (h === '::1' || h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe80')) return 'เป็น IPv6 private/loopback address'
  return null
}

async function hmacSha256Hex(secret, message) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
  return [...new Uint8Array(sigBuf)].map(b => b.toString(16).padStart(2, '0')).join('')
}

async function verifyFirebaseToken(idToken, apiKey) {
  if (!apiKey) return null
  try {
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.users?.[0] || null
  } catch { return null }
}
async function isAuthorizedStaff(idToken, uid, env) {
  const projectId = env.FIREBASE_PROJECT_ID
  if (!projectId || !uid) return false
  try {
    const res = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${uid}`, {
      headers: { Authorization: `Bearer ${idToken}` },
    })
    if (!res.ok) return false
    const doc = await res.json()
    const f = doc.fields || {}
    const role = f.role?.stringValue || 'viewer'
    const expiresAt = f.accessExpiresAt?.timestampValue || null
    if (expiresAt && new Date(expiresAt).getTime() < Date.now()) return false
    return STAFF_ROLES.includes(role)
  } catch { return false }
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...headers } })
}
