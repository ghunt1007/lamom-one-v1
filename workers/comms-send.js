/**
 * LAMOM ONE — Comms Send Worker (SMS/Email/LINE/Push)
 * Deploy: wrangler deploy --config wrangler-comms-send.toml
 *
 * ทำไมต้องมี Worker นี้: เดิมปุ่ม "ส่ง" ในหน้า Broadcast/SMS Marketing ไม่เรียกผู้ให้บริการ
 * ส่งข้อความจริงเลยสักช่องทาง (ดู CHANGELOG v1.0.247) Worker นี้คือตัวกลางที่เรียก API จริง
 * ของ Twilio (SMS) / SendGrid (Email) / LINE Messaging API / Firebase Cloud Messaging (Push)
 * ให้ — เก็บ credential จริงเป็น secret ฝั่ง server เท่านั้น (ตั้งด้วย `wrangler secret put`)
 * ไม่ส่งให้ client เห็นเลย เหมือน pattern ai-proxy.js ฝั่ง client ส่งแค่ Firebase ID token
 * มายืนยันตัวตนแทน
 *
 * แต่ละช่องทางเปิดใช้งานอิสระต่อกันตามว่ามี secret ของช่องทางนั้นตั้งไว้หรือยัง — ถ้ายังไม่ตั้ง
 * จะตอบ "ยังไม่ได้ตั้งค่า" ตรงไปตรงมา (configured:false) แทนที่จะแกล้งทำเหมือนส่งสำเร็จ
 *
 * Binding/vars ที่ต้องตั้งใน Cloudflare Dashboard หรือ wrangler-comms-send.toml:
 *   Var:    FIREBASE_API_KEY          (Firebase Web API key — public, ใช้ verify ID token เท่านั้น)
 *   Var:    ALLOWED_ORIGIN            (origin ของแอปจริง เช่น https://lamom-one.pages.dev)
 *   Secret: TWILIO_ACCOUNT_SID        (wrangler secret put TWILIO_ACCOUNT_SID)
 *   Secret: TWILIO_AUTH_TOKEN
 *   Secret: TWILIO_FROM_NUMBER        (เบอร์ Twilio รูปแบบ E.164 เช่น +15017122661)
 *   Secret: SENDGRID_API_KEY
 *   Secret: SENDGRID_FROM_EMAIL       (ต้องผ่าน Sender/Domain Authentication ของ SendGrid แล้ว)
 *   Secret: LINE_CHANNEL_ACCESS_TOKEN (จาก LINE Official Account Manager > Messaging API)
 *   Secret: FCM_SERVICE_ACCOUNT_JSON  (JSON key ทั้งไฟล์ของ Firebase service account แบบ string เดียว)
 */

const CHUNK_SIZE = 20 // ส่งเป็นชุดละเท่านี้ กัน subrequest ค้างพร้อมกันเยอะเกินไปใน 1 invocation

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
    if (request.method !== 'POST') return json({ error: 'Not found' }, 404, cors)

    const auth = request.headers.get('Authorization') || ''
    const idToken = auth.startsWith('Bearer ') ? auth.slice(7) : ''
    if (!idToken) return json({ error: 'Unauthorized — missing token' }, 401, cors)

    const verified = await verifyFirebaseToken(idToken, env.FIREBASE_API_KEY)
    if (!verified) return json({ error: 'Unauthorized — invalid token' }, 401, cors)

    let body
    try { body = await request.json() } catch { body = {} }

    try {
      if (url.pathname === '/send/sms') return json(await sendSms(env, body), 200, cors)
      if (url.pathname === '/send/email') return json(await sendEmail(env, body), 200, cors)
      if (url.pathname === '/send/line') return json(await sendLine(env, body), 200, cors)
      if (url.pathname === '/send/push') return json(await sendPush(env, body), 200, cors)
      return json({ error: 'Not found' }, 404, cors)
    } catch (err) {
      return json({ error: err.message || 'Send error' }, 500, cors)
    }
  },
}

// ── ส่งเป็นชุดๆ พร้อมนับผลจริง (ไม่สุ่ม) ─────────────────────────────
async function sendInChunks(items, sendOne) {
  let sent = 0, failed = 0
  const errors = []
  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    const chunk = items.slice(i, i + CHUNK_SIZE)
    const results = await Promise.allSettled(chunk.map(sendOne))
    results.forEach((r, idx) => {
      if (r.status === 'fulfilled' && r.value?.ok) { sent++ }
      else { failed++; errors.push({ target: chunk[idx], error: r.status === 'fulfilled' ? r.value?.error : String(r.reason) }) }
    })
  }
  return { sent, failed, errors }
}

