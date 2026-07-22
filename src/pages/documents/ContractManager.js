/**
 * Contract Manager — จัดการสัญญา
 * Route: /documents/contracts
 */
import { formatDate, formatCurrency } from '../../utils/format.js'
import { openModal, confirmDialog } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'

function esc(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;') }

const CONTRACT_TYPES = {
  sale:       { label: 'สัญญาซื้อขาย', color: 'primary', icon: '🚗' },
  service:    { label: 'สัญญาบริการ', color: 'success', icon: '🔧' },
  lease:      { label: 'สัญญาเช่า', color: 'warning', icon: '📋' },
  employment: { label: 'สัญญาจ้างงาน', color: 'secondary', icon: '👥' },
  supplier:   { label: 'สัญญาซัพพลายเออร์', color: 'secondary', icon: '🤝' },
  nda:        { label: 'NDA', color: 'danger', icon: '🔒' },
}

const CONTRACT_STATUS = {
  draft:    { label: 'ร่าง', color: 'secondary' },
  review:   { label: 'รอรีวิว', color: 'warning' },
  signed:   { label: 'ลงนามแล้ว', color: 'success' },
  active:   { label: 'Active', color: 'success' },
  expired:  { label: 'หมดอายุ', color: 'danger' },
  cancelled:{ label: 'ยกเลิก', color: 'danger' },
}

function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }

