// (v1.0.1144) แจ้งเตือนทันทีเมื่อมีลีดใหม่เข้ามาทางฟอร์ม / TikTok / อีเมล / Facebook Lead Ads / แชต Facebook-Instagram
//
// ทำไม: เดิมลีดเข้ามาแล้วเงียบ ต้องมีคนเปิดแอปถึงจะเห็น — ลูกค้าที่ได้รับสายกลับใน 5 นาทีแรกปิดการขายได้ง่ายกว่ามาก
// ทำอะไร: 1) LINE ถึงเซลส์ที่ได้รับมอบหมาย (ถ้าลงทะเบียน LINE ไว้) 2) LINE ถึงเจ้าของ 3) แจ้งเตือนในแอปถึงผู้จัดการ + เซลส์คนนั้น
//          ถ้ายังไม่มีผู้ดูแล → แจ้งเซลส์ทุกคนในแอปให้รีบรับ
// ปิดได้ที่แท็บ 🤖 ตอบอัตโนมัติ (สวิตช์ "แจ้งเตือนทันทีเมื่อมีลีดใหม่")
import { normName } from './notify.js'

const SRC = { facebook: 'Facebook', line: 'LINE', tiktok: 'TikTok', instagram: 'Instagram', 'walk-in': 'Walk-in', referral: 'แนะนำ', google: 'Google', website: 'เว็บไซต์/ฟอร์ม', phone: 'โทรศัพท์', email: 'อีเมล', event: 'อีเวนต์', other: 'อื่น ๆ' }
const clip = (s, n) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n)
export const fmtPhone = p => { const d = String(p || '').replace(/\D/g, ''); return d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : d }

/** ข้อความ LINE — สั้น อ่านจบในจอเดียว มีเบอร์ให้กดโทรและลิงก์เปิดลูกค้า */
export function leadAlertText(lead = {}, { id = '', appUrl = '', duplicate = false, forOwner = false } = {}) {
  const name = clip(`${lead.first || ''} ${lead.last || ''}`, 80) || 'ไม่ระบุชื่อ'
  const src = SRC[lead.source] || clip(lead.source, 30) || 'ไม่ระบุ'
  const lines = [
    duplicate ? `🔔 ลูกค้าเดิมติดต่อเข้ามาอีกครั้ง (${src})` : `🔔 ลีดใหม่เข้ามา (${src})`,
    `👤 ${name}`,
  ]
  if (lead.phone) lines.push(`📞 ${fmtPhone(lead.phone)}`)
  if (lead.model) lines.push(`🚗 สนใจ ${clip(lead.model, 80)}`)
  if (lead.note) lines.push(`📝 ${clip(lead.note, 160)}`)
  if (forOwner) lines.push(lead.assignedTo ? `🙋 ผู้ดูแล: ${clip(lead.assignedTo, 60)}` : '🙋 ยังไม่มีผู้ดูแล')
  lines.push(lead.phone ? '⏱ โทรกลับภายใน 5 นาที โอกาสปิดสูงที่สุด' : '⏱ รีบตอบแชตภายใน 5 นาที โอกาสปิดสูงที่สุด')
  const base = String(appUrl || '').replace(/\/+$/, '')
  if (base && id) lines.push(`👉 ${base}/crm/customers?id=${encodeURIComponent(id)}`)
  return lines.join('\n')
}

/** หา LINE userId ของเซลส์จากชื่อ (ชื่อที่ลงทะเบียน LINE ไว้) */
export function salesLineId(targets = [], name = '') {
  const want = normName(name)
  if (!want) return ''
  const hit = targets.find(t => t?.userId && (normName(t.name) === want || normName(String(t.name || '').split(/\s+/)[0]) === want))
  return hit?.userId || ''
}

/**
 * deps: { enabled, appUrl, salesTargets(): [{name,userId}], ownerTarget(): userId, pushLine(to, text), notify(body) }
 * ไม่ throw — การแจ้งเตือนพังต้องไม่ทำให้การรับลีดล้มเหลว
 */
export async function alertNewLead(lead, result = {}, deps = {}) {
  const out = { line: 0, app: false }
  try {
    if (deps.enabled === false || !(result.created || result.duplicate) || !result.id) return out
    const opts = { id: result.id, appUrl: deps.appUrl, duplicate: !!result.duplicate && !result.created }
    const sent = new Set()
    const push = async (to, text) => {
      if (!to || sent.has(to)) return
      sent.add(to)
      try { if (await deps.pushLine(to, text)) out.line++ } catch { /* ข้าม */ }
    }
    if (deps.pushLine) {
      if (lead.assignedTo && deps.salesTargets) {
        const targets = await Promise.resolve(deps.salesTargets()).catch(() => [])
        await push(salesLineId(targets, lead.assignedTo), leadAlertText(lead, opts))
      }
      if (deps.ownerTarget) await push(await Promise.resolve(deps.ownerTarget()).catch(() => ''), leadAlertText(lead, { ...opts, forOwner: true }))
    }
    if (deps.notify) {
      const name = clip(`${lead.first || ''} ${lead.last || ''}`, 80) || 'ไม่ระบุชื่อ'
      const src = SRC[lead.source] || clip(lead.source, 30) || ''
      await Promise.resolve(deps.notify({
        title: opts.duplicate ? `🔔 ลูกค้าเดิมติดต่อมาอีกครั้ง: ${name}` : `🔔 ลีดใหม่: ${name}${src ? ` (${src})` : ''}`,
        body: [lead.phone ? `โทร ${fmtPhone(lead.phone)}` : '', lead.model ? `สนใจ ${clip(lead.model, 80)}` : '', lead.assignedTo ? `ผู้ดูแล ${clip(lead.assignedTo, 60)}` : 'ยังไม่มีผู้ดูแล — ใครว่างรับเลย', 'ติดต่อกลับภายใน 5 นาที'].filter(Boolean).join(' · '),
        link: `/crm/customers?id=${encodeURIComponent(result.id)}`,
        type: 'lead',
        roles: lead.assignedTo ? ['manager'] : ['manager', 'sales'],
        names: lead.assignedTo ? [lead.assignedTo] : [],
      })).then(() => { out.app = true }).catch(() => {})
    }
  } catch { /* ไม่ให้การแจ้งเตือนทำให้รับลีดล้ม */ }
  return out
}
