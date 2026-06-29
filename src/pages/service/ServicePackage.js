/**
 * Service Package — แพ็กเกจบริการ
 * Route: /service/packages
 */
import { formatCurrency, formatDate } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'

const PKG_TYPES = {
  basic:    { label: 'Basic', color: 'secondary', icon: '🔧' },
  standard: { label: 'Standard', color: 'primary', icon: '⭐' },
  premium:  { label: 'Premium', color: 'warning', icon: '👑' },
  ev:       { label: 'EV Special', color: 'success', icon: '⚡' },
}

const DEMO_PACKAGES = [
  { id: 'PKG001', name: 'เปลี่ยนถ่ายน้ำมันเครื่อง', type: 'basic', price: 1200, duration: 60, items: ['น้ำมันเครื่อง 4L','ไส้กรองน้ำมัน'], soldCount: 142, active: true },
  { id: 'PKG002', name: 'ตรวจเช็คระยะ 10,000 km', type: 'standard', price: 3500, duration: 120, items: ['น้ำมันเครื่อง','ไส้กรองอากาศ','ตรวจสายพาน','ตรวจเบรก'], soldCount: 88, active: true },
  { id: 'PKG003', name: 'Premium Service Package', type: 'premium', price: 6800, duration: 180, items: ['Full Service','เปลี่ยนหัวเทียน','ล้างห้องเครื่อง','ตรวจช่วงล่าง','ล้างแอร์'], soldCount: 34, active: true },
  { id: 'PKG004', name: 'EV Battery Health Check', type: 'ev', price: 1800, duration: 90, items: ['ตรวจ SOH','ตรวจ BMS','ทดสอบ Cell Balance','Report'], soldCount: 56, active: true },
  { id: 'PKG005', name: 'ล้างรถ + เคลือบแว็กซ์', type: 'basic', price: 800, duration: 90, items: ['ล้างรถภายนอก','ดูดฝุ่นภายใน','เคลือบแว็กซ์'], soldCount: 211, active: true },
  { id: 'PKG006', name: 'EV Annual Service', type: 'ev', price: 4200, duration: 150, items: ['ตรวจ Full EV System','ตรวจชาร์จเจอร์','ตรวจ Inverter','Software Update'], soldCount: 29, active: false },
]

