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
 *   Var:    ALLOWED_ORIGIN        (origin ของแอปจริง เช่น https://lamom-one.pages.dev)
 */

const MODEL = 'gemini-2.5-flash'

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

    if (!env.GEMINI_API_KEY) return json({ error: 'AI proxy not configured (missing GEMINI_API_KEY secret)' }, 500, cors)

    try {
      if (url.pathname === '/generate') {
        const body = await request.json()
        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${env.GEMINI_API_KEY}`,
          { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
        )
        const data = await geminiRes.text()
        return new Response(data, { status: geminiRes.status, headers: { 'Content-Type': 'application/json', ...cors } })
      }

      if (url.pathname === '/generate-stream') {
        const body = await request.json()
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
