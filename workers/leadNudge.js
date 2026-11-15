// (v1.0.1146) เตือนซ้ำเมื่อลีดใหม่ (ที่เข้ามาเองทางฟอร์ม/webhook/แชต) ยังไม่มีใครติดต่อเกิน 30 นาที
//
// ต่อจาก workers/leadAlert.js (แจ้งทันทีตอนลีดเข้า): ถ้าผ่านไป 30 นาทีแล้วยังไม่มีการกด "ติดตามแล้ว" (lastContactAt ว่าง)
// → LINE หาเซลส์ที่ดูแล (ถ้าไม่ได้ลงทะเบียน LINE หรือยังไม่มีผู้ดูแล → หาเจ้าของ) + แจ้งเตือนในแอปถึงผู้จัดการ
// เตือนครั้งเดียวต่อลีด (ประทับ leadNudgedAt ก่อนส่ง) · เฉพาะ 08:30–20:00 เวลาไทย · ลีดที่เข้ากลางคืนจะถูกเตือนตอนเช้า
// เรียกจาก cron ทุก 10 นาทีเดียวกับตัวส่ง Broadcast ตามเวลา · ปิดได้ด้วยสวิตช์ "แจ้งเตือนทันทีเมื่อมีลีดใหม่"
import { fmtPhone, salesLineId } from './leadAlert.js'

export const NUDGE_AFTER_MS = 30 * 60 * 1000
// (v1.0.1182) ลีดที่สแกน QR หน้างาน (บูธ / รถโชว์) — ลูกค้ายังยืนอยู่ตรงนั้น รอ 30 นาทีก็เดินกลับไปแล้ว → เตือนหลัง 10 นาที
export const NUDGE_ONSITE_MS = 10 * 60 * 1000
export const isOnsiteLead = c => !!(c && (c.eventId || c.utmMedium === 'qr'))
export const NUDGE_MAX_AGE_MS = 18 * 3600 * 1000
const clip = (s, n) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n)

export function inNudgeHours(now = Date.now()) {
  const hhmm = new Date(now + 7 * 3600 * 1000).toISOString().slice(11, 16)
  return hhmm >= '08:30' && hhmm < '20:00'
}

/** ลีดอัตโนมัติที่ค้างเกิน 30 นาที ยังไม่มีใครติดต่อ และยังไม่เคยเตือน */
export function pickStaleLeads(customers = [], now = Date.now()) {
  return customers.filter(c => {
    if (!c || c.autoLead !== true || c.deleted || c.isLost || c.lastContactAt || c.leadNudgedAt) return false
    if (c.stage && !['lead', 'pp'].includes(c.stage)) return false
    const at = new Date(c.createdAt || '').getTime()
    if (!Number.isFinite(at)) return false
    const age = now - at
    return age >= (isOnsiteLead(c) ? NUDGE_ONSITE_MS : NUDGE_AFTER_MS) && age <= NUDGE_MAX_AGE_MS
  })
}

// (v1.0.1214) ลูกค้าเดิมทักมาอีกครั้ง (reEnquiredAt จาก leadIntake) ยังไม่มีใครโทรกลับเกิน 30 นาที และยังไม่เคยเตือนรอบนี้
const ms = v => { const t = new Date(v || '').getTime(); return Number.isFinite(t) ? t : 0 }
export function pickStaleReturns(customers = [], now = Date.now()) {
  return customers.filter(c => {
    if (!c || c.deleted) return false
    const at = ms(c.reEnquiredAt)
    if (!at) return false
    const age = now - at
    if (age < NUDGE_AFTER_MS || age > NUDGE_MAX_AGE_MS) return false
    return !(ms(c.lastContactAt) > at) && !(ms(c.backNudgedAt) >= at)
  })
}

export function backNudgeText(c = {}, { appUrl = '', now = Date.now() } = {}) {
  const name = clip(`${c.firstName || ''} ${c.lastName || ''}`, 80) || 'ไม่ระบุชื่อ'
  const mins = Math.max(30, Math.round((now - ms(c.reEnquiredAt)) / 60000))
  const waited = mins >= 120 ? `${Math.floor(mins / 60)} ชั่วโมง` : `${mins} นาที`
  const lines = [`📣 ลูกค้าเดิมทักมาอีกครั้ง ${waited}แล้ว ยังไม่มีใครโทรกลับ`, `👤 ${name}`]
  if (c.phone) lines.push(`📞 ${fmtPhone(c.phone)}`)
  if (c.reEnquiredModel || c.interestedModel) lines.push(`🚗 สนใจ ${clip(c.reEnquiredModel || c.interestedModel, 80)}`)
  if (c.isLost) lines.push('↩️ เคยเสียดีล — ลูกค้ากลับมาเอง โอกาสดี')
  lines.push(c.assignedTo ? `🙋 ผู้ดูแล: ${clip(c.assignedTo, 60)}` : '🙋 ยังไม่มีผู้ดูแล')
  lines.push('โทรแล้วกด "ติดต่อแล้ว" ในแอป ระบบจะหยุดเตือน')
  const base = String(appUrl || '').replace(/\/+$/, '')
  if (base && c.id) lines.push(`👉 ${base}/crm/customers?id=${encodeURIComponent(c.id)}`)
  return lines.join('\n')
}

