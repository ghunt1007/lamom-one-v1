/**
 * LAMOM ONE — Cloudflare R2 Upload Worker
 * Deploy: wrangler deploy --config wrangler.toml
 *
 * Binding ใน Cloudflare Dashboard:
 *   Worker > Settings > Bindings > R2 Bucket
 *   Variable name: BUCKET
 *   R2 bucket: lamom-files
 *   Var: FIREBASE_API_KEY — Firebase Web API key (public, ใช้ verify ID token เท่านั้น)
 *   Var: FIREBASE_PROJECT_ID — Firebase/Firestore project id เช่น "lamom-one-v1" (ใช้เช็ค role พนักงานจริง)
 *   Var: ALLOWED_ORIGIN — origin ของแอปจริง เช่น https://lamom-one.pages.dev (จำกัด CORS ของ /upload, /delete)
 *
 * เดิมมี env var REQUIRE_AUTH="false" ที่ปิดการตรวจสอบสิทธิ์ไปเลย (ปิดถาวรจากที่ตั้งไว้ตอน
 * dev ครั้งแรกแล้วไม่ได้เปิดคืน) และแม้เปิดไว้ก็เช็คแค่ว่า header ขึ้นต้นด้วย "Bearer " เท่านั้น
 * ไม่ได้ตรวจสอบว่า token จริงหรือปลอม — เท่ากับใครก็อัปโหลด/ลบไฟล์ในบัคเก็ตจริงได้โดยไม่ต้อง
 * เป็นพนักงาน ตอนนี้ตรวจสอบ Firebase ID token จริงกับ Firebase ทุกครั้งก่อนอัปโหลด/ลบเสมอ
 *
 * เดิม publicUrl ชี้ไป https://files.lamom.one/... (custom domain ที่ตั้งใจจะผูกกับ R2 bucket
 * โดยตรง) แต่โดเมนนี้ไม่มีอยู่จริง (NXDOMAIN — ไม่เคยตั้งค่า DNS/custom domain เลย) ทำให้ไฟล์ทุก
 * ไฟล์ที่อัปโหลดไปก่อนหน้านี้มี URL ใช้งานไม่ได้ ตอนนี้เปลี่ยนไปเสิร์ฟผ่าน endpoint /file ของ
 * Worker นี้เอง (ทดสอบแล้วว่าทำงานได้จริงกับ bucket จริง) แทน ไม่ต้องรอตั้งค่า custom domain เพิ่ม
 */

// เดิม verifyFirebaseToken() เช็คแค่ว่า token เป็นของบัญชี Firebase จริง (ไม่ใช่ token ปลอม) แต่ไม่เคยเช็คว่า
// บัญชีนั้นเป็น "พนักงานที่อนุมัติแล้ว" หรือเปล่าเลย — ใครก็สมัครบัญชีเองจากหน้า Login ได้ (ได้ role:'pending'
// ตามค่าเริ่มต้นใน Firestore Rules) แล้วใช้ token ที่ถูกต้องนั้นเรียก /upload, /delete ได้ทันทีทั้งที่ยังไม่ได้
// รับอนุมัติ แก้ให้เช็ค role จริงจาก Firestore ก่อนอนุญาต (ใช้ ID token เดิมอ่าน users/{uid} ของตัวเอง ซึ่ง
// Firestore Rules อนุญาตให้เจ้าของอ่านเอกสารตัวเองได้อยู่แล้ว ไม่ต้องมี service account เพิ่ม)
// เดิมไม่มีการจำกัดความถี่การอัปโหลด/ลบต่อบัญชีเลย — บัญชีเดียวที่ถูกขโมย/ใช้สคริปต์วน loop ก็ยัง
// อัปโหลดไฟล์ 50MB (MAX_SIZE) ซ้ำๆไม่จำกัดจำนวนครั้งได้ ทำให้ค่าใช้จ่าย R2 storage พุ่งจนควบคุมไม่ได้
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX_CALLS = 20 // ต่อบัญชีต่อนาที (อัปโหลด+ลบรวมกัน)
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

