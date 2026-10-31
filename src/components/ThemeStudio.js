// หน้าต่าง "ปรับหน้าตา" — เลือกธีมจากภาพตัวอย่างจริง (ไม่ต้องกดลองทีละอัน) + โหมด มืด/สว่าง/ตามเครื่อง +
// ขนาดตัวอักษร · ความโค้งมุม · ความหนาแน่น · เอฟเฟกต์ · ภาพพื้นหลัง (ภาพวาด/3D/รูปของฉัน) · การ์ด 3D
// ทุกอย่างเปลี่ยนทันทีและจำไว้ในเครื่องนี้ · "ธีมภาพ" กดครั้งเดียวได้ทั้งภาพ + สีธีม + โหมดที่เข้ากัน
import { openModal } from '../utils/modal.js'
import { setTheme, setMode, showToast } from '../core/store.js'
import { THEME_GROUPS } from '../data/themes.js'
import { UI_OPTIONS, loadUi, saveUi, applyUi, wallImage, saveWallImage, WALL_IMG_KEY } from '../utils/appearance.js'
import { WALLPAPERS, wallpaperCss } from '../data/wallpapers.js'

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function modePref() {
  try { return localStorage.getItem('lamom_mode') || 'dark' } catch { return 'dark' }
}

// ภาพย่อของหน้าจอจริงในธีมนั้น: ใส่ data-theme/data-mode ที่กล่องตัวอย่าง ตัวแปรสีของธีมจึงมีผลเฉพาะในกล่อง
function preview(id, mode, wall = '') {
  return `<div class="ts-prev${wall ? ' has-wall' : ''}" data-theme="${id}" data-mode="${mode}" aria-hidden="true"${wall ? ` style='background-image:${wall}'` : ''}>
    <i class="ts-side"><b></b><b></b><b></b></i>
    <span class="ts-main"><i class="ts-bar"></i><span class="ts-kpis"><i></i><i></i><i></i></span><span class="ts-row"><i class="ts-line"></i><i class="ts-btn"></i></span></span>
  </div>`
}

