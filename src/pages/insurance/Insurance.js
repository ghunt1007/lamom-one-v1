import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'
import { showToast } from '../../core/store.js'
import { formatDate, formatCurrency } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { exportToExcel } from '../../utils/importExport.js'
import { getInsurers, getInsuranceTypes } from '../../data/masterData.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const INSURERS = getInsurers()
const INS_TYPES = getInsuranceTypes()
const INS_STATUS = {
  active:   { label: '✅ คุ้มครองอยู่',  badge: 'success' },
  expiring: { label: '⚠️ ใกล้หมดอายุ', badge: 'warning' },
  expired:  { label: '❌ หมดอายุแล้ว',  badge: 'danger'  },
  cancelled:{ label: '🚫 ยกเลิก',        badge: 'primary' },
}

export default async function InsurancePage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let policies = []
  let filtered = []
  let statusFilter = 'all'
  let search = ''

  async function loadData() {
    try { policies = await listDocs('insurance_policies', [], 'endDate', 'asc', 500) } catch {}
    // Auto-calculate status by date
    const today = new Date()
    const in30 = new Date(today.getTime() + 30 * 86400000)
    policies.forEach(p => {
      if (!p.status || p.status === 'active') {
        const end = new Date(p.endDate)
        if (end < today) p.status = 'expired'
        else if (end < in30) p.status = 'expiring'
        else p.status = 'active'
      }
    })
    updateStats(); applyFilter()
  }

  function updateStats() {
    const counts = { active: 0, expiring: 0, expired: 0, cancelled: 0 }
    policies.forEach(p => { if (counts[p.status] !== undefined) counts[p.status]++ })
    Object.entries(counts).forEach(([k, v]) => {
      const el = document.getElementById(`is-${k}`); if (el) el.textContent = v
    })
    const totalPrem = policies.filter(p => p.status === 'active').reduce((s, p) => s + (p.premium||0), 0)
    const totalComm = policies.filter(p => p.status === 'active').reduce((s, p) => s + (p.commission||0), 0)
    const premEl = document.getElementById('ins-total-prem'); if (premEl) premEl.textContent = `เบี้ยรวม: ${formatCurrency(totalPrem)}`
    const commEl = document.getElementById('ins-total-comm'); if (commEl) commEl.textContent = `ค่าคอมรวม: ${formatCurrency(totalComm)}`
    const totEl = document.getElementById('ins-total'); if (totEl) totEl.textContent = `${policies.length} กรมธรรม์`
  }

  function applyFilter() {
    filtered = policies.filter(p => {
      const ss = statusFilter === 'all' || p.status === statusFilter
      const qs = !search || `${p.policyNo} ${p.custName} ${p.brand} ${p.model} ${p.plate} ${p.insurer}`.toLowerCase().includes(search)
      return ss && qs
    })
    renderTable()
  }

  function renderTable() {
    const wrap = document.getElementById('ins-content')
    if (!wrap) return

    if (!filtered.length) {
      wrap.innerHTML = `<div class="empty-state" style="padding:48px"><div class="empty-icon">🛡</div><div class="empty-title">ไม่พบกรมธรรม์</div></div>`
      return
    }

    wrap.innerHTML = `<div class="table-wrap">
      <table>
        <thead><tr>
          <th>เลขกรมธรรม์</th><th>ลูกค้า</th><th>รถ/ทะเบียน</th><th>บริษัทประกัน</th>
          <th>ประเภท</th><th>เบี้ยประกัน</th><th>ค่าคอม</th><th>สิ้นสุด</th><th>สถานะ</th><th></th>
        </tr></thead>
        <tbody>${filtered.map(p => tableRow(p)).join('')}</tbody>
      </table>
    </div>`

    document.querySelectorAll('.ins-row').forEach(row => {
      row.addEventListener('click', e => {
        if (e.target.closest('.renew-btn,.edit-ins')) return
        openDetail(policies.find(x => x.id === row.dataset.id))
      })
    })
    document.querySelectorAll('.renew-btn').forEach(btn => btn.addEventListener('click', async e => {
      e.stopPropagation()
      const p = policies.find(x => x.id === btn.dataset.id)
      if (!p) return
      openRenewForm(p)
    }))
    document.querySelectorAll('.edit-ins').forEach(btn => btn.addEventListener('click', e => {
      e.stopPropagation(); openForm(policies.find(x => x.id === btn.dataset.id))
    }))
  }

  function tableRow(p) {
    const st = INS_STATUS[p.status] || INS_STATUS.active
    const daysLeft = Math.ceil((new Date(p.endDate) - new Date()) / 86400000)
    return `
      <tr class="ins-row" data-id="${p.id}" style="cursor:pointer">
        <td><span style="font-weight:600;color:var(--primary);font-size:0.85rem">${escHtml(p.policyNo)}</span></td>
        <td style="font-weight:600">${escHtml(p.custName)}</td>
        <td>
          <div style="font-size:0.85rem">${escHtml(p.brand)} ${escHtml(p.model)}</div>
          <div style="font-size:0.72rem;color:var(--text-muted)">${escHtml(p.plate||'')}</div>
        </td>
        <td style="font-size:0.82rem;color:var(--text-2)">${escHtml(p.insurer)}</td>
        <td><span class="badge badge-primary">${escHtml(p.type)}</span></td>
        <td style="font-weight:600;color:var(--accent)">${formatCurrency(p.premium)}</td>
        <td style="color:var(--success)">${formatCurrency(p.commission)}</td>
        <td style="font-size:0.8rem;${p.status==='expiring'?'color:var(--warning);font-weight:600':p.status==='expired'?'color:var(--danger);font-weight:600':'color:var(--text-2)'}">
          ${formatDate(p.endDate)}
          ${daysLeft <= 30 && daysLeft > 0 ? `<div style="font-size:0.7rem">⚠️ เหลือ ${daysLeft} วัน</div>` : ''}
          ${daysLeft <= 0 ? `<div style="font-size:0.7rem">หมดแล้ว ${Math.abs(daysLeft)} วัน</div>` : ''}
        </td>
        <td><span class="badge badge-${st.badge}">${st.label}</span></td>
        <td>
          <div style="display:flex;gap:3px">
            ${p.status !== 'active' ? `<button class="btn btn-success btn-sm renew-btn" data-id="${p.id}">🔄 ต่อ</button>` : ''}
            <button class="btn btn-ghost btn-sm edit-ins" data-id="${p.id}">✏️</button>
          </div>
        </td>
      </tr>`
  }

  function openDetail(p) {
    if (!p) return
    const st = INS_STATUS[p.status] || INS_STATUS.active
    const daysLeft = Math.ceil((new Date(p.endDate) - new Date()) / 86400000)
    openModal({
      title: '🛡 ' + escHtml(p.policyNo), size: 'md',
      body: `
        <div style="display:flex;flex-direction:column;gap:10px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span class="badge badge-${st.badge}" style="font-size:0.9rem">${st.label}</span>
            <span style="font-size:1.2rem;font-weight:700;color:var(--accent)">${formatCurrency(p.premium)}</span>
          </div>
          ${dRow('👤','ลูกค้า',escHtml(p.custName))}
          ${dRow('🚗','รถ',escHtml(p.brand)+' '+escHtml(p.model))}
          ${dRow('🔢','ทะเบียน',escHtml(p.plate||'-'))}
          ${dRow('🏢','บริษัทประกัน',escHtml(p.insurer))}
          ${dRow('📋','ประเภท',escHtml(p.type))}
          ${dRow('📅','เริ่มต้น',formatDate(p.startDate))}
          ${dRow('📅','สิ้นสุด',`${formatDate(p.endDate)} ${daysLeft > 0 ? `(เหลือ ${daysLeft} วัน)` : '(หมดแล้ว)'}`)}
          ${dRow('💰','เบี้ยประกัน',formatCurrency(p.premium))}
          ${dRow('🏆','ค่าคอม',formatCurrency(p.commission))}
          ${dRow('🎯','เซลส์',escHtml(p.salesName||'-'))}
        </div>
      `,
      footer: `<button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">ปิด</button>
               ${p.status !== 'active' ? `<button class="btn btn-success" id="ins-renew">🔄 ต่ออายุ</button>` : ''}
               <button class="btn btn-primary" id="ins-edit">✏️ แก้ไข</button>`
    })
    document.getElementById('ins-renew')?.addEventListener('click', () => { document.querySelector('.modal-overlay')?.remove(); openRenewForm(p) })
    document.getElementById('ins-edit')?.addEventListener('click', () => { document.querySelector('.modal-overlay')?.remove(); openForm(p) })
  }

  function openRenewForm(p) {
    const newStart = new Date(p.endDate > new Date().toISOString().slice(0,10) ? p.endDate : new Date().toISOString().slice(0,10))
    const newEnd = new Date(newStart); newEnd.setFullYear(newEnd.getFullYear() + 1)
    const { el, close } = openModal({
      title: '🔄 ต่ออายุกรมธรรม์ — ' + escHtml(p.custName), size: 'md',
      body: `
        <div style="display:flex;flex-direction:column;gap:12px">
          <div style="background:var(--surface-2);padding:10px 14px;border-radius:var(--radius-md);font-size:0.85rem">
            <div>🚗 ${escHtml(p.brand)} ${escHtml(p.model)} — ${escHtml(p.plate)}</div>
            <div>🏢 ${escHtml(p.insurer)} — ${escHtml(p.type)}</div>
          </div>
          <div class="grid-2">
            <div class="input-group"><label class="input-label">วันเริ่มต้น</label><input class="input" type="date" id="rn-start" value="${newStart.toISOString().slice(0,10)}"></div>
            <div class="input-group"><label class="input-label">วันสิ้นสุด</label><input class="input" type="date" id="rn-end" value="${newEnd.toISOString().slice(0,10)}"></div>
          </div>
          <div class="grid-2">
            <div class="input-group"><label class="input-label">เบี้ยประกัน (บาท)</label><input class="input" type="number" id="rn-prem" value="${p.premium}"></div>
            <div class="input-group"><label class="input-label">ค่าคอม (บาท)</label><input class="input" type="number" id="rn-comm" value="${Math.round(p.premium * 0.2)}"></div>
          </div>
          <div class="input-group"><label class="input-label">บริษัทประกัน</label>
            <select class="input" id="rn-insurer">
              ${INSURERS.map(i => `<option value="${i}" ${i===p.insurer?'selected':''}>${i}</option>`).join('')}
            </select>
          </div>
        </div>
      `,
      footer: `<button class="btn btn-secondary" id="rnc">ยกเลิก</button><button class="btn btn-success" id="rns">✅ ต่ออายุ</button>`
    })
    el.querySelector('#rnc').addEventListener('click', close)
    el.querySelector('#rns').addEventListener('click', async () => {
      const btn = el.querySelector('#rns'); btn.disabled = true
      const newStartDate = el.querySelector('#rn-start').value
      const newEndDate = el.querySelector('#rn-end').value
      const prem = Number(el.querySelector('#rn-prem').value) || 0
      const comm = Number(el.querySelector('#rn-comm').value) || 0
      const insurer = el.querySelector('#rn-insurer').value
      // Create new policy
      const newPolicyNo = `INS-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`
      const data = { ...p, policyNo: newPolicyNo, startDate: newStartDate, endDate: newEndDate, premium: prem, commission: comm, insurer, status: 'active' }
      delete data.id
      try {
        const id = await createDoc('insurance_policies', data)
        policies.unshift({ ...data, id })
        await updateDocData('insurance_policies', p.id, { status: 'cancelled' })
        p.status = 'cancelled'
        showToast(`✅ ต่ออายุกรมธรรม์แล้ว — ${newPolicyNo}`, 'success')
        close(); updateStats(); applyFilter()
      } catch { showToast('เกิดข้อผิดพลาด','error') }
    })
  }

  function openForm(existing = null) {
    const isEdit = !!existing
    const today = new Date().toISOString().slice(0,10)
    const nextYear = new Date(); nextYear.setFullYear(nextYear.getFullYear() + 1)
    const { el, close } = openModal({
      title: isEdit ? '✏️ แก้ไขกรมธรรม์' : '➕ เพิ่มกรมธรรม์', size: 'lg',
      body: `
        <div style="display:flex;flex-direction:column;gap:12px">
          <div class="grid-2">
            <div class="input-group"><label class="input-label">ชื่อลูกค้า *</label><input class="input" id="if-cust" value="${escHtml(existing?.custName||'')}"><span class="input-error" id="if-cust-e"></span></div>
            <div class="input-group"><label class="input-label">ทะเบียนรถ</label><input class="input" id="if-plate" value="${escHtml(existing?.plate||'')}"></div>
          </div>
          <div class="grid-2">
            <div class="input-group"><label class="input-label">ยี่ห้อ</label><input class="input" id="if-brand" value="${escHtml(existing?.brand||'')}"></div>
            <div class="input-group"><label class="input-label">รุ่น</label><input class="input" id="if-model" value="${escHtml(existing?.model||'')}"></div>
          </div>
          <div class="grid-2">
            <div class="input-group"><label class="input-label">บริษัทประกัน</label>
              <select class="input" id="if-insurer">
                ${INSURERS.map(i => `<option value="${i}" ${existing?.insurer===i?'selected':''}>${i}</option>`).join('')}
              </select>
            </div>
            <div class="input-group"><label class="input-label">ประเภท</label>
              <select class="input" id="if-type">
                ${INS_TYPES.map(t => `<option value="${t}" ${existing?.type===t?'selected':''}>${t}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="grid-2">
            <div class="input-group"><label class="input-label">วันเริ่มต้น</label><input class="input" type="date" id="if-start" value="${existing?.startDate||today}"></div>
            <div class="input-group"><label class="input-label">วันสิ้นสุด</label><input class="input" type="date" id="if-end" value="${existing?.endDate||nextYear.toISOString().slice(0,10)}"></div>
          </div>
          <div class="grid-2">
            <div class="input-group"><label class="input-label">เบี้ยประกัน (บาท)</label><input class="input" type="number" id="if-prem" value="${existing?.premium||''}"></div>
            <div class="input-group"><label class="input-label">ค่าคอม (บาท)</label><input class="input" type="number" id="if-comm" value="${existing?.commission||''}"></div>
          </div>
          <div class="input-group"><label class="input-label">เซลส์ผู้รับผิดชอบ</label><input class="input" id="if-sales" value="${escHtml(existing?.salesName||'')}"></div>
        </div>
      `,
      footer: `<button class="btn btn-secondary" id="ifc">ยกเลิก</button><button class="btn btn-primary" id="ifs">💾 บันทึก</button>`
    })
    el.querySelector('#ifc').addEventListener('click', close)
    el.querySelector('#ifs').addEventListener('click', async () => {
      const cust = el.querySelector('#if-cust').value.trim()
      if (!cust) { el.querySelector('#if-cust-e').textContent = 'กรุณาระบุ'; return }
      const btn = el.querySelector('#ifs'); btn.disabled = true; btn.innerHTML = '<span class="spinner spinner-sm"></span>'
      const startDate = el.querySelector('#if-start').value
      const endDate = el.querySelector('#if-end').value
      const premium = Number(el.querySelector('#if-prem').value)||0
      const today2 = new Date()
      const end2 = new Date(endDate)
      const in30 = new Date(today2.getTime() + 30 * 86400000)
      const status = end2 < today2 ? 'expired' : end2 < in30 ? 'expiring' : 'active'
      const data = {
        policyNo: existing?.policyNo || `INS-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
        custName: cust, plate: el.querySelector('#if-plate').value.trim(),
        brand: el.querySelector('#if-brand').value.trim(), model: el.querySelector('#if-model').value.trim(),
        insurer: el.querySelector('#if-insurer').value, type: el.querySelector('#if-type').value,
        startDate, endDate, premium, commission: Number(el.querySelector('#if-comm').value)||0,
        salesName: el.querySelector('#if-sales').value.trim(), status,
      }
      try {
        if (isEdit) { await updateDocData('insurance_policies', existing.id, data); Object.assign(existing, data) }
        else { const id = await createDoc('insurance_policies', data); policies.unshift({ ...data, id }) }
        showToast(isEdit ? 'แก้ไขแล้ว' : '✅ เพิ่มกรมธรรม์แล้ว', 'success')
        close(); updateStats(); applyFilter()
      } catch { showToast('บันทึกไม่สำเร็จ','error') }
    })
  }

  container.innerHTML = `
    <div class="page-content animate-slide">
      <div class="page-header">
        <div>
          <div class="page-title">🛡 Insurance</div>
          <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
            <span class="page-subtitle" id="ins-total">กำลังโหลด...</span>
            <span style="font-size:0.8rem;color:var(--accent)" id="ins-total-prem"></span>
            <span style="font-size:0.8rem;color:var(--success)" id="ins-total-comm"></span>
          </div>
        </div>
        <div class="page-actions">
          <button class="btn btn-secondary btn-sm" id="ins-export">📥 Export</button>
          <button class="btn btn-primary" id="add-ins-btn">➕ เพิ่มกรมธรรม์</button>
        </div>
      </div>

      <!-- Status Pills -->
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
        <button class="btn btn-sm if-btn btn-primary" data-sf="all">ทั้งหมด</button>
        ${Object.entries(INS_STATUS).map(([k,v]) => `
          <button class="btn btn-sm if-btn btn-secondary" data-sf="${k}" style="white-space:nowrap">
            ${v.label} <span id="is-${k}" style="margin-left:4px;font-weight:700">0</span>
          </button>
        `).join('')}
      </div>

      <!-- Search -->
      <div class="card mb-4" style="padding:10px 16px">
        <div style="position:relative">
          <span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text-muted)">🔍</span>
          <input class="input" id="ins-search" placeholder="ค้นหา เลขกรมธรรม์ ลูกค้า รถ ทะเบียน..." style="padding-left:32px">
        </div>
      </div>

      <div id="ins-content">
        ${[...Array(4)].map(() => `<div class="skeleton" style="height:44px;border-radius:6px;margin-bottom:8px"></div>`).join('')}
      </div>
    </div>
  `

  document.getElementById('add-ins-btn').addEventListener('click', () => openForm())
  document.getElementById('ins-search').addEventListener('input', e => { search = e.target.value.toLowerCase(); applyFilter() })
  document.getElementById('ins-export').addEventListener('click', () => {
    exportToExcel(policies.map(p => ({ เลขกรมธรรม์:p.policyNo, ลูกค้า:p.custName, ทะเบียน:p.plate, รถ:`${p.brand} ${p.model}`, บริษัทประกัน:p.insurer, ประเภท:p.type, เบี้ย:p.premium, ค่าคอม:p.commission, เริ่ม:p.startDate, สิ้นสุด:p.endDate, สถานะ:INS_STATUS[p.status]?.label||p.status })), `insurance-${new Date().toISOString().slice(0,10)}.xlsx`, 'Insurance')
    showToast('Export แล้ว', 'success')
  })
  document.querySelectorAll('.if-btn').forEach(btn => btn.addEventListener('click', () => {
    statusFilter = btn.dataset.sf
    document.querySelectorAll('.if-btn').forEach(b => b.className = `btn btn-sm if-btn ${b.dataset.sf === statusFilter ? 'btn-primary' : 'btn-secondary'}`)
    applyFilter()
  }))

  if (container.__routerGen === myGen) await loadData()
}

function dRow(icon, label, value) {
  return `<div style="font-size:0.83rem;display:flex;gap:6px"><span>${icon}</span><span style="color:var(--text-muted);min-width:80px;flex-shrink:0">${label}</span><span style="color:var(--text-2)">${value}</span></div>`
}
