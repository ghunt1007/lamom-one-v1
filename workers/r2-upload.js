/**
 * LAMOM ONE — Cloudflare R2 Upload Worker
 * Deploy: wrangler deploy --config wrangler.toml
 *
 * Binding ใน Cloudflare Dashboard:
 *   Worker > Settings > Bindings > R2 Bucket
 *   Variable name: BUCKET
 *   R2 bucket: lamom-files
 *   Var: FIREBASE_API_KEY — Firebase Web API key (public, ใช้ verify ID token เท่านั้น)
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

const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/msword', // .doc (เอกสารเก่า)
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls (เอกสารเก่า)
  'text/csv',
  'video/mp4',
]
const MAX_SIZE = 50 * 1024 * 1024 // 50 MB

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    // CORS headers
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors })
    }

    // POST /upload, DELETE /delete — ต้องมี Firebase ID token จริงเท่านั้น (verify กับ Firebase
    // ทุกครั้ง ไม่ใช่แค่เช็คว่า header ขึ้นต้นด้วย "Bearer " เหมือนเดิม)
    if ((request.method === 'POST' && url.pathname === '/upload') || (request.method === 'DELETE' && url.pathname === '/delete')) {
      const auth = request.headers.get('Authorization') || ''
      const idToken = auth.startsWith('Bearer ') ? auth.slice(7) : ''
      const verified = idToken ? await verifyFirebaseToken(idToken, env.FIREBASE_API_KEY) : null
      if (!verified) return json({ error: 'Unauthorized' }, 401, cors)
    }

    // POST /upload — อัปโหลดไฟล์
    if (request.method === 'POST' && url.pathname === '/upload') {
      try {
        const formData = await request.formData()
        const file = formData.get('file')
        const folder = formData.get('folder') || 'uploads'

        if (!file) return json({ error: 'No file provided' }, 400, cors)
        if (!ALLOWED_TYPES.includes(file.type)) return json({ error: 'File type not allowed' }, 400, cors)
        if (file.size > MAX_SIZE) return json({ error: 'File too large (max 50 MB)' }, 400, cors)

        const ext = file.name.split('.').pop()
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
