// (v1.0.1143) ส่ง LINE Broadcast ตามเวลาที่กำหนดไว้ "เอง" — เดิมหน้า Broadcast บันทึกเวลาได้แต่ทีมต้องกลับมากดส่งเอง
//
// ทำงานอย่างไร
//   1) หน้า /comms/broadcast กด ⏰ กำหนดเวลา → เรียก POST /social/line/schedule (เฉพาะผู้จัดการ/การตลาด/เจ้าของ)
//   2) worker เก็บ "คิวส่ง" ไว้ที่ system_integrations/sched_<id> — collection นี้เปิดเฉพาะเจ้าของโปรแกรม
//      (พนักงานทั่วไปเขียนเองไม่ได้ จึงปลอมคิวให้ระบบส่งข้อความหาลูกค้าไม่ได้ ต่างจาก collection broadcasts ที่พนักงานแก้ได้)
//   3) cron ทุก 10 นาที (SEND_CRON) หยิบคิวที่ถึงเวลา → "ลบคิวก่อนแล้วค่อยส่ง" (ลบสำเร็จได้ครั้งเดียว = ไม่มีทางส่งซ้ำ)
//      → อัปเดตผลกลับไปที่ broadcasts/<id>
//   คิวที่เลยเวลาเกิน 6 ชม. (เช่น ระบบล่ม) จะไม่ส่งย้อนหลัง — ตีกลับเป็นร่างพร้อมหมายเหตุ
import { lineMulticast, lineBroadcast, MULTICAST_ROLES } from './social.js'

export const SEND_CRON = '*/10 * * * *'
export const QUEUE_PREFIX = 'sched_'
export const MAX_LATE_MS = 6 * 3600 * 1000
export const MAX_AHEAD_MS = 60 * 24 * 3600 * 1000
const MAX_TEXT = 4500

const fsBase = env => `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`
async function call(fetchImpl, url, init) { try { return await fetchImpl(url, init) } catch { return null } }
const bad = (msg, status = 400) => Object.assign(new Error(msg), { status })
const auth = token => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' })

export const queueId = id => QUEUE_PREFIX + String(id || '').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 120)
const isLineUser = v => /^U[0-9a-f]{10,40}$/i.test(String(v || ''))

function enc(v) {
  if (v === null || v === undefined) return { nullValue: null }
  if (typeof v === 'boolean') return { booleanValue: v }
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }
  if (Array.isArray(v)) return { arrayValue: { values: v.map(enc) } }
  return { stringValue: String(v) }
}
function dec(v = {}) {
  if ('stringValue' in v) return v.stringValue
  if ('booleanValue' in v) return v.booleanValue
  if ('integerValue' in v) return Number(v.integerValue)
  if ('doubleValue' in v) return v.doubleValue
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(dec)
  return null
}
const decDoc = d => Object.fromEntries(Object.entries(d.fields || {}).map(([k, v]) => [k, dec(v)]))

/** ตรวจคำขอกำหนดเวลา → คืนข้อมูลคิวที่สะอาดแล้ว (throw ถ้าไม่ผ่าน) */
export function cleanSchedule(body = {}, now = Date.now()) {
  const id = String(body.id || '').trim()
  if (!id) throw bad('ไม่พบรายการ Broadcast')
  const text = String(body.text || '').trim().slice(0, MAX_TEXT)
  if (!text) throw bad('ข้อความว่าง — พิมพ์ข้อความก่อนกำหนดเวลา')
  const at = new Date(body.at || '').getTime()
  if (!Number.isFinite(at)) throw bad('วันเวลาไม่ถูกต้อง')
  if (at < now + 60_000) throw bad('เวลาที่เลือกผ่านไปแล้ว — เลือกเวลาในอนาคต')
  if (at > now + MAX_AHEAD_MS) throw bad('กำหนดล่วงหน้าได้ไม่เกิน 60 วัน')
  const all = body.all === true
  const userIds = all ? [] : [...new Set((Array.isArray(body.userIds) ? body.userIds : []).filter(isLineUser))].slice(0, 2000)
  if (!all && !userIds.length) throw bad('ไม่มีลูกค้าที่ส่ง LINE ได้ในกลุ่มนี้ (ส่งได้เฉพาะคนที่เคยทัก LINE OA)')
  return { id, text, at: new Date(at).toISOString(), all, userIds }
}

export async function scheduleSend(env, token, body, { role = '', by = '', fetchImpl = fetch, now = Date.now() } = {}) {
  if (!MULTICAST_ROLES.includes(role)) throw bad('เฉพาะผู้จัดการ/การตลาด/เจ้าของเท่านั้นที่ตั้งเวลาส่งข้อความหาลูกค้าได้', 403)
  if (!env.LINE_CHANNEL_ACCESS_TOKEN) return { configured: false, error: 'LINE OA ยังไม่ได้ตั้งค่า' }
  const q = cleanSchedule(body, now)
  const fields = Object.fromEntries(Object.entries({ kind: 'line-broadcast', broadcastId: q.id, text: q.text, at: q.at, all: q.all, userIds: q.userIds, by: String(by).slice(0, 80), createdAt: new Date(now).toISOString() }).map(([k, v]) => [k, enc(v)]))
  const r = await call(fetchImpl, `${fsBase(env)}/system_integrations/${queueId(q.id)}`, { method: 'PATCH', headers: auth(token), body: JSON.stringify({ fields }) })
  if (!r?.ok) throw bad('บันทึกกำหนดการไม่สำเร็จ ลองใหม่อีกครั้ง', 502)
  return { configured: true, scheduled: true, at: q.at, recipients: q.all ? null : q.userIds.length }
}

