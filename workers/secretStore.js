/**
 * (v1.0.1141) กุญแจเชื่อมต่อที่เจ้าของโปรแกรมใส่จากในแอป — ไม่ต้องเข้า Cloudflare
 *
 * เก็บที่ Firestore `system_integrations/secrets` (กฎฐานข้อมูล: เจ้าของโปรแกรมเท่านั้น พนักงานอ่านไม่ได้)
 * และ "เข้ารหัสก่อนเก็บ" ด้วย AES-GCM โดยใช้กุญแจที่ได้จาก private key ของบัญชีระบบ (FIRESTORE_SERVICE_ACCOUNT_JSON)
 * ซึ่งมีอยู่ใน worker เท่านั้น → ในฐานข้อมูล/ไฟล์สำรองเห็นแต่ข้อความที่อ่านไม่ออก หน้าเว็บไม่มีทางได้ค่าจริงกลับไป
 * (ถ้าเปลี่ยนบัญชีระบบ กุญแจที่เก็บไว้จะถอดไม่ได้ ต้องใส่ใหม่ — หน้าแอปจะขึ้นว่ายังไม่ได้ใส่)
 *
 * ค่าที่ใส่จากแอปมาก่อนค่าใน Cloudflare (แก้จากแอปแล้วมีผลเลย) · worker จำค่าไว้ 60 วินาที
 */
export const SECRETS_DOC = 'system_integrations/secrets'
export const SECRET_KEYS = ['GEMINI_API_KEY', 'META_SYSTEM_USER_TOKEN', 'META_APP_SECRET', 'META_VERIFY_TOKEN', 'LEAD_WEBHOOK_KEY', 'LINE_EXTRA_CHANNELS', 'GOOGLE_MAPS_API_KEY']
const MAX_LEN = 8000

const fsBase = env => `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`
async function call(fetchImpl, url, init) { try { return await fetchImpl(url, init) } catch { return null } }
const b64 = bytes => { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s) }
const unb64 = str => Uint8Array.from(atob(str), c => c.charCodeAt(0))

async function aesKey(env) {
  let pk = ''
  try { pk = JSON.parse(env.FIRESTORE_SERVICE_ACCOUNT_JSON || '{}').private_key || '' } catch { pk = '' }
  if (!pk) return null
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('lamom-secrets-v1|' + pk))
  return crypto.subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}
export async function encryptValue(env, plain) {
  const key = await aesKey(env)
  if (!key) return null
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(String(plain))))
  return `v1:${b64(iv)}:${b64(ct)}`
}
export async function decryptValue(env, stored) {
  const m = /^v1:([A-Za-z0-9+/=]+):([A-Za-z0-9+/=]+)$/.exec(String(stored || ''))
  if (!m) return ''
  try {
    const key = await aesKey(env)
    if (!key) return ''
    return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(m[1]) }, key, unb64(m[2])))
  } catch { return '' }
}

let cache = { at: 0, values: null }
export function __resetSecretCache() { cache = { at: 0, values: null } }

// คืน { KEY: ค่าจริง } เฉพาะที่ใส่จากแอปและถอดรหัสได้ — พลาดตรงไหนคืน {} (ใช้ค่าใน Cloudflare ต่อไป)
export async function loadStoredSecrets(env, getToken, fetchImpl = fetch, now = Date.now()) {
  if (cache.values && now - cache.at < 60_000) return cache.values
  const values = {}
  try {
    const token = await getToken()
    if (token) {
      const r = await call(fetchImpl, `${fsBase(env)}/${SECRETS_DOC}`, { headers: { Authorization: `Bearer ${token}` } })
      if (r?.ok) {
        const f = (await r.json().catch(() => ({}))).fields || {}
        for (const k of SECRET_KEYS) {
          const v = await decryptValue(env, f[k]?.stringValue)
          if (v) values[k] = v
        }
      }
      // อ่านไม่ได้เพราะไม่มีเอกสาร (404) ก็จำว่า "ว่าง" ไว้ 60 วินาทีเหมือนกัน
      if (r) cache = { at: now, values }
    }
  } catch { /* ใช้ค่าใน Cloudflare */ }
  return values
}

// env ใหม่ที่ค่าในแอปทับค่าใน Cloudflare (binding อื่นๆ ยังอยู่ครบผ่าน prototype)
export async function withStoredSecrets(env, getToken, fetchImpl = fetch) {
  if (!env?.FIRESTORE_SERVICE_ACCOUNT_JSON || !env.FIREBASE_PROJECT_ID) return env
  const stored = await loadStoredSecrets(env, getToken, fetchImpl)
  return Object.keys(stored).length ? Object.assign(Object.create(env), stored) : env
}

