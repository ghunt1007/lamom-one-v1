// (v1.0.1152) ตั้งเวลาโพสต์ลงเพจ Facebook / Instagram — เขียนโพสต์ไว้ล่วงหน้า แล้วระบบโพสต์เองตามเวลา
//
// ใช้คิวเดียวกับ LINE Broadcast ตั้งเวลา (workers/scheduledSend.js): เก็บที่ system_integrations/sched_post_<id>
// (collection นี้เปิดเฉพาะเจ้าของโปรแกรม พนักงานทั่วไปปลอมคิวเองไม่ได้ — ต้องผ่าน worker ที่ตรวจสิทธิ์)
// cron ทุก 10 นาที: "ลบคิวก่อนแล้วค่อยโพสต์" (ลบสำเร็จได้ครั้งเดียว = ไม่โพสต์ซ้ำ) แล้วเก็บผลไว้ที่ postlog_<id> 14 วัน
// คิวที่เลยเวลาเกิน 6 ชม. ไม่โพสต์ย้อนหลัง — บันทึกผลว่า "ข้าม" ให้เห็นในรายการ
import { validatePost, metaPost, MULTICAST_ROLES } from './social.js'
import { QUEUE_PREFIX, MAX_LATE_MS, MAX_AHEAD_MS, fsBase, call, bad, auth, enc, decDoc, listCollection } from './scheduledSend.js'

export const POST_KIND = 'meta-post'
export const POST_LOG_KIND = 'meta-post-log'
export const POST_QUEUE_PREFIX = QUEUE_PREFIX + 'post_'
export const POST_LOG_PREFIX = 'postlog_'
export const LOG_KEEP_MS = 14 * 24 * 3600 * 1000
const MAX_PENDING = 50

const cleanId = id => String(id || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 60)
const docName = d => String(d.name || '').split('/').pop()
const toFields = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, enc(v)]))

/** ตรวจคำขอ → ข้อมูลคิวที่สะอาด (throw ถ้าไม่ผ่าน) */
export function cleanPostSchedule(body = {}, now = Date.now()) {
  const err = validatePost(body)
  if (err) throw bad(err)
  const at = new Date(body.at || '').getTime()
  if (!Number.isFinite(at)) throw bad('วันเวลาไม่ถูกต้อง')
  if (at < now + 60_000) throw bad('เวลาที่เลือกผ่านไปแล้ว — เลือกเวลาในอนาคต')
  if (at > now + MAX_AHEAD_MS) throw bad('กำหนดล่วงหน้าได้ไม่เกิน 60 วัน')
  if (body.link && !/^https:\/\/\S+$/.test(String(body.link))) throw bad('ลิงก์แนบต้องขึ้นต้นด้วย https://')
  const pageIds = [...new Set(body.pageIds.map(String))]
  const names = Array.isArray(body.pageNames) ? body.pageNames.map(n => String(n || '').slice(0, 80)).slice(0, pageIds.length) : []
  return {
    message: String(body.message || '').trim(), imageUrl: String(body.imageUrl || '').trim(), link: String(body.link || '').trim(),
    pageIds, pageNames: names, toInstagram: body.toInstagram === true, at: new Date(at).toISOString(),
  }
}

async function listAll(env, token, fetchImpl) {
  const docs = await listCollection(fetchImpl, env, token, 'system_integrations')
  if (!docs) return null
  return docs.map(d => ({ ...decDoc(d), docId: docName(d), name: d.name, updateTime: d.updateTime }))
}
const pendingOf = rows => rows.filter(r => r.kind === POST_KIND && r.docId.startsWith(POST_QUEUE_PREFIX))
const logsOf = rows => rows.filter(r => r.kind === POST_LOG_KIND && r.docId.startsWith(POST_LOG_PREFIX))
const publicRow = r => ({ id: r.docId.replace(POST_QUEUE_PREFIX, '').replace(POST_LOG_PREFIX, ''), at: r.at, message: r.message || '', imageUrl: r.imageUrl || '', link: r.link || '', pageNames: r.pageNames || [], pages: (r.pageIds || []).length, toInstagram: !!r.toInstagram, by: r.by || '', status: r.status || 'scheduled', note: r.note || '', doneAt: r.doneAt || '' })

function needRole(role) {
  if (!MULTICAST_ROLES.includes(role)) throw bad('เฉพาะผู้จัดการ/การตลาด/เจ้าของเท่านั้นที่ตั้งเวลาโพสต์ได้', 403)
}

export async function schedulePost(env, token, body, { role = '', by = '', fetchImpl = fetch, now = Date.now(), newId = () => now.toString(36) + Math.random().toString(36).slice(2, 8) } = {}) {
  needRole(role)
  if (!env.META_SYSTEM_USER_TOKEN) return { configured: false, error: 'ยังไม่ได้เชื่อม Facebook' }
  const q = cleanPostSchedule(body, now)
  const rows = await listAll(env, token, fetchImpl)
  if (!rows) throw bad('อ่านคิวไม่สำเร็จ ลองใหม่อีกครั้ง', 502)
  if (pendingOf(rows).length >= MAX_PENDING) throw bad(`ตั้งเวลาค้างไว้ได้สูงสุด ${MAX_PENDING} โพสต์ — ยกเลิกรายการเก่าก่อน`)
  const id = cleanId(newId())
  const fields = toFields({ kind: POST_KIND, ...q, by: String(by).slice(0, 80), createdAt: new Date(now).toISOString() })
  const r = await call(fetchImpl, `${fsBase(env)}/system_integrations/${POST_QUEUE_PREFIX}${id}`, { method: 'PATCH', headers: auth(token), body: JSON.stringify({ fields }) })
  if (!r?.ok) throw bad('บันทึกกำหนดการไม่สำเร็จ ลองใหม่อีกครั้ง', 502)
  return { configured: true, scheduled: true, id, at: q.at }
}

