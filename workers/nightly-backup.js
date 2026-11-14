// (2026-11-02) สำรองข้อมูลอัตโนมัติทุกคืน 03:00 เวลาไทย — เดิมสำรองได้แค่กดเองในหน้า ตั้งค่า > สำรอง/กู้คืนข้อมูล
// ถ้าข้อมูลถูกลบหรือเขียนทับผิด จะไม่มีของให้กู้คืน
//
// ทำงานอย่างไร (เรียกจาก scheduled() ใน workers/daily-report.js ตาม cron BACKUP_CRON):
// 1. ถาม Firestore ว่ามี collection ไหนบ้างที่มีข้อมูลจริง (listCollectionIds — ไม่ต้องไล่ 267 ชื่อ)
// 2. ดึงทุกเอกสารของแต่ละ collection (แบ่งหน้า) → ไฟล์ JSON รูปแบบเดียวกับปุ่ม "Backup ทันที" ในแอป
//    จึงใช้ปุ่ม "กู้คืนจากไฟล์" เดิมกู้คืนได้เลย
// 3. บีบอัด gzip แล้วเก็บใน R2 (bucket lamom-files) ชื่อไฟล์มีรหัสสุ่ม — ไฟล์ใน bucket นี้เปิดผ่าน /file?key= ได้
//    ถ้ารู้ชื่อ จึงห้ามตั้งชื่อที่เดาได้ · เก็บ 30 ชุดล่าสุด ที่เก่ากว่านั้นลบทิ้ง
// 4. บันทึกผลลง system_backups (เห็นในหน้า สำรอง/กู้คืนข้อมูล) · ถ้าพลาดส่ง Telegram บอกเจ้าของ
//
// ดาวน์โหลดชุดล่าสุด: GET /backup/latest (ต้องล็อกอินเป็นเจ้าของโปรแกรม) → ไฟล์ JSON พร้อมกู้คืน

export const BACKUP_CRON = '0 20 * * *' // 20:00 UTC = 03:00 เวลาไทย
export const BACKUP_PREFIX = 'backups/'
export const BACKUP_KEEP = 30
// ไม่สำรอง: log ต่อเนื่อง/ข้อมูลชั่วคราว/ข้อมูลที่สร้างใหม่ได้เอง (ตรงกับ BACKUP_EXCLUDED_COLLECTIONS ในแอป + rag_chunks)
export const BACKUP_SKIP = ['audit_log', 'error_log', 'system_backups', 'security_sessions', 'rag_chunks']
// เจ้าของโปรแกรม (ตรงกับ isProgramOwner() ใน firestore.rules)
export const PROGRAM_OWNER_EMAIL = 'ghunt1007@gmail.com'

// (v1.0.1074) u.programOwner = users/{uid}.programOwner && role 'owner' (ผูกกับรหัสบัญชี — ตั้งโดย withProgramOwnerFlag
// ใน daily-report.js) เปลี่ยนอีเมลแล้วยังเป็นเจ้าของโปรแกรม
export function isProgramOwnerUser(u) {
  return u?.programOwner === true || String(u?.email || '').toLowerCase() === PROGRAM_OWNER_EMAIL
}

const fsBase = env => `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`

// (v1.0.1127) แปลงค่าจาก Firestore REST ให้ "วันที่" เก็บเป็นรูปเดียวกับปุ่มสำรองในแอป
// ({type, seconds, nanoseconds}) — เดิมเก็บเป็นข้อความ พอกู้คืนแล้ววันที่กลายเป็นข้อความ แยกไม่ออกจากข้อความทั่วไป
export function backupDecodeValue(v = {}) {
  if (v.timestampValue !== undefined) {
    const m = /\.(\d+)Z$/.exec(v.timestampValue)
    const ms = Date.parse(v.timestampValue)
    const seconds = Math.floor(ms / 1000)
    const nanoseconds = m ? Number(m[1].padEnd(9, '0').slice(0, 9)) : 0
    return { type: 'firestore/timestamp/1.0', seconds, nanoseconds }
  }
  if (v.stringValue !== undefined) return v.stringValue
  if (v.integerValue !== undefined) return Number(v.integerValue)
  if (v.doubleValue !== undefined) return v.doubleValue
  if (v.booleanValue !== undefined) return v.booleanValue
  if (v.nullValue !== undefined) return null
  if (v.mapValue !== undefined) {
    const o = {}
    for (const [k, vv] of Object.entries(v.mapValue.fields || {})) o[k] = backupDecodeValue(vv)
    return o
  }
  if (v.arrayValue !== undefined) return (v.arrayValue.values || []).map(backupDecodeValue)
  if (v.geoPointValue !== undefined) return { latitude: v.geoPointValue.latitude, longitude: v.geoPointValue.longitude }
  if (v.referenceValue !== undefined) return v.referenceValue
  return null
}

export function backupKey(date, id) {
  return `${BACKUP_PREFIX}${date}-${id}.json.gz`
}

// เลือกไฟล์ที่ต้องลบ: เรียงใหม่สุดก่อน เก็บ keep ไฟล์แรก
export function keysToPrune(objects, keep = BACKUP_KEEP) {
  return [...objects]
    .sort((a, b) => new Date(b.uploaded) - new Date(a.uploaded))
    .slice(keep)
    .map(o => o.key)
}

export function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const u = ['B', 'KB', 'MB', 'GB']
  let i = 0, n = bytes
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++ }
  return `${n.toFixed(i ? 1 : 0)} ${u[i]}`
}

