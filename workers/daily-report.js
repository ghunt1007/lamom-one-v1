/**
 * LAMOM ONE — Daily Report Worker (Telegram + LINE)
 * Deploy: wrangler deploy --config wrangler-daily-report.toml
 *
 * ทำไมต้องเป็น Worker แยกจาก comms-send.js: รายงานนี้ต้องทำงาน "เอง" ทุกวันตาม Cron Trigger โดยไม่มีใคร
 * ล็อกอินอยู่เลย — ต่างจาก comms-send.js ที่ทุก request ต้องมี Firebase ID token ของพนักงานที่ล็อกอินอยู่
 * ยืนยันตัวตนก่อนเสมอ Worker นี้จึงต้องอ่าน Firestore เองด้วย Firebase Service Account (เซ็น JWT ขอ access
 * token เอง) แทนที่จะพึ่ง token ของใคร — ใช้ pattern เดียวกับ getFcmAccessToken() ใน comms-send.js เป๊ะๆ
 * (เปลี่ยนแค่ scope จาก firebase.messaging เป็น datastore) แต่ละไฟล์ worker ในโปรเจกต์นี้ตั้งใจให้ยืนอ่าน
 * เข้าใจได้ครบในตัวเอง (ไม่แชร์โมดูลข้ามไฟล์) จึงคัดลอก helper พวกนี้มาแทนที่จะ import จาก comms-send.js
 *
 * Binding/vars ที่ต้องตั้งใน Cloudflare Dashboard หรือ wrangler-daily-report.toml:
 *   Var:    FIREBASE_PROJECT_ID            (เช่น "lamom-one-v1")
 *   Var:    FIREBASE_API_KEY               (Firebase Web API key — public, ใช้ verify ID token เท่านั้น)
 *   Var:    ALLOWED_ORIGIN                 (origin ของแอปจริง เช่น https://lamom-one.pages.dev)
 *   Secret: FIRESTORE_SERVICE_ACCOUNT_JSON (JSON key ทั้งไฟล์ของ Firebase service account แบบ string เดียว —
 *                                            Firebase Console > Project Settings > Service Accounts >
 *                                            Generate new private key)
 *   Secret: TELEGRAM_BOT_TOKEN             (จาก @BotFather ใน Telegram)
 *   Secret: TELEGRAM_CHAT_ID               (chat id ปลายทาง — เปิด https://api.telegram.org/bot<TOKEN>/getUpdates
 *                                            หลังทักบอทไปสักข้อความ จะเห็น "chat":{"id":...})
 *   Secret: LINE_CHANNEL_ACCESS_TOKEN      (LINE Developers Console > Messaging API — ใช้ตัวเดียวกับ
 *                                            comms-send.js ได้ถ้าเป็น LINE OA เดียวกัน)
 *   Secret: LINE_CHANNEL_SECRET            (ใช้ตรวจลายเซ็น webhook เท่านั้น — คนละค่ากับ Channel Access Token)
 *   Secret: LINE_TARGET_ID (ไม่บังคับ)      (LINE userId ปลายทาง — ถ้าไม่ตั้งเอง worker จะจับให้อัตโนมัติจาก
 *                                            webhook ครั้งแรกที่มีคนทัก LINE OA แล้วเก็บไว้ใน Firestore
 *                                            doc system_integrations/line_daily_report แทน — ต้องตั้ง webhook
 *                                            URL ของ worker นี้ (…/line/webhook) ไว้ใน LINE Console ก่อน)
 *
 * แต่ละช่องทาง (Telegram/LINE) เปิดใช้งานอิสระต่อกัน — ถ้ายังไม่ตั้ง secret ของช่องทางไหนจะข้ามช่องทางนั้น
 * ไปแบบรายงานสถานะ configured:false ตรงๆ (ไม่ throw จนพังทั้งงาน) ตาม pattern เดียวกับ comms-send.js
 */

