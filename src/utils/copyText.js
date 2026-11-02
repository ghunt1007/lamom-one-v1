// (v1.0.916) คัดลอกข้อความ — ที่เดียวทั้งแอป (เดิมเขียนซ้ำ 15 ที่ และบางที่ไม่ดักกรณีคัดลอกไม่ได้)
// ลอง Clipboard API ก่อน ถ้าไม่ได้ (แอป Android/เบราว์เซอร์เก่า/ไม่ให้สิทธิ์) ใช้วิธีเลือกข้อความแล้ว copy แบบเดิม
// คืน true ถ้าคัดลอกได้ · แสดงข้อความแจ้งให้เอง
import { showToast } from '../core/store.js'

export function legacyCopy(text, doc = typeof document !== 'undefined' ? document : null) {
  if (!doc || !doc.body) return false
  const ta = doc.createElement('textarea')
  ta.value = String(text ?? '')
  ta.setAttribute('readonly', '')
  ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none'
  doc.body.appendChild(ta)
  const active = doc.activeElement
  ta.select()
  try { ta.setSelectionRange(0, ta.value.length) } catch {}
  let ok = false
  try { ok = doc.execCommand('copy') } catch { ok = false }
  ta.remove()
  try { active?.focus?.({ preventScroll: true }) } catch {}
  return ok
}

export async function copyText(text, okMsg = '📋 คัดลอกแล้ว', failMsg = 'คัดลอกไม่สำเร็จ — กดค้างที่ข้อความแล้วคัดลอกเอง') {
  let ok = false
  try {
    if (navigator?.clipboard?.writeText) { await navigator.clipboard.writeText(String(text ?? '')); ok = true }
  } catch { ok = false }
  if (!ok) ok = legacyCopy(text)
  if (okMsg || failMsg) showToast(ok ? okMsg : failMsg, ok ? 'success' : 'warning')
  return ok
}
