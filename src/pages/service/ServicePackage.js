/**
 * Service Package — แพ็กเกจบริการ
 * Route: /service/packages
 */
import { formatCurrency, formatDate } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'

function esc(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;') }

const PKG_TYPES = {
  basic:    { label: 'Basic', color: 'secondary', icon: '🔧' },
  standard: { label: 'Standard', color: 'primary', icon: '⭐' },
  premium:  { label: 'Premium', color: 'warning', icon: '👑' },
  ev:       { label: 'EV Special', color: 'success', icon: '⚡' },
}

export default async function ServicePackagePage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let packages = []
  let typeFilter = 'all'
  let loading = true

  async function loadData() {
    loading = true
    try { packages = await listDocs('service_packages', [], 'name', 'asc', 500) } catch (e) { packages = [] }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
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
          ${kpi('🏆 ขายมากสุด', esc(topPkg?.name?.slice(0,15))+'...', 'warning')}
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
                    <div style="font-weight:700;font-size:0.9rem;margin-top:4px">${esc(p.name)}</div>
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
    container.querySelectorAll('.toggle-btn').forEach(b => b.addEventListener('click', async () => {
      const p = packages.find(x => x.id === b.dataset.id)
      if (!p) return
      const active = !p.active
      try {
        await updateDocData('service_packages', p.id, { active })
        showToast(active ? '✅ เปิดใช้แพ็กเกจ' : '❌ ปิดใช้แพ็กเกจ', 'success')
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    }))
  }

  function openDetail(p) {
    const t = PKG_TYPES[p.type]
    openModal({
      title: `${t?.icon} ${esc(p.name)}`,
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
      async onConfirm() {
        const name = document.getElementById('pg-name')?.value?.trim()
        const price = +document.getElementById('pg-price')?.value || 0
        if (!name) { showToast('❗ กรุณากรอกชื่อแพ็กเกจ', 'error'); return false }
        if (price <= 0) { showToast('❗ กรุณากรอกราคา', 'error'); return false }
        try {
          await createDoc('service_packages', {
            name,
            type: document.getElementById('pg-type')?.value || 'basic',
            price, duration: +document.getElementById('pg-duration')?.value || 60,
            items: (document.getElementById('pg-items')?.value||'').split(',').map(s=>s.trim()).filter(Boolean),
            soldCount: 0, active: true
          })
          showToast('✅ สร้างแพ็กเกจแล้ว!', 'success')
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      }
    })
  }

  await loadData()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
function row(l, v) { return `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:0.83rem"><span style="color:var(--text-muted)">${l}</span><span>${v}</span></div>` }