// ── SMS (Twilio) ─────────────────────────────────────────────────
async function sendSms(env, { recipients = [], message = '' }) {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_FROM_NUMBER) {
    return { configured: false, error: 'SMS ยังไม่ได้ตั้งค่า (ต้องตั้ง secret TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM_NUMBER)' }
  }
  if (!recipients.length) return { configured: true, sent: 0, failed: 0, errors: [] }

  const authHeader = 'Basic ' + btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`)
  const result = await sendInChunks(recipients, async (to) => {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: authHeader, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ To: to, From: env.TWILIO_FROM_NUMBER, Body: message }),
    })
    if (res.ok) return { ok: true }
    const data = await res.json().catch(() => ({}))
    return { ok: false, error: data.message || `Twilio ${res.status}` }
  })
  return { configured: true, ...result }
}

// ── Email (SendGrid) ─────────────────────────────────────────────
async function sendEmail(env, { recipients = [], subject = '', message = '' }) {
  if (!env.SENDGRID_API_KEY || !env.SENDGRID_FROM_EMAIL) {
    return { configured: false, error: 'Email ยังไม่ได้ตั้งค่า (ต้องตั้ง secret SENDGRID_API_KEY / SENDGRID_FROM_EMAIL)' }
  }
  if (!recipients.length) return { configured: true, sent: 0, failed: 0, errors: [] }

  const result = await sendInChunks(recipients, async (to) => {
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.SENDGRID_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: env.SENDGRID_FROM_EMAIL, name: env.SENDGRID_FROM_NAME || 'LAMOM ONE' },
        subject,
        content: [{ type: 'text/plain', value: message }],
      }),
    })
    if (res.ok) return { ok: true }
    const data = await res.json().catch(() => ({}))
    return { ok: false, error: data.errors?.[0]?.message || `SendGrid ${res.status}` }
  })
  return { configured: true, ...result }
}

// ── LINE (Messaging API — Broadcast เท่านั้น ส่งถึงเพื่อน OA ทุกคน) ──
// หมายเหตุสำคัญ: ระบบยังไม่มีการเก็บ LINE userId รายบุคคลของลูกค้า (ฟิลด์ lineId ในแอปเป็นแค่
// LINE ID ที่ลูกค้ากรอกเอง ไม่ใช่ userId ที่ผูกกับ Messaging API ใช้ยิงหาเฉพาะคนได้) จึงรองรับ
// แค่ broadcast ถึงเพื่อน OA ทั้งหมดเท่านั้น — ส่งแบบเจาะกลุ่มเป้าหมายเฉพาะยังทำไม่ได้จริงตอนนี้
async function sendLine(env, { message = '' }) {
  if (!env.LINE_CHANNEL_ACCESS_TOKEN) {
    return { configured: false, error: 'LINE ยังไม่ได้ตั้งค่า (ต้องตั้ง secret LINE_CHANNEL_ACCESS_TOKEN)' }
  }
  const res = await fetch('https://api.line.me/v2/bot/message/broadcast', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [{ type: 'text', text: message }] }),
  })
  if (res.ok) return { configured: true, sent: 1, failed: 0, errors: [], broadcast: true }
  const data = await res.json().catch(() => ({}))
  return { configured: true, sent: 0, failed: 1, errors: [{ error: data.message || `LINE ${res.status}` }], broadcast: true }
}

// ── Push (Firebase Cloud Messaging v1 API) ───────────────────────
// หมายเหตุสำคัญ: แอปนี้ยังไม่มีระบบให้ลูกค้าลงทะเบียนรับ Push (ต้องมี service worker ขอสิทธิ์
// แจ้งเตือน + เก็บ FCM token ต่อเครื่องก่อน — ยังไม่มีอยู่ในแอปตอนนี้) route นี้จึงพร้อมใช้งานจริง
// ในเชิงเทคนิค แต่ tokens ที่ส่งมาจะว่างเปล่าเสมอจนกว่าจะสร้างระบบเก็บ token นั้นก่อน
async function sendPush(env, { tokens = [], title = '', message = '' }) {
  if (!env.FCM_SERVICE_ACCOUNT_JSON) {
    return { configured: false, error: 'Push ยังไม่ได้ตั้งค่า (ต้องตั้ง secret FCM_SERVICE_ACCOUNT_JSON)' }
  }
  if (!tokens.length) {
    return { configured: true, sent: 0, failed: 0, errors: [], note: 'ยังไม่มีลูกค้าลงทะเบียนรับ Push Notification ในระบบ' }
  }
  const fcm = await getFcmAccessToken(env)
  if (!fcm) return { configured: true, sent: 0, failed: tokens.length, errors: [{ error: 'ขอ FCM access token ไม่สำเร็จ (ตรวจสอบ FCM_SERVICE_ACCOUNT_JSON)' }] }

  const result = await sendInChunks(tokens, async (token) => {
    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${fcm.projectId}/messages:send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${fcm.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: { token, notification: { title, body: message } } }),
    })
    if (res.ok) return { ok: true }
    const data = await res.json().catch(() => ({}))
    return { ok: false, error: data.error?.message || `FCM ${res.status}` }
  })
  return { configured: true, ...result }
}

async function getFcmAccessToken(env) {
  let sa
  try { sa = JSON.parse(env.FCM_SERVICE_ACCOUNT_JSON) } catch { return null }
  if (!sa.client_email || !sa.private_key || !sa.project_id) return null

  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const claim = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now, exp: now + 3600,
  }
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claim))}`

  let signature
  try {
    const key = await importPkcs8(sa.private_key)
    const sigBuf = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned))
    signature = b64urlFromBuffer(sigBuf)
  } catch { return null }

  const jwt = `${unsigned}.${signature}`
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${jwt}`,
  })
  if (!res.ok) return null
  const data = await res.json()
  if (!data.access_token) return null
  return { accessToken: data.access_token, projectId: sa.project_id }
}

async function importPkcs8(pem) {
  const body = pem.replace(/-----BEGIN PRIVATE KEY-----/, '').replace(/-----END PRIVATE KEY-----/, '').replace(/\s+/g, '')
  const binary = atob(body)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return crypto.subtle.importKey('pkcs8', bytes.buffer, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
}

function b64url(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function b64urlFromBuffer(buf) {
  let binary = ''
  const bytes = new Uint8Array(buf)
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
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

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...headers } })
}
