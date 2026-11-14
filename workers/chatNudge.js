// (v1.0.1153) เตือนเมื่อลูกค้าทักแชต (LINE OA / Facebook / Instagram) แล้วยังไม่มีใครตอบเกิน 15 นาที
//
// ต่อจาก leadNudge.js (ลีดไม่มีใครติดต่อ): แชตที่ข้อความล่าสุดมาจากลูกค้าและยังไม่ได้อ่าน/ตอบ หรือ AI ตอบไปแล้วแต่ส่งต่อให้คน (needsHuman)
// → LINE หาเจ้าของ + แจ้งเตือนในแอปถึงผู้จัดการและเซลส์ · เตือนครั้งเดียวต่อข้อความล่าสุด (ประทับ chatNudgedAt ก่อนส่ง)
// เฉพาะ 08:30–20:00 เวลาไทย · แชตที่ค้างกลางคืนถูกเตือนตอนเช้า · ปิดได้ด้วยสวิตช์ "แจ้งเตือนทันทีเมื่อมีลีดใหม่"
import { inNudgeHours } from './leadNudge.js'

export const CHAT_NUDGE_AFTER_MS = 15 * 60 * 1000
export const CHAT_NUDGE_MAX_AGE_MS = 18 * 3600 * 1000
const clip = (s, n) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n)
const ms = v => { const t = new Date(v || '').getTime(); return Number.isFinite(t) ? t : NaN }

/** แชตที่รอคนตอบเกิน 15 นาที และยังไม่เคยเตือนสำหรับข้อความล่าสุดนี้ */
export function pickWaitingChats(threads = [], now = Date.now()) {
  return threads.filter(t => {
    if (!t || t.deleted) return false
    const waiting = (t.lastDirection === 'in' && t.unread !== false) || t.needsHuman === true
    if (!waiting) return false
    const at = ms(t.lastAt)
    if (!Number.isFinite(at)) return false
    const age = now - at
    if (age < CHAT_NUDGE_AFTER_MS || age > CHAT_NUDGE_MAX_AGE_MS) return false
    const nudged = ms(t.chatNudgedAt)
    return !(Number.isFinite(nudged) && nudged >= at)
  })
}

export function chatNudgeText(list = [], { appUrl = '', now = Date.now() } = {}) {
  const lines = [`💬 มีแชตลูกค้ารอตอบ ${list.length} ห้อง (เกิน 15 นาที)`]
  for (const t of list.slice(0, 5)) {
    const mins = Math.round((now - ms(t.lastAt)) / 60000)
    const waited = mins >= 120 ? `${Math.floor(mins / 60)} ชม.` : `${mins} นาที`
    lines.push(`• ${clip(t.name, 40) || 'ลูกค้า'}${t.channelName ? ` (${clip(t.channelName, 30)})` : ''} รอ ${waited}${t.needsHuman ? ' · AI ส่งต่อให้คน' : ''}${t.lastText && t.lastDirection === 'in' ? `: "${clip(t.lastText, 60)}"` : ''}`)
  }
  if (list.length > 5) lines.push(`และอีก ${list.length - 5} ห้อง`)
  const base = String(appUrl || '').replace(/\/+$/, '')
  if (base) lines.push(`👉 ${base}/marketing/channels`)
  return lines.join('\n')
}

/**
 * deps: { enabled, appUrl, now, listThreads(): threads[], mark(id, iso): bool, ownerTarget(), pushLine(to,text), notify(body) }
 * ไม่ throw — รวมทุกห้องเป็นข้อความเดียว (ไม่ส่ง LINE รัว)
 */
export async function runChatNudge(deps = {}) {
  const out = { waiting: 0, nudged: 0 }
  try {
    const now = deps.now || Date.now()
    if (deps.enabled === false || !inNudgeHours(now)) return out
    const waiting = pickWaitingChats(await deps.listThreads(), now).slice(0, 20)
    out.waiting = waiting.length
    const marked = []
    for (const t of waiting) {
      if (await Promise.resolve(deps.mark(t.id, new Date(now).toISOString())).catch(() => false)) marked.push(t)
    }
    out.nudged = marked.length
    if (!marked.length) return out
    const owner = deps.ownerTarget ? await Promise.resolve(deps.ownerTarget()).catch(() => '') : ''
    if (owner && deps.pushLine) await Promise.resolve(deps.pushLine(owner, chatNudgeText(marked, { appUrl: deps.appUrl, now }))).catch(() => false)
    if (deps.notify) {
      const first = marked[0]
      await Promise.resolve(deps.notify({
        title: marked.length === 1 ? `💬 แชตรอตอบ: ${clip(first.name, 40) || 'ลูกค้า'}` : `💬 มีแชตลูกค้ารอตอบ ${marked.length} ห้อง`,
        body: [marked.length === 1 && first.channelName ? clip(first.channelName, 30) : '', marked.some(t => t.needsHuman) ? 'AI ส่งต่อให้คนตอบ' : '', 'รอเกิน 15 นาทีแล้ว'].filter(Boolean).join(' · '),
        link: marked.length === 1 ? `/marketing/channels?open=${encodeURIComponent(first.id)}` : '/marketing/channels', type: 'lead',
        roles: ['manager', 'sales'], names: [],
      })).catch(() => {})
    }
  } catch { /* ไม่ให้ cron ล้ม */ }
  return out
}