const FIRESTORE_SCOPE = 'https://www.googleapis.com/auth/datastore'
const FINAL_BOOKING_STATUS = ['ส่งมอบแล้ว', 'ถอนจอง']
const STAFF_ROLES = ['owner', 'admin', 'manager', 'sales', 'service', 'finance', 'hr', 'staff']

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const origin = env.ALLOWED_ORIGIN || '*'
    const cors = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors })

    try {
      if (request.method === 'POST' && url.pathname === '/line/webhook') return await handleLineWebhook(request, env, cors)
      if (url.pathname === '/test-send') return await handleTestSend(request, env, cors)
      if (url.pathname === '/preview') return await handlePreview(request, env, cors)
      return json({ error: 'Not found' }, 404, cors)
    } catch (err) {
      return json({ error: err.message || 'Daily report worker error' }, 500, cors)
    }
  },

  // Cron Trigger เรียกจุดนี้ตามตารางเวลาใน wrangler-daily-report.toml (ไม่มี HTTP request ผูกมาด้วยเลย)
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runDailyReport(env))
  },
}

// ── รายงานหลัก — ใช้ร่วมกันทั้ง scheduled() และ /test-send ─────────────────────
async function runDailyReport(env) {
  const accessToken = await getFirestoreAccessToken(env)
  if (!accessToken) return { error: 'อ่าน Firestore ไม่ได้ — ตรวจสอบ secret FIRESTORE_SERVICE_ACCOUNT_JSON' }
  const text = await buildReportText(env, accessToken)
  const [telegram, line] = await Promise.all([
    sendTelegram(env, text),
    sendLineTarget(env, accessToken, text),
  ])
  return { text, telegram, line }
}

async function handleTestSend(request, env, cors) {
  const auth = await requireStaff(request, env)
  if (auth.error) return json({ error: auth.error }, auth.status, cors)
  return json(await runDailyReport(env), 200, cors)
}

async function handlePreview(request, env, cors) {
  const auth = await requireStaff(request, env)
  if (auth.error) return json({ error: auth.error }, auth.status, cors)
  const accessToken = await getFirestoreAccessToken(env)
  if (!accessToken) return json({ error: 'อ่าน Firestore ไม่ได้ — ตรวจสอบ secret FIRESTORE_SERVICE_ACCOUNT_JSON' }, 500, cors)
  return json({ text: await buildReportText(env, accessToken) }, 200, cors)
}

// ── LINE webhook — จับ userId ของคนที่ทัก LINE OA มาเก็บเป็นปลายทางส่งรายงาน ──────
// ทำไมต้องมีจุดนี้: LINE Messaging API "push" (ส่งเจาะจงคนเดียว ไม่ broadcast หาลูกค้าทุกคน — ตามที่เลือกไว้)
// ต้องรู้ userId ปลายทางก่อนเสมอ แต่เจ้าของระบบไม่มีทางรู้ userId ของตัวเองในแอป LINE ได้เองตรงๆ วิธีที่ LINE
// ให้มาคือรับ userId จาก webhook event ตอนมีคนทักแชทกับ OA เท่านั้น — endpoint นี้เก็บ userId แรกที่ทักมา
// ไว้ใน Firestore (system_integrations/line_daily_report) แล้วตอบกลับยืนยันให้รู้ว่าลงทะเบียนสำเร็จ
async function handleLineWebhook(request, env, cors) {
  const rawBody = await request.text()
  const signature = request.headers.get('X-Line-Signature') || ''
  if (!(await verifyLineSignature(rawBody, signature, env.LINE_CHANNEL_SECRET))) {
    return json({ error: 'Invalid signature' }, 401, cors)
  }
  let body
  try { body = JSON.parse(rawBody) } catch { body = {} }
  const events = Array.isArray(body.events) ? body.events : []
  const accessToken = await getFirestoreAccessToken(env)
  for (const ev of events) {
    const userId = ev.source?.userId
    if (userId && accessToken) await writeLineTarget(env, accessToken, userId)
    if (ev.replyToken && env.LINE_CHANNEL_ACCESS_TOKEN) {
      await fetch('https://api.line.me/v2/bot/message/reply', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ replyToken: ev.replyToken, messages: [{ type: 'text', text: '✅ ลงทะเบียนรับรายงานประจำวัน LAMOM ONE เรียบร้อยแล้วครับ' }] }),
      }).catch(() => {})
    }
  }
  return json({ ok: true }, 200, cors)
}

async function verifyLineSignature(rawBody, signature, channelSecret) {
  if (!channelSecret || !signature) return false
  try {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(channelSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody))
    let binary = ''
    new Uint8Array(sigBuf).forEach(b => { binary += String.fromCharCode(b) })
    return btoa(binary) === signature
  } catch { return false }
}

