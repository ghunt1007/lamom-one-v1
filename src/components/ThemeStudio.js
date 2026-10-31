// หน้าต่าง "ปรับหน้าตา" — เลือกธีมจากภาพตัวอย่างจริง (ไม่ต้องกดลองทีละอัน) + โหมด มืด/สว่าง/ตามเครื่อง +
// ขนาดตัวอักษร · ความโค้งมุม · ความหนาแน่น · เอฟเฟกต์ ทุกอย่างเปลี่ยนทันทีและจำไว้ในเครื่องนี้
import { openModal } from '../utils/modal.js'
import { setTheme, setMode } from '../core/store.js'
import { THEME_GROUPS } from '../data/themes.js'
import { UI_OPTIONS, loadUi, saveUi, applyUi } from '../utils/appearance.js'

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function modePref() {
  try { return localStorage.getItem('lamom_mode') || 'dark' } catch { return 'dark' }
}

// ภาพย่อของหน้าจอจริงในธีมนั้น: ใส่ data-theme/data-mode ที่กล่องตัวอย่าง ตัวแปรสีของธีมจึงมีผลเฉพาะในกล่อง
function preview(id, mode) {
  return `<div class="ts-prev" data-theme="${id}" data-mode="${mode}" aria-hidden="true">
    <i class="ts-side"><b></b><b></b><b></b></i>
    <span class="ts-main"><i class="ts-bar"></i><span class="ts-kpis"><i></i><i></i><i></i></span><span class="ts-row"><i class="ts-line"></i><i class="ts-btn"></i></span></span>
  </div>`
}

export function openThemeStudio() {
  document.getElementById('theme-studio')?.closest('.modal-overlay')?.remove()
  let ui = loadUi()
  const curTheme = () => document.documentElement.getAttribute('data-theme') || 'midnight'
  const curMode = () => document.documentElement.getAttribute('data-mode') || 'dark'
  const seg = (key, opts, cur) => `<div class="ts-seg" data-key="${key}">${opts.map(([v, label]) =>
    `<button type="button" data-val="${v}" class="${v === cur ? 'on' : ''}">${label}</button>`).join('')}</div>`

  const body = () => `
    <div id="theme-studio">
      <div class="ts-settings">
        <label>โหมด ${seg('mode', [['dark', '🌙 มืด'], ['light', '☀️ สว่าง'], ['auto', '🖥 ตามเครื่อง']], modePref())}</label>
        <label>ขนาดตัวอักษร ${seg('font', UI_OPTIONS.font, ui.font)}</label>
        <label>มุมการ์ด/ปุ่ม ${seg('radius', UI_OPTIONS.radius, ui.radius)}</label>
        <label>ระยะห่าง ${seg('density', UI_OPTIONS.density, ui.density)}</label>
        <label>ลวดลาย/อนิเมชัน ${seg('effects', UI_OPTIONS.effects, ui.effects)}</label>
      </div>
      ${THEME_GROUPS.map(g => `
        <div class="ts-group">${esc(g.group)}</div>
        <div class="ts-grid">
          ${g.themes.map(th => `
            <button type="button" class="ts-card${th.id === curTheme() ? ' on' : ''}" data-pick="${th.id}" title="${esc(th.label)}">
              ${preview(th.id, curMode())}
              <span class="ts-name"><span>${th.icon}</span><span>${esc(th.label)}</span>${th.id === curTheme() ? '<b>✓</b>' : ''}</span>
            </button>`).join('')}
        </div>`).join('')}
    </div>`

  const m = openModal({
    title: '🎨 ปรับหน้าตาโปรแกรม', size: 'xl', body: body(),
    footer: `<span style="flex:1;font-size:0.74rem;color:var(--text-muted)">เปลี่ยนทันที · จำไว้ในเครื่องนี้</span><button class="btn btn-secondary" id="ts-reset">↺ ค่าเริ่มต้น</button><button class="btn btn-primary" id="ts-done">✅ เสร็จ</button>`,
  })
  const rerender = () => { const sc = m.el.querySelector('.modal-body').scrollTop; m.el.querySelector('.modal-body').innerHTML = body(); m.el.querySelector('.modal-body').scrollTop = sc }

  m.el.addEventListener('click', e => {
    const pick = e.target.closest('[data-pick]')
    if (pick) { setTheme(pick.dataset.pick); rerender(); return }
    const btn = e.target.closest('.ts-seg [data-val]')
    if (btn) {
      const key = btn.closest('.ts-seg').dataset.key, val = btn.dataset.val
      if (key === 'mode') setMode(val)
      else { ui = { ...ui, [key]: val }; saveUi(ui); applyUi(ui) }
      rerender(); return
    }
    if (e.target.closest('#ts-reset')) { ui = loadUi({ getItem: () => null }); saveUi(ui); applyUi(ui); setTheme('midnight'); setMode('dark'); rerender() }
    if (e.target.closest('#ts-done')) m.close()
  })
}