export async function unscheduleSend(env, token, body, { role = '', fetchImpl = fetch } = {}) {
  if (!MULTICAST_ROLES.includes(role)) throw bad('เฉพาะผู้จัดการ/การตลาด/เจ้าของเท่านั้น', 403)
  const id = String(body?.id || '').trim()
  if (!id) throw bad('ไม่พบรายการ Broadcast')
  const r = await call(fetchImpl, `${fsBase(env)}/system_integrations/${queueId(id)}`, { method: 'DELETE', headers: auth(token) })
  if (!r?.ok) throw bad('ยกเลิกไม่สำเร็จ ลองใหม่อีกครั้ง', 502)
  return { configured: true, cancelled: true }
}

/** แยกคิว: ถึงเวลา (due) / เลยเวลานานเกิน (missed) / ยังไม่ถึง (ไม่คืน) */
export function splitQueue(items = [], now = Date.now()) {
  const due = [], missed = []
  for (const it of items) {
    const at = new Date(it.at || '').getTime()
    if (!Number.isFinite(at) || at > now) continue
    ;(now - at > MAX_LATE_MS ? missed : due).push(it)
  }
  return { due, missed }
}

async function patchBroadcast(env, token, id, data, fetchImpl) {
  const mask = Object.keys(data).map(k => 'updateMask.fieldPaths=' + k).join('&')
  const fields = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, enc(v)]))
  // currentDocument.exists=true — ถ้ารายการถูกลบไปแล้ว ไม่สร้างเอกสารเปล่าขึ้นมาใหม่
  await call(fetchImpl, `${fsBase(env)}/broadcasts/${encodeURIComponent(id)}?${mask}&currentDocument.exists=true`, { method: 'PATCH', headers: auth(token), body: JSON.stringify({ fields }) })
}

/** เรียกจาก cron ทุก 10 นาที — คืนสรุปว่าส่ง/ข้ามกี่รายการ */
export async function runScheduledSends(env, token, { fetchImpl = fetch, now = Date.now(), send = null } = {}) {
  const out = { checked: 0, sent: 0, failed: 0, missed: 0 }
  if (!token) return out
  const r = await call(fetchImpl, `${fsBase(env)}/system_integrations?pageSize=200`, { headers: auth(token) })
  if (!r?.ok) return out
  const docs = ((await r.json().catch(() => ({}))).documents || []).filter(d => String(d.name || '').split('/').pop().startsWith(QUEUE_PREFIX))
  const items = docs.map(d => ({ ...decDoc(d), name: d.name, updateTime: d.updateTime })).filter(i => i.kind === 'line-broadcast')
  out.checked = items.length
  const { due, missed } = splitQueue(items, now)
  const claim = async it => {
    // ลบคิวพร้อมเงื่อนไข updateTime — ถ้ามี cron สองรอบชนกัน จะมีรอบเดียวที่ลบสำเร็จ จึงส่งได้ครั้งเดียว
    const del = await call(fetchImpl, `https://firestore.googleapis.com/v1/${it.name}?currentDocument.updateTime=${encodeURIComponent(it.updateTime || '')}`, { method: 'DELETE', headers: auth(token) })
    return !!del?.ok
  }
  for (const it of missed) {
    if (!(await claim(it))) continue
    out.missed++
    await patchBroadcast(env, token, it.broadcastId, { status: 'draft', autoSend: false, scheduleNote: 'เลยเวลาที่กำหนดเกิน 6 ชั่วโมง ระบบจึงไม่ส่งย้อนหลัง — กดส่งเองหรือกำหนดเวลาใหม่' }, fetchImpl)
  }
  const role = MULTICAST_ROLES[0]
  for (const it of due) {
    if (!(await claim(it))) continue
    const sentAt = new Date(now).toISOString()
    try {
      const res = send ? await send(it) : (it.all ? await lineBroadcast(env, { text: it.text }, role) : await lineMulticast(env, { userIds: it.userIds, text: it.text }, role))
      if (res?.configured === false) throw new Error(res.error || 'LINE OA ยังไม่ได้ตั้งค่า')
      out.sent++
      await patchBroadcast(env, token, it.broadcastId, { status: 'sent', autoSend: false, sentAt, sentBy: 'auto', recipients: it.all ? null : (it.userIds || []).length, sent: res?.sent ?? null, failed: res?.failed ?? 0, scheduleNote: (res?.errors || []).slice(0, 2).join(' · ') }, fetchImpl)
    } catch (e) {
      out.failed++
      await patchBroadcast(env, token, it.broadcastId, { status: 'failed', autoSend: false, sentBy: 'auto', scheduleNote: `ส่งอัตโนมัติไม่สำเร็จ: ${String(e?.message || e).slice(0, 200)}` }, fetchImpl)
    }
  }
  return out
}
