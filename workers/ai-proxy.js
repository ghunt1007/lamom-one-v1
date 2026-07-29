/**
 * LAMOM ONE — AI Proxy Worker (Gemini)
 * Deploy: wrangler deploy --config wrangler-ai-proxy.toml
 *
 * ทำไมต้องมี Worker นี้: เดิม src/utils/ai.js เรียก Gemini API ตรงจาก browser
 * ด้วย VITE_GEMINI_API_KEY ซึ่งเป็นตัวแปร Vite แปลว่าค่าจริงถูกฝังลงใน JS bundle
 * สาธารณะที่ deploy ไป Cloudflare Pages — ใครก็เปิด DevTools/โหลดไฟล์ .js มาดูได้
 * (พบระหว่างตรวจสอบความปลอดภัยของแอป) Worker นี้ทำหน้าที่เป็นตัวกลาง: เก็บ API key
 * จริงไว้เป็น secret ฝั่ง server (ตั้งด้วย `wrangler secret put GEMINI_API_KEY`)
 * ไม่ส่งให้ client เห็นเลย ฝั่ง client ส่งแค่ Firebase ID token มายืนยันตัวตนแทน
 *
 * Binding/vars ที่ต้องตั้งใน Cloudflare Dashboard หรือ wrangler-ai-proxy.toml:
 *   Secret: GEMINI_API_KEY        (wrangler secret put GEMINI_API_KEY)
 *   Var:    FIREBASE_API_KEY      (Firebase Web API key — public, ใช้ verify ID token เท่านั้น)
 *   Var:    FIREBASE_PROJECT_ID   (Firebase/Firestore project id เช่น "lamom-one-v1" — ใช้เช็ค role พนักงานจริง)
 *   Var:    ALLOWED_ORIGIN        (origin ของแอปจริง เช่น https://lamom-one.pages.dev)
 */

const MODEL = 'gemini-2.5-flash'
// เดิมไม่มีการจำกัดขนาด request หรือความถี่การเรียกต่อบัญชีเลย — ต่อให้ตรวจ role พนักงานแล้ว (แก้ไปแล้วรอบก่อน)
// บัญชีเดียวที่ถูกขโมย/ใช้สคริปต์เรียกซ้ำๆ ก็ยังส่ง prompt ขนาดใหญ่รัว ๆ ได้ไม่จำกัด ทำให้ค่าใช้จ่าย Gemini
// (คิดตาม token) พุ่งจนควบคุมไม่ได้ แก้ให้จำกัดทั้งขนาด request และความถี่ต่อบัญชี
const MAX_BODY_BYTES = 200_000 // ~200KB ต่อ request เพียงพอสำหรับ prompt/บทสนทนาจริงในแอป
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX_CALLS = 30 // ต่อบัญชีต่อนาที — ฟีเจอร์ AI ในแอปเรียกบ่อยกว่า SMS/Email ปกติ
const rateLimitLog = new Map() // uid -> timestamps[] — ชั้นป้องกันแรกในหน่วยความจำของ isolate เดียว
function checkRateLimit(uid) {
  const now = Date.now()
  const hits = (rateLimitLog.get(uid) || []).filter(t => now - t < RATE_LIMIT_WINDOW_MS)
  if (hits.length >= RATE_LIMIT_MAX_CALLS) return false
  hits.push(now)
  rateLimitLog.set(uid, hits)
  return true
}
// เฉพาะเทสใช้เคลียร์ตัวนับระหว่างเคส (rateLimitLog เป็น module-level singleton ข้ามหลาย it() ในไฟล์เดียว)
export function __resetRateLimit() { rateLimitLog.clear() }

