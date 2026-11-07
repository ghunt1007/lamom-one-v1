// หน้าต่าง "ปรับหน้าตา" (v1.0.962 — ธีมเดียว): เลือกโหมด มืด / สว่าง / ตามเครื่อง จากภาพตัวอย่างจริง +
// ขนาดตัวอักษร · ความโค้งมุม · ระยะห่าง — เปลี่ยนทันทีและจำไว้ในเครื่องนี้
import { openModal } from '../utils/modal.js'
import { setMode } from '../core/store.js'
import { UI_OPTIONS, UI_DEFAULTS, loadUi, saveUi, applyUi } from '../utils/appearance.js'

const MODES = [
  ['dark', '🌙 มืด', 'สบายตาตอนกลางคืน/ในร่ม'],
  ['light', '☀️ สว่าง', 'อ่านชัดกลางแดด/พิมพ์ออก'],
  ['auto', '🖥 ตามเครื่อง', 'สลับเองตามมือถือ/คอม'],
]

function modePref() {
  try { return localStorage.getItem('lamom_mode') || 'dark' } catch { return 'dark' }
}

// ภาพย่อหน้าจอจริง: ใส่ data-mode ที่กล่อง ตัวแปรสีของโหมดนั้นจึงมีผลเฉพาะในกล่อง
function preview(mode) {
  const box = m => `<div class="ts-prev" data-mode="${m}" aria-hidden="true">
    <i class="ts-side"><b></b><b></b><b></b></i>
    <span class="ts-main"><i class="ts-bar"></i><span class="ts-kpis"><i></i><i></i><i></i></span><span class="ts-row"><i class="ts-line"></i><i class="ts-btn"></i></span></span>
  </div>`
  return mode === 'auto' ? `<div class="ts-prev-split">${box('light')}${box('dark')}</div>` : box(mode)
}

export function openThemeStudio() {
  document.getElementById('theme-studio')?.closest('.modal-overlay')?.remove()
  let ui = loadUi()
  const seg = (key, opts, cur) => `<div class="ts-seg" data-key="${key}">${opts.map(([v, label]) =>
    `<button type="button" data-val="${v}" class="${v === cur ? 'on' : ''}">${label}</button>`).join('')}</div>`

  const body = () => {
    const mode = modePref()
    return `
    <div id="theme-studio">
      <div class="ts-group">โหมดสี</div>
      <div class="ts-grid ts-modes">
        ${MODES.map(([id, label, hint]) => `
          <button type="button" class="ts-card${id === mode ? ' on' : ''}" data-mode-pick="${id}">
            ${preview(id)}
            <span class="ts-name"><span>${label}</span>${id === mode ? '<b>✓</b>' : ''}</span>
            <span class="ts-hint">${hint}</span>
          </button>`).join('')}
      </div>
      <div class="ts-group">ปรับให้เหมาะกับคุณ</div>
      <div class="ts-settings">
        <label>ขนาดตัวอักษร ${seg('font', UI_OPTIONS.font, ui.font)}</label>
        <label>ระยะห่าง ${seg('density', UI_OPTIONS.density, ui.density)}</label>
        <label>มุมการ์ด/ปุ่ม ${seg('radius', UI_OPTIONS.radius, ui.radius)}</label>
      </div>
    </div>`
  }

  const m = openModal({
    title: '🎨 ปรับหน้าตาโปรแกรม', size: 'lg', body: body(),
    footer: `<span class="ts-foot-hint" style="flex:1;font-size:0.74rem;color:var(--text-muted)">เปลี่ยนทันที · จำไว้ในเครื่องนี้</span><button class="btn btn-secondary" id="ts-reset">↺ ค่าเริ่มต้น</button><button class="btn btn-primary" id="ts-done">✅ เสร็จ</button>`,
  })
  const setUi = patch => { ui = { ...ui, ...patch }; saveUi(ui); applyUi(ui) }
  const rerender = () => { const b = m.el.querySelector('.modal-body'); const sc = b.scrollTop; b.innerHTML = body(); b.scrollTop = sc }

  m.el.addEventListener('click', e => {
    const mp = e.target.closest('[data-mode-pick]')
    if (mp) { setMode(mp.dataset.modePick); rerender(); return }
    const btn = e.target.closest('.ts-seg [data-val]')
    if (btn) { setUi({ [btn.closest('.ts-seg').dataset.key]: btn.dataset.val }); rerender(); return }
    if (e.target.closest('#ts-reset')) { ui = { ...UI_DEFAULTS }; saveUi(ui); applyUi(ui); setMode('dark'); rerender() }
    if (e.target.closest('#ts-done')) m.close()
  })
}