// ── เนื้อหารายงาน — ดึงเลขเดียวกับที่ Dashboard.js ใช้จริง (bookingDate/actualDeliveryDate/status ฯลฯ) ──
// ไม่ใช้ where()+orderBy() คนละฟิลด์ (ต้องมี composite index — ปัญหาที่เจอซ้ำหลายรอบในโปรเจกต์นี้) ดึงมา
// เรียงตาม field เดียวแล้วกรองวันที่ฝั่งนี้แทน เหมือน listDocs()/pattern ฝั่ง client ทั้งหมด
async function buildReportText(env, accessToken) {
  const today = todayBangkok()
  const thisMonth = today.slice(0, 7)
  const [bookingsRaw, jobsRaw] = await Promise.all([
    runQuery(env, accessToken, 'bookings', 'bookingDate', 'DESCENDING', 1000),
    runQuery(env, accessToken, 'job_cards', 'createdAt', 'DESCENDING', 500),
  ])
  const bookings = bookingsRaw.filter(b => !b.deleted)
  const jobs = jobsRaw.filter(j => !j.deleted)

  const newToday = bookings.filter(b => (b.bookingDate || '').startsWith(today))
  const deliveredToday = bookings.filter(b => b.status === 'ส่งมอบแล้ว' && (b.actualDeliveryDate || '').startsWith(today))
  const monthBookings = bookings.filter(b => (b.bookingDate || '').startsWith(thisMonth) && b.status !== 'ถอนจอง')
  const stuck = bookings.filter(b => !FINAL_BOOKING_STATUS.includes(b.status) && b.bookingDate && daysSinceBangkok(b.bookingDate) >= 14)
  const jobsToday = jobs.filter(j => (j.createdAt || '').startsWith(today))
  const jobsActive = jobs.filter(j => !['done', 'delivered'].includes(j.status))

  const newTotal = newToday.reduce((s, b) => s + (b.price || 0), 0)
  const monthTotal = monthBookings.reduce((s, b) => s + (b.price || 0), 0)

  return [
    '📊 รายงานประจำวัน — LAMOM ONE',
    `📅 ${formatThaiDate(today)}`,
    '',
    `📝 จองใหม่วันนี้: ${newToday.length} คัน (฿${newTotal.toLocaleString()})`,
    `✅ ส่งมอบวันนี้: ${deliveredToday.length} คัน`,
    `🔧 Job Card เปิดวันนี้: ${jobsToday.length} งาน`,
    `🔧 งานซ่อมค้างอยู่ (ยังไม่เสร็จ/ยังไม่ส่งคืน): ${jobsActive.length} งาน`,
    `⏳ ใบจองค้างเกิน 14 วัน: ${stuck.length} รายการ`,
    `💰 ยอดขายสะสมเดือนนี้: ฿${monthTotal.toLocaleString()} (${monthBookings.length} คัน)`,
  ].join('\n')
}

// ── ส่ง Telegram ────────────────────────────────────────────────
async function sendTelegram(env, text) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    return { configured: false, error: 'Telegram ยังไม่ได้ตั้งค่า (ต้องตั้ง secret TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID)' }
  }
  const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text }),
  })
  if (res.ok) return { configured: true, sent: true }
  const data = await res.json().catch(() => ({}))
  return { configured: true, sent: false, error: data.description || `Telegram ${res.status}` }
}

// ── ส่ง LINE — push เจาะจงคนเดียว (ไม่ broadcast หาลูกค้า ตามที่เลือกไว้) ──────────
async function sendLineTarget(env, accessToken, text) {
  if (!env.LINE_CHANNEL_ACCESS_TOKEN) {
    return { configured: false, error: 'LINE ยังไม่ได้ตั้งค่า (ต้องตั้ง secret LINE_CHANNEL_ACCESS_TOKEN)' }
  }
  const targetId = env.LINE_TARGET_ID || await readLineTarget(env, accessToken)
  if (!targetId) {
    return { configured: true, sent: false, error: 'ยังไม่มี LINE User ID ปลายทาง — ตั้ง webhook URL ของ worker นี้ (…/line/webhook) ไว้ใน LINE Console แล้วทัก LINE OA ครั้งแรก ระบบจะจับ userId ให้อัตโนมัติ' }
  }
  const res = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: targetId, messages: [{ type: 'text', text }] }),
  })
  if (res.ok) return { configured: true, sent: true }
  const data = await res.json().catch(() => ({}))
  return { configured: true, sent: false, error: data.message || `LINE ${res.status}` }
}