export async function unschedulePost(env, token, body, { role = '', fetchImpl = fetch } = {}) {
  needRole(role)
  const id = cleanId(body?.id)
  if (!id) throw bad('ไม่พบรายการ')
  const r = await call(fetchImpl, `${fsBase(env)}/system_integrations/${POST_QUEUE_PREFIX}${id}`, { method: 'DELETE', headers: auth(token) })
  if (!r?.ok) throw bad('ยกเลิกไม่สำเร็จ ลองใหม่อีกครั้ง', 502)
  return { configured: true, cancelled: true }
}

/** รายการที่ตั้งเวลาไว้ + ผลล่าสุด (ใครในทีมที่เข้าหน้านี้ได้ก็ดูได้ — ไม่มีข้อมูลลับ) */
export async function listScheduledPosts(env, token, { fetchImpl = fetch } = {}) {
  const rows = await listAll(env, token, fetchImpl)
  if (!rows) throw bad('อ่านรายการไม่สำเร็จ ลองใหม่อีกครั้ง', 502)
  return {
    pending: pendingOf(rows).map(publicRow).sort((a, b) => String(a.at).localeCompare(String(b.at))),
    recent: logsOf(rows).map(publicRow).sort((a, b) => String(b.doneAt).localeCompare(String(a.doneAt))).slice(0, 15),
  }
}

/** สรุปผลจาก metaPost → { status, note } */
export function summarizePostResult(res) {
  const rows = res?.results || []
  const fb = rows.filter(r => r.facebook?.ok).length
  const igWant = rows.filter(r => r.instagram).length, ig = rows.filter(r => r.instagram?.ok).length
  const errs = rows.flatMap(r => [r.facebook?.ok === false ? `${r.name || r.pageId}: ${r.facebook.error}` : '', r.instagram?.ok === false ? `IG ${r.name || r.pageId}: ${r.instagram.error}` : '']).filter(Boolean)
  const status = !rows.length || fb === 0 ? 'failed' : errs.length ? 'partial' : 'sent'
  const note = [`Facebook ${fb}/${rows.length} เพจ`, igWant ? `Instagram ${ig}/${igWant}` : '', ...errs.slice(0, 2)].filter(Boolean).join(' · ').slice(0, 400)
  return { status, note }
}

/** เรียกจาก cron ทุก 10 นาที */
export async function runScheduledPosts(env, token, { fetchImpl = fetch, now = Date.now(), post = null } = {}) {
  const out = { checked: 0, sent: 0, failed: 0, missed: 0, cleaned: 0 }
  if (!token) return out
  const rows = await listAll(env, token, fetchImpl)
  if (!rows) return out
  const items = pendingOf(rows)
  out.checked = items.length
  const claim = async it => !!(await call(fetchImpl, `https://firestore.googleapis.com/v1/${it.name}?currentDocument.updateTime=${encodeURIComponent(it.updateTime || '')}`, { method: 'DELETE', headers: auth(token) }))?.ok
  const log = async (it, status, note) => {
    const id = it.docId.replace(POST_QUEUE_PREFIX, '')
    const fields = toFields({ kind: POST_LOG_KIND, at: it.at, message: String(it.message || '').slice(0, 300), imageUrl: it.imageUrl || '', link: it.link || '', pageIds: it.pageIds || [], pageNames: it.pageNames || [], toInstagram: !!it.toInstagram, by: it.by || '', status, note, doneAt: new Date(now).toISOString() })
    await call(fetchImpl, `${fsBase(env)}/system_integrations/${POST_LOG_PREFIX}${id}`, { method: 'PATCH', headers: auth(token), body: JSON.stringify({ fields }) })
  }
  for (const it of items) {
    const at = new Date(it.at || '').getTime()
    if (!Number.isFinite(at) || at > now) continue
    if (!(await claim(it))) continue
    if (now - at > MAX_LATE_MS) { out.missed++; await log(it, 'missed', 'เลยเวลาที่กำหนดเกิน 6 ชั่วโมง ระบบจึงไม่โพสต์ย้อนหลัง'); continue }
    try {
      const payload = { pageIds: it.pageIds || [], message: it.message || '', imageUrl: it.imageUrl || '', link: it.link || '', toInstagram: !!it.toInstagram }
      const res = post ? await post(payload) : await metaPost(env, payload)
      if (res?.configured === false) throw new Error('ยังไม่ได้เชื่อม Facebook')
      const s = summarizePostResult(res)
      if (s.status === 'failed') out.failed++; else out.sent++
      await log(it, s.status, s.note)
    } catch (e) {
      out.failed++
      await log(it, 'failed', `โพสต์อัตโนมัติไม่สำเร็จ: ${String(e?.message || e).slice(0, 200)}`)
    }
  }
  // ล้างผลเก่าเกิน 14 วัน
  for (const l of logsOf(rows)) {
    const t = new Date(l.doneAt || '').getTime()
    if (Number.isFinite(t) && now - t > LOG_KEEP_MS) { const d = await call(fetchImpl, `https://firestore.googleapis.com/v1/${l.name}`, { method: 'DELETE', headers: auth(token) }); if (d?.ok) out.cleaned++ }
  }
  return out
}