// สถานะรายกุญแจ: ใส่แล้วหรือยัง และใส่จากที่ไหน — ไม่มีค่าจริงในคำตอบ
export function secretsStatus(baseEnv, stored = {}) {
  return Object.fromEntries(SECRET_KEYS.map(k => [k, { set: !!(stored[k] || baseEnv?.[k]), from: stored[k] ? 'app' : baseEnv?.[k] ? 'cloudflare' : '' }]))
}

const bad = msg => Object.assign(new Error(msg), { status: 400 })
export function cleanLineChannel(c = {}) {
  const name = String(c.name || '').replace(/[<>\u0000-\u001f]/g, ' ').trim().slice(0, 60)
  let id = String(c.id || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 20)
  const secret = String(c.secret || '').trim(), token = String(c.token || '').trim()
  if (!name) throw bad('ใส่ชื่อ LINE OA ก่อน')
  if (!/^[a-f0-9]{32}$/i.test(secret)) throw bad('Channel secret ต้องเป็นตัวอักษร 32 ตัว (คัดลอกจากแท็บ Basic settings)')
  if (token.length < 100 || /\s/.test(token)) throw bad('Channel access token ไม่ถูกต้อง (คัดลอกจากแท็บ Messaging API → กด Issue)')
  if (!id || id === 'main') throw bad('รหัส OA ใช้ a-z 0-9 - เท่านั้น')
  return { id, name, owner: String(c.owner || '').replace(/[<>\u0000-\u001f]/g, ' ').trim().slice(0, 60), secret, token }
}
export function nextChannelId(list = []) {
  const used = new Set(list.map(c => c.id))
  for (let i = 1; i < 100; i++) if (!used.has(`oa${i}`)) return `oa${i}`
  return `oa${Date.now() % 100000}`
}

export function validateSecret(key, value) {
  if (!SECRET_KEYS.includes(key)) throw bad('ไม่รู้จักกุญแจนี้')
  const v = String(value ?? '').trim()
  if (v.length > MAX_LEN) throw bad('ค่ายาวเกินไป')
  if (!v) return ''
  if (key === 'LINE_EXTRA_CHANNELS') { let a; try { a = JSON.parse(v) } catch { throw bad('รูปแบบ LINE OA ไม่ถูกต้อง') } if (!Array.isArray(a)) throw bad('รูปแบบ LINE OA ไม่ถูกต้อง'); return JSON.stringify(a.map(cleanLineChannel)) }
  if (/\s/.test(v)) throw bad('กุญแจต้องไม่มีช่องว่างหรือขึ้นบรรทัดใหม่ — คัดลอกมาใหม่อีกครั้ง')
  if ((key === 'META_VERIFY_TOKEN' || key === 'LEAD_WEBHOOK_KEY') && v.length < 12) throw bad('รหัสสั้นเกินไป ใช้อย่างน้อย 12 ตัว (กด 🎲 สร้างให้ ได้)')
  if (key !== 'META_VERIFY_TOKEN' && key !== 'LEAD_WEBHOOK_KEY' && v.length < 20) throw bad('กุญแจสั้นผิดปกติ — ตรวจว่าคัดลอกมาครบ')
  return v
}