async function readLineTarget(env, accessToken) {
  if (!accessToken) return null
  try {
    const res = await fetch(`https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/system_integrations/line_daily_report`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) return null
    const doc = await res.json()
    return doc.fields?.userId?.stringValue || null
  } catch { return null }
}
async function writeLineTarget(env, accessToken, userId) {
  try {
    await fetch(`https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/system_integrations/line_daily_report`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { userId: { stringValue: userId }, capturedAt: { timestampValue: new Date().toISOString() } } }),
    })
  } catch { /* ครั้งหน้าทักมาใหม่ก็จับได้อีก ไม่ critical ถ้าครั้งนี้เขียนไม่สำเร็จ */ }
}

// ── Firestore REST — runQuery (orderBy เดียว ไม่มี where — กัน composite index) ──
async function runQuery(env, accessToken, collectionId, orderField, direction, limit) {
  const res = await fetch(`https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents:runQuery`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId }],
        orderBy: [{ field: { fieldPath: orderField }, direction }],
        limit,
      },
    }),
  })
  if (!res.ok) throw new Error(`Firestore runQuery(${collectionId}) ${res.status}`)
  const rows = await res.json()
  return (Array.isArray(rows) ? rows : []).filter(r => r.document).map(r => docToObject(r.document))
}
function docToObject(doc) {
  const obj = { id: doc.name.split('/').pop() }
  for (const [k, v] of Object.entries(doc.fields || {})) obj[k] = decodeFsValue(v)
  return obj
}
export function decodeFsValue(v) {
  if (v.stringValue !== undefined) return v.stringValue
  if (v.integerValue !== undefined) return Number(v.integerValue)
  if (v.doubleValue !== undefined) return v.doubleValue
  if (v.booleanValue !== undefined) return v.booleanValue
  if (v.timestampValue !== undefined) return v.timestampValue
  if (v.nullValue !== undefined) return null
  if (v.mapValue !== undefined) {
    const o = {}
    for (const [k, vv] of Object.entries(v.mapValue.fields || {})) o[k] = decodeFsValue(vv)
    return o
  }
  if (v.arrayValue !== undefined) return (v.arrayValue.values || []).map(decodeFsValue)
  return null
}

// ── Firebase Service Account → Firestore access token (เหมือน getFcmAccessToken() ใน comms-send.js) ──
async function getFirestoreAccessToken(env) {
  let sa
  try { sa = JSON.parse(env.FIRESTORE_SERVICE_ACCOUNT_JSON) } catch { return null }
  if (!sa.client_email || !sa.private_key) return null

  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const claim = { iss: sa.client_email, scope: FIRESTORE_SCOPE, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }
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
  return data.access_token || null
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
  new Uint8Array(buf).forEach(b => { binary += String.fromCharCode(b) })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// ── Firebase ID token auth (เหมือน comms-send.js — ใช้กับ /test-send และ /preview เท่านั้น) ──
async function requireStaff(request, env) {
  const authHeader = request.headers.get('Authorization') || ''
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!idToken) return { error: 'Unauthorized — missing token', status: 401 }
  const verified = await verifyFirebaseToken(idToken, env.FIREBASE_API_KEY)
  if (!verified) return { error: 'Unauthorized — invalid token', status: 401 }
  if (!(await isAuthorizedStaff(idToken, verified.localId, env))) {
    return { error: 'Unauthorized — บัญชีนี้ยังไม่ได้รับอนุมัติให้เป็นพนักงาน', status: 403 }
  }
  return { uid: verified.localId }
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

// ── วันที่ตามเวลาไทยจริง (Cloudflare Workers รันเป็น UTC เสมอ) — export ไว้เพื่อเทสตรงๆ ─────────
export function todayBangkok() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}
export function daysSinceBangkok(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const then = Date.UTC(y, m - 1, d)
  const [ty, tm, td] = todayBangkok().split('-').map(Number)
  const now = Date.UTC(ty, tm - 1, td)
  return Math.floor((now - then) / 86400000)
}
export function formatThaiDate(dateStr) {
  const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
  const [y, m, d] = dateStr.split('-').map(Number)
  return `${d} ${months[m - 1]} ${y + 543}`
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...headers } })
}
