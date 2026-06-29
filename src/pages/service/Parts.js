import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'
import { showToast } from '../../core/store.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
import { formatCurrency, formatDate } from '../../utils/format.js'
import { openModal, confirmDialog } from '../../utils/modal.js'
import { exportToExcel } from '../../utils/importExport.js'

const PART_CATEGORIES = ['น้ำมันและของเหลว','ระบบเบรก','ระบบกันสะเทือน','ระบบไฟฟ้า','แบตเตอรี่ EV','ยางและล้อ','ตัวถัง','ฟิลเตอร์','อุปกรณ์เสริม','อื่นๆ']

const DEMO_PARTS = [
  { id:'p1', sku:'BYD-SEAL-BF001', name:'น้ำมันเบรก DOT4 BYD Original', brand:'BYD', category:'น้ำมันและของเหลว', unit:'ขวด', qty:24, minQty:5, unitCost:280, unitPrice:450, location:'ชั้น A1', createdAt:'2025-01-10' },
  { id:'p2', sku:'BYD-SEAL-BP002', name:'ผ้าเบรกหน้า BYD Seal', brand:'BYD', category:'ระบบเบรก', unit:'ชุด', qty:8, minQty:2, unitCost:1800, unitPrice:3200, location:'ชั้น B2', createdAt:'2025-01-15' },
  { id:'p3', sku:'MG-MG4-TY001', name:'ยางหน้า Michelin 235/45R18', brand:'Michelin', category:'ยางและล้อ', unit:'เส้น', qty:12, minQty:4, unitCost:3200, unitPrice:4800, location:'โกดัง', createdAt:'2025-02-01' },
  { id:'p4', sku:'NETA-V-AC001', name:'คอมเพรสเซอร์แอร์ NETA V II', brand:'NETA', category:'ระบบไฟฟ้า', unit:'ชิ้น', qty:2, minQty:1, unitCost:12000, unitPrice:18500, location:'ชั้น C1', createdAt:'2025-02-10' },
  { id:'p5', sku:'UNI-FL001', name:'น้ำหล่อเย็น EV Coolant', brand:'Universal', category:'น้ำมันและของเหลว', unit:'ลิตร', qty:3, minQty:10, unitCost:450, unitPrice:700, location:'ชั้น A2', createdAt:'2025-01-20' },
]

