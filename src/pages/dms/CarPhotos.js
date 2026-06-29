/**
 * Car Photos — รูปรถสต็อกสำหรับโพสต์ขาย
 * Route: /dms/photos
 */
import { timeAgo } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString() }

const PHOTO_ANGLES = ['หน้าตรง', 'หน้าเฉียงซ้าย', 'หน้าเฉียงขวา', 'ข้างซ้าย', 'ข้างขวา', 'หลังตรง', 'ภายใน-คอนโซล', 'ภายใน-เบาะหน้า', 'ภายใน-เบาะหลัง', 'ห้องเก็บของ', 'ล้อ/แม็กซ์', 'จอ/ระบบ Infotainment']

const DEMO_CARS = [
  { id: 'CP01', model: 'BYD Dolphin สีน้ำเงิน', vin: '...1122', photos: 12, posted: { fb: true, line: true, web: true }, lastShoot: addDays(-5) },
  { id: 'CP02', model: 'BYD Atto 3 สีขาว', vin: '...3344', photos: 8, posted: { fb: true, line: false, web: true }, lastShoot: addDays(-10) },
  { id: 'CP03', model: 'BYD Seal AWD สีดำ', vin: '...5566', photos: 0, posted: { fb: false, line: false, web: false }, lastShoot: null },
  { id: 'CP04', model: 'MG4 Electric สีแดง', vin: '...7788', photos: 12, posted: { fb: true, line: true, web: false }, lastShoot: addDays(-2) },
  { id: 'CP05', model: 'BYD Han สีขาว', vin: '...9900', photos: 5, posted: { fb: false, line: false, web: false }, lastShoot: addDays(-20) },
]

