import { listDocs, createDoc, updateDocData, softDelete, seedDemoData } from '../../core/db.js'
import { showToast } from '../../core/store.js'
import { formatDate, timeAgo, formatPhone, initials, fullName } from '../../utils/format.js'
import { openModal, confirmDialog } from '../../utils/modal.js'
import { exportToExcel, exportToCSV, openImportModal } from '../../utils/importExport.js'
import { SmartSheet } from '../../components/SmartSheet.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const STATUS = {
  hot:  { label: '🔴 Hot',  badge: 'danger'  },
  warm: { label: '🟡 Warm', badge: 'warning' },
  cold: { label: '🔵 Cold', badge: 'accent'  },
  vip:  { label: '⭐ VIP',  badge: 'primary' },
  lost: { label: '⬛ Lost', badge: 'primary' },
}

const SOURCE = {
  facebook: '📘 Facebook', line: '💚 LINE', tiktok: '🎵 TikTok',
  'walk-in': '🚶 Walk-in', referral: '🤝 Referral', google: '🔍 Google', other: '📌 อื่นๆ'
}

export default async function CustomersPage(container) {
  const myGen = container.__routerGen
  seedDemoData()
  let customers = []
  let filtered = []
  let search = ''
  let statusFilter = 'all'

  async function loadData() {
    try { customers = await listDocs('customers', [], 'createdAt', 'desc', 200) } catch {}
    applyFilter()
  }

  function applyFilter() {
    filtered = customers.filter(c => {
      const name = fullName(c).toLowerCase()
      const matchSearch = !search || name.includes(search) ||
        (c.phone || '').includes(search) || (c.lineId || '').toLowerCase().includes(search) ||
        (c.interestedModel || '').toLowerCase().includes(search)
      const matchStatus = statusFilter === 'all' || c.status === statusFilter
      return matchSearch && matchStatus
    })
    renderTable()
  }

  function renderTable() {
    const tbody = document.getElementById('cust-tbody')
    if (!tbody) return
    const countEl = document.getElementById('cust-count')
    if (countEl) countEl.textContent = `${filtered.length} รายการ`

    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><div class="empty-icon">👥</div><div class="empty-title">ไม่พบลูกค้า</div><div class="empty-desc">${search ? 'ลองเปลี่ยนคำค้นหา' : 'เริ่มเพิ่มลูกค้าคนแรก'}</div></div></td></tr>`
      return
    }
    tbody.innerHTML = filtered.map(c => `
      <tr class="cust-row" data-id="${c.id}">
        <td>
          <div style="display:flex;align-items:center;gap:10px">
            <div class="avatar avatar-md" style="background:${avatarColor(c.status)};color:#fff">${escHtml(initials(c.firstName, c.lastName))}</div>
            <div>
              <div style="font-weight:600;color:var(--text)">${escHtml(fullName(c))}</div>
              <div style="font-size:0.75rem;color:var(--text-muted)">${escHtml(c.email || '')}</div>
            </div>
          </div>
        </td>
        <td>${formatPhone(c.phone)}</td>
        <td><span class="badge badge-${STATUS[c.status]?.badge || 'secondary'}">${STATUS[c.status]?.label || escHtml(c.status)}</span></td>
        <td style="color:var(--text-2)">${escHtml(c.interestedModel || '-')}</td>
        <td style="color:var(--text-3);font-size:0.8rem">${SOURCE[c.source] || escHtml(c.source) || '-'}</td>
        <td>${c.tags?.map(t => `<span class="badge badge-primary" style="margin-right:3px">${escHtml(t)}</span>`).join('') || '-'}</td>
        <td style="color:var(--text-muted);font-size:0.8rem">${timeAgo(c.createdAt)}</td>
        <td>
          <div style="display:flex;gap:4px">
            <button class="btn btn-ghost btn-sm edit-btn" data-id="${c.id}" title="แก้ไข">✏️</button>
            <button class="btn btn-ghost btn-sm del-btn" data-id="${c.id}" title="ลบ" style="color:var(--danger)">🗑</button>
          </div>
        </td>
      </tr>
    `).join('')

    tbody.querySelectorAll('.cust-row').forEach(row => {
      row.addEventListener('click', e => {
        if (e.target.closest('.edit-btn,.del-btn')) return
        const c = filtered.find(x => x.id === row.dataset.id)
        if (c) openDetail(c)
      })
    })
    tbody.querySelectorAll('.edit-btn').forEach(btn =>
      btn.addEventListener('click', () => {
        const c = customers.find(x => x.id === btn.dataset.id)
        if (c) openForm(c)
      })
    )
    tbody.querySelectorAll('.del-btn').forEach(btn =>
      btn.addEventListener('click', async () => {
        const c = customers.find(x => x.id === btn.dataset.id)
        const ok = await confirmDialog({ title: 'ลบลูกค้า', message: `ต้องการลบ "${fullName(c)}"? (กู้คืนได้ใน 30 วัน)`, confirmText: 'ลบ', danger: true })
        if (!ok) return
        try {
          await softDelete('customers', c.id)
          showToast(`ลบ ${fullName(c)} แล้ว`, 'success')
          await loadData()
        } catch { showToast('เกิดข้อผิดพลาด','error') }
      })
    )
  }

  function openDetail(c) {
    const icons = { call: '📞', line: '💚', email: '📧', visit: '🚶', note: '📝' }
    openModal({
      title: `👤 ${fullName(c)}`,
      size: 'lg',
      body: `
        <div class="grid-2" style="gap:24px">
          <div>
            <div style="display:flex;align-items:center;gap:14px;margin-bottom:20px">
              <div class="avatar avatar-xl" style="background:${avatarColor(c.status)};color:#fff;font-size:1.4rem">${escHtml(initials(c.firstName,c.lastName))}</div>
              <div>
                <div style="font-size:1.2rem;font-weight:700">${escHtml(fullName(c))}</div>
                <span class="badge badge-${STATUS[c.status]?.badge||'muted'}" style="margin-top:4px">${STATUS[c.status]?.label||escHtml(c.status)}</span>
              </div>
            </div>
            <div style="display:flex;flex-direction:column;gap:10px">
              ${detail('📱 โทร', formatPhone(c.phone))}
              ${detail('💚 LINE', escHtml(c.lineId||'-'))}
              ${detail('📧 Email', escHtml(c.email||'-'))}
              ${detail('🚗 สนใจ', escHtml(c.interestedModel||'-'))}
              ${detail('📌 ที่มา', SOURCE[c.source]||escHtml(c.source)||'-')}
              ${detail('📅 เพิ่มเมื่อ', formatDate(c.createdAt))}
            </div>
          </div>
          <div>
            <div style="font-weight:600;margin-bottom:12px">📝 ประวัติการติดต่อ</div>
            <div id="comm-log-list" style="display:flex;flex-direction:column;gap:8px;max-height:260px;overflow-y:auto">
              <div class="skeleton" style="height:56px;border-radius:10px"></div>
              <div class="skeleton" style="height:56px;border-radius:10px"></div>
            </div>
            <button class="btn btn-secondary btn-sm" id="add-comm-btn" style="margin-top:10px;width:100%;justify-content:center">➕ บันทึกการติดต่อ</button>
          </div>
        </div>
      `,
      footer: `
        <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">ปิด</button>
        <button class="btn btn-primary" id="edit-detail-btn">✏️ แก้ไข</button>
      `
    })
    document.getElementById('edit-detail-btn')?.addEventListener('click', () => {
      document.querySelector('.modal-overlay')?.remove(); openForm(c)
    })
    document.getElementById('add-comm-btn')?.addEventListener('click', () => openCommForm(c.id))
    refreshCommLogs(c.id, icons)
  }

  async function refreshCommLogs(cid, icons) {
    let logs; try { logs = await listDocs('comm_logs', [['customerId','==',cid]], 'createdAt', 'desc', 20) } catch { logs = [] }
    const el = document.getElementById('comm-log-list')
    if (!el) return
    if (!logs.length) { el.innerHTML = `<div class="empty-state" style="padding:12px"><div class="empty-icon" style="font-size:1.5rem">📝</div><div class="empty-title" style="font-size:0.85rem">ยังไม่มีบันทึก</div></div>`; return }
    el.innerHTML = logs.map(l => `
      <div style="background:var(--surface-2);border-radius:var(--radius-md);padding:10px 12px">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">
          <span>${icons?.[l.type]||'📌'}</span>
          <span style="font-weight:600;font-size:0.78rem">${typeLabel(l.type)}</span>
          <span style="margin-left:auto;font-size:0.72rem;color:var(--text-muted)">${timeAgo(l.createdAt)}</span>
        </div>
        <div style="font-size:0.825rem;color:var(--text-2)">${escHtml(l.note || '')}</div>
      </div>
    `).join('')
  }

  function openCommForm(cid) {
    const icons = { call:'📞',line:'💚',visit:'🚶',email:'📧',note:'📝' }
    const {el, close} = openModal({
      title:'📝 บันทึกการติดต่อ', size:'sm',
      body:`
        <div style="display:flex;flex-direction:column;gap:14px">
          <div class="input-group">
            <label class="input-label">ประเภท</label>
            <select class="input" id="log-type">
              ${Object.entries(icons).map(([k,v])=>`<option value="${k}">${v} ${typeLabel(k)}</option>`).join('')}
            </select>
          </div>
          <div class="input-group">
            <label class="input-label">รายละเอียด <span class="required">*</span></label>
            <textarea class="input" id="log-note" rows="3" placeholder="บันทึกสิ่งที่คุย..."></textarea>
            <span class="input-error" id="log-err"></span>
          </div>
        </div>
      `,
      footer:`<button class="btn btn-secondary" id="lc">ยกเลิก</button><button class="btn btn-primary" id="ls">💾 บันทึก</button>`
    })
    el.querySelector('#lc').addEventListener('click', close)
    el.querySelector('#ls').addEventListener('click', async () => {
      const note = document.getElementById('log-note').value.trim()
      if (!note) { document.getElementById('log-err').textContent='กรุณาระบุรายละเอียด'; return }
      try {
        await createDoc('comm_logs', { customerId:cid, type: document.getElementById('log-type').value, note, createdBy:'demo-user' })
        close(); showToast('บันทึกแล้ว','success')
        refreshCommLogs(cid, icons)
      } catch { showToast('เกิดข้อผิดพลาด','error') }
    })
  }

  function openForm(existing=null) {
    const isEdit = !!existing
    const {el, close} = openModal({
      title: isEdit ? `✏️ แก้ไข ${fullName(existing)}` : '➕ เพิ่มลูกค้าใหม่', size:'md',
      body:`
        <div style="display:flex;flex-direction:column;gap:14px">
          <div class="grid-2">
            <div class="input-group"><label class="input-label">ชื่อ <span class="required">*</span></label><input class="input" id="ff" value="${escHtml(existing?.firstName||'')}" placeholder="ชื่อ"><span class="input-error" id="ff-e"></span></div>
            <div class="input-group"><label class="input-label">นามสกุล <span class="required">*</span></label><input class="input" id="fl" value="${escHtml(existing?.lastName||'')}" placeholder="นามสกุล"><span class="input-error" id="fl-e"></span></div>
          </div>
          <div class="grid-2">
            <div class="input-group"><label class="input-label">โทรศัพท์ <span class="required">*</span></label><input class="input" id="fp" value="${escHtml(existing?.phone||'')}" placeholder="0812345678"><span class="input-error" id="fp-e"></span></div>
            <div class="input-group"><label class="input-label">LINE ID</label><input class="input" id="fl2" value="${escHtml(existing?.lineId||'')}" placeholder="@lineid"></div>
          </div>
          <div class="input-group"><label class="input-label">Email</label><input class="input" id="fe" type="email" value="${escHtml(existing?.email||'')}" placeholder="email@example.com"></div>
          <div class="grid-2">
            <div class="input-group"><label class="input-label">รถที่สนใจ</label><input class="input" id="fm" value="${escHtml(existing?.interestedModel||'')}" placeholder="เช่น BYD Seal"></div>
            <div class="input-group"><label class="input-label">สถานะ</label><select class="input" id="fs">${Object.entries(STATUS).map(([k,v])=>`<option value="${k}" ${existing?.status===k?'selected':''}>${v.label}</option>`).join('')}</select></div>
          </div>
          <div class="input-group"><label class="input-label">ที่มา</label><select class="input" id="fso">${Object.entries(SOURCE).map(([k,v])=>`<option value="${k}" ${existing?.source===k?'selected':''}>${v}</option>`).join('')}</select></div>
        </div>
      `,
      footer:`<button class="btn btn-secondary" id="fc">ยกเลิก</button><button class="btn btn-primary" id="fok">💾 ${isEdit?'บันทึก':'เพิ่ม'}</button>`
    })
    el.querySelector('#fc').addEventListener('click', close)
    el.querySelector('#fok').addEventListener('click', async () => {
      const first=document.getElementById('ff').value.trim()
      const last=document.getElementById('fl').value.trim()
      const phone=document.getElementById('fp').value.trim()
      let ok=true
      if(!first){document.getElementById('ff-e').textContent='กรุณาระบุชื่อ';ok=false}
      if(!last){document.getElementById('fl-e').textContent='กรุณาระบุนามสกุล';ok=false}
      if(!phone){document.getElementById('fp-e').textContent='กรุณาระบุเบอร์โทร';ok=false}
      if(!ok) return
      const btn=el.querySelector('#fok'); btn.disabled=true; btn.innerHTML='<span class="spinner spinner-sm"></span>'
      const data={firstName:first,lastName:last,phone,lineId:document.getElementById('fl2').value.trim(),email:document.getElementById('fe').value.trim(),interestedModel:document.getElementById('fm').value.trim(),status:document.getElementById('fs').value,source:document.getElementById('fso').value,tags:existing?.tags||[]}
      try {
        if(isEdit) await updateDocData('customers',existing.id,data)
        else await createDoc('customers',data)
        showToast(isEdit?`แก้ไข ${first} ${last} แล้ว`:`เพิ่ม ${first} ${last} แล้ว`,'success')
        close(); await loadData()
      } catch { btn.disabled=false; btn.textContent='บันทึก'; showToast('บันทึกไม่สำเร็จ','error') }
    })
  }

  // ── Page HTML ─────────────────────────────────────
  container.innerHTML = `
    <div class="page-content animate-slide">
      <div class="page-header">
        <div><div class="page-title">👥 ลูกค้าทั้งหมด</div><div class="page-subtitle" id="cust-count">กำลังโหลด...</div></div>
        <div class="page-actions">
          <button class="btn btn-ghost btn-sm" id="sheet-view-btn" title="Spreadsheet View">📊 Sheet</button>
          <button class="btn btn-ghost btn-sm" id="import-cust-btn">📤 Import</button>
          <button class="btn btn-secondary btn-sm" id="export-cust-btn">📥 Export</button>
          <button class="btn btn-primary" id="add-cust-btn">➕ เพิ่มลูกค้า</button>
        </div>
      </div>

      <div class="card mb-4" style="padding:14px 20px">
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
          <div style="position:relative;flex:1;min-width:200px">
            <span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text-muted)">🔍</span>
            <input class="input" id="cust-search" placeholder="ค้นหาชื่อ เบอร์โทร LINE รถที่สนใจ..." style="padding-left:32px">
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            ${['all','hot','warm','cold','vip','lost'].map(s=>`
              <button class="btn btn-sm sf ${s==='all'?'btn-primary':'btn-secondary'}" data-s="${s}">
                ${s==='all'?'ทั้งหมด':(STATUS[s]?.label||s)}
              </button>
            `).join('')}
          </div>
        </div>
      </div>

      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>ลูกค้า</th><th>โทร</th><th>สถานะ</th><th>รถที่สนใจ</th><th>ที่มา</th><th>Tag</th><th>เพิ่มเมื่อ</th><th></th>
          </tr></thead>
          <tbody id="cust-tbody">
            ${[...Array(5)].map(()=>`<tr>${[...Array(8)].map(()=>`<td><div class="skeleton" style="height:16px;border-radius:4px"></div></td>`).join('')}</tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div id="sheet-view-wrap" style="display:none"></div>
    </div>
  `

  if (!document.getElementById('cust-style')) {
    const s = document.createElement('style')
    s.id = 'cust-style'
    s.textContent = `.cust-row{cursor:pointer}.cust-row:hover td{background:var(--surface-2)}.ss-active{background:var(--primary-dim)!important}`
    document.head.appendChild(s)
  }

  // Sheet / Table toggle
  let sheetMode = false
  let sheet = null
  const SHEET_COLS = [
    { key:'firstName', label:'ชื่อ', width:100, required:true },
    { key:'lastName',  label:'นามสกุล', width:110, required:true },
    { key:'phone',     label:'โทรศัพท์', width:120 },
    { key:'lineId',    label:'LINE ID', width:100 },
    { key:'email',     label:'Email', width:150 },
    { key:'interestedModel', label:'รถที่สนใจ', width:130 },
    { key:'status',    label:'สถานะ', width:90, type:'select', options: Object.entries(STATUS).map(([v,s])=>({value:v,label:s.label.replace(/[🔴🟡🔵⭐⬛]\s*/,'')})) },
    { key:'source',    label:'ที่มา', width:100, type:'select', options: Object.entries(SOURCE).map(([v,l])=>({value:v,label:l.replace(/[📘💚🎵🚶🤝🔍📌]\s*/,'')})) },
  ]

  document.getElementById('sheet-view-btn').addEventListener('click', () => {
    sheetMode = !sheetMode
    const tableWrap = container.querySelector('.table-wrap')
    const sheetWrap = document.getElementById('sheet-view-wrap')
    const btn = document.getElementById('sheet-view-btn')
    const addBtn = document.getElementById('add-cust-btn')
    if (sheetMode) {
      tableWrap.style.display = 'none'
      sheetWrap.style.display = ''
      btn.textContent = '📋 Table'; btn.className = 'btn btn-primary btn-sm'
      addBtn.style.display = 'none'
      sheet = new SmartSheet(sheetWrap, {
        columns: SHEET_COLS,
        rows: customers,
        onSave: async (row) => {
          try {
            if (row.id) await updateDocData('customers', row.id, row)
            else { const id = await createDoc('customers', row); row.id = id }
            showToast('บันทึกแล้ว', 'success')
            await loadData(); sheet.setRows(customers)
          } catch { showToast('บันทึกไม่สำเร็จ','error') }
        },
        onDelete: async (row) => {
          if (row.id) await softDelete('customers', row.id).catch(() => {})
        }
      })
    } else {
      tableWrap.style.display = ''
      sheetWrap.style.display = 'none'
      btn.textContent = '📊 Sheet'; btn.className = 'btn btn-ghost btn-sm'
      addBtn.style.display = ''
      sheet = null
      renderTable()
    }
  })

  document.getElementById('add-cust-btn').addEventListener('click', () => openForm())

  document.getElementById('export-cust-btn').addEventListener('click', () => {
    if (!customers.length) { showToast('ไม่มีข้อมูลสำหรับ Export', 'warning'); return }
    const rows = customers.map(c => ({
      'ชื่อ': c.firstName || '', 'นามสกุล': c.lastName || '',
      'โทรศัพท์': c.phone || '', 'LINE ID': c.lineId || '', 'Email': c.email || '',
      'รถที่สนใจ': c.interestedModel || '', 'สถานะ': c.status || '',
      'ที่มา': c.source || '', 'แท็ก': (c.tags || []).join(', '),
      'วันที่เพิ่ม': formatDate(c.createdAt),
    }))
    exportToExcel(rows, `customers-${new Date().toISOString().slice(0,10)}.xlsx`, 'ลูกค้า')
    showToast(`Export ${rows.length} รายการแล้ว`, 'success')
  })

  const IMPORT_COLS = ['ชื่อ','นามสกุล','โทรศัพท์','LINE ID','Email','รถที่สนใจ','สถานะ','ที่มา']
  document.getElementById('import-cust-btn').addEventListener('click', () => {
    openImportModal({
      title: 'นำเข้าข้อมูลลูกค้า',
      columns: IMPORT_COLS,
      onImport: async (rows) => {
        let added = 0
        for (const row of rows) {
          const first = row['ชื่อ']?.trim()
          const last  = row['นามสกุล']?.trim()
          if (!first && !last) continue
          await createDoc('customers', {
            firstName: first || '', lastName: last || '',
            phone: row['โทรศัพท์'] || '', lineId: row['LINE ID'] || '',
            email: row['Email'] || '', interestedModel: row['รถที่สนใจ'] || '',
            status: row['สถานะ'] || 'cold', source: row['ที่มา'] || 'other', tags: [],
          }).catch(() => {})
          added++
        }
        showToast(`นำเข้า ${added} รายการสำเร็จ`, 'success')
        await loadData()
      }
    })
  })
  document.getElementById('cust-search').addEventListener('input', e => { search=e.target.value.trim().toLowerCase(); applyFilter() })
  document.querySelectorAll('.sf').forEach(btn => btn.addEventListener('click', () => {
    statusFilter = btn.dataset.s
    document.querySelectorAll('.sf').forEach(b => b.className=`btn btn-sm sf ${b.dataset.s===statusFilter?'btn-primary':'btn-secondary'}`)
    applyFilter()
  }))

  if (container.__routerGen !== myGen) return
  await loadData()
}

function avatarColor(s) {
  return {hot:'#EF4444',warm:'#F59E0B',cold:'#06B6D4',vip:'#8B5CF6',lost:'#6B7280'}[s]||'#6B7280'
}
function typeLabel(t) {
  return {call:'โทรศัพท์',line:'LINE',visit:'เข้าโชว์รูม',email:'Email',note:'Note'}[t]||t
}
function detail(label, value) {
  return `<div style="display:flex;gap:8px;font-size:0.875rem"><span style="color:var(--text-muted);min-width:100px">${label}</span><span style="color:var(--text-2)">${value}</span></div>`
}