export default async function PartsPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let parts = []
  let filtered = []
  let catFilter = 'all'
  let search = ''
  let lowStockOnly = false

  async function loadData() {
    try { parts = await listDocs('parts', [], 'name', 'asc', 1000) } catch {}
    if (!parts.length) DEMO_PARTS.forEach(p => parts.push({ ...p }))
    updateStats(); applyFilter()
  }

  function updateStats() {
    const total = parts.length
    const low = parts.filter(p => (p.qty || 0) <= (p.minQty || 0)).length
    const value = parts.reduce((s, p) => s + (p.qty || 0) * (p.unitCost || 0), 0)
    const totalEl = document.getElementById('parts-total')
    if (totalEl) totalEl.textContent = `${total} รายการ`
    const lowEl = document.getElementById('parts-low')
    if (lowEl) { lowEl.textContent = `⚠️ ใกล้หมด ${low} รายการ`; lowEl.style.color = low > 0 ? 'var(--danger)' : 'var(--text-muted)' }
    const valEl = document.getElementById('parts-value')
    if (valEl) valEl.textContent = `มูลค่าคลัง: ${formatCurrency(value)}`
  }

  function applyFilter() {
    filtered = parts.filter(p => {
      const cs = catFilter === 'all' || p.category === catFilter
      const qs = !search || `${p.sku} ${p.name} ${p.brand}`.toLowerCase().includes(search)
      const ls = !lowStockOnly || (p.qty || 0) <= (p.minQty || 0)
      return cs && qs && ls
    })
    renderTable()
  }

  function renderTable() {
    const wrap = document.getElementById('parts-content')
    if (!wrap) return
    const cEl = document.getElementById('parts-filtered')
    if (cEl) cEl.textContent = `แสดง ${filtered.length} รายการ`

    if (!filtered.length) {
      wrap.innerHTML = `<div class="empty-state" style="padding:48px"><div class="empty-icon">🔩</div><div class="empty-title">ไม่พบอะไหล่</div></div>`
      return
    }

    wrap.innerHTML = `<div class="table-wrap">
      <table>
        <thead><tr>
          <th>SKU</th><th>ชื่ออะไหล่</th><th>หมวดหมู่</th><th>ยี่ห้อ</th>
          <th>คงเหลือ</th><th>ขั้นต่ำ</th><th>ราคาทุน</th><th>ราคาขาย</th><th>ที่เก็บ</th><th></th>
        </tr></thead>
        <tbody>${filtered.map(p => tableRow(p)).join('')}</tbody>
      </table>
    </div>`

    document.querySelectorAll('.part-row').forEach(row => {
      row.addEventListener('click', e => { if (e.target.closest('.edit-p,.adj-p')) return; openDetail(parts.find(x => x.id === row.dataset.id)) })
    })
    document.querySelectorAll('.edit-p').forEach(btn => btn.addEventListener('click', e => {
      e.stopPropagation(); openForm(parts.find(x => x.id === btn.dataset.id))
    }))
    document.querySelectorAll('.adj-p').forEach(btn => btn.addEventListener('click', e => {
      e.stopPropagation(); openAdjust(parts.find(x => x.id === btn.dataset.id))
    }))
  }

  function tableRow(p) {
    const isLow = (p.qty || 0) <= (p.minQty || 0)
    const isOut = (p.qty || 0) === 0
    return `
      <tr class="part-row" data-id="${p.id}" style="cursor:pointer;${isOut ? 'opacity:0.6' : ''}">
        <td style="font-size:0.75rem;font-family:monospace;color:var(--text-muted)">${escHtml(p.sku)}</td>
        <td>
          <div style="font-weight:600">${escHtml(p.name)}</div>
          ${isLow ? `<div style="font-size:0.72rem;color:var(--danger);font-weight:600">⚠️ ใกล้หมด</div>` : ''}
        </td>
        <td style="font-size:0.78rem"><span class="badge badge-primary">${escHtml(p.category||'-')}</span></td>
        <td style="font-size:0.82rem;color:var(--text-2)">${escHtml(p.brand||'-')}</td>
        <td style="text-align:center;font-weight:700;color:${isOut?'var(--danger)':isLow?'var(--warning)':'var(--success)'}">
          ${p.qty||0} <span style="font-size:0.7rem;color:var(--text-muted)">${escHtml(p.unit||'')}</span>
        </td>
        <td style="text-align:center;font-size:0.82rem;color:var(--text-muted)">${p.minQty||0}</td>
        <td style="color:var(--text-2);font-size:0.85rem">${formatCurrency(p.unitCost)}</td>
        <td style="color:var(--accent);font-weight:600;font-size:0.85rem">${formatCurrency(p.unitPrice)}</td>
        <td style="font-size:0.78rem;color:var(--text-muted)">${escHtml(p.location||'-')}</td>
        <td>
          <div style="display:flex;gap:3px">
            <button class="btn btn-ghost btn-sm adj-p" data-id="${p.id}" title="ปรับสต็อก">📦</button>
            <button class="btn btn-ghost btn-sm edit-p" data-id="${p.id}" title="แก้ไข">✏️</button>
          </div>
        </td>
      </tr>`
  }

  function openDetail(p) {
    if (!p) return
    const isLow = (p.qty || 0) <= (p.minQty || 0)
    const margin = (p.unitPrice || 0) - (p.unitCost || 0)
    openModal({
      title: '🔩 ' + escHtml(p.name), size: 'md',
      body: `
        <div style="display:flex;flex-direction:column;gap:10px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span class="badge badge-primary">${escHtml(p.category||'-')}</span>
            ${isLow ? `<span style="color:var(--danger);font-weight:600;font-size:0.85rem">⚠️ ใกล้หมด!</span>` : ''}
          </div>
          ${dRow('🏷','SKU',escHtml(p.sku||'-'))}
          ${dRow('🚗','ยี่ห้อ',escHtml(p.brand||'-'))}
          ${dRow('📦','คงเหลือ',`${p.qty||0} ${escHtml(p.unit||'')}`)}
          ${dRow('⚠️','ขั้นต่ำ',`${p.minQty||0} ${escHtml(p.unit||'')}`)}
          ${dRow('💰','ราคาทุน',formatCurrency(p.unitCost))}
          ${dRow('💵','ราคาขาย',formatCurrency(p.unitPrice))}
          ${dRow('📊','กำไร/หน่วย',`<span style="color:${margin>0?'var(--success)':'var(--danger)'}">${margin>0?'+':''}${formatCurrency(margin)}</span>`)}
          ${dRow('📍','ที่เก็บ',escHtml(p.location||'-'))}
        </div>
      `,
      footer: `<button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">ปิด</button>
               <button class="btn btn-primary" id="p-adj">📦 ปรับสต็อก</button>`
    })
    document.getElementById('p-adj')?.addEventListener('click', () => { document.querySelector('.modal-overlay')?.remove(); openAdjust(p) })
  }

  function openAdjust(p) {
    if (!p) return
    const { el, close } = openModal({
      title: '📦 ปรับสต็อก — ' + escHtml(p.name), size: 'sm',
      body: `
        <div style="display:flex;flex-direction:column;gap:12px">
          <div style="text-align:center;font-size:2rem;font-weight:800;color:var(--primary)">${p.qty||0} ${escHtml(p.unit||'')}</div>
          <div style="display:flex;gap:8px;align-items:center">
            <button class="btn btn-danger btn-sm" id="adj-minus" style="width:40px;font-size:1.2rem">−</button>
            <input class="input" type="number" id="adj-qty" value="${p.qty||0}" style="text-align:center;font-size:1.1rem;font-weight:700">
            <button class="btn btn-success btn-sm" id="adj-plus" style="width:40px;font-size:1.2rem">+</button>
          </div>
          <div class="input-group"><label class="input-label">เหตุผล</label>
            <select class="input" id="adj-reason">
              <option>รับสินค้าเข้า</option><option>ตัดจ่าย Job Card</option><option>ตรวจนับสต็อก</option><option>ส่งคืน</option><option>สูญหาย</option>
            </select>
          </div>
        </div>
      `,
      footer: `<button class="btn btn-secondary" id="adj-c">ยกเลิก</button><button class="btn btn-primary" id="adj-s">💾 บันทึก</button>`
    })
    el.querySelector('#adj-c').addEventListener('click', close)
    el.querySelector('#adj-minus').addEventListener('click', () => {
      const inp = el.querySelector('#adj-qty'); inp.value = Math.max(0, Number(inp.value) - 1)
    })
    el.querySelector('#adj-plus').addEventListener('click', () => {
      const inp = el.querySelector('#adj-qty'); inp.value = Number(inp.value) + 1
    })
    el.querySelector('#adj-s').addEventListener('click', async () => {
      const newQty = Number(el.querySelector('#adj-qty').value)
      try {
        await updateDocData('parts', p.id, { qty: newQty })
        p.qty = newQty; showToast(`✅ ปรับสต็อกเป็น ${newQty} ${p.unit}`, 'success')
        close(); updateStats(); applyFilter()
      } catch { showToast('บันทึกไม่สำเร็จ','error') }
    })
  }

  function openForm(existing = null) {
    const isEdit = !!existing
    const { el, close } = openModal({
      title: isEdit ? '✏️ แก้ไขอะไหล่' : '➕ เพิ่มอะไหล่', size: 'lg',
      body: `
        <div style="display:flex;flex-direction:column;gap:12px">
          <div class="grid-2">
            <div class="input-group"><label class="input-label">SKU *</label><input class="input" id="pf-sku" value="${escHtml(existing?.sku||'')}"><span class="input-error" id="pf-sku-e"></span></div>
            <div class="input-group"><label class="input-label">ชื่ออะไหล่ *</label><input class="input" id="pf-name" value="${escHtml(existing?.name||'')}"><span class="input-error" id="pf-name-e"></span></div>
          </div>
          <div class="grid-2">
            <div class="input-group"><label class="input-label">หมวดหมู่</label>
              <select class="input" id="pf-cat">
                ${PART_CATEGORIES.map(c => `<option value="${c}" ${existing?.category===c?'selected':''}>${c}</option>`).join('')}
              </select>
            </div>
            <div class="input-group"><label class="input-label">ยี่ห้อ</label><input class="input" id="pf-brand" value="${escHtml(existing?.brand||'')}"></div>
          </div>
          <div class="grid-2">
            <div class="input-group"><label class="input-label">จำนวนคงเหลือ</label><input class="input" type="number" id="pf-qty" value="${existing?.qty||0}"></div>
            <div class="input-group"><label class="input-label">ขั้นต่ำ (แจ้งเตือน)</label><input class="input" type="number" id="pf-min" value="${existing?.minQty||0}"></div>
          </div>
          <div class="grid-2">
            <div class="input-group"><label class="input-label">ราคาทุน (บาท)</label><input class="input" type="number" id="pf-cost" value="${existing?.unitCost||''}"></div>
            <div class="input-group"><label class="input-label">ราคาขาย (บาท)</label><input class="input" type="number" id="pf-price" value="${existing?.unitPrice||''}"></div>
          </div>
          <div class="grid-2">
            <div class="input-group"><label class="input-label">หน่วย</label><input class="input" id="pf-unit" value="${escHtml(existing?.unit||'ชิ้น')}"></div>
            <div class="input-group"><label class="input-label">ที่เก็บ</label><input class="input" id="pf-loc" value="${escHtml(existing?.location||'')}"></div>
          </div>
        </div>
      `,
      footer: `<button class="btn btn-secondary" id="pfc">ยกเลิก</button><button class="btn btn-primary" id="pfs">💾 บันทึก</button>`
    })
    el.querySelector('#pfc').addEventListener('click', close)
    el.querySelector('#pfs').addEventListener('click', async () => {
      const sku = el.querySelector('#pf-sku').value.trim()
      const name = el.querySelector('#pf-name').value.trim()
      if (!sku) { el.querySelector('#pf-sku-e').textContent = 'กรุณาระบุ'; return }
      if (!name) { el.querySelector('#pf-name-e').textContent = 'กรุณาระบุ'; return }
      const btn = el.querySelector('#pfs'); btn.disabled = true; btn.innerHTML = '<span class="spinner spinner-sm"></span>'
      const data = {
        sku, name, category: el.querySelector('#pf-cat').value, brand: el.querySelector('#pf-brand').value.trim(),
        qty: Number(el.querySelector('#pf-qty').value)||0, minQty: Number(el.querySelector('#pf-min').value)||0,
        unitCost: Number(el.querySelector('#pf-cost').value)||0, unitPrice: Number(el.querySelector('#pf-price').value)||0,
        unit: el.querySelector('#pf-unit').value||'ชิ้น', location: el.querySelector('#pf-loc').value.trim(),
        createdAt: existing?.createdAt || new Date().toISOString().slice(0,10),
      }
      try {
        if (isEdit) { await updateDocData('parts', existing.id, data); Object.assign(existing, data) }
        else { const id = await createDoc('parts', data); parts.unshift({ ...data, id }) }
        showToast(isEdit ? 'แก้ไขแล้ว' : '✅ เพิ่มอะไหล่แล้ว', 'success')
        close(); updateStats(); applyFilter()
      } catch { showToast('บันทึกไม่สำเร็จ','error') }
    })
  }

  // ── Page HTML ─────────────────────
  container.innerHTML = `
    <div class="page-content animate-slide">
      <div class="page-header">
        <div>
          <div class="page-title">🔩 คลังอะไหล่</div>
          <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
            <span class="page-subtitle" id="parts-total">กำลังโหลด...</span>
            <span style="font-size:0.8rem" id="parts-low"></span>
            <span style="font-size:0.8rem;color:var(--accent)" id="parts-value"></span>
          </div>
        </div>
        <div class="page-actions">
          <button class="btn btn-ghost btn-sm" id="low-toggle">⚠️ ใกล้หมด</button>
          <button class="btn btn-secondary btn-sm" id="parts-export">📥 Export</button>
          <button class="btn btn-primary" id="add-part-btn">➕ เพิ่มอะไหล่</button>
        </div>
      </div>

      <!-- Category filter + Search -->
      <div class="card mb-4" style="padding:12px 16px">
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
          <div style="position:relative;flex:1;min-width:200px">
            <span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text-muted)">🔍</span>
            <input class="input" id="parts-search" placeholder="ค้นหา SKU ชื่ออะไหล่ ยี่ห้อ..." style="padding-left:32px">
          </div>
          <select class="input" id="cat-filter" style="width:180px">
            <option value="all">ทุกหมวดหมู่</option>
            ${PART_CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('')}
          </select>
        </div>
      </div>
      <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:8px" id="parts-filtered"></div>
      <div id="parts-content">
        ${[...Array(5)].map(() => `<div class="skeleton" style="height:40px;border-radius:6px;margin-bottom:8px"></div>`).join('')}
      </div>
    </div>
  `

  document.getElementById('add-part-btn').addEventListener('click', () => openForm())
  document.getElementById('parts-search').addEventListener('input', e => { search = e.target.value.toLowerCase(); applyFilter() })
  document.getElementById('cat-filter').addEventListener('change', e => { catFilter = e.target.value; applyFilter() })
  document.getElementById('low-toggle').addEventListener('click', () => {
    lowStockOnly = !lowStockOnly
    document.getElementById('low-toggle').className = `btn btn-sm ${lowStockOnly ? 'btn-danger' : 'btn-ghost'}`
    applyFilter()
  })
  document.getElementById('parts-export').addEventListener('click', () => {
    exportToExcel(parts.map(p => ({ SKU:p.sku, ชื่ออะไหล่:p.name, หมวดหมู่:p.category, ยี่ห้อ:p.brand, คงเหลือ:p.qty, หน่วย:p.unit, ขั้นต่ำ:p.minQty, ราคาทุน:p.unitCost, ราคาขาย:p.unitPrice, ที่เก็บ:p.location })), `parts-${new Date().toISOString().slice(0,10)}.xlsx`, 'คลังอะไหล่')
    showToast('Export แล้ว', 'success')
  })

  if (container.__routerGen === myGen) await loadData()
}

function dRow(icon, label, value) {
  return `<div style="font-size:0.83rem;display:flex;gap:6px"><span>${icon}</span><span style="color:var(--text-muted);min-width:80px;flex-shrink:0">${label}</span><span style="color:var(--text-2)">${value}</span></div>`
}
