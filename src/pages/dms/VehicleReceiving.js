/**
 * Vehicle Receiving — รับรถเข้าสต็อก (จากคำสั่งซื้อ)
 * Route: /dms/receiving
 */
import { formatCurrency, formatDate } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { exportToExcel } from '../../utils/importExport.js'
import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const RECV_STATUS = {
  transit:  { label: 'อยู่ระหว่างขนส่ง', color: 'primary' },
  arrived:  { label: 'ถึงโชว์รูมแล้ว', color: 'warning' },
  inspecting:{ label: 'กำลัง PDI', color: 'primary' },
  stocked:  { label: 'รับเข้าสต็อกแล้ว', color: 'success' },
  rejected: { label: 'ปฏิเสธรับ', color: 'danger' },
}

function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }

export default async function VehicleReceivingPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let statusFilter = 'all'
  let vehicles = []
  let loading = true

  function filtered() {
    return vehicles.filter(v => statusFilter === 'all' || v.status === statusFilter)
      .sort((a, b) => (b.eta || b.id).localeCompare(a.eta || a.id))
  }

  const today = addDays(0)

  async function loadData() {
    loading = true
    try { vehicles = await listDocs('vehicle_receiving', [], 'eta', 'asc', 200) } catch (e) { vehicles = [] }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const list = filtered()
    const transit = vehicles.filter(v => v.status === 'transit').length
    const arrived = vehicles.filter(v => v.status === 'arrived').length
    const stocked = vehicles.filter(v => v.status === 'stocked').length
    const overdue = vehicles.filter(v => v.status === 'transit' && v.eta && v.eta < today).length

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">📦 รับรถเข้าสต็อก</div>
            <div class="page-subtitle">Vehicle Receiving — ติดตามการขนส่งและ PDI</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="export-btn">📥 Export</button>
            <button class="btn btn-primary" id="add-btn">+ บันทึกรับรถ</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('🚚 กำลังขนส่ง', transit, 'primary')}
          ${kpi('🏠 ถึงโชว์รูม', arrived, 'warning')}
          ${kpi('✅ รับเข้าสต็อก', stocked, 'success')}
          ${kpi('❗ เกิน ETA', overdue, overdue > 0 ? 'danger' : 'secondary')}
        </div>

        <div style="display:flex;gap:4px;margin-bottom:12px">
          <button class="btn btn-sm ${statusFilter==='all'?'btn-primary':'btn-secondary'} sf-btn" data-s="all">ทั้งหมด</button>
          ${Object.entries(RECV_STATUS).map(([k,v]) => `<button class="btn btn-sm ${statusFilter===k?'btn-'+v.color:'btn-secondary'} sf-btn" data-s="${k}">${v.label}</button>`).join('')}
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px">
          ${list.map(v => renderVehicleCard(v)).join('')}
          ${!list.length ? `<div class="empty-state" style="grid-column:1/-1"><div class="empty-state-icon">📦</div><div>ไม่พบรายการ</div></div>` : ''}
        </div>
      </div>
    `

    container.querySelectorAll('.sf-btn').forEach(b => b.addEventListener('click', () => { statusFilter = b.dataset.s; renderPage() }))
    document.getElementById('add-btn')?.addEventListener('click', openAddForm)
    document.getElementById('export-btn')?.addEventListener('click', () => {
      exportToExcel(vehicles.map(v => ({ ID: v.id, รุ่น: `${v.brand} ${v.model}`, สี: v.color, VIN: v.vin, ต้นทุน: v.cost, สถานะ: RECV_STATUS[v.status]?.label, ETA: v.eta, รับเข้า: v.stockedDate||'-' })), 'vehicle_receiving')
      showToast('📥 Export แล้ว!', 'success')
    })
    container.querySelectorAll('.open-rv-btn').forEach(b => b.addEventListener('click', () => {
      const v = vehicles.find(x => x.id === b.dataset.id); if (v) openVehicleDetail(v)
    }))
    container.querySelectorAll('.pdi-btn').forEach(b => b.addEventListener('click', () => {
      const v = vehicles.find(x => x.id === b.dataset.id); if (v) openPDIModal(v)
    }))
    container.querySelectorAll('.arrived-btn').forEach(b => b.addEventListener('click', async () => {
      const v = vehicles.find(x => x.id === b.dataset.id)
      if (!v) return
      try {
        await updateDocData('vehicle_receiving', v.id, { status: 'arrived', arrivedDate: today })
        showToast(`✅ ${v.brand} ${v.model} ถึงโชว์รูมแล้ว!`, 'success')
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    }))
  }

  function renderVehicleCard(v) {
    const st = RECV_STATUS[v.status]
    const isOverdue = v.status === 'transit' && v.eta && v.eta < today
    const checkCount = Object.values(v.checklist).filter(Boolean).length
    const checkTotal = Object.keys(v.checklist).length
    return `<div class="card" style="padding:14px;border-left:3px solid var(--${st?.color})">
      <div style="display:flex;justify-content:space-between;margin-bottom:8px">
        <div>
          <div style="font-weight:700;font-size:0.9rem">${escHtml(v.brand)} ${escHtml(v.model)}</div>
          <div style="font-size:0.75rem;color:var(--text-muted)">${escHtml(v.variant)} · ${escHtml(v.color)} · ${v.year}</div>
        </div>
        <span class="badge badge-${st?.color}">${st?.label}</span>
      </div>
      <div style="font-family:monospace;font-size:0.75rem;color:var(--text-muted);margin-bottom:8px">${escHtml(v.vin)}</div>
      <div style="display:flex;justify-content:space-between;font-size:0.78rem;margin-bottom:8px">
        <span>💰 ต้นทุน: <strong>${formatCurrency(v.cost)}</strong></span>
        <span>🏢 ${escHtml(v.branch)}</span>
      </div>
      ${v.status === 'transit' ? `<div style="font-size:0.78rem;color:${isOverdue?'var(--danger)':'var(--text-muted)'}">🚚 ETA: ${formatDate(v.eta)} ${isOverdue?'(เกินกำหนด!)':''}</div>` : ''}
      ${v.status !== 'transit' && v.status !== 'stocked' ? `
        <div style="margin-bottom:8px">
          <div style="font-size:0.73rem;color:var(--text-muted);margin-bottom:3px">PDI Checklist ${checkCount}/${checkTotal}</div>
          <div style="background:var(--surface-2);border-radius:3px;height:5px">
            <div style="width:${Math.round(checkCount/checkTotal*100)}%;background:${checkCount===checkTotal?'var(--success)':'var(--primary)'};height:5px;border-radius:3px"></div>
          </div>
        </div>
      ` : ''}
      <div style="display:flex;gap:6px;margin-top:8px">
        <button class="btn btn-xs btn-secondary open-rv-btn" data-id="${v.id}">ดู</button>
        ${v.status === 'transit' ? `<button class="btn btn-xs btn-warning arrived-btn" data-id="${v.id}">📦 รับถึงแล้ว</button>` : ''}
        ${v.status === 'arrived' ? `<button class="btn btn-xs btn-primary pdi-btn" data-id="${v.id}">🔍 ทำ PDI</button>` : ''}
        ${v.status === 'inspecting' ? `<button class="btn btn-xs btn-primary pdi-btn" data-id="${v.id}">📋 ต่อ PDI</button>` : ''}
      </div>
    </div>`
  }

  function openPDIModal(v) {
    const checkItems = [['exterior','🚗 สภาพภายนอก'],['interior','🪑 ภายในห้องโดยสาร'],['mechanical','⚙️ ระบบเครื่องยนต์/EV'],['documents','📄 เอกสาร'],['keys','🔑 กุญแจ/อุปกรณ์']]
    openModal({
      title: '🔍 PDI — ' + escHtml(v.brand) + ' ' + escHtml(v.model),
      size: 'md',
      body: `
        <div style="padding:10px;background:var(--surface-2);border-radius:var(--radius-sm);font-size:0.82rem;margin-bottom:12px">
          <strong>${escHtml(v.brand)} ${escHtml(v.model)} ${escHtml(v.variant)}</strong> · ${escHtml(v.color)} · ${escHtml(v.vin)}
        </div>
        <div style="font-size:0.8rem;font-weight:700;margin-bottom:8px">ตรวจสอบรายการ</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
          ${checkItems.map(([key, label]) => `
            <label style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:var(--surface-2);border-radius:var(--radius-sm);cursor:pointer">
              <input type="checkbox" class="pdi-check" data-k="${key}" ${v.checklist[key]?'checked':''} style="width:15px;height:15px">
              <span style="font-size:0.82rem">${label}</span>
            </label>
          `).join('')}
        </div>
      `,
      confirmLabel: '✅ บันทึก PDI',
      confirmClass: 'btn-primary',
      async onConfirm() {
        const checklist = { ...v.checklist }
        checkItems.forEach(([key]) => {
          checklist[key] = !!document.querySelector(`.modal .pdi-check[data-k="${key}"]`)?.checked
        })
        const allPassed = Object.values(checklist).every(Boolean)
        try {
          if (allPassed) {
            await updateDocData('vehicle_receiving', v.id, { checklist, status: 'stocked', stockedDate: today, pdiStatus: 'passed' })
            showToast(`✅ PDI ผ่าน! รับ ${v.brand} ${v.model} เข้าสต็อกแล้ว`, 'success')
          } else {
            await updateDocData('vehicle_receiving', v.id, { checklist, status: 'inspecting', pdiStatus: 'in_progress' })
            showToast('📋 บันทึก PDI บางส่วน', 'warning')
          }
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      }
    })
  }

  function openVehicleDetail(v) {
    const st = RECV_STATUS[v.status]
    openModal({
      title: '📦 ' + escHtml(v.id) + ' — ' + escHtml(v.brand) + ' ' + escHtml(v.model),
      size: 'md',
      body: `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
          <div>
            ${row('รุ่น', escHtml(v.brand)+' '+escHtml(v.model)+' '+escHtml(v.variant))}${row('สี', escHtml(v.color))}${row('ปีรถ', v.year)}${row('VIN', `<span style="font-family:monospace;font-size:0.78rem">${escHtml(v.vin)}</span>`)}
          </div>
          <div>
            ${row('ต้นทุน', `<strong style="color:var(--success)">${formatCurrency(v.cost)}</strong>`)}${row('ซัพพลายเออร์', escHtml(v.supplier))}${row('ETA', v.eta ? formatDate(v.eta) : '-')}${row('ถึงวันที่', v.arrivedDate ? formatDate(v.arrivedDate) : '-')}${row('รับเข้า', v.stockedDate ? formatDate(v.stockedDate) : '-')}
          </div>
        </div>
        <div style="margin-top:12px">${row('สถานะ', `<span class="badge badge-${st?.color}">${st?.label}</span>`)}</div>
        <div style="margin-top:12px;font-size:0.78rem;font-weight:700;margin-bottom:8px">✅ PDI Checklist</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px">
          ${Object.entries(v.checklist).map(([k,val]) => `<div style="display:flex;align-items:center;gap:6px;padding:5px 8px;background:var(--surface-2);border-radius:var(--radius-sm);font-size:0.8rem">
            <span>${val ? '✅' : '⬜'}</span><span style="${!val?'color:var(--text-muted)':''}">PDI ${k}</span>
          </div>`).join('')}
        </div>
      `
    })
  }

  function openAddForm() {
    openModal({
      title: '+ บันทึกรถรับเข้าใหม่',
      size: 'md',
      body: `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="input-group"><label class="input-label">แบรนด์</label><input class="input" id="rvf-brand" placeholder="BYD / MG / Neta"></div>
          <div class="input-group"><label class="input-label">รุ่น</label><input class="input" id="rvf-model" placeholder="Seal AWD"></div>
          <div class="input-group"><label class="input-label">สี</label><input class="input" id="rvf-color" placeholder="Cosmos Black"></div>
          <div class="input-group"><label class="input-label">VIN</label><input class="input" id="rvf-vin" placeholder="VIN..."></div>
          <div class="input-group"><label class="input-label">ต้นทุน (บาท)</label><input type="number" class="input" id="rvf-cost" placeholder="1280000"></div>
          <div class="input-group"><label class="input-label">ETA (วันที่คาดถึง)</label><input type="date" class="input" id="rvf-eta" value="${addDays(7)}"></div>
          <div class="input-group"><label class="input-label">ซัพพลายเออร์</label><input class="input" id="rvf-supplier" placeholder="BYD Thailand"></div>
          <div class="input-group"><label class="input-label">สาขา</label><input class="input" id="rvf-branch" value="สาขาหลัก"></div>
        </div>
      `,
      async onConfirm() {
        const brand = document.getElementById('rvf-brand')?.value?.trim()
        const model = document.getElementById('rvf-model')?.value?.trim()
        if (!brand || !model) { showToast('❗ กรุณากรอกแบรนด์และรุ่น', 'error'); return false }
        try {
          await createDoc('vehicle_receiving', {
            orderId: '',
            brand, model, variant: '', color: document.getElementById('rvf-color')?.value||'',
            year: 2024, vin: document.getElementById('rvf-vin')?.value||'',
            cost: +document.getElementById('rvf-cost')?.value||0,
            supplier: document.getElementById('rvf-supplier')?.value||'',
            status: 'transit', eta: document.getElementById('rvf-eta')?.value||addDays(7),
            arrivedDate: null, stockedDate: null, pdiStatus: 'pending',
            branch: document.getElementById('rvf-branch')?.value||'สาขาหลัก',
            checklist: { exterior: false, interior: false, mechanical: false, documents: false, keys: false }
          })
          showToast('✅ บันทึกรถรับเข้าแล้ว!', 'success')
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      }
    })
  }

  await loadData()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
function row(l, v) { return `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);font-size:0.82rem"><span style="color:var(--text-muted)">${l}</span><span>${v}</span></div>` }