async function listCollectionIds(env, token) {
  const ids = []
  let pageToken
  for (let i = 0; i < 10; i++) {
    const res = await fetch(`${fsBase(env)}:listCollectionIds`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ pageSize: 500, ...(pageToken ? { pageToken } : {}) }),
    })
    if (!res.ok) throw new Error(`listCollectionIds ${res.status}`)
    const data = await res.json()
    ids.push(...(data.collectionIds || []))
    if (!data.nextPageToken) break
    pageToken = data.nextPageToken
  }
  return ids
}

async function listCollection(env, token, col, decode) {
  const out = []
  let pageToken
  for (let i = 0; i < 100; i++) {
    const q = new URLSearchParams({ pageSize: '1000' })
    if (pageToken) q.set('pageToken', pageToken)
    const res = await fetch(`${fsBase(env)}/${encodeURIComponent(col)}?${q}`, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) throw new Error(`${col} ${res.status}`)
    const data = await res.json()
    for (const d of data.documents || []) {
      const obj = { id: d.name.split('/').pop() }
      for (const [k, v] of Object.entries(d.fields || {})) obj[k] = decode(v)
      out.push(obj)
    }
    if (!data.nextPageToken) break
    pageToken = data.nextPageToken
  }
  return out
}

async function gzip(text) {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

async function logBackup(env, token, fields) {
  const enc = v => (typeof v === 'number' ? { integerValue: String(v) } : { stringValue: String(v) })
  await fetch(`${fsBase(env)}/system_backups`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, enc(v)])) }),
  }).catch(() => {})
}

/**
 * deps: { getToken: () => Promise<string|null>, decode: Firestore value decoder, notify: (text) => Promise, today: 'YYYY-MM-DD' }
 */
export async function runNightlyBackup(env, deps) {
  const startedAt = Date.now()
  const bucket = env.BACKUP_BUCKET
  let token = null
  try {
    if (!bucket) throw new Error('ยังไม่ได้ผูก R2 (BACKUP_BUCKET)')
    token = await deps.getToken()
    if (!token) throw new Error('อ่าน Firestore ไม่ได้ (ไม่มี service account)')
    const cols = (await listCollectionIds(env, token)).filter(c => !BACKUP_SKIP.includes(c))
    const data = {}
    const skipped = []
    let totalDocs = 0
    for (const col of cols) {
      try {
        const docs = await listCollection(env, token, col, deps.decode)
        if (docs.length) { data[col] = docs; totalDocs += docs.length }
      } catch (e) {
        skipped.push({ colName: col, message: e.message || String(e) })
      }
    }
    const backup = { exportedAt: new Date().toISOString(), source: 'nightly', collections: Object.keys(data).length, totalDocs, skipped, data }
    const body = await gzip(JSON.stringify(backup))
    const key = backupKey(deps.today, crypto.randomUUID())
    await bucket.put(key, body, {
      httpMetadata: { contentType: 'application/gzip' },
      customMetadata: { date: deps.today, docs: String(totalDocs), collections: String(backup.collections) },
    })
    const listed = await bucket.list({ prefix: BACKUP_PREFIX, limit: 1000 })
    const old = keysToPrune(listed.objects || [])
    if (old.length) await bucket.delete(old)
    const status = skipped.length ? 'partial' : 'success'
    await logBackup(env, token, {
      action: 'backup', status, size: formatBytes(body.length), duration: `${Math.round((Date.now() - startedAt) / 1000)} วินาที`,
      time: new Date().toISOString(), note: `อัตโนมัติทุกคืน · ${backup.collections} ชุด ${totalDocs} รายการ${skipped.length ? ` · ข้าม ${skipped.length}` : ''}`,
    })
    if (skipped.length) await deps.notify(`⚠️ สำรองข้อมูลคืนนี้ได้ไม่ครบ: ข้าม ${skipped.length} ชุด (${skipped.slice(0, 5).map(s => s.colName).join(', ')})`)
    return { ok: true, key, totalDocs, collections: backup.collections, skipped: skipped.length, size: body.length }
  } catch (e) {
    const msg = e.message || String(e)
    if (token) await logBackup(env, token, { action: 'backup', status: 'failed', size: '-', duration: '-', time: new Date().toISOString(), note: `อัตโนมัติ: ${msg}` })
    await deps.notify(`❌ สำรองข้อมูลอัตโนมัติไม่สำเร็จ: ${msg}`).catch(() => {})
    return { ok: false, error: msg }
  }
}

// GET /backup/latest — คืนไฟล์ JSON ชุดล่าสุด (คลาย gzip ให้แล้ว) เฉพาะเจ้าของโปรแกรม
export async function handleLatestBackup(env, verifiedUser, cors) {
  if (!isProgramOwnerUser(verifiedUser)) return new Response(JSON.stringify({ error: 'เฉพาะเจ้าของโปรแกรม' }), { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } })
  if (!env.BACKUP_BUCKET) return new Response(JSON.stringify({ error: 'ยังไม่ได้ผูก R2' }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } })
  const listed = await env.BACKUP_BUCKET.list({ prefix: BACKUP_PREFIX, limit: 1000 })
  const latest = [...(listed.objects || [])].sort((a, b) => new Date(b.uploaded) - new Date(a.uploaded))[0]
  if (!latest) return new Response(JSON.stringify({ error: 'ยังไม่มีไฟล์สำรองอัตโนมัติ' }), { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } })
  const obj = await env.BACKUP_BUCKET.get(latest.key)
  if (!obj) return new Response(JSON.stringify({ error: 'ไม่พบไฟล์' }), { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } })
  const date = latest.key.slice(BACKUP_PREFIX.length, BACKUP_PREFIX.length + 10)
  return new Response(obj.body.pipeThrough(new DecompressionStream('gzip')), {
    headers: {
      ...cors,
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="lamom-backup-auto-${date}.json"`,
      'Access-Control-Expose-Headers': 'Content-Disposition, X-Backup-Date',
      'X-Backup-Date': date,
    },
  })
}