export default async function ContractManagerPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let contracts = []
  let typeFilter = 'all'
  let statusFilter = 'all'
  let search = ''
  let loading = true

  async function loadData() {
    loading = true
    try { contracts = await listDocs('contracts', [], 'startDate', 'desc', 500) } catch (e) { contracts = [] }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function filtered() {
    return contracts.filter(c => {
      if (typeFilter !== 'all' && c.type !== typeFilter) return false
      if (statusFilter !== 'all' && c.status !== statusFilter) return false
      if (search && !c.title.toLowerCase().includes(search.toLowerCase()) && !c.party.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const list = filtered()
    const active = contracts.filter(c => c.status === 'active' || c.status === 'signed').length
    const pending = contracts.filter(c => c.status === 'review' || c.status === 'draft').length
    const totalValue = contracts.filter(c => c.value > 0).reduce((a, c) => a + c.value, 0)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">📜 Contract Manager</div>
            <div class="page-subtitle">จัดการสัญญาทุกประเภท — ซื้อขาย, บริการ, จ้างงาน</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="add-contract-btn">+ สร้างสัญญา</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('📋 สัญญาทั้งหมด', contracts.length, 'primary')}
          ${kpi('✅ มีผลบังคับ', active, 'success')}
          ${kpi('⏳ รอดำเนินการ', pending, pending > 0 ? 'warning' : 'secondary')}
          ${kpi('💰 มูลค่ารวม', formatCurrency(totalValue), 'primary')}
        </div>

        <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;align-items:center">
          <input class="input" id="search-inp" placeholder="🔍 ค้นหา..." style="max-width:200px" value="${search}">
          <div style="display:flex;gap:4px;flex-wrap:wrap">
            <button class="btn btn-xs ${typeFilter==='all'?'btn-primary':'btn-secondary'} tf-btn" data-t="all">ทั้งหมด</button>
            ${Object.entries(CONTRACT_TYPES).map(([k,v]) => `<button class="btn btn-xs ${typeFilter===k?'btn-'+v.color:'btn-secondary'} tf-btn" data-t="${k}">${v.icon} ${v.label}</button>`).join('')}
          </div>
          <select class="input" id="status-sel" style="max-width:150px">
            <option value="all">ทุกสถานะ</option>
            ${Object.entries(CONTRACT_STATUS).map(([k,v]) => `<option value="${k}" ${statusFilter===k?'selected':''}>${v.label}</option>`).join('')}
          </select>
        </div>

        <div class="card" style="overflow:hidden">
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="border-bottom:1px solid var(--border);font-size:0.78rem;color:var(--text-muted)">
                <th style="padding:10px 14px;text-align:left">สัญญา</th>
                <th style="padding:10px 14px;text-align:left">คู่สัญญา</th>
                <th style="padding:10px 14px;text-align:center">ประเภท</th>
                <th style="padding:10px 14px;text-align:center">สถานะ</th>
                <th style="padding:10px 14px;text-align:right">มูลค่า</th>
                <th style="padding:10px 14px;text-align:center">วันหมดอายุ</th>
                <th style="padding:10px 14px;text-align:center">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              ${list.map(c => {
                const ct = CONTRACT_TYPES[c.type]
                const cs = CONTRACT_STATUS[c.status]
                const daysLeft = Math.floor((new Date(c.endDate) - new Date()) / 86400000)
                return `<tr style="border-bottom:1px solid var(--border);cursor:pointer" class="ct-row" data-id="${c.id}">
                  <td style="padding:10px 14px">
                    <div style="font-weight:600;font-size:0.85rem">${c.id}</div>
                    <div style="font-size:0.78rem;color:var(--text-muted)">${esc(c.title)}</div>
                  </td>
                  <td style="padding:10px 14px;font-size:0.83rem">${c.party}</td>
                  <td style="padding:10px 14px;text-align:center"><span class="badge badge-${ct?.color}" style="font-size:0.65rem">${ct?.icon} ${ct?.label}</span></td>
                  <td style="padding:10px 14px;text-align:center"><span class="badge badge-${cs?.color}" style="font-size:0.65rem">${cs?.label}</span></td>
                  <td style="padding:10px 14px;text-align:right;font-size:0.83rem">${c.value > 0 ? formatCurrency(c.value) : '—'}</td>
                  <td style="padding:10px 14px;text-align:center;font-size:0.78rem;color:${daysLeft < 30 ? 'var(--danger)' : daysLeft < 90 ? 'var(--warning)' : 'inherit'}">
                    ${formatDate(c.endDate)}<br><span style="font-size:0.68rem">(${daysLeft > 0 ? daysLeft + ' วัน' : 'หมดแล้ว'})</span>
                  </td>
                  <td style="padding:10px 14px;text-align:center">
                    <div style="display:flex;gap:4px;justify-content:center">
                      <button class="btn btn-xs btn-secondary view-btn" data-id="${c.id}">ดู</button>
                      ${c.status === 'review' ? `<button class="btn btn-xs btn-success sign-btn" data-id="${c.id}">ลงนาม</button>` : ''}
                    </div>
                  </td>
                </tr>`
              }).join('')}
            </tbody>
          </table>
          ${!list.length ? '<div class="empty-state"><div class="empty-state-icon">📜</div><div>ไม่พบสัญญา</div></div>' : ''}
        </div>
      </div>
    `

    document.getElementById('search-inp')?.addEventListener('input', e => { search = e.target.value; renderPage() })
    container.querySelectorAll('.tf-btn').forEach(b => b.addEventListener('click', () => { typeFilter = b.dataset.t; renderPage() }))
    document.getElementById('status-sel')?.addEventListener('change', e => { statusFilter = e.target.value; renderPage() })
    document.getElementById('add-contract-btn')?.addEventListener('click', openAddForm)
    container.querySelectorAll('.view-btn').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); const c = contracts.find(x => x.id === b.dataset.id); if (c) openDetail(c) }))
    container.querySelectorAll('.sign-btn').forEach(b => b.addEventListener('click', async e => { e.stopPropagation()
      const c = contracts.find(x => x.id === b.dataset.id)
      if (!c) return
      try {
        await updateDocData('contracts', c.id, { status: 'signed', signedDate: new Date().toISOString().slice(0, 10) })
        showToast('✅ ลงนามสัญญาแล้ว!', 'success')
        await loadData()
      } catch (err) { showToast('บันทึกไม่สำเร็จ', 'error') }
    }))
  }

  function openDetail(c) {
    const ct = CONTRACT_TYPES[c.type]
    const cs = CONTRACT_STATUS[c.status]
    openModal({
      title: `📜 ${c.id} — ${esc(c.title)}`,
      size: 'lg',
      body: `
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
          <span class="badge badge-${ct?.color}">${ct?.icon} ${ct?.label}</span>
          <span class="badge badge-${cs?.color}">${cs?.label}</span>
        </div>
        ${row('คู่สัญญา', c.party)}
        ${c.value > 0 ? row('มูลค่าสัญญา', formatCurrency(c.value)) : ''}
        ${row('วันเริ่ม', formatDate(c.startDate))}
        ${row('วันหมดอายุ', formatDate(c.endDate))}
        ${c.signedDate ? row('วันลงนาม', formatDate(c.signedDate)) : ''}
        ${row('สร้างโดย', c.createdBy)}
        <div style="margin-top:12px;display:flex;gap:6px;flex-wrap:wrap">
          ${c.tags.map(t => `<span style="font-size:0.72rem;padding:3px 8px;background:var(--surface-2);border-radius:10px;color:var(--text-muted)">#${t}</span>`).join('')}
        </div>
      `
    })
  }

  function openAddForm() {
    openModal({
      title: '+ สร้างสัญญาใหม่',
      size: 'lg',
      body: `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="input-group" style="grid-column:1/-1"><label class="input-label">ชื่อสัญญา *</label><input class="input" id="cf-title" placeholder="สัญญา..."></div>
          <div class="input-group"><label class="input-label">ประเภท</label>
            <select class="input" id="cf-type">${Object.entries(CONTRACT_TYPES).map(([k,v])=>`<option value="${k}">${v.icon} ${v.label}</option>`).join('')}</select>
          </div>
          <div class="input-group"><label class="input-label">คู่สัญญา *</label><input class="input" id="cf-party" placeholder="ชื่อ/บริษัท"></div>
          <div class="input-group"><label class="input-label">มูลค่า (บาท)</label><input type="number" class="input" id="cf-value" placeholder="0"></div>
          <div class="input-group"><label class="input-label">วันเริ่ม</label><input type="date" class="input" id="cf-start" value="${new Date().toISOString().slice(0,10)}"></div>
          <div class="input-group"><label class="input-label">วันหมดอายุ</label><input type="date" class="input" id="cf-end"></div>
        </div>
      `,
      async onConfirm() {
        const title = document.getElementById('cf-title')?.value?.trim()
        const party = document.getElementById('cf-party')?.value?.trim()
        if (!title || !party) { showToast('❗ กรุณากรอกชื่อสัญญาและคู่สัญญา', 'error'); return false }
        try {
          await createDoc('contracts', {
            title,
            type: document.getElementById('cf-type')?.value||'sale', status: 'draft', party,
            value: +document.getElementById('cf-value')?.value||0,
            startDate: document.getElementById('cf-start')?.value||addDays(0),
            endDate: document.getElementById('cf-end')?.value||addDays(365),
            createdBy: 'ผู้ใช้ปัจจุบัน', signedDate: null, tags: []
          })
          showToast('✅ สร้างสัญญาแล้ว!', 'success')
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      }
    })
  }

  await loadData()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
function row(l, v) { return `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:0.83rem"><span style="color:var(--text-muted)">${l}</span><span>${v}</span></div>` }
