/**
 * Asset Management — จัดการสินทรัพย์
 * Route: /finance/assets
 */
import { formatCurrency, formatDate } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, seedDemoData } from '../../core/db.js'

function escHtml(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }

const ASSET_CATS = {
  vehicle:    { label: 'ยานพาหนะ', color: 'primary', icon: '🚗' },
  equipment:  { label: 'เครื่องมือ', color: 'warning', icon: '🔧' },
  it:         { label: 'IT & Tech', color: 'primary', icon: '💻' },
  furniture:  { label: 'เฟอร์นิเจอร์', color: 'secondary', icon: '🪑' },
  building:   { label: 'อาคาร/สถานที่', color: 'secondary', icon: '🏢' },
  charger:    { label: 'EV Charger', color: 'success', icon: '⚡' },
}

const DEPRECIATION_METHODS = {
  sl: 'Straight-Line',
  db: 'Double-Declining',
}

function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }

function calcBookValue(asset) {
  const years = (new Date() - new Date(asset.purchaseDate)) / (365.25 * 86400 * 1000)
  const annualDep = asset.cost / asset.usefulLife
  const accumulatedDep = Math.min(annualDep * years, asset.cost)
  return Math.max(asset.cost - accumulatedDep, 0)
}

export default async function AssetManagementPage(container) {
  const myGen = container.__routerGen
  seedDemoData()
  let assets = []
  let catFilter = 'all'
  let loading = true

  async function loadData() {
    loading = true
    try { assets = await listDocs('assets', [], 'purchaseDate', 'desc', 200) } catch (e) { assets = [] }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const list = catFilter === 'all' ? assets : assets.filter(a => a.cat === catFilter)
    const totalCost = assets.reduce((a, x) => a + x.cost, 0)
    const totalBookValue = assets.reduce((a, x) => a + calcBookValue(x), 0)
    const totalDepreciation = totalCost - totalBookValue

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🏭 Asset Management</div>
            <div class="page-subtitle">จัดการสินทรัพย์และค่าเสื่อมราคา</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="add-asset-btn">+ เพิ่มสินทรัพย์</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('🏭 สินทรัพย์ทั้งหมด', assets.length + ' รายการ', 'primary')}
          ${kpi('💰 ราคาทุนรวม', formatCurrency(totalCost), 'primary')}
          ${kpi('📊 มูลค่าทางบัญชี', formatCurrency(totalBookValue), 'success')}
          ${kpi('📉 ค่าเสื่อมสะสม', formatCurrency(totalDepreciation), 'warning')}
        </div>

        <div style="display:flex;gap:4px;margin-bottom:12px;flex-wrap:wrap">
          <button class="btn btn-xs ${catFilter==='all'?'btn-primary':'btn-secondary'} cf-btn" data-c="all">ทั้งหมด</button>
          ${Object.entries(ASSET_CATS).map(([k,v]) => `<button class="btn btn-xs ${catFilter===k?'btn-'+v.color:'btn-secondary'} cf-btn" data-c="${k}">${v.icon} ${v.label}</button>`).join('')}
        </div>

        <div class="card" style="overflow:hidden">
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="border-bottom:1px solid var(--border);font-size:0.75rem;color:var(--text-muted)">
                <th style="padding:10px 14px;text-align:left">สินทรัพย์</th>
                <th style="padding:10px 14px;text-align:center">ประเภท</th>
                <th style="padding:10px 14px;text-align:right">ราคาทุน</th>
                <th style="padding:10px 14px;text-align:right">มูลค่าปัจจุบัน</th>
                <th style="padding:10px 14px;text-align:center">เสื่อม</th>
                <th style="padding:10px 14px;text-align:center">สภาพ</th>
                <th style="padding:10px 14px;text-align:center">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              ${list.map(a => {
                const bv = calcBookValue(a)
                const depPct = Math.round((a.cost - bv) / a.cost * 100)
                const cat = ASSET_CATS[a.cat]
                return `<tr style="border-bottom:1px solid var(--border)">
                  <td style="padding:10px 14px">
                    <div style="font-weight:600;font-size:0.85rem">${escHtml(a.name)}</div>
                    <div style="font-size:0.72rem;color:var(--text-muted)">${escHtml(a.location)} · ซื้อ ${formatDate(a.purchaseDate)}</div>
                  </td>
                  <td style="padding:10px 14px;text-align:center"><span class="badge badge-${cat?.color}" style="font-size:0.65rem">${cat?.icon} ${cat?.label}</span></td>
                  <td style="padding:10px 14px;text-align:right;font-size:0.83rem">${formatCurrency(a.cost)}</td>
                  <td style="padding:10px 14px;text-align:right;font-size:0.83rem;font-weight:700;color:var(--success)">${formatCurrency(Math.round(bv))}</td>
                  <td style="padding:10px 14px;text-align:center">
                    <div style="display:flex;align-items:center;gap:6px">
                      <div style="flex:1;background:var(--surface-2);border-radius:3px;height:6px;min-width:60px">
                        <div style="width:${depPct}%;background:var(--warning);height:6px;border-radius:3px"></div>
                      </div>
                      <span style="font-size:0.7rem;min-width:28px">${depPct}%</span>
                    </div>
                  </td>
                  <td style="padding:10px 14px;text-align:center">
                    <span style="font-size:0.75rem;color:${a.condition==='good'?'var(--success)':a.condition==='fair'?'var(--warning)':'var(--danger)'}">${a.condition==='good'?'● ดี':a.condition==='fair'?'● พอใช้':'● แย่'}</span>
                  </td>
                  <td style="padding:10px 14px;text-align:center">
                    <button class="btn btn-xs btn-secondary view-asset-btn" data-id="${escHtml(a.id)}">ดู</button>
                  </td>
                </tr>`
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `

    container.querySelectorAll('.cf-btn').forEach(b => b.addEventListener('click', () => { catFilter = b.dataset.c; renderPage() }))
    document.getElementById('add-asset-btn')?.addEventListener('click', openAddForm)
    container.querySelectorAll('.view-asset-btn').forEach(b => b.addEventListener('click', () => {
      const a = assets.find(x => x.id === b.dataset.id); if (a) openDetail(a)
    }))
  }

  function openDetail(a) {
    const bv = calcBookValue(a)
    const cat = ASSET_CATS[a.cat]
    openModal({
      title: '🏭 ' + escHtml(a.id) + ' — ' + escHtml(a.name),
      size: 'md',
      body: `
        <div style="margin-bottom:12px"><span class="badge badge-${cat?.color}">${cat?.icon} ${cat?.label}</span></div>
        ${row('สถานที่', escHtml(a.location))}
        ${row('วันที่ซื้อ', formatDate(a.purchaseDate))}
        ${row('ราคาทุน', formatCurrency(a.cost))}
        ${row('มูลค่าปัจจุบัน', formatCurrency(Math.round(bv)))}
        ${row('ค่าเสื่อมสะสม', formatCurrency(Math.round(a.cost - bv)))}
        ${row('วิธีคิดค่าเสื่อม', DEPRECIATION_METHODS[a.depMethod])}
        ${row('อายุการใช้งาน', a.usefulLife + ' ปี')}
        ${a.lastMaint ? row('ซ่อมบำรุงล่าสุด', formatDate(a.lastMaint)) : ''}
      `
    })
  }

  function openAddForm() {
    openModal({
      title: '+ เพิ่มสินทรัพย์',
      size: 'md',
      body: `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="input-group" style="grid-column:1/-1"><label class="input-label">ชื่อสินทรัพย์ *</label><input class="input" id="af-name"></div>
          <div class="input-group"><label class="input-label">ประเภท</label>
            <select class="input" id="af-cat">${Object.entries(ASSET_CATS).map(([k,v])=>`<option value="${k}">${v.icon} ${v.label}</option>`).join('')}</select>
          </div>
          <div class="input-group"><label class="input-label">ราคาทุน (บาท)</label><input type="number" class="input" id="af-cost" placeholder="0"></div>
          <div class="input-group"><label class="input-label">อายุการใช้งาน (ปี)</label><input type="number" class="input" id="af-life" value="5"></div>
          <div class="input-group"><label class="input-label">สถานที่</label><input class="input" id="af-loc" placeholder="สาขา..."></div>
          <div class="input-group"><label class="input-label">วันที่ซื้อ</label><input type="date" class="input" id="af-date" value="${new Date().toISOString().slice(0,10)}"></div>
        </div>
      `,
      async onConfirm() {
        const name = document.getElementById('af-name')?.value?.trim()
        if (!name) { showToast('❗ กรุณากรอกชื่อ', 'error'); return false }
        try {
          await createDoc('assets', {
            name,
            cat: document.getElementById('af-cat')?.value||'equipment',
            cost: +document.getElementById('af-cost')?.value||0,
            depMethod: 'sl',
            usefulLife: +document.getElementById('af-life')?.value||5,
            purchaseDate: document.getElementById('af-date')?.value||addDays(0),
            location: document.getElementById('af-loc')?.value||'', status: 'active', condition: 'good', lastMaint: null
          })
          showToast('✅ เพิ่มสินทรัพย์แล้ว!', 'success')
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      }
    })
  }

  await loadData()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
function row(l, v) { return `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:0.83rem"><span style="color:var(--text-muted)">${l}</span><span>${v}</span></div>` }