// ลองใช้กุญแจจริง 1 ครั้งหลังบันทึก (บอกผลให้เจ้าของรู้ทันทีว่าใช้ได้ไหม) — คืน null ถ้ากุญแจนั้นทดสอบไม่ได้
export async function testSecret(key, value, fetchImpl = fetch) {
  if (key === 'GEMINI_API_KEY') {
    const r = await call(fetchImpl, 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1', { headers: { 'x-goog-api-key': value } })
    return r?.ok ? { ok: true, text: '✅ ทดสอบแล้ว กุญแจ AI ใช้ได้' } : { ok: false, text: '⚠️ บันทึกแล้ว แต่ Google ไม่รับกุญแจนี้ — ตรวจว่าคัดลอกมาครบ' }
  }
  if (key === 'META_SYSTEM_USER_TOKEN') {
    const r = await call(fetchImpl, 'https://graph.facebook.com/v21.0/me?fields=id,name', { headers: { Authorization: `Bearer ${value}` } })
    return r?.ok ? { ok: true, text: '✅ ทดสอบแล้ว โทเค็น Meta ใช้ได้' } : { ok: false, text: '⚠️ บันทึกแล้ว แต่ Meta ไม่รับโทเค็นนี้ — ตรวจว่าคัดลอกมาครบและยังไม่หมดอายุ' }
  }
  return null
}

async function readRawDoc(env, token, fetchImpl) {
  const r = await call(fetchImpl, `${fsBase(env)}/${SECRETS_DOC}`, { headers: { Authorization: `Bearer ${token}` } })
  return r?.ok ? ((await r.json().catch(() => ({}))).fields || {}) : {}
}
async function writeField(env, token, key, cipher, by, fetchImpl) {
  const mask = [key, 'updatedAt', 'updatedBy'].map(k => 'updateMask.fieldPaths=' + k).join('&')
  const fields = { updatedAt: { timestampValue: new Date().toISOString() }, updatedBy: { stringValue: String(by || '').slice(0, 80) } }
  if (cipher) fields[key] = { stringValue: cipher }
  const r = await call(fetchImpl, `${fsBase(env)}/${SECRETS_DOC}?${mask}`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ fields }) })
  if (!r?.ok) throw Object.assign(new Error('บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง'), { status: 502 })
}

/**
 * จุดเดียวสำหรับหน้า "🔑 กุญแจเชื่อมต่อ" — เรียกได้เฉพาะเจ้าของโปรแกรม (daily-report.js ตรวจก่อนเรียก)
 * body.op: status | set {key,value} | clear {key} | line-add {name,secret,token,owner} | line-remove {id}
 */
export async function handleSecrets(baseEnv, body = {}, { getToken, by = '', fetchImpl = fetch } = {}) {
  if (!baseEnv.FIRESTORE_SERVICE_ACCOUNT_JSON) throw Object.assign(new Error('ตัวรับยังไม่ได้ต่อฐานข้อมูล (FIRESTORE_SERVICE_ACCOUNT_JSON)'), { status: 503 })
  const token = await getToken()
  if (!token) throw Object.assign(new Error('ต่อฐานข้อมูลไม่ได้ ลองใหม่อีกครั้ง'), { status: 503 })
  const op = String(body.op || 'status')
  const current = async () => { __resetSecretCache(); return loadStoredSecrets(baseEnv, async () => token, fetchImpl) }
  const lineList = stored => { try { const a = JSON.parse(stored.LINE_EXTRA_CHANNELS || baseEnv.LINE_EXTRA_CHANNELS || '[]'); return Array.isArray(a) ? a : [] } catch { return [] } }
  const answer = async (extra = {}) => { const stored = await current(); return { ok: true, keys: secretsStatus(baseEnv, stored), lineExtra: lineList(stored).map(c => ({ id: String(c.id || ''), name: String(c.name || c.id || '') })), ...extra } }
  const save = async (key, plain) => {
    const cipher = plain ? await encryptValue(baseEnv, plain) : ''
    if (plain && !cipher) throw Object.assign(new Error('เข้ารหัสไม่สำเร็จ'), { status: 500 })
    await writeField(baseEnv, token, key, cipher, by, fetchImpl)
  }
  if (op === 'status') return answer()
  if (op === 'set' || op === 'clear') {
    const key = String(body.key || '')
    const v = op === 'clear' ? (validateSecret(key, ''), '') : validateSecret(key, body.value)
    if (op === 'set' && !v) throw bad('วางกุญแจก่อนกดบันทึก')
    await save(key, v)
    return answer({ test: v ? await testSecret(key, v, fetchImpl) : null })
  }
  if (op === 'line-add' || op === 'line-remove') {
    const list = lineList(await current())
    let next, added = null
    if (op === 'line-add') {
      if (list.length >= 20) throw bad('เพิ่ม LINE OA ได้ไม่เกิน 20 บัญชี')
      added = cleanLineChannel({ ...body, id: body.id || nextChannelId(list) })
      next = [...list.filter(c => c.id !== added.id), added]
    } else {
      const id = String(body.id || '')
      if (!list.some(c => c.id === id)) throw bad('ไม่พบ LINE OA นี้')
      next = list.filter(c => c.id !== id)
    }
    // ลบจนหมด = เก็บ [] ไว้ (ทับค่าใน Cloudflare ด้วย ไม่งั้นบัญชีที่ลบจะกลับมา)
    await save('LINE_EXTRA_CHANNELS', JSON.stringify(next))
    return answer(added ? { added: { id: added.id, name: added.name } } : {})
  }
  throw bad('ไม่รู้จักคำสั่งนี้')
}