const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/msword', // .doc (เอกสารเก่า)
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls (เอกสารเก่า)
  'text/csv',
  'video/mp4',
  // เสียง — Voice-to-CRM: อัดเสียงจริงผ่าน MediaRecorder (webm/mp4 แล้วแต่เบราว์เซอร์) +
  // นำเข้าไฟล์เสียง (.mp3/.wav/.m4a/.ogg) — audio/x-m4a และ audio/x-wav เป็น mimeType ที่
  // เบราว์เซอร์บางตัว (Safari เก่า ฯลฯ) รายงานสำหรับ .m4a/.wav แทนค่ามาตรฐาน
  'audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav',
  'audio/ogg', 'audio/x-m4a', 'audio/aac', 'audio/flac',
]
const MAX_SIZE = 50 * 1024 * 1024 // 50 MB

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    // เดิม CORS เปิดกว้าง '*' ตายตัวสำหรับ endpoint ที่มีสิทธิ์เขียน/ลบไฟล์ (ต่างจาก worker อื่นในระบบที่
    // จำกัดด้วย ALLOWED_ORIGIN) แก้ให้จำกัดตาม origin ของแอปจริงเหมือนกันหมด (ไม่กระทบการแสดงรูป/ไฟล์
    // ผ่าน <img>/<video> src เพราะ CORS ไม่มีผลกับการโหลดทรัพยากรแบบนั้น)
    const cors = {
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors })
    }

    // POST /upload, DELETE /delete — ต้องมี Firebase ID token จริงและเป็นพนักงานที่อนุมัติแล้วเท่านั้น
    // (verify กับ Firebase ทุกครั้ง + เช็ค role จริงจาก Firestore ไม่ใช่แค่เช็คว่า token ถูกต้องอย่างเดียว)
    if ((request.method === 'POST' && url.pathname === '/upload') || (request.method === 'DELETE' && url.pathname === '/delete')) {
      const auth = request.headers.get('Authorization') || ''
      const idToken = auth.startsWith('Bearer ') ? auth.slice(7) : ''
      const verified = idToken ? await verifyFirebaseToken(idToken, env.FIREBASE_API_KEY) : null
      if (!verified) return json({ error: 'Unauthorized' }, 401, cors)
      if (!(await isAuthorizedStaff(idToken, verified.localId, env))) {
        return json({ error: 'Unauthorized — บัญชีนี้ยังไม่ได้รับอนุมัติให้เป็นพนักงาน' }, 403, cors)
      }
      if (!checkRateLimit(verified.localId)) {
        return json({ error: `อัปโหลด/ลบไฟล์บ่อยเกินไป — จำกัด ${RATE_LIMIT_MAX_CALLS} ครั้ง/นาทีต่อบัญชี กรุณารอสักครู่แล้วลองใหม่` }, 429, cors)
      }
    }

    // POST /upload — อัปโหลดไฟล์
    if (request.method === 'POST' && url.pathname === '/upload') {
      try {
        const formData = await request.formData()
        const file = formData.get('file')
        // เดิม client กำหนด folder ได้อิสระเต็มที่ไม่มีการกรองเลย แก้ให้เหลือแค่ตัวอักษร/เลข/-/_ กัน key
        // ชนกับโฟลเดอร์ของโมดูลอื่นโดยไม่ตั้งใจ (R2 เป็น flat namespace ไม่มี path traversal จริงแบบไฟล์ระบบ
        // แต่ยังควรกรอง input แปลกๆ ก่อนใช้สร้าง key เสมอ)
        const rawFolder = String(formData.get('folder') || 'uploads')
        const folder = rawFolder.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 60) || 'uploads'

        if (!file) return json({ error: 'No file provided' }, 400, cors)
        if (!ALLOWED_TYPES.includes(file.type)) return json({ error: 'File type not allowed' }, 400, cors)
        if (file.size > MAX_SIZE) return json({ error: 'File too large (max 50 MB)' }, 400, cors)

        const ext = (file.name.split('.').pop() || 'bin').replace(/[^a-zA-Z0-9]/g, '').slice(0, 10) || 'bin'
        const key = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

        await env.BUCKET.put(key, file.stream(), {
          httpMetadata: { contentType: file.type },
          customMetadata: { originalName: file.name, uploadedAt: new Date().toISOString() },
        })

        const publicUrl = `${url.origin}/file?key=${encodeURIComponent(key)}`
        return json({ ok: true, key, url: publicUrl, size: file.size }, 200, cors)
      } catch (err) {
        return json({ error: err.message }, 500, cors)
      }
    }

    // DELETE /delete?key=xxx — ลบไฟล์
    if (request.method === 'DELETE' && url.pathname === '/delete') {
      const key = url.searchParams.get('key')
      if (!key) return json({ error: 'No key provided' }, 400, cors)
      await env.BUCKET.delete(key)
      return json({ ok: true }, 200, cors)
    }

    // POST /csp-report — เบราว์เซอร์ส่งมาอัตโนมัติเมื่อ Content-Security-Policy-Report-Only ถูกละเมิด
    // ไม่ต้องมี auth เพราะเบราว์เซอร์แนบ header เองไม่ได้ตาม CSP spec — แค่ log ไว้ดูผ่าน `wrangler tail`
    // ก่อนตัดสินใจเปลี่ยนจาก Report-Only เป็นบังคับใช้จริง (เดิม Report-Only ไม่มี report-uri เลย
    // แปลว่าไม่มีใคร "สังเกตการณ์" อะไรจริงๆตลอดที่ผ่านมา ทั้งที่ตั้งใจจะรอดูก่อน)
    if (request.method === 'POST' && url.pathname === '/csp-report') {
      try {
        const body = await request.json()
        console.log('[csp-report]', JSON.stringify(body))
      } catch { /* body แปลก/ว่างเปล่าได้ ไม่ต้องทำอะไรต่อ */ }
      return new Response(null, { status: 204, headers: cors })
    }

    // GET /file?key=xxx — ดาวน์โหลดไฟล์
    if (request.method === 'GET' && url.pathname === '/file') {
      const key = url.searchParams.get('key')
      if (!key) return json({ error: 'No key' }, 400, cors)
      const obj = await env.BUCKET.get(key)
      if (!obj) return json({ error: 'File not found' }, 404, cors)
      return new Response(obj.body, {
        headers: {
          'Content-Type': obj.httpMetadata?.contentType || 'application/octet-stream',
          'Cache-Control': 'public, max-age=31536000',
          ...cors,
        },
      })
    }

    return json({ error: 'Not found' }, 404, cors)
  },
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
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