export default async function ServicePackagePage(container) {
  let packages = DEMO_PACKAGES.map(p => ({ ...p }))
  let typeFilter = 'all'

  function renderPage() {
    const list = packages.filter(p => typeFilter === 'all' || p.type === typeFilter)
    const totalRevenue = packages.reduce((a, p) => a + p.price * p.soldCount, 0)
    const topPkg = packages.reduce((top, p) => p.soldCount > top.soldCount ? p : top, packages[0])

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">📦 Service Packages</div>
            <div class="page-subtitle">จัดการแพ็กเกจบริการ — กำหนดราคาและรายการ</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="add-pkg-btn">+ สร้างแพ็กเกจ</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('📦 แพ็กเกจทั้งหมด', packages.length, 'primary')}
          ${kpi('✅ ใช้งาน', packages.filter(p=>p.active).length, 'success')}
          ${kpi('🏆 ขายมากสุด', topPkg?.name?.slice(0,15)+'...', 'warning')}
          ${kpi('💰 รายได้รวม', formatCurrency(totalRevenue), 'success')}
        </div>

        <div style="display:flex;gap:4px;margin-bottom:12px">
          <button class="btn btn-xs ${typeFilter==='all'?'btn-primary':'btn-secondary'} tf-btn" data-t="all">ทั้งหมด</button>
          ${Object.entries(PKG_TYPES).map(([k,v]) => `<button class="btn btn-xs ${typeFilter===k?'btn-'+v.color:'btn-secondary'} tf-btn" data-t="${k}">${v.icon} ${v.label}</button>`).join('')}
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px">
          ${list.map(p => {
            const t = PKG_TYPES[p.type]
            return `<div class="card" style="padding:0;overflow:hidden;opacity:${p.active?1:0.6}">
              <div style="padding:14px;border-left:4px solid var(--${t?.color})">
                <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:10px">
                  <div>
                    <div style="font-size:1.2rem">${t?.icon}</div>
                    <div style="font-weight:700;font-size:0.9rem;margin-top:4px">${p.name}</div>
                    <div style="font-size:0.72rem;color:var(--text-muted)">⏱ ${p.duration} นาที · ขายแล้ว ${p.soldCount} ครั้ง</div>
                  </div>
                  <div style="text-align:right">
                    <div style="font-size:1.2rem;font-weight:900;color:var(--${t?.color})">${formatCurrency(p.price)}</div>
                    <span class="badge ${p.active?'badge-success':'badge-secondary'}" style="font-size:0.6rem">${p.active?'ใช้งาน':'ปิดใช้'}</span>
                  </div>
                </div>
                <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:10px">📋 ${p.items.join(' · ')}</div>
                <div style="display:flex;gap:6px">
                  <button class="btn btn-xs btn-primary view-pkg-btn" data-id="${p.id}" style="flex:1">รายละเอียด</button>
                  <button class="btn btn-xs ${p.active?'btn-secondary':'btn-success'} toggle-btn" data-id="${p.id}">${p.active?'ปิดใช้':'เปิดใช้'}</button>
                </div>
              </div>
            </div>`
          }).join('')}
        </div>
      </div>
    `

    container.querySelectorAll('.tf-btn').forEach(b => b.addEventListener('click', () => { typeFilter = b.dataset.t; renderPage() }))
    document.getElementById('add-pkg-btn')?.addEventListener('click', openAddForm)
    container.querySelectorAll('.view-pkg-btn').forEach(b => b.addEventListener('click', () => {
      const p = packages.find(x => x.id === b.dataset.id); if (p) openDetail(p)
    }))
    container.querySelectorAll('.toggle-btn').forEach(b => b.addEventListener('click', () => {
      const p = packages.find(x => x.id === b.dataset.id)
      if (p) { p.active = !p.active; showToast(p.active ? '✅ เปิดใช้แพ็กเกจ' : '❌ ปิดใช้แพ็กเกจ', 'success'); renderPage() }
    }))
  }

  function openDetail(p) {
    const t = PKG_TYPES[p.type]
    openModal({
      title: `${t?.icon} ${p.name}`,
      size: 'sm',
      body: `
        <div style="margin-bottom:10px">
          <span class="badge badge-${t?.color}">${t?.label}</span>
          <span class="badge ${p.active?'badge-success':'badge-secondary'}" style="margin-left:6px">${p.active?'ใช้งาน':'ปิดใช้'}</span>
        </div>
        ${row('ราคา', formatCurrency(p.price))}
        ${row('ระยะเวลา', p.duration + ' นาที')}
        ${row('ขายไปแล้ว', p.soldCount + ' ครั้ง')}
        ${row('รายได้รวม', formatCurrency(p.price * p.soldCount))}
        <div style="margin-top:12px">
          <div style="font-size:0.78rem;font-weight:700;color:var(--text-muted);margin-bottom:6px">📋 รายการที่ครอบคลุม</div>
          ${p.items.map(item => `<div style="font-size:0.82rem;padding:4px 0;border-bottom:1px solid var(--border)">✓ ${item}</div>`).join('')}
        </div>
      `
    })
  }

  function openAddForm() {
    openModal({
      title: '+ สร้างแพ็กเกจใหม่',
      size: 'md',
      body: `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="input-group" style="grid-column:1/-1"><label class="input-label">ชื่อแพ็กเกจ *</label><input class="input" id="pg-name"></div>
          <div class="input-group"><label class="input-label">ประเภท</label>
            <select class="input" id="pg-type">${Object.entries(PKG_TYPES).map(([k,v])=>`<option value="${k}">${v.icon} ${v.label}</option>`).join('')}</select>
          </div>
          <div class="input-group"><label class="input-label">ราคา (บาท) *</label><input type="number" class="input" id="pg-price"></div>
          <div class="input-group"><label class="input-label">ระยะเวลา (นาที)</label><input type="number" class="input" id="pg-duration" value="60"></div>
          <div class="input-group" style="grid-column:1/-1"><label class="input-label">รายการ (คั่นด้วย comma)</label><input class="input" id="pg-items" placeholder="น้ำมันเครื่อง, ไส้กรอง, ..."></div>
        </div>
      `,
      onConfirm() {
        const name = document.getElementById('pg-name')?.value?.trim()
        const price = +document.getElementById('pg-price')?.value || 0
        if (!name) { showToast('❗ กรุณากรอกชื่อแพ็กเกจ', 'error'); return }
        if (price <= 0) { showToast('❗ กรุณากรอกราคา', 'error'); return }
        packages.unshift({
          id: `PKG${String(packages.length+1).padStart(3,'0')}`, name,
          type: document.getElementById('pg-type')?.value || 'basic',
          price, duration: +document.getElementById('pg-duration')?.value || 60,
          items: (document.getElementById('pg-items')?.value||'').split(',').map(s=>s.trim()).filter(Boolean),
          soldCount: 0, active: true
        })
        showToast('✅ สร้างแพ็กเกจแล้ว!', 'success'); renderPage()
      }
    })
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
function row(l, v) { return `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:0.83rem"><span style="color:var(--text-muted)">${l}</span><span>${v}</span></div>` }
