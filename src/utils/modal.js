import { enhanceMics } from './micInput.js'
import { validationToastCount } from '../core/store.js'
// Modal & Dialog utilities

export function openModal({ title, body, footer = '', size = 'md', onClose, onConfirm, confirmText = '✅ บันทึก', cancelText = 'ยกเลิก' } = {}) {
  const id = 'modal-' + Date.now()
  // ถ้ามี onConfirm และไม่ได้ส่ง footer มาเอง → สร้างปุ่มยืนยัน/ยกเลิกให้อัตโนมัติ
  const autoFooter = !footer && typeof onConfirm === 'function'
    ? `<button class="btn btn-secondary" id="${id}-cancel">${cancelText}</button>
       <button class="btn btn-primary" id="${id}-confirm">${confirmText}</button>`
    : footer
  const div = document.createElement('div')
  div.id = id
  div.className = 'modal-overlay'
  div.innerHTML = `
    <div class="modal modal-${size}">
      <div class="modal-header">
        <span class="modal-title">${safeInlineHtml(title)}</span>
        <button class="modal-close" id="${id}-close">✕</button>
      </div>
      <div class="modal-body">${body}</div>
      ${autoFooter ? `<div class="modal-footer">${autoFooter}</div>` : ''}
    </div>
  `
  div.querySelector(`#${id}-close`).addEventListener('click', () => { div.remove(); onClose?.() })
  div.addEventListener('click', e => { if (e.target === div) { div.remove(); onClose?.() } })
  div.querySelector(`#${id}-cancel`)?.addEventListener('click', () => { div.remove(); onClose?.() })
  div.querySelector(`#${id}-confirm`)?.addEventListener('click', async () => {
    const btn = div.querySelector(`#${id}-confirm`)
    if (btn) { btn.disabled = true; btn.textContent = '⏳ ...' }
    try {
      const warned = validationToastCount()
      const result = await onConfirm?.()
      // กรอกไม่ครบแล้วระบบเตือน (เช่น "❗ กรุณากรอกชื่อ") แต่โค้ดหน้านั้นลืม return false → อย่าปิดหน้าต่าง ข้อมูลที่พิมพ์ไว้จะหายหมด
      if (result !== false && !(result === undefined && validationToastCount() > warned)) div.remove()
    } catch (e) {
      // onConfirm threw — keep modal open so user can retry
    } finally {
      if (btn && document.body.contains(btn)) { btn.disabled = false; btn.textContent = confirmText }
    }
  })
  document.body.appendChild(div)
  enhanceMics(div)
  return { id, el: div, close: () => div.remove() }
}

// กันข้อความลูกค้า/พนักงานที่มีแท็ก HTML แฝงมากลายเป็นโค้ดในกล่องยืนยัน: อนุญาตเฉพาะ <strong> <b> <em> <br>
// แบบไม่มี attribute ที่เหลือแปลง "<" เป็น &lt; (ไม่แตะ & เพื่อให้ข้อความที่ escape มาแล้วยังแสดงถูก)
export function safeInlineHtml(s) {
  return String(s ?? '').replace(/<(?!\/?(?:strong|b|em|br)\s*\/?>)/gi, '&lt;')
}

export function confirmDialog({ title = 'ยืนยัน', message, confirmText = 'ยืนยัน', cancelText = 'ยกเลิก', danger = false } = {}) {
  return new Promise(resolve => {
    const { el, close } = openModal({
      title: safeInlineHtml(title),
      size: 'sm',
      body: `<p style="color:var(--text-2)">${safeInlineHtml(message)}</p>`,
      footer: `
        <button class="btn btn-secondary" id="modal-cancel">${cancelText}</button>
        <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="modal-confirm">${confirmText}</button>
      `
    })
    el.querySelector('#modal-cancel').addEventListener('click', () => { close(); resolve(false) })
    el.querySelector('#modal-confirm').addEventListener('click', () => { close(); resolve(true) })
  })
}

// (v1.0.1043) กล่องถามค่าเดียว แทน prompt() ของเบราว์เซอร์ (ในแอป Android prompt()/confirm() ไม่ขึ้นเลย)
// คืนข้อความที่พิมพ์ หรือ null เมื่อยกเลิก · กด Enter = ตกลง
export function promptDialog({ title = 'กรอกข้อมูล', label = '', value = '', type = 'text', placeholder = '', confirmText = '✅ ตกลง' } = {}) {
  return new Promise(resolve => {
    let done = false
    const finish = v => { if (!done) { done = true; resolve(v) } }
    const esc = t => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
    const { el } = openModal({
      title, size: 'sm', confirmText,
      body: `<div class="input-group">${label ? `<label class="input-label">${safeInlineHtml(label)}</label>` : ''}
        <input class="input" id="prompt-dialog-input" type="${type === 'number' ? 'number' : 'text'}" ${type === 'number' ? 'inputmode="decimal" step="any"' : ''} value="${esc(value)}" placeholder="${esc(placeholder)}"></div>`,
      onClose: () => finish(null),
      onConfirm: () => { finish(el.querySelector('#prompt-dialog-input').value) },
    })
    el.style.zIndex = '10050' // อยู่เหนือหน้าจอเต็ม (เช่น Personal AI)
    const inp = el.querySelector('#prompt-dialog-input')
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); el.querySelector('.modal-footer .btn-primary')?.click() } })
    setTimeout(() => { inp.focus(); inp.select?.() }, 50)
  })
}
