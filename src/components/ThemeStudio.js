// หน้าต่าง "ปรับหน้าตา" — (v1.0.1030) ธีมหลายแบบ มีลูกเล่น ปรับแต่งได้
// ชุดสำเร็จรูป 1 คลิก (16 ชุด มีภาพตัวอย่าง) · สีธีม 20 ชุด + เลือกสีเอง · พื้นผิว · สไตล์การ์ด · พื้นหลังมีลูกเล่น · ตัวอักษร
// โหมด มืด/สว่าง/ตามเครื่อง · ขนาด · ระยะห่าง · มุม · รูปแบบปี — เปลี่ยนทันทีและจำไว้ในเครื่องนี้
import { openModal } from '../utils/modal.js'
import { setMode } from '../core/store.js'
import { UI_OPTIONS, UI_DEFAULTS, loadUi, saveUi, applyUi, LOOKS, randomLook } from '../utils/appearance.js'
import { PRESETS, colorsFor, previewVars } from '../utils/themeEngine.js'
import { escHtml as esc } from '../utils/escape.js'

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

// (v1.0.1130) ภาพย่อหน้าจอในสีของชุดนั้นจริง ๆ (ก่อนกดเลือก)
function miniPreview(look, mode) {
  return `<span class="ts-prev ts-prev-look" style="${previewVars(look, mode)}" aria-hidden="true">
    <i class="ts-side"><b></b><b></b><b></b></i>
    <span class="ts-main"><i class="ts-bar"></i><span class="ts-kpis"><i></i><i></i><i></i></span><span class="ts-row"><i class="ts-line"></i><i class="ts-btn"></i></span></span>
  </span>`
}

const dot = (p, a) => `background:linear-gradient(135deg, ${p}, ${a})`

export function openThemeStudio() {
  document.getElementById('theme-studio')?.closest('.modal-overlay')?.remove()
  let ui = loadUi()
  const seg = (key, opts, cur) => `<div class="ts-seg" data-key="${key}">${opts.map(([v, label]) =>
    `<button type="button" data-val="${v}" class="${v === cur ? 'on' : ''}">${label}</button>`).join('')}</div>`

  const body = () => {
    const mode = modePref()
    const custom = colorsFor('custom', ui.custom)
    return `
    <div id="theme-studio">
      <div class="ts-group">✨ ชุดสำเร็จรูป (กดครั้งเดียวเปลี่ยนทั้งชุด)</div>
      <div class="ts-looks">
        ${LOOKS.map((l, i) => { const on = l.ui.theme === ui.theme && l.ui.surface === ui.surface && l.ui.card === ui.card && l.ui.bg === ui.bg; return `
          <button type="button" class="ts-look${on ? ' on' : ''}" data-look="${i}">
            ${miniPreview(l.ui, l.mode || (mode === 'light' ? 'light' : 'dark'))}
            <b>${esc(l.name)}${on ? ' ✓' : ''}</b><small>${esc(l.hint)}</small>
          </button>` }).join('')}
        <button type="button" class="ts-look" data-look="random"><span class="ts-dots"><i style="background:conic-gradient(#f43f5e,#f59e0b,#10b981,#0ea5e9,#8b5cf6,#f43f5e)"></i></span><b>🎲 สุ่มธีม</b><small>ลองแบบใหม่ๆ ไม่ชอบกดอีกครั้ง</small></button>
      </div>

      <div class="ts-group">โหมดสี</div>
      <div class="ts-grid ts-modes">
        ${MODES.map(([id, label, hint]) => `
          <button type="button" class="ts-card${id === mode ? ' on' : ''}" data-mode-pick="${id}">
            ${preview(id)}
            <span class="ts-name"><span>${label}</span>${id === mode ? '<b>✓</b>' : ''}</span>
            <span class="ts-hint">${hint}</span>
          </button>`).join('')}
      </div>

      <div class="ts-group">🎨 สีธีม</div>
      <div class="ts-swatches">
        ${PRESETS.map(t => `<button type="button" class="ts-sw${ui.theme === t.id ? ' on' : ''}" data-theme-pick="${t.id}"><i style="${dot(t.p, t.a)}"></i>${esc(t.name)}</button>`).join('')}
        <label class="ts-sw${ui.theme === 'custom' ? ' on' : ''}" title="เลือกสีเองได้ทุกสี — ระบบปรับความเข้มให้อ่านง่ายเอง"><i style="${dot(custom.p, custom.a)}"></i>เลือกสีเอง<input type="color" id="ts-custom" value="${esc(ui.custom || '#5B7FF5')}"></label>
      </div>

      <div class="ts-group">ลูกเล่น</div>
      <div class="ts-settings">
        <label>พื้นผิว ${seg('surface', UI_OPTIONS.surface, ui.surface)}</label>
        <label>สไตล์การ์ด ${seg('card', UI_OPTIONS.card, ui.card)}</label>
        <label>พื้นหลัง ${seg('bg', UI_OPTIONS.bg, ui.bg)}</label>
        <label>ภาพเคลื่อนไหว ${seg('motion', UI_OPTIONS.motion, ui.motion)}</label>
      </div>

      <div class="ts-group">ปรับให้เหมาะกับคุณ</div>
      <div class="ts-settings">
        <label>แบบตัวอักษร ${seg('family', UI_OPTIONS.family, ui.family)}</label>
        <label>ขนาดตัวอักษร ${seg('font', UI_OPTIONS.font, ui.font)}</label>
        <label>ระยะห่าง ${seg('density', UI_OPTIONS.density, ui.density)}</label>
        <label>มุมการ์ด/ปุ่ม ${seg('radius', UI_OPTIONS.radius, ui.radius)}</label>
        <label>ปีในวันที่ (วว/ดด/ปปปป · เวลา 24 ชม.) ${seg('era', UI_OPTIONS.era, ui.era)}</label>
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
    const look = e.target.closest('[data-look]')
    if (look) {
      const l = look.dataset.look === 'random' ? randomLook() : LOOKS[+look.dataset.look]
      setUi(l.ui)
      if (l.mode) setMode(l.mode)
      rerender(); return
    }
    const mp = e.target.closest('[data-mode-pick]')
    if (mp) { setMode(mp.dataset.modePick); rerender(); return }
    const tp = e.target.closest('[data-theme-pick]')
    if (tp) { setUi({ theme: tp.dataset.themePick }); rerender(); return }
    const btn = e.target.closest('.ts-seg [data-val]')
    if (btn) { setUi({ [btn.closest('.ts-seg').dataset.key]: btn.dataset.val }); rerender(); return }
    if (e.target.closest('#ts-reset')) { ui = { ...UI_DEFAULTS }; saveUi(ui); applyUi(ui); setMode('dark'); rerender() }
    if (e.target.closest('#ts-done')) m.close()
  })
  // เลือกสีเอง: เปลี่ยนสดระหว่างลาก แต่วาดหน้าต่างใหม่ตอนปล่อย (ไม่ให้ตัวเลือกสีปิดเอง)
  m.el.addEventListener('input', e => { if (e.target.id === 'ts-custom') setUi({ theme: 'custom', custom: e.target.value }) })
  m.el.addEventListener('change', e => { if (e.target.id === 'ts-custom') rerender() })
}
