/**
 * Price List — รายการราคารถ
 * Route: /dms/pricelist
 */
import { formatCurrency } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const BRANDS = ['BYD', 'MG', 'Neta']
const TYPES = { EV: 'EV', PHEV: 'PHEV', HEV: 'HEV' }

export default async function PriceListPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let models = []
  let brandFilter = 'all'
  let typeFilter = 'all'
  let compareList = []
  let loading = true

  async function loadData() {
    loading = true
    try { models = await listDocs('vehicle_models', [], 'basePrice', 'asc', 100) } catch (e) { models = [] }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const list = models.filter(m =>
      (brandFilter === 'all' || m.brand === brandFilter) &&
      (typeFilter === 'all' || m.type === typeFilter)
    )

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">💰 Price List</div>
            <div class="page-subtitle">รายการราคารถ — จัดการโปรโมชั่นและราคา</div>
          </div>
          <div class="page-actions">
            ${compareList.length >= 2 ? `<button class="btn btn-warning" id="compare-now-btn">⚖️ เปรียบเทียบ (${compareList.length})</button>` : ''}
            <button class="btn btn-primary" id="add-model-btn">+ เพิ่มรุ่น</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('🚗 รุ่นรถ', models.length, 'primary')}
          ${kpi('✅ ใช้งาน', models.filter(m=>m.active).length, 'success')}
          ${kpi('📦 สต็อกรวม', models.reduce((a,m)=>a+m.stock,0) + ' คัน', 'primary')}
          ${kpi('💰 ราคาต่ำสุด', formatCurrency(Math.min(...models.map(m=>m.promotionPrice||m.basePrice))), 'warning')}
        </div>

        <!-- Filters -->
        <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
          <div style="display:flex;gap:4px">
            <button class="btn btn-xs ${brandFilter==='all'?'btn-primary':'btn-secondary'} brand-btn" data-b="all">ทั้งหมด</button>
            ${BRANDS.map(b => `<button class="btn btn-xs ${brandFilter===b?'btn-primary':'btn-secondary'} brand-btn" data-b="${b}">${b}</button>`).join('')}
          </div>
          <div style="display:flex;gap:4px">
            ${Object.keys(TYPES).map(t => `<button class="btn btn-xs ${typeFilter===t?'btn-primary':'btn-secondary'} type-btn" data-t="${t}">${t}</button>`).join('')}
            <button class="btn btn-xs ${typeFilter==='all'?'btn-primary':'btn-secondary'} type-btn" data-t="all">ทุกประเภท</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px">
          ${list.map(m => {
            const hasPromo = m.promotionPrice && m.promotionPrice < m.basePrice
            const inCompare = compareList.includes(m.id)
            return `<div class="card" style="padding:0;overflow:hidden;opacity:${m.active?1:0.6};border:${inCompare?'2px solid var(--primary)':'1px solid var(--border)'}">
              <div style="background:linear-gradient(135deg, ${m.color}22, ${m.color}08);padding:14px;border-bottom:1px solid var(--border)">
                <div style="display:flex;justify-content:space-between;align-items:start">
                  <div>
                    <div style="font-size:0.7rem;color:var(--text-muted)">${escHtml(m.brand)} · ${escHtml(m.type)}</div>
                    <div style="font-weight:700;font-size:0.95rem">${escHtml(m.model)}</div>
                    <div style="font-size:0.72rem;color:var(--text-muted)">📦 สต็อก ${m.stock} คัน</div>
                  </div>
                  <div style="text-align:right">
                    ${hasPromo ? `
                      <div style="font-size:0.7rem;text-decoration:line-through;color:var(--text-muted)">${formatCurrency(m.basePrice)}</div>
                      <div style="font-size:1.1rem;font-weight:900;color:var(--danger)">${formatCurrency(m.promotionPrice)}</div>
                      <div style="font-size:0.62rem;color:var(--danger)">ประหยัด ${formatCurrency(m.basePrice-m.promotionPrice)}</div>
                    ` : `
                      <div style="font-size:1.1rem;font-weight:900;color:${m.color}">${formatCurrency(m.basePrice)}</div>
                    `}
                  </div>
                </div>
              </div>
              <div style="padding:12px 14px">
                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:10px">
                  ${spec('🔋', m.battery + ' kWh', 'แบตเตอรี่')}
                  ${spec('📏', m.range + ' km', 'ระยะทาง')}
                  ${spec('⚡', m.power + ' kW', 'กำลัง')}
                </div>
                <div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:10px">สี: ${escHtml(m.colors.join(' · '))}</div>
                <div style="display:flex;gap:6px">
                  <button class="btn btn-xs btn-primary detail-btn" data-id="${m.id}" style="flex:1">รายละเอียด</button>
                  <button class="btn btn-xs ${inCompare?'btn-primary':'btn-secondary'} compare-btn" data-id="${m.id}">${inCompare?'✓':'⚖️'}</button>
                  <button class="btn btn-xs btn-secondary edit-price-btn" data-id="${m.id}">ราคา</button>
                </div>
              </div>
            </div>`
          }).join('')}
        </div>
      </div>
    `

    container.querySelectorAll('.brand-btn').forEach(b => b.addEventListener('click', () => { brandFilter = b.dataset.b; renderPage() }))
    container.querySelectorAll('.type-btn').forEach(b => b.addEventListener('click', () => { typeFilter = b.dataset.t; renderPage() }))
    document.getElementById('add-model-btn')?.addEventListener('click', openAddModelModal)
    container.querySelectorAll('.detail-btn').forEach(b => b.addEventListener('click', () => {
      const m = models.find(x => x.id === b.dataset.id); if (m) openDetail(m)
    }))
    container.querySelectorAll('.compare-btn').forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.id
      if (compareList.includes(id)) compareList = compareList.filter(x => x !== id)
      else if (compareList.length < 3) compareList.push(id)
      else { showToast('เปรียบเทียบได้สูงสุด 3 รุ่น', 'warning'); return }
      renderPage()
    }))
    container.querySelectorAll('.edit-price-btn').forEach(b => b.addEventListener('click', () => {
      const m = models.find(x => x.id === b.dataset.id); if (m) openEditPrice(m)
    }))
    document.getElementById('compare-now-btn')?.addEventListener('click', () => openCompare())
  }

  function openAddModelModal() {
    openModal({
      title: '🚗 เพิ่มรุ่นรถใหม่ใน Price List',
      size: 'md',
      body: `
        <div style="display:flex;flex-direction:column;gap:12px;font-size:0.82rem">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div><label style="font-size:0.74rem;color:var(--text-muted)">แบรนด์</label>
              <select id="am-brand" class="input">
                ${BRANDS.map(b=>`<option value="${b}">${b}</option>`).join('')}
              </select>
            </div>
            <div><label style="font-size:0.74rem;color:var(--text-muted)">ประเภท</label>
              <select id="am-type" class="input">
                ${Object.keys(TYPES).map(t=>`<option value="${t}">${t}</option>`).join('')}
              </select>
            </div>
          </div>
          <div><label style="font-size:0.74rem;color:var(--text-muted)">ชื่อรุ่น *</label>
            <input id="am-model" class="input" placeholder="BYD Atto 3 Pro..."></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div><label style="font-size:0.74rem;color:var(--text-muted)">ราคาปกติ (บาท) *</label>
              <input id="am-base" type="number" class="input" placeholder="1099000"></div>
            <div><label style="font-size:0.74rem;color:var(--text-muted)">ราคาโปรโมชั่น (0 = ไม่มี)</label>
              <input id="am-promo" type="number" class="input" value="0"></div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
            <div><label style="font-size:0.74rem;color:var(--text-muted)">แบตเตอรี่ (kWh)</label>
              <input id="am-bat" type="number" step="0.1" class="input" placeholder="60.5"></div>
            <div><label style="font-size:0.74rem;color:var(--text-muted)">ระยะทาง (km)</label>
              <input id="am-range" type="number" class="input" placeholder="420"></div>
            <div><label style="font-size:0.74rem;color:var(--text-muted)">กำลัง (kW)</label>
              <input id="am-pwr" type="number" class="input" placeholder="150"></div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div><label style="font-size:0.74rem;color:var(--text-muted)">สีที่มี (คั่นจุลภาค)</label>
              <input id="am-colors" class="input" placeholder="ขาว, ดำ, ฟ้า..."></div>
            <div><label style="font-size:0.74rem;color:var(--text-muted)">สต็อก (คัน)</label>
              <input id="am-stock" type="number" class="input" value="0"></div>
          </div>
        </div>
      `,
      footer: `
        <span></span>
        <div style="display:flex;gap:8px">
          <button class="btn btn-secondary btn-sm" onclick="this.closest('.modal-overlay').remove()">ยกเลิก</button>
          <button class="btn btn-primary btn-sm" id="am-save">🚗 เพิ่มรุ่น</button>
        </div>
      `
    })
    document.getElementById('am-save')?.addEventListener('click', async () => {
      const modelName = document.getElementById('am-model')?.value.trim()
      const basePrice = parseFloat(document.getElementById('am-base')?.value) || 0
      if (!modelName || !basePrice) { showToast('⚠️ กรุณากรอกชื่อรุ่นและราคา', 'warning'); return }
      const promo = parseFloat(document.getElementById('am-promo')?.value) || 0
      const colorsRaw = document.getElementById('am-colors')?.value.trim()
      const brand = document.getElementById('am-brand')?.value || BRANDS[0]
      try {
        await createDoc('vehicle_models', {
          brand,
          model: modelName,
          type:   document.getElementById('am-type')?.value || 'EV',
          basePrice,
          promotionPrice: promo > 0 ? promo : null,
          range:   parseInt(document.getElementById('am-range')?.value) || 0,
          battery: parseFloat(document.getElementById('am-bat')?.value) || 0,
          power:   parseInt(document.getElementById('am-pwr')?.value) || 0,
          color: '#3b82f6',
          colors: colorsRaw ? colorsRaw.split(',').map(s=>s.trim()).filter(Boolean) : [],
          active: true,
          stock: parseInt(document.getElementById('am-stock')?.value) || 0,
        })
        document.querySelector('.modal-overlay')?.remove()
        showToast('✅ เพิ่ม ' + brand + ' ' + modelName + ' ใน Price List แล้ว', 'success')
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    })
  }

  function openDetail(m) {
    openModal({
      title: '🚗 ' + escHtml(m.model),
      size: 'sm',
      body: `
        <div style="margin-bottom:10px"><span class="badge badge-primary">${escHtml(m.brand)}</span> <span class="badge badge-secondary">${escHtml(m.type)}</span></div>
        ${row('ราคาปกติ', formatCurrency(m.basePrice))}
        ${m.promotionPrice ? row('ราคาโปรโมชั่น', `<span style="color:var(--danger);font-weight:700">${formatCurrency(m.promotionPrice)}</span>`) : ''}
        ${row('แบตเตอรี่', m.battery + ' kWh')}
        ${row('ระยะทาง', m.range + ' km')}
        ${row('กำลัง', m.power + ' kW')}
        ${row('สต็อก', m.stock + ' คัน')}
        ${row('สีที่มี', escHtml(m.colors.join(', ')))}
      `
    })
  }

  function openEditPrice(m) {
    openModal({
      title: '✏️ แก้ไขราคา — ' + escHtml(m.model),
      size: 'sm',
      body: `
        <div style="display:grid;gap:10px">
          <div class="input-group"><label class="input-label">ราคาปกติ (บาท)</label><input type="number" class="input" id="ep-base" value="${m.basePrice}"></div>
          <div class="input-group"><label class="input-label">ราคาโปรโมชั่น (0 = ไม่มีโปร)</label><input type="number" class="input" id="ep-promo" value="${m.promotionPrice||0}"></div>
        </div>
      `,
      async onConfirm() {
        const basePrice = +document.getElementById('ep-base')?.value || m.basePrice
        const promo = +document.getElementById('ep-promo')?.value || 0
        try {
          await updateDocData('vehicle_models', m.id, { basePrice, promotionPrice: promo > 0 ? promo : null })
          showToast(`✅ อัปเดตราคา ${m.model} แล้ว`, 'success')
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      }
    })
  }

  function openCompare() {
    const selected = compareList.map(id => models.find(m => m.id === id)).filter(Boolean)
    openModal({
      title: '⚖️ เปรียบเทียบรถ',
      size: 'lg',
      body: `
        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;min-width:500px">
            <thead>
              <tr style="border-bottom:2px solid var(--border)">
                <th style="padding:10px 14px;text-align:left;font-size:0.8rem;color:var(--text-muted)">รายการ</th>
                ${selected.map(m => `<th style="padding:10px 14px;text-align:center;font-weight:700;color:${m.color}">${escHtml(m.model)}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${[
                ['ราคา', m => formatCurrency(m.promotionPrice||m.basePrice)],
                ['แบตเตอรี่', m => m.battery + ' kWh'],
                ['ระยะทาง', m => m.range + ' km'],
                ['กำลัง', m => m.power + ' kW'],
                ['สต็อก', m => m.stock + ' คัน'],
                ['ประเภท', m => escHtml(m.type)],
              ].map(([label, fn]) => `
                <tr style="border-bottom:1px solid var(--border)">
                  <td style="padding:8px 14px;font-size:0.8rem;color:var(--text-muted)">${label}</td>
                  ${selected.map(m => `<td style="padding:8px 14px;text-align:center;font-size:0.83rem;font-weight:600">${fn(m)}</td>`).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `
    })
  }

  await loadData()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
function row(l, v) { return `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:0.83rem"><span style="color:var(--text-muted)">${l}</span><span>${v}</span></div>` }
function spec(icon, val, label) { return `<div style="text-align:center;padding:6px;background:var(--surface-2);border-radius:var(--radius-sm)"><div style="font-size:0.7rem;color:var(--text-muted)">${icon} ${label}</div><div style="font-size:0.78rem;font-weight:700">${val}</div></div>` }
