import { formatCurrency, formatDate, timeAgo } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { exportToExcel } from '../../utils/importExport.js'
import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const JOB_STATUS = {
  pending:    { label: 'รอรับ', color: 'warning' },
  in_progress:{ label: 'กำลังซ่อม', color: 'primary' },
  waiting_parts:{ label: 'รออะไหล่', color: 'warning' },
  done:       { label: 'เสร็จแล้ว', color: 'success' },
  delivered:  { label: 'ส่งคืนแล้ว', color: 'secondary' },
}

const SERVICE_TYPES = { periodic: 'ตรวจตามระยะ', repair: 'ซ่อมทั่วไป', warranty: 'รับประกัน', recall: 'Recall', pdi: 'PDI', accident: 'อุบัติเหตุ', electric: 'EV System' }

function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }

export default async function ServiceHistoryPage(container) {
  const myGen = container.__routerGen
  seedDemoData()
  let statusFilter = 'all'
  let typeFilter = 'all'
  let search = ''
  let records = []
  let loading = true

  async function loadData() {
    loading = true
    try { records = await listDocs('service_history_records', [], 'date', 'desc', 300) } catch (e) { records = [] }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function filtered() {
    return records.filter(r => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false
      if (typeFilter !== 'all' && r.type !== typeFilter) return false
      if (search) {
        const q = search.toLowerCase()
        if (!r.customerName.toLowerCase().includes(q) && !r.plate.toLowerCase().includes(q) && !r.model.toLowerCase().includes(q)) return false
      }
      return true
    }).sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const list = filtered()
    const total = records.length
    const inProgress = records.filter(r => r.status === 'in_progress').length
    const totalRevenue = records.filter(r => r.status === 'delivered').reduce((a, r) => a + r.totalCost, 0)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🔧 ประวัติการซ่อม</div>
            <div class="page-subtitle">Service History — บันทึกการซ่อมและบริการทั้งหมด</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="export-btn">📥 Export</button>
            <button class="btn btn-primary" id="add-sh-btn">+ บันทึกงานใหม่</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('🔧 ทั้งหมด', total, 'primary')}
          ${kpi('⚙️ กำลังซ่อม', inProgress, inProgress > 0 ? 'warning' : 'secondary')}
          ${kpi('📅 นัดพรุ่งนี้', records.filter(r => r.date === addDays(1)).length, 'primary')}
          ${kpi('💰 รายได้รวม', formatCurrency(totalRevenue), 'success')}
        </div>

        <!-- Filters -->
        <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;align-items:center">
          <input class="input" id="search-inp" placeholder="🔍 ค้นหา ชื่อ / ทะเบียน / รุ่น..." style="max-width:240px" value="${escHtml(search)}">
          <div style="display:flex;gap:4px">
            <button class="btn btn-xs ${statusFilter==='all'?'btn-primary':'btn-secondary'} sf-btn" data-s="all">ทั้งหมด</button>
            ${Object.entries(JOB_STATUS).map(([k,v]) => `<button class="btn btn-xs ${statusFilter===k?'btn-'+v.color:'btn-secondary'} sf-btn" data-s="${k}">${v.label}</button>`).join('')}
          </div>
          <select class="input" id="type-filter" style="max-width:160px">
            <option value="all">ทุกประเภท</option>
            ${Object.entries(SERVICE_TYPES).map(([k,v]) => `<option value="${k}" ${typeFilter===k?'selected':''}>${v}</option>`).join('')}
          </select>
        </div>

        <div class="card" style="padding:0;overflow:hidden">
          <table class="table">
            <thead><tr><th>รหัส</th><th>ลูกค้า / รถ</th><th>ประเภท</th><th>วันที่</th><th>ช่าง</th><th>ค่าใช้จ่าย</th><th>สถานะ</th><th></th></tr></thead>
            <tbody>
              ${list.map(r => {
                const st = JOB_STATUS[r.status]
                return `<tr>
                  <td style="font-family:monospace;font-weight:700;font-size:0.8rem">${escHtml(r.id)}</td>
                  <td>
                    <div style="font-weight:600;font-size:0.85rem">${escHtml(r.customerName)}</div>
                    <div style="font-size:0.73rem;color:var(--text-muted)">${escHtml(r.brand)} ${escHtml(r.model)} · ${escHtml(r.plate)} · ${r.mileage.toLocaleString()} กม.</div>
                  </td>
                  <td>
                    <span class="badge badge-secondary" style="font-size:0.68rem">${escHtml(SERVICE_TYPES[r.type]||r.type)}</span>
                  </td>
                  <td>
                    <div style="font-size:0.82rem">${formatDate(r.date)}</div>
                    ${r.completedDate ? `<div style="font-size:0.7rem;color:var(--success)">✅ เสร็จ ${formatDate(r.completedDate)}</div>` : ''}
                  </td>
                  <td style="font-size:0.82rem">${escHtml(r.technicianName)}</td>
                  <td class="text-right" style="font-size:0.83rem;font-weight:${r.totalCost?700:400};color:${r.totalCost?'var(--success)':'var(--text-muted)'}">${r.totalCost ? formatCurrency(r.totalCost) : '-'}</td>
                  <td><span class="badge badge-${st?.color}">${st?.label}</span></td>
                  <td>
                    <div style="display:flex;gap:4px">
                      <button class="btn btn-xs btn-secondary open-sh-btn" data-id="${r.id}">ดู</button>
                      ${r.status === 'done' ? `<button class="btn btn-xs btn-success close-sh-btn" data-id="${r.id}">ส่งคืน</button>` : ''}
                      ${r.status === 'in_progress' ? `<button class="btn btn-xs btn-success complete-sh-btn" data-id="${r.id}">✓ เสร็จ</button>` : ''}
                    </div>
                  </td>
                </tr>`
              }).join('')}
              ${!list.length ? `<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--text-muted)">ไม่พบรายการ</td></tr>` : ''}
            </tbody>
          </table>
        </div>
      </div>
    `

    container.querySelectorAll('.sf-btn').forEach(b => b.addEventListener('click', () => { statusFilter = b.dataset.s; renderPage() }))
    document.getElementById('type-filter')?.addEventListener('change', e => { typeFilter = e.target.value; renderPage() })
    document.getElementById('search-inp')?.addEventListener('input', e => { search = e.target.value; renderPage() })
    document.getElementById('add-sh-btn')?.addEventListener('click', openAddForm)
    document.getElementById('export-btn')?.addEventListener('click', () => {
      exportToExcel(records.map(r => ({ ID: r.id, ลูกค้า: r.customerName, รถ: `${r.brand} ${r.model}`, ทะเบียน: r.plate, ประเภท: SERVICE_TYPES[r.type]||r.type, ช่าง: r.technicianName, วันที่: r.date, สถานะ: JOB_STATUS[r.status]?.label, ค่าใช้จ่าย: r.totalCost })), 'service_history')
      showToast('📥 Export แล้ว!', 'success')
    })
    container.querySelectorAll('.open-sh-btn').forEach(b => b.addEventListener('click', () => {
      const r = records.find(x => x.id === b.dataset.id); if (r) openDetail(r)
    }))
    container.querySelectorAll('.complete-sh-btn').forEach(b => b.addEventListener('click', async () => {
      const r = records.find(x => x.id === b.dataset.id)
      if (!r) return
      try {
        await updateDocData('service_history_records', r.id, { status: 'done', completedDate: addDays(0) })
        showToast(`✅ งาน ${r.id} เสร็จแล้ว!`, 'success')
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    }))
    container.querySelectorAll('.close-sh-btn').forEach(b => b.addEventListener('click', async () => {
      const r = records.find(x => x.id === b.dataset.id)
      if (!r) return
      try {
        await updateDocData('service_history_records', r.id, { status: 'delivered' })
        showToast(`🚗 ส่งคืนรถ ${r.plate} แล้ว!`, 'success')
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    }))
  }

  function openDetail(r) {
    const st = JOB_STATUS[r.status]
    openModal({
      title: '🔧 ' + escHtml(r.id) + ' — ' + escHtml(r.customerName),
      size: 'lg',
      body: `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
          <div>
            <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);margin-bottom:6px">ข้อมูลรถ</div>
            ${row('รุ่น', escHtml(r.brand) + ' ' + escHtml(r.model))}${row('ทะเบียน', escHtml(r.plate))}${row('VIN', `<span style="font-family:monospace;font-size:0.78rem">${escHtml(r.vin)}</span>`)}${row('ระยะ', `${r.mileage.toLocaleString()} กม.`)}
          </div>
          <div>
            <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);margin-bottom:6px">งานบริการ</div>
            ${row('ประเภท', escHtml(SERVICE_TYPES[r.type]||r.type))}${row('ช่าง', escHtml(r.technicianName))}${row('วันที่', formatDate(r.date))}${row('สถานะ', `<span class="badge badge-${st?.color}">${st?.label}</span>`)}
          </div>
        </div>
        <div style="font-size:0.78rem;font-weight:700;margin-bottom:8px">รายการบริการ</div>
        <div style="margin-bottom:12px">
          ${r.services.map(s => `<div style="padding:5px 0;border-bottom:1px solid var(--border);font-size:0.83rem">✓ ${escHtml(s)}</div>`).join('')}
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:12px">
          ${kpi('🔧 ค่าแรง', formatCurrency(r.laborCost), 'primary')}
          ${kpi('🔩 ค่าอะไหล่', formatCurrency(r.partsCost), 'warning')}
          ${kpi('💰 รวม', formatCurrency(r.totalCost), 'success')}
        </div>
        ${r.nextServiceDate ? `<div style="padding:10px;background:var(--surface-2);border-radius:var(--radius-sm);font-size:0.82rem">📅 นัดครั้งถัดไป: <strong>${formatDate(r.nextServiceDate)}</strong> หรือ <strong>${r.nextServiceMileage?.toLocaleString()} กม.</strong></div>` : ''}
        ${r.notes ? `<div style="margin-top:10px;padding:10px;background:var(--surface-2);border-radius:var(--radius-sm);font-size:0.82rem;color:var(--text-muted)">📌 ${escHtml(r.notes)}</div>` : ''}
      `
    })
  }

  function openAddForm() {
    openModal({
      title: '+ บันทึกงานบริการใหม่',
      size: 'md',
      body: `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="input-group"><label class="input-label">ชื่อลูกค้า *</label><input class="input" id="shf-name" placeholder="ชื่อลูกค้า"></div>
          <div class="input-group"><label class="input-label">โทรศัพท์</label><input class="input" id="shf-phone" placeholder="08x-xxx-xxxx"></div>
          <div class="input-group"><label class="input-label">แบรนด์ / รุ่น</label><input class="input" id="shf-model" placeholder="BYD Seal AWD"></div>
          <div class="input-group"><label class="input-label">ทะเบียน</label><input class="input" id="shf-plate" placeholder="กก 1234"></div>
          <div class="input-group"><label class="input-label">ระยะทาง (กม.)</label><input type="number" class="input" id="shf-mileage" placeholder="12500"></div>
          <div class="input-group"><label class="input-label">ประเภทงาน</label>
            <select class="input" id="shf-type">${Object.entries(SERVICE_TYPES).map(([k,v]) => `<option value="${k}">${v}</option>`).join('')}</select>
          </div>
          <div class="input-group"><label class="input-label">ช่างผู้รับผิดชอบ</label><input class="input" id="shf-tech" placeholder="ชื่อช่าง"></div>
          <div class="input-group"><label class="input-label">วันที่นัด</label><input type="date" class="input" id="shf-date" value="${addDays(0)}"></div>
          <div class="input-group" style="grid-column:1/-1"><label class="input-label">รายการงาน</label><textarea class="input" id="shf-services" rows="2" placeholder="รายการงานที่ต้องทำ (แต่ละรายการขึ้นบรรทัดใหม่)"></textarea></div>
        </div>
      `,
      async onConfirm() {
        const name = document.getElementById('shf-name')?.value?.trim()
        if (!name) { showToast('❗ กรุณากรอกชื่อลูกค้า', 'error'); return false }
        const model = document.getElementById('shf-model')?.value || ''
        const [brand, ...rest] = model.split(' ')
        const services = (document.getElementById('shf-services')?.value || '').split('\n').map(s => s.trim()).filter(Boolean)
        try {
          await createDoc('service_history_records', {
            vehicleId: '', customerName: name, phone: document.getElementById('shf-phone')?.value||'',
            brand: brand||'', model: rest.join(' ')||model, plate: document.getElementById('shf-plate')?.value||'', vin: '',
            mileage: +document.getElementById('shf-mileage')?.value||0,
            type: document.getElementById('shf-type')?.value||'periodic',
            technicianName: document.getElementById('shf-tech')?.value||'',
            date: document.getElementById('shf-date')?.value||addDays(0), completedDate: null,
            status: 'pending', laborCost: 0, partsCost: 0, totalCost: 0, nextServiceDate: null, nextServiceMileage: null,
            services: services.length ? services : ['งานบริการทั่วไป'], notes: ''
          })
          showToast('✅ บันทึกงานบริการแล้ว!', 'success')
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      }
    })
  }

  await loadData()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
function row(l, v) { return `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);font-size:0.82rem"><span style="color:var(--text-muted)">${l}</span><span>${v}</span></div>` }