// เดิม verifyFirebeToken() เช็คแค่ว่า token เป็นของบัญชี Firebase จริง ไม่เคยเช็คว่าบัญชีนั้นเป็น "พนักงานที่
// อนุมัติแล้ว" หรือเปล่า — ใครก็สมัครบัญชีเองจากหน้า Login ได้ (ได้ role:'pending' ตามค่าเริ่มต้น) แล้วใช้
// token ที่ถูกต้องเรียก AI API (มีค่าใช้จ่ายจริง) ได้ทันที แก้ให้เช็ค role จริงจาก Firestore ก่อนอนุญาต
const STAFF_ROLES = ['owner', 'admin', 'manager', 'sales', 'service', 'finance', 'hr', 'staff']
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

    // ยืนยันตัวตนจริงด้วย Firebase ID token — เรียก accounts:lookup ของ Firebase
    // (ใช้ FIREBASE_API_KEY ซึ่งเป็น public key ปลอดภัย ไม่ใช่ secret) ถ้า token ปลอมหรือหมดอายุ
    // Firebase จะตอบ error กลับมา ปฏิเสธ request ทันทีก่อนแตะ Gemini API เลย
    const auth = request.headers.get('Authorization') || ''
    const idToken = auth.startsWith('Bearer ') ? auth.slice(7) : ''
    if (!idToken) return json({ error: 'Unauthorized — missing token' }, 401, cors)

    const verified = await verifyFirebaseToken(idToken, env.FIREBASE_API_KEY)
    if (!verified) return json({ error: 'Unauthorized — invalid token' }, 401, cors)
    if (!(await isAuthorizedStaff(idToken, verified.localId, env))) {
      return json({ error: 'Unauthorized — บัญชีนี้ยังไม่ได้รับอนุมัติให้เป็นพนักงาน' }, 403, cors)
    }
    if (!checkRateLimit(verified.localId)) {
      return json({ error: `เรียกใช้ AI บ่อยเกินไป — จำกัด ${RATE_LIMIT_MAX_CALLS} ครั้ง/นาทีต่อบัญชี กรุณารอสักครู่แล้วลองใหม่` }, 429, cors)
    }

    if (!env.GEMINI_API_KEY) return json({ error: 'AI proxy not configured (missing GEMINI_API_KEY secret)' }, 500, cors)

    const rawBody = await request.text()
    if (rawBody.length > MAX_BODY_BYTES) {
      return json({ error: `ข้อความ/prompt ใหญ่เกินไป (สูงสุด ${Math.round(MAX_BODY_BYTES / 1000)}KB)` }, 400, cors)
    }
    let body
    try { body = JSON.parse(rawBody) } catch { body = {} }

    try {
      if (url.pathname === '/generate') {
        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${env.GEMINI_API_KEY}`,
          { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
        )
        const data = await geminiRes.text()
        return new Response(data, { status: geminiRes.status, headers: { 'Content-Type': 'application/json', ...cors } })
      }

      // RAG (Phase 3): แปลงข้อความเป็น vector สำหรับ index/ค้นหาความรู้ภายใน (SOP/คู่มือ/Product Knowledge)
      if (url.pathname === '/embed') {
        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${env.GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: { parts: [{ text: body.text || '' }] },
              taskType: body.taskType || 'RETRIEVAL_DOCUMENT',
              outputDimensionality: 768,
            }),
          }
        )
        const data = await geminiRes.text()
        return new Response(data, { status: geminiRes.status, headers: { 'Content-Type': 'application/json', ...cors } })
      }

      if (url.pathname === '/generate-stream') {
        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:streamGenerateContent?key=${env.GEMINI_API_KEY}&alt=sse`,
          { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
        )
        // ส่งต่อ SSE stream ตรงๆ ไม่ต้อง buffer ทั้งหมด — ให้ client เห็น token แบบ real-time เหมือนเดิม
        return new Response(geminiRes.body, {
          status: geminiRes.status,
          headers: { 'Content-Type': 'text/event-stream', ...cors },
        })
      }

      return json({ error: 'Not found' }, 404, cors)
    } catch (err) {
      return json({ error: err.message || 'Proxy error' }, 500, cors)
    }
  },
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