export default async function CarPhotosPage(container) {
  const myGen = container.__routerGen
  let cars = DEMO_CARS.map(c => ({ ...c, posted: { ...c.posted } }))
  let dataSource = 'demo'

  try {
    const docs = await listDocs('car_photos', [], 'lastShoot', 'desc', 100).catch(() => [])
    if (container.__routerGen !== myGen) return
    if (docs.length >= 2) {
      const mapped = docs.map((d, i) => ({
        id: d.id || `CP${String(i+1).padStart(2,'0')}`,
        model: d.model || '',
        vin: d.vin || '',
        photos: d.photos || 0,
        posted: { fb: d.posted?.fb || false, line: d.posted?.line || false, web: d.posted?.web || false },
        lastShoot: d.lastShoot || null,
      }))
      cars = [...mapped, ...DEMO_CARS]
      dataSource = 'live'
    }
  } catch {}

  function renderPage() {
    const complete = cars.filter(c => c.photos >= 12).length
    const noPhotos = cars.filter(c => c.photos === 0).length
    const notPosted = cars.filter(c => c.photos >= 12 && (!c.posted.fb || !c.posted.line || !c.posted.web)).length

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">📸 Car Photos</div>
            <div class="page-subtitle">รูปรถสต็อก — มาตรฐาน 12 มุม พร้อมโพสต์ขาย${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ข้อมูลจริง</span>' : ''}</div>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('📸 ครบ 12 มุม', complete + '/' + cars.length + ' คัน', complete === cars.length ? 'success' : 'warning')}
          ${kpi('🚫 ยังไม่มีรูป', noPhotos, noPhotos > 0 ? 'danger' : 'success')}
          ${kpi('📤 รูปครบแต่ยังไม่โพสต์ครบ', notPosted, notPosted > 0 ? 'warning' : 'success')}
          ${kpi('🚗 รถสต็อกทั้งหมด', cars.length, 'primary')}
        </div>

        <!-- Standard angles guide -->
        <div class="card" style="padding:12px 14px;margin-bottom:14px">
          <div style="font-size:0.78rem;font-weight:700;color:var(--text-muted);margin-bottom:8px">📐 มาตรฐาน 12 มุม</div>
          <div style="display:flex;flex-wrap:wrap;gap:5px">
            ${PHOTO_ANGLES.map((a, i) => `<span style="font-size:0.66rem;background:var(--surface-2);padding:3px 9px;border-radius:10px;color:var(--text-muted)">${i+1}. ${a}</span>`).join('')}
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:10px">
          ${cars.map(c => {
            const pct = Math.round(c.photos / 12 * 100)
            const color = pct === 100 ? 'success' : pct >= 50 ? 'warning' : 'danger'
            return `<div class="card" style="padding:13px 14px;border-left:3px solid var(--${color})">
              <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px">
                <div>
                  <div style="font-weight:700;font-size:0.87rem">${escHtml(c.model)}</div>
                  <div style="font-size:0.7rem;color:var(--text-muted)">VIN ${escHtml(c.vin)}${c.lastShoot ? ' · ถ่ายล่าสุด ' + timeAgo(c.lastShoot) : ' · ยังไม่เคยถ่าย'}</div>
                </div>
                <div style="font-size:1rem;font-weight:900;color:var(--${color})">${c.photos}/12</div>
              </div>
              <div style="background:var(--surface-2);border-radius:3px;height:8px;margin-bottom:10px">
                <div style="width:${pct}%;background:var(--${color});height:8px;border-radius:3px"></div>
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center">
                <div style="display:flex;gap:6px">
                  ${[['fb','📘 Facebook'],['line','💚 LINE'],['web','🌐 เว็บไซต์']].map(([k, l]) => `
                    <button class="btn btn-xs ${c.posted[k]?'btn-success':'btn-secondary'} post-btn" data-id="${c.id}" data-ch="${k}" ${c.photos < 12 ? 'disabled' : ''}>
                      ${c.posted[k] ? '✅ ' : ''}${l}
                    </button>
                  `).join('')}
                </div>
                <button class="btn btn-xs btn-primary shoot-btn" data-id="${c.id}">📸 ${c.photos === 0 ? 'เริ่มถ่าย' : c.photos < 12 ? 'ถ่ายต่อ' : 'ถ่ายใหม่'}</button>
              </div>
            </div>`
          }).join('')}
        </div>
      </div>
    `

    container.querySelectorAll('.shoot-btn').forEach(b => b.addEventListener('click', () => {
      const c = cars.find(x => x.id === b.dataset.id)
      if (c) openModal({
        title: '📸 ถ่ายรูป: ' + escHtml(c.model),
        size: 'md',
        body: `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">
          ${PHOTO_ANGLES.map((a, i) => `
            <div style="padding:10px;background:var(--surface-2);border-radius:var(--radius-sm);text-align:center;border:2px solid ${i < c.photos ? 'var(--success)' : 'var(--border)'}">
              <div style="font-size:1.2rem">${i < c.photos ? '✅' : '📷'}</div>
              <div style="font-size:0.62rem;color:var(--text-muted)">${i+1}. ${a}</div>
            </div>
          `).join('')}
        </div>
        <p style="font-size:0.7rem;color:var(--text-muted);margin-top:10px">💡 ถ่ายตอนเช้า/เย็นแสงสวย · เช็ดรถก่อนถ่าย · พื้นหลังโล่ง</p>`,
        confirmText: '📸 อัปโหลดรูปครบชุด',
        onConfirm() {
          c.photos = 12; c.lastShoot = new Date().toISOString()
          showToast('📸 อัปโหลดรูปครบ 12 มุมแล้ว — พร้อมโพสต์!', 'success'); renderPage()
        }
      })
    }))
    container.querySelectorAll('.post-btn:not([disabled])').forEach(b => b.addEventListener('click', () => {
      const c = cars.find(x => x.id === b.dataset.id)
      if (c) {
        const ch = b.dataset.ch
        c.posted[ch] = !c.posted[ch]
        if (c.posted[ch]) showToast(`📤 โพสต์ ${c.model} แล้ว`, 'success')
        renderPage()
      }
    }))
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