function hasCustom() {
  try { return !!localStorage.getItem(WALL_IMG_KEY) } catch { return false }
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
      <div class="ts-group">🖼 ธีมภาพวาด · ภาพ 3D — กดครั้งเดียวได้ทั้งภาพ สี และโหมดที่เข้ากัน</div>
      <div class="ts-grid">
        ${WALLPAPERS.map(w => {
          const on = ui.wall === w.id && curTheme() === w.theme
          return `<button type="button" class="ts-card${on ? ' on' : ''}" data-preset="${w.id}" title="${esc(w.label)}">
            ${preview(w.theme, w.mode, wallpaperCss(w.id))}
            <span class="ts-name"><span>${w.icon}</span><span>${esc(w.label)}${w.kind === '3d' ? ' · 3D' : ''}</span>${on ? '<b>✓</b>' : ''}</span>
          </button>`
        }).join('')}
      </div>
      <div class="ts-group">🏞 ภาพพื้นหลังอย่างเดียว (ใช้กับธีมสีไหนก็ได้) · 📷 ใส่รูปของคุณเองได้ เช่น รูปโชว์รูม รูปรถ</div>
      <div class="ts-walls">
        <button type="button" class="ts-wall plain${ui.wall === 'none' ? ' on' : ''}" data-wall="none">🚫<span>ไม่มีภาพ</span></button>
        <button type="button" class="ts-wall${ui.wall === 'custom' ? ' on' : ''}${hasCustom() ? '' : ' plain'}" data-wall="custom" ${hasCustom() ? `style='background-image:${wallImage('custom')}'` : ''}>${hasCustom() ? '<span>📷 รูปของฉัน</span>' : '📷<span>เลือกรูปของฉัน</span>'}</button>
        ${hasCustom() ? '<button type="button" class="ts-wall plain" data-wall-upload>🔄<span>เปลี่ยนรูป</span></button>' : ''}
        ${WALLPAPERS.map(w => `<button type="button" class="ts-wall${ui.wall === w.id ? ' on' : ''}" data-wall="${w.id}" style='background-image:${wallpaperCss(w.id)}'><span>${w.icon} ${esc(w.label)}</span></button>`).join('')}
      </div>
      <input type="file" id="ts-wall-file" accept="image/*" hidden>
      <div class="ts-group">⚙️ ตั้งค่าหน้าตา</div>
      <div class="ts-settings">
        <label>โหมด ${seg('mode', [['dark', '🌙 มืด'], ['light', '☀️ สว่าง'], ['auto', '🖥 ตามเครื่อง']], modePref())}</label>
        <label>ขนาดตัวอักษร ${seg('font', UI_OPTIONS.font, ui.font)}</label>
        <label>มุมการ์ด/ปุ่ม ${seg('radius', UI_OPTIONS.radius, ui.radius)}</label>
        <label>ระยะห่าง ${seg('density', UI_OPTIONS.density, ui.density)}</label>
        <label>ลวดลาย/อนิเมชัน ${seg('effects', UI_OPTIONS.effects, ui.effects)}</label>
        <label>การ์ด/ปุ่ม ${seg('fx3d', UI_OPTIONS.fx3d, ui.fx3d)}</label>
        ${ui.wall !== 'none' ? `<label>ความชัดของภาพพื้นหลัง ${seg('wallDim', UI_OPTIONS.wallDim, ui.wallDim)}</label>` : ''}
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
  const setUi = patch => { ui = { ...ui, ...patch }; saveUi(ui); applyUi(ui) }
  const fileIn = () => m.el.querySelector('#ts-wall-file')
  const rerender = () => { const sc = m.el.querySelector('.modal-body').scrollTop; m.el.querySelector('.modal-body').innerHTML = body(); m.el.querySelector('.modal-body').scrollTop = sc }

  m.el.addEventListener('click', e => {
    const pre = e.target.closest('[data-preset]')
    if (pre) {
      const w = WALLPAPERS.find(x => x.id === pre.dataset.preset)
      setTheme(w.theme); setMode(w.mode); setUi({ wall: w.id, fx3d: w.kind === '3d' ? 'on' : ui.fx3d, effects: 'on' }); rerender(); return
    }
    const wb = e.target.closest('.ts-wall[data-wall]')
    if (wb) {
      if (wb.dataset.wall === 'custom' && !hasCustom()) { fileIn()?.click(); return }
      setUi({ wall: wb.dataset.wall, ...(wb.dataset.wall !== 'none' ? { effects: 'on' } : {}) }); rerender(); return
    }
    if (e.target.closest('[data-wall-upload]')) { fileIn()?.click(); return }
    const pick = e.target.closest('[data-pick]')
    if (pick) { setTheme(pick.dataset.pick); rerender(); return }
    const btn = e.target.closest('.ts-seg [data-val]')
    if (btn) {
      const key = btn.closest('.ts-seg').dataset.key, val = btn.dataset.val
      if (key === 'mode') setMode(val)
      else setUi({ [key]: val })
      rerender(); return
    }
    if (e.target.closest('#ts-reset')) { ui = loadUi({ getItem: () => null }); saveUi(ui); applyUi(ui); setTheme('midnight'); setMode('dark'); rerender() }
    if (e.target.closest('#ts-done')) m.close()
  })
  m.el.addEventListener('change', async e => {
    if (e.target.id !== 'ts-wall-file' || !e.target.files?.[0]) return
    try {
      await saveWallImage(e.target.files[0])
      setUi({ wall: 'custom', effects: 'on' }); rerender()
      showToast('ใส่รูปพื้นหลังแล้ว', 'success')
    } catch {
      showToast('ใส่รูปนี้ไม่ได้ ลองรูปอื่นหรือรูปที่เล็กลง', 'error')
    }
  })
}
