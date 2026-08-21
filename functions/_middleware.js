// LAMOM ONE — IP allowlist edge block (v1.0.533)
//
// Cloudflare Pages Function ที่รันก่อนทุก request ถึงเว็บ (ก่อน main.js จะโหลดด้วยซ้ำ) — เป็นจุดเดียวที่
// "บล็อกจริง" ตาม IP ทำได้ในสถาปัตยกรรมนี้ เพราะ Firestore Rules มองไม่เห็น IP ผู้เรียกเลย (ตามที่ auth.js
// เคยเตือนไว้ตั้งแต่ v1.0.350) — ข้อจำกัดที่ควรรู้: บล็อกนี้ป้องกันได้แค่ "โหลดเว็บแอปผ่าน Cloudflare Pages"
// เท่านั้น ถ้ามีคนขโมย Firebase ID token ไปเรียก Firestore ตรงๆ (ไม่ผ่านเว็บนี้เลย) จะยังเข้าถึงข้อมูลได้อยู่ดี
// เพราะ Firestore เป็นเซิร์ฟเวอร์ของ Google แยกจาก Cloudflare ไม่มีทาง proxy ผ่านจุดนี้ได้ — feature นี้จึงเป็น
// "ด่านหน้าเว็บ" ไม่ใช่ "บล็อกฐานข้อมูล" ระดับที่ Firestore Rules ทำได้ (นั่นทำไม่ได้จริงในสถาปัตยกรรมนี้)
//
// ⚠️ ความเสี่ยงตัวจริง (ตามที่ auth.js เตือนไว้): ถ้าตั้งค่า whitelist ผิดพลาด เจ้าของ/พนักงานอาจเข้าเว็บธุรกิจ
// จริงของตัวเองไม่ได้ — ออกแบบให้ fail-open (ปล่อยผ่าน ไม่บล็อก) ทุกจุดที่ไม่แน่ใจ 100% ว่าปลอดภัยที่จะบล็อก:
//   1) ปิดโดยดีฟอลต์ — ต้องตั้ง env var IP_BLOCK_ENABLED="true" เองที่ Cloudflare Pages > Settings >
//      Environment variables ก่อนถึงจะเริ่มบล็อกจริง (โค้ดนี้ deploy ขึ้นไปก่อนไม่มีผลอะไรเลยจนกว่าจะเปิดเอง)
//   2) ดึง whitelist จาก Firestore ไม่สำเร็จ ไม่ว่ากรณีไหน (network error/timeout/parse พัง/Firestore ล่ม)
//      → ปล่อยผ่านเสมอ ไม่บล็อกใคร
//   3) whitelist ว่างเปล่า (ยังไม่มีใครเพิ่ม IP เลย) → ปล่อยผ่านเสมอ เหมือนพฤติกรรม "เตือนเท่านั้น" เดิม
//   4) มีทางออกฉุกเฉินถาวร — ตั้ง env var IP_BLOCK_BYPASS_KEY เอง (สุ่มค่ายาวๆ เก็บเป็นความลับ) แล้วเปิด URL
//      พร้อม ?_bypass=<key> ครั้งเดียว ระบบจะจำผ่าน cookie (HttpOnly) ให้อัตโนมัติ 1 ปี ใช้ตอนตั้งค่า
//      whitelist ผิดจนตัวเองเข้าไม่ได้ — เก็บลิงก์นี้ไว้ในที่ปลอดภัยแยกจากระบบ (เช่น password manager)
//      ก่อนเปิดใช้ IP_BLOCK_ENABLED จริง

const FIRESTORE_PROJECT = 'lamom-one-v1'
const FIREBASE_API_KEY = 'AIzaSyBH098B5Ja9WiLL5sfgCvSuBqOab8aeKMo'
const BYPASS_COOKIE = 'lamom_ip_bypass'

export async function onRequest(context) {
  const { request, env, next } = context

  // (1) ปิดโดยดีฟอลต์
  if (env.IP_BLOCK_ENABLED !== 'true') return next()

  const url = new URL(request.url)
  const bypassKey = env.IP_BLOCK_BYPASS_KEY || ''

  // (4) เข้าผ่าน ?_bypass=<key> → ตั้ง cookie แล้ว redirect ตัดพารามิเตอร์ทิ้ง กัน key ค้างใน URL/ประวัติ
  if (bypassKey && url.searchParams.get('_bypass') === bypassKey) {
    url.searchParams.delete('_bypass')
    return new Response(null, {
      status: 302,
      headers: {
        Location: url.toString(),
        'Set-Cookie': `${BYPASS_COOKIE}=${bypassKey}; Path=/; Max-Age=31536000; Secure; HttpOnly; SameSite=Lax`,
      },
    })
  }
  const cookieHeader = request.headers.get('Cookie') || ''
  if (bypassKey && cookieHeader.includes(`${BYPASS_COOKIE}=${bypassKey}`)) return next()

  const ip = request.headers.get('cf-connecting-ip') || ''
  if (!ip) return next() // ไม่รู้ IP ผู้เรียกเลย → fail open

  let whitelist = []
  try {
    const res = await fetch(
      `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT}/databases/(default)/documents/ip_whitelist?key=${FIREBASE_API_KEY}&pageSize=200`,
      { signal: AbortSignal.timeout(3000) }
    )
    if (!res.ok) return next() // (2) Firestore ตอบผิดพลาด → fail open
    const data = await res.json()
    whitelist = (data.documents || [])
      .map(d => ({
        ip: d.fields?.ip?.stringValue || '',
        deleted: d.fields?.deleted?.booleanValue || false,
      }))
      .filter(w => w.ip && !w.deleted)
  } catch {
    return next() // (2) network error/timeout/parse error → fail open
  }

  if (!whitelist.length) return next() // (3) ยังไม่มีใครตั้งค่า whitelist เลย

  if (whitelist.some(w => w.ip === ip)) return next()

  return new Response(blockedPageHtml(ip), {
    status: 403,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

function blockedPageHtml(ip) {
  return `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>เข้าถึงถูกจำกัด — LAMOM ONE</title>
<meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:system-ui,-apple-system,sans-serif;background:#0A0E1A;color:#F9FAFB;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:20px">
  <div style="max-width:440px;text-align:center">
    <div style="font-size:3rem;margin-bottom:12px">🔒</div>
    <h1 style="font-size:1.3rem;margin-bottom:8px">การเข้าถึงถูกจำกัดตาม IP</h1>
    <p style="color:#9CA3AF;font-size:0.9rem;line-height:1.6">
      IP ของคุณ (<code style="background:#1F2937;padding:2px 6px;border-radius:4px">${escapeHtml(ip)}</code>)
      ไม่อยู่ใน Whitelist ที่อนุญาตให้เข้าใช้งาน LAMOM ONE<br><br>
      ถ้าเป็นการเข้าใช้งานที่ถูกต้อง กรุณาติดต่อเจ้าของระบบให้เพิ่ม IP นี้ที่ Settings &gt; Security
      หรือใช้ลิงก์สำรองที่เจ้าของระบบให้ไว้
    </p>
  </div>
</body></html>`
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
