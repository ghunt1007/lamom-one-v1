import { on } from '../../core/store.js'

const ICONS = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' }

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function ToastContainer(container) {
  const wrap = document.createElement('div')
  wrap.className = 'toast-container'
  container.appendChild(wrap)

  const unsub = on('toast', (toast) => {
    if (!toast) return
    const el = document.createElement('div')
    el.className = `toast ${toast.type || 'info'} animate-fade`
    el.innerHTML = `
      <span class="toast-icon">${ICONS[toast.type] || 'ℹ️'}</span>
      <span class="toast-msg">${escHtml(toast.message)}</span>
      <button class="toast-close">✕</button>
    `
    el.querySelector('.toast-close').addEventListener('click', () => el.remove())
    wrap.appendChild(el)
    setTimeout(() => el.remove(), 4500)
  })

  return () => unsub()
}