export function nudgeText(c = {}, { appUrl = '', now = Date.now() } = {}) {
  const name = clip(`${c.firstName || ''} ${c.lastName || ''}`, 80) || 'ไม่ระบุชื่อ'
  const onsite = isOnsiteLead(c)
  const mins = Math.max(onsite ? 10 : 30, Math.round((now - new Date(c.createdAt).getTime()) / 60000))
  const waited = mins >= 120 ? `${Math.floor(mins / 60)} ชั่วโมง` : `${mins} นาที`
  const lines = [`⏰ ลีดรอมา ${waited}แล้ว ยังไม่มีใครติดต่อ`, `👤 ${name}`]
  if (onsite) lines.push(c.eventId ? `📍 สแกน QR ที่บูธ${c.eventName ? ' ' + clip(c.eventName, 60) : ''} — ลูกค้าอาจยังอยู่ที่บูธ` : (c.utmSource === 'walk-in' ? '📍 สแกน QR ที่รถโชว์ — ลูกค้าอาจยังอยู่ในโชว์รูม' : '📍 สแกน QR เข้ามา — รีบติดต่อขณะลูกค้ายังสนใจ'))
  if (c.phone) lines.push(`📞 ${fmtPhone(c.phone)}`)
  if (c.interestedModel) lines.push(`🚗 สนใจ ${clip(c.interestedModel, 80)}`)
  lines.push(c.assignedTo ? `🙋 ผู้ดูแล: ${clip(c.assignedTo, 60)}` : '🙋 ยังไม่มีผู้ดูแล')
  lines.push('ติดต่อแล้วกด "ติดตามแล้ว" ในแอป ระบบจะหยุดเตือน')
  const base = String(appUrl || '').replace(/\/+$/, '')
  if (base && c.id) lines.push(`👉 ${base}/crm/customers?id=${encodeURIComponent(c.id)}`)
  return lines.join('\n')
}

/**
 * deps: { enabled, appUrl, now, listRecent(): customers[], mark(id, iso): bool, salesTargets(), ownerTarget(), pushLine(to,text), notify(body) }
 * ไม่ throw
 */
export async function runLeadNudge(deps = {}) {
  const out = { stale: 0, nudged: 0 }
  try {
    const now = deps.now || Date.now()
    if (deps.enabled === false || !inNudgeHours(now)) return out
    const stale = pickStaleLeads(await deps.listRecent(), now).slice(0, 10)
    const back = deps.listBack ? pickStaleReturns(await Promise.resolve(deps.listBack()).catch(() => []), now).filter(c => !stale.some(x => x.id === c.id)).slice(0, 10) : []
    out.stale = stale.length
    if (deps.listBack) out.back = back.length
    if (!stale.length && !back.length) return out
    const targets = deps.salesTargets ? await Promise.resolve(deps.salesTargets()).catch(() => []) : []
    const owner = deps.ownerTarget ? await Promise.resolve(deps.ownerTarget()).catch(() => '') : ''
    for (const c of stale) {
      // ประทับก่อนส่ง — ถ้าประทับไม่สำเร็จ (เช่น cron ชนกัน/ลูกค้าถูกลบ) ไม่ส่ง กันเตือนซ้ำ
      if (!(await Promise.resolve(deps.mark(c.id, new Date(now).toISOString())).catch(() => false))) continue
      out.nudged++
      const text = nudgeText(c, { appUrl: deps.appUrl, now })
      const to = salesLineId(targets, c.assignedTo) || owner
      if (to && deps.pushLine) await Promise.resolve(deps.pushLine(to, text)).catch(() => false)
      if (deps.notify) {
        const name = clip(`${c.firstName || ''} ${c.lastName || ''}`, 80) || 'ไม่ระบุชื่อ'
        await Promise.resolve(deps.notify({
          title: `⏰ ลีดยังไม่มีใครติดต่อ: ${name}`,
          body: [c.phone ? `โทร ${fmtPhone(c.phone)}` : '', c.assignedTo ? `ผู้ดูแล ${clip(c.assignedTo, 60)}` : 'ยังไม่มีผู้ดูแล', 'รอเกิน 30 นาทีแล้ว'].filter(Boolean).join(' · '),
          link: `/crm/customers?id=${encodeURIComponent(c.id)}`, type: 'lead',
          roles: c.assignedTo ? ['manager'] : ['manager', 'sales'], names: c.assignedTo ? [c.assignedTo] : [],
        })).catch(() => {})
      }
    }
    for (const c of back) {
      if (!deps.markBack || !(await Promise.resolve(deps.markBack(c.id, new Date(now).toISOString())).catch(() => false))) continue
      out.nudged++
      const to = salesLineId(targets, c.assignedTo) || owner
      if (to && deps.pushLine) await Promise.resolve(deps.pushLine(to, backNudgeText(c, { appUrl: deps.appUrl, now }))).catch(() => false)
      if (deps.notify) {
        const name = clip(`${c.firstName || ''} ${c.lastName || ''}`, 80) || 'ไม่ระบุชื่อ'
        await Promise.resolve(deps.notify({
          title: `📣 ลูกค้าเดิมรอโทรกลับ: ${name}`,
          body: [c.phone ? `โทร ${fmtPhone(c.phone)}` : '', c.assignedTo ? `ผู้ดูแล ${clip(c.assignedTo, 60)}` : 'ยังไม่มีผู้ดูแล', 'ทักมาเกิน 30 นาทีแล้ว'].filter(Boolean).join(' · '),
          link: `/crm/customers?id=${encodeURIComponent(c.id)}`, type: 'lead',
          roles: c.assignedTo ? ['manager'] : ['manager', 'sales'], names: c.assignedTo ? [c.assignedTo] : [],
        })).catch(() => {})
      }
    }
  } catch { /* ไม่ให้ cron ล้ม */ }
  return out
}
