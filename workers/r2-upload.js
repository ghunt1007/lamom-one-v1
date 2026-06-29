/**
 * LAMOM ONE — Cloudflare R2 Upload Worker
 * Deploy: wrangler deploy workers/r2-upload.js --name r2-upload
 *
 * Binding ใน Cloudflare Dashboard:
 *   Worker > Settings > Bindings > R2 Bucket
 *   Variable name: BUCKET
 *   R2 bucket: lamom-files
 */

const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
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

    // Auth check — ส่ง Bearer token (Firebase ID token) มาใน header
    const auth = request.headers.get('Authorization') || ''
    if (!auth.startsWith('Bearer ') && env.REQUIRE_AUTH !== 'false') {
      return json({ error: 'Unauthorized' }, 401, cors)
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

        const publicUrl = `https://files.lamom.one/${key}`
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
