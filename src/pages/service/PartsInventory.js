/**
 * Parts Inventory — คลังอะไหล่
 * Route: /service/parts-inventory
 */
import { formatCurrency } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'

function esc(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;') }

const PART_CATS = {
  brake:    { label: 'เบรก', color: 'danger', icon: '🔴' },
  filter:   { label: 'ไส้กรอง', color: 'primary', icon: '🔵' },
  fluid:    { label: 'น้ำมัน/น้ำยา', color: 'warning', icon: '🟡' },
  electrical:{ label: 'ไฟฟ้า/EV', color: 'success', icon: '⚡' },
  body:     { label: 'ตัวถัง', color: 'secondary', icon: '🔧' },
  tyre:     { label: 'ยาง', color: 'secondary', icon: '⭕' },
}

export default async function PartsInventoryPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let parts = []
  let catFilter = 'all'
  let search = ''
  let sortBy = 'name'
  let loading = true

  async function loadData() {
    loading = true
    try { parts = await listDocs('service_parts_inventory', [], 'name', 'asc', 500) } catch (e) { parts = [] }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const list = parts.filter(p =>
      (catFilter === 'all' || p.cat === catFilter) &&
      (search === '' || p.name.toLowerCase().includes(search) || p.sku.toLowerCase().includes(search))
    )
    const lowStock = parts.filter(p => p.qty < p.minQty)
    const totalValue = parts.reduce((a, p) => a + p.qty * p.unitCost, 0)
    const totalSKUs = parts.length

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🔩 Parts Inventory</div>
            <div class="page-subtitle">คลังอะไหล่ — สต็อก ราคา ตำแหน่ง</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="adjust-btn">± ปรับสต็อก</button>
            <button class="btn btn-primary" id="add-part-btn">+ เพิ่มอะไหล่</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('🔩 SKU ทั้งหมด', totalSKUs, 'primary')}
          ${kpi('⚠️ สต็อกต่ำ', lowStock.length + ' รายการ', lowStock.length > 0 ? 'danger' : 'success')}
          ${kpi('💰 มูลค่าคลัง', formatCurrency(totalValue), 'warning')}
          ${kpi('📦 รายการทั้งหมด', parts.reduce((a,p)=>a+p.qty,0) + ' ชิ้น', 'secondary')}
        </div>

        ${lowStock.length > 0 ? `
          <div style="padding:10px 14px;background:var(--danger)11;border:1px solid var(--danger)33;border-radius:var(--radius);margin-bottom:12px;font-size:0.78rem">
            ⚠️ <strong>สต็อกต่ำ:</strong> ${lowStock.map(p => `${esc(p.name)} (${p.qty}/${p.minQty})`).join(' · ')}
          </div>
        ` : ''}

        <!-- Filters + search -->
        <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;align-items:center">
          <input class="input" id="search-input" placeholder="ค้นหาชื่อ / SKU..." value="${search}" style="width:200px;padding:6px 10px;font-size:0.8rem">
          <div style="display:flex;gap:4px">
            <button class="btn btn-xs ${catFilter==='all'?'btn-primary':'btn-secondary'} cat-btn" data-c="all">ทั้งหมด</button>
            ${Object.entries(PART_CATS).map(([k,v]) => `<button class="btn btn-xs ${catFilter===k?'btn-'+v.color:'btn-secondary'} cat-btn" data-c="${k}">${v.icon} ${v.label}</button>`).join('')}
          </div>
        </div>

        <!-- Parts table -->
        <div class="card" style="overflow:hidden">
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="border-bottom:1px solid var(--border);font-size:0.73rem;color:var(--text-muted)">
                <th style="padding:8px 14px;text-align:left">อะไหล่</th>
                <th style="padding:8px 10px;text-align:left">SKU</th>
                <th style="padding:8px 10px">ประเภท</th>
                <th style="padding:8px 10px;text-align:center">สต็อก</th>
                <th style="padding:8px 10px;text-align:right">ต้นทุน</th>
                <th style="padding:8px 10px;text-align:right">ราคาขาย</th>
                <th style="padding:8px 10px;text-align:center">ตำแหน่ง</th>
                <th style="padding:8px 14px"></th>
              </tr>
            </thead>
            <tbody>
              ${list.map(p => {
                const pc = PART_CATS[p.cat]
                const isLow = p.qty < p.minQty
                return `<tr style="border-bottom:1px solid var(--border);font-size:0.8rem${isLow?';background:var(--danger)06':''}">
                  <td style="padding:8px 14px">
                    <div style="font-weight:600">${esc(p.name)}</div>
                    <div style="font-size:0.65rem;color:var(--text-muted)">${p.compatible.join(', ')}</div>
                  </td>
                  <td style="padding:8px 10px;font-family:monospace;font-size:0.75rem">${p.sku}</td>
                  <td style="padding:8px 10px;text-align:center"><span class="badge badge-${pc?.color}" style="font-size:0.6rem">${pc?.icon} ${pc?.label}</span></td>
                  <td style="padding:8px 10px;text-align:center">
                    <span style="font-weight:700;color:var(--${isLow?'danger':'success'})">${p.qty}</span>
                    <span style="font-size:0.65rem;color:var(--text-muted)">/ min ${p.minQty}</span>
                  </td>
                  <td style="padding:8px 10px;text-align:right">${formatCurrency(p.unitCost)}</td>
                  <td style="padding:8px 10px;text-align:right;font-weight:700">${formatCurrency(p.unitPrice)}</td>
                  <td style="padding:8px 10px;text-align:center"><code style="font-size:0.72rem">${p.location}</code></td>
                  <td style="padding:8px 14px;text-align:right">
                    <button class="btn btn-xs btn-secondary adj-qty-btn" data-id="${p.id}">±</button>
                  </td>
                </tr>`
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `

    document.getElementById('search-input')?.addEventListener('input', e => { search = e.target.value.toLowerCase(); renderPage() })
    container.querySelectorAll('.cat-btn').forEach(b => b.addEventListener('click', () => { catFilter = b.dataset.c; renderPage() }))
    container.querySelectorAll('.adj-qty-btn').forEach(b => b.addEventListener('click', () => {
      const p = parts.find(x => x.id === b.dataset.id); if (p) openAdjQty(p)
    }))
    document.getElementById('add-part-btn')?.addEventListener('click', openAddForm)
  }

  function openAdjQty(p) {
    openModal({
      title: '± ปรับสต็อก: ' + esc(p.name),
      size: 'sm',
      body: `<div style="display:grid;gap:10px">
        ${row2('สต็อกปัจจุบัน', p.qty + ' ชิ้น')}
        <div class="input-group"><label class="input-label">รับเข้า / จ่ายออก (+/-)</label><input class="input" type="number" id="adj-qty" value="0"></div>
        <div class="input-group"><label class="input-label">หมายเหตุ</label><input class="input" id="adj-note" placeholder="รับของจากซัพพลายเออร์ / ใช้งาน"></div>
      </div>`,
      async onConfirm() {
        const adj = parseInt(document.getElementById('adj-qty')?.value) || 0
        const newQty = Math.max(0, p.qty + adj)
        try {
          await updateDocData('service_parts_inventory', p.id, { qty: newQty })
          showToast(`✅ ปรับสต็อก ${p.name}: ${adj > 0 ? '+' : ''}${adj} → ${newQty} ชิ้น`, 'success')
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      }
    })
  }

  function openAddForm() {
    openModal({
      title: '+ เพิ่มอะไหล่ใหม่',
      size: 'md',
      body: `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="input-group" style="grid-column:1/-1"><label class="input-label">ชื่ออะไหล่ *</label><input class="input" id="pn-name"></div>
        <div class="input-group"><label class="input-label">SKU</label><input class="input" id="pn-sku"></div>
        <div class="input-group"><label class="input-label">ประเภท</label>
          <select class="input" id="pn-cat">${Object.entries(PART_CATS).map(([k,v])=>`<option value="${k}">${v.icon} ${v.label}</option>`).join('')}</select>
        </div>
        <div class="input-group"><label class="input-label">จำนวนเริ่มต้น</label><input class="input" type="number" id="pn-qty" value="1"></div>
        <div class="input-group"><label class="input-label">ขั้นต่ำ</label><input class="input" type="number" id="pn-min" value="2"></div>
        <div class="input-group"><label class="input-label">ต้นทุน (บาท)</label><input class="input" type="number" id="pn-cost" value="0"></div>
        <div class="input-group"><label class="input-label">ราคาขาย (บาท)</label><input class="input" type="number" id="pn-price" value="0"></div>
        <div class="input-group"><label class="input-label">ตำแหน่ง</label><input class="input" id="pn-loc" placeholder="A1-01"></div>
      </div>`,
      async onConfirm() {
        const name = document.getElementById('pn-name')?.value?.trim()
        if (!name) { showToast('❗ กรุณากรอกชื่ออะไหล่','error'); return false }
        try {
          await createDoc('service_parts_inventory', { name, sku:document.getElementById('pn-sku')?.value||'—', cat:document.getElementById('pn-cat')?.value||'body', qty:parseInt(document.getElementById('pn-qty')?.value)||0, minQty:parseInt(document.getElementById('pn-min')?.value)||2, unitCost:parseInt(document.getElementById('pn-cost')?.value)||0, unitPrice:parseInt(document.getElementById('pn-price')?.value)||0, location:document.getElementById('pn-loc')?.value||'—', compatible:['All'] })
          showToast('✅ เพิ่มอะไหล่แล้ว','success')
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      }
    })
  }

  await loadData()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
function row2(l, v) { return `<div style="display:flex;justify-content:space-between;font-size:0.8rem;padding:4px 0;border-bottom:1px solid var(--border)"><span style="color:var(--text-muted)">${l}</span><span>${v}</span></div>` }
