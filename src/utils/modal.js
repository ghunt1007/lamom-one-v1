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
        <span class="modal-title">${title}</span>
        <button class="modal-close" id="${id}-close">✕</button>
      </div>
      <div class="modal-body">${body}</div>
      ${autoFooter ? `<div class="modal-footer">${autoFooter}</div>` : ''}
    </div>
  `
  div.querySelector(`#${id}-close`).addEventListener('click', () => { div.remove(); onClose?.() })
  div.addEventListener('click', e => { if (e.target === div) { div.remove(); onClose?.() } })
  div.querySelector(`#${id}-cancel`)?.addEventListener('click', () => { div.remove(); onClose?.() })
  div.querySelector(`#${id}-confirm`)?.addEventListener('click', () => {
    const result = onConfirm?.()
    if (result !== false) div.remove() // คืน false จาก onConfirm = ไม่ปิด modal (เช่น validation ไม่ผ่าน)
  })
  document.body.appendChild(div)
  return { id, el: div, close: () => div.remove() }
}

export function confirmDialog({ title = 'ยืนยัน', message, confirmText = 'ยืนยัน', cancelText = 'ยกเลิก', danger = false } = {}) {
  return new Promise(resolve => {
    const { el, close } = openModal({
      title,
      size: 'sm',
      body: `<p style="color:var(--text-2)">${message}</p>`,
      footer: `
        <button class="btn btn-secondary" id="modal-cancel">${cancelText}</button>
        <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="modal-confirm">${confirmText}</button>
      `
    })
    el.querySelector('#modal-cancel').addEventListener('click', () => { close(); resolve(false) })
    el.querySelector('#modal-confirm').addEventListener('click', () => { close(); resolve(true) })
  })
}
