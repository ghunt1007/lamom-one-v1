import { on } from '../../core/store.js'
import { escHtml } from '../../utils/escape.js'

const ICONS = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' }
// (v1.0.986) ข้อความที่ขึ้นต้นด้วยอีโมจิอยู่แล้ว (เช่น "✅ บันทึกแล้ว", "📋 คัดลอกแล้ว") ใช้อีโมจินั้นเป็นไอคอนแทน
// เดิมขึ้นซ้อนกันเป็น "✅ ✅ บันทึกแล้ว" ทั่วทั้งแอป
const LEAD_EMOJI = /^\s*(\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic}|\uFE0F?\u20E3)*)\s*/u
export function toastParts(type, message) {
  const msg = String(message ?? '')
  const m = LEAD_EMOJI.exec(msg)
  return m && m[0].length < msg.length ? { icon: m[1], text: msg.slice(m[0].length) } : { icon: ICONS[type] || 'ℹ️', text: msg }
}

export function ToastContainer(container) {
  const wrap = document.createElement('div')
  wrap.className = 'toast-container'
  container.appendChild(wrap)

  const unsub = on('toast', (toast) => {
    if (!toast) return
    const el = document.createElement('div')
    el.className = `toast ${toast.type || 'info'} animate-fade`
    const { icon, text } = toastParts(toast.type, toast.message)
    el.innerHTML = `
      <span class="toast-icon">${icon}</span>
      <span class="toast-msg">${escHtml(text)}</span>
      <button class="toast-close">✕</button>
    `
    el.querySelector('.toast-close').addEventListener('click', () => el.remove())
    wrap.appendChild(el)
    setTimeout(() => el.remove(), 4500)
  })

  return () => unsub()
}
