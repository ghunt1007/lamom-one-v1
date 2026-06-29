import { listDocs, createDoc, updateDocData, softDelete, seedDemoData } from '../../core/db.js'
import { showToast } from '../../core/store.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
import { formatDate, formatDateTime } from '../../utils/format.js'
import { confirmDialog, openModal } from '../../utils/modal.js'
import { exportToExcel } from '../../utils/importExport.js'

const DOC_TYPES = {
  booking:       { label: '📝 ใบจอง',           color: 'primary' },
  cancel:        { label: '❌ ใบถอนจอง',         color: 'danger'  },
  quote:         { label: '💰 ใบเสนอราคา',       color: 'warning' },
  contract:      { label: '📜 สัญญาจะซื้อจะขาย', color: 'success' },
  delivery:      { label: '🚗 ใบส่งมอบรถ',        color: 'accent'  },
  receipt:       { label: '🧾 ใบรับมัดจำ',        color: 'accent'  },
  invoice:       { label: '🏦 ใบกำกับภาษี',       color: 'success' },
  jobcard:       { label: '🔧 Job Card',          color: 'warning' },
  claim:         { label: '🛡 ใบรับงานเคลม',       color: 'danger'  },
  hr_contract:   { label: '👤 สัญญาจ้าง HR',      color: 'primary' },
  power_atty:    { label: '📋 หนังสือมอบอำนาจ',   color: 'accent'  },
  spec_sheet:    { label: '🚘 Spec Sheet รถ',      color: 'accent'  },
}

const DEMO_DOCS = [
  { id: 'doc1', type: 'booking',  title: 'ใบจอง BYD Seal — สมชาย มีทรัพย์',   status: 'draft',     createdAt: new Date(Date.now()-86400000).toISOString() },
  { id: 'doc2', type: 'quote',    title: 'ใบเสนอราคา MG4 — สมหญิง ดีมาก',     status: 'sent',      createdAt: new Date(Date.now()-86400000*2).toISOString() },
  { id: 'doc3', type: 'contract', title: 'สัญญาซื้อขาย BYD Atto3 — วิชัย สุขใจ', status: 'signed',  createdAt: new Date(Date.now()-86400000*5).toISOString() },
  { id: 'doc4', type: 'delivery', title: 'ใบส่งมอบ BYD Atto3 — วิชัย สุขใจ',   status: 'completed', createdAt: new Date(Date.now()-86400000*5).toISOString() },
  { id: 'doc5', type: 'jobcard',  title: 'Job Card #JC-001 — สมชาย มีทรัพย์',  status: 'draft',     createdAt: new Date(Date.now()-3600000*3).toISOString() },
]

const STATUS_INFO = {
  draft:     { label: '✏️ Draft',     badge: 'primary' },
  sent:      { label: '📤 ส่งแล้ว',   badge: 'accent' },
  signed:    { label: '✅ เซ็นแล้ว',  badge: 'success' },
  completed: { label: '🏁 เสร็จสิ้น', badge: 'primary' },
  cancelled: { label: '❌ ยกเลิก',    badge: 'danger' },
}

export default async function DocumentStudioPage(container) {
  const myGen = container.__routerGen

  // seed demo docs
  DEMO_DOCS.forEach(d => {
    const store = window.__lamomDemoStore
    if (store && !store['documents']?.[d.id]) {
      if (!store['documents']) store['documents'] = {}
      store['documents'][d.id] = d
    }
  })

  let docs = []
  let filtered = []
  let typeFilter = 'all'
  let search = ''

  async function loadData() {
    // try Firestore, fallback demo
    try { docs = await listDocs('documents', [], 'createdAt', 'desc', 200) } catch { docs = DEMO_DOCS }
    if (!docs.length) docs = DEMO_DOCS
    applyFilter()
  }

  function applyFilter() {
    filtered = docs.filter(d => {
      const matchType = typeFilter === 'all' || d.type === typeFilter
      const matchSearch = !search || (d.title||'').toLowerCase().includes(search)
      return matchType && matchSearch
    })
    renderList()
  }

  function renderList() {
    const el = document.getElementById('doc-list')
    const countEl = document.getElementById('doc-count')
    if (countEl) countEl.textContent = `${filtered.length} เอกสาร`
    if (!el) return
    if (!filtered.length) {
      el.innerHTML = `<div class="empty-state" style="padding:48px"><div class="empty-icon">📄</div><div class="empty-title">ไม่พบเอกสาร</div><div class="empty-desc">${typeFilter!=='all'?'ลองเลือกประเภทอื่น':'สร้างเอกสารแรกได้เลย'}</div></div>`
      return
    }
    el.innerHTML = filtered.map(d => {
      const type = DOC_TYPES[d.type] || { label: escHtml(d.type), color: 'primary' }
      const status = STATUS_INFO[d.status] || { label: escHtml(d.status), badge: 'primary' }
      return `
        <div class="doc-card card card-lift" data-id="${d.id}" style="cursor:pointer;margin-bottom:8px">
          <div style="display:flex;align-items:center;gap:12px">
            <div style="width:40px;height:40px;border-radius:var(--radius-md);background:var(--${type.color}-dim);color:var(--${type.color});display:flex;align-items:center;justify-content:center;font-size:1.2rem;flex-shrink:0">
              ${type.label.split(' ')[0]}
            </div>
            <div style="flex:1;min-width:0">
              <div style="font-weight:600;font-size:0.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(d.title)}</div>
              <div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px">${type.label.slice(2)} · ${formatDate(d.createdAt)}</div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
              <span class="badge badge-${status.badge}">${status.label}</span>
              <button class="btn btn-ghost btn-sm doc-print" data-id="${d.id}" title="พิมพ์/PDF">🖨️</button>
              <button class="btn btn-ghost btn-sm doc-del" data-id="${d.id}" title="ลบ" style="color:var(--danger)">🗑</button>
            </div>
          </div>
        </div>
      `
    }).join('')

    el.querySelectorAll('.doc-card').forEach(card => {
      card.addEventListener('click', e => {
        if (e.target.closest('.doc-print,.doc-del')) return
        const doc = docs.find(d => d.id === card.dataset.id)
        if (doc) openDocEditor(doc)
      })
    })
    el.querySelectorAll('.doc-print').forEach(btn => {
      btn.addEventListener('click', () => {
        const doc = docs.find(d => d.id === btn.dataset.id)
        if (doc) printDocument(doc)
      })
    })
    el.querySelectorAll('.doc-del').forEach(btn => {
      btn.addEventListener('click', async () => {
        const doc = docs.find(d => d.id === btn.dataset.id)
        const ok = await confirmDialog({ title:'ลบเอกสาร', message:`ลบ "${doc?.title}"?`, confirmText:'ลบ', danger:true })
        if (!ok) return
        try {
          await softDelete('documents', btn.dataset.id)
          showToast('ลบเอกสารแล้ว','success')
          await loadData()
        } catch { showToast('เกิดข้อผิดพลาด','error') }
      })
    })
  }

  container.innerHTML = `
    <div class="page-content animate-slide">
      <div class="page-header">
        <div>
          <div class="page-title">📄 Document Studio</div>
          <div class="page-subtitle" id="doc-count">กำลังโหลด...</div>
        </div>
        <div class="page-actions">
          <button class="btn btn-secondary btn-sm" id="doc-export-btn">📥 Export รายการ</button>
          <button class="btn btn-primary" id="doc-new-btn">➕ สร้างเอกสาร</button>
        </div>
      </div>

      <!-- Type Filter + Search -->
      <div class="card mb-4" style="padding:14px 20px">
        <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center">
          <div style="position:relative;flex:1;min-width:180px">
            <span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text-muted)">🔍</span>
            <input class="input" id="doc-search" placeholder="ค้นหาชื่อเอกสาร..." style="padding-left:32px">
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <button class="btn btn-sm dt-btn btn-primary" data-t="all">ทั้งหมด</button>
            ${Object.entries(DOC_TYPES).map(([k,v])=>`<button class="btn btn-sm dt-btn btn-secondary" data-t="${k}">${v.label}</button>`).join('')}
          </div>
        </div>
      </div>

      <!-- Template Gallery -->
      <div class="card mb-4">
        <div class="card-header">
          <span class="card-title">📋 เทมเพลตยอดนิยม</span>
          <button class="btn btn-ghost btn-sm" id="see-all-templates">ดูทั้งหมด →</button>
        </div>
        <div style="display:flex;gap:12px;flex-wrap:wrap;padding:4px 0">
          ${Object.entries(DOC_TYPES).slice(0,6).map(([k,v])=>`
            <button class="btn btn-secondary btn-sm tpl-btn" data-type="${k}" style="display:flex;align-items:center;gap:6px">
              ${v.label}
            </button>
          `).join('')}
        </div>
      </div>

      <!-- Document List -->
      <div id="doc-list">
        ${[1,2,3].map(()=>`<div class="skeleton" style="height:68px;border-radius:var(--radius-lg);margin-bottom:8px"></div>`).join('')}
      </div>
    </div>
  `

  if (!document.getElementById('doc-style')) {
    const s = document.createElement('style')
    s.id = 'doc-style'
    s.textContent = `.doc-card:hover { transform:translateY(-1px); } `
    document.head.appendChild(s)
  }

  document.getElementById('doc-search').addEventListener('input', e => { search = e.target.value.toLowerCase(); applyFilter() })
  document.querySelectorAll('.dt-btn').forEach(btn => btn.addEventListener('click', () => {
    typeFilter = btn.dataset.t
    document.querySelectorAll('.dt-btn').forEach(b => b.className = `btn btn-sm dt-btn ${b.dataset.t===typeFilter?'btn-primary':'btn-secondary'}`)
    applyFilter()
  }))
  document.querySelectorAll('.tpl-btn').forEach(btn => btn.addEventListener('click', () => openNewDocForm(btn.dataset.type)))
  document.getElementById('doc-new-btn').addEventListener('click', () => openNewDocForm())
  document.getElementById('doc-export-btn').addEventListener('click', () => {
    if (!docs.length) return
    exportToExcel(docs.map(d => ({ ชื่อเอกสาร: d.title, ประเภท: DOC_TYPES[d.type]?.label||d.type, สถานะ: STATUS_INFO[d.status]?.label||d.status, วันที่สร้าง: formatDate(d.createdAt) })), 'documents.xlsx', 'เอกสาร')
    showToast('Export แล้ว','success')
  })
  document.getElementById('see-all-templates').addEventListener('click', () => {
    const { el: tmplEl, close: tmplClose } = openModal({
      title: '📄 เทมเพลตเอกสารทั้งหมด',
      size: 'md',
      body: `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          ${Object.entries(DOC_TYPES).map(([k,v]) => `
            <button class="tpl-pick-btn btn btn-secondary" data-type="${k}"
              style="text-align:left;padding:10px 12px;display:flex;align-items:center;gap:8px;font-size:0.8rem">
              <span style="font-size:1.2rem">${v.label.split(' ')[0]}</span>
              <span>${v.label.split(' ').slice(1).join(' ')}</span>
            </button>
          `).join('')}
        </div>
      `
    })
    tmplEl.querySelectorAll('.tpl-pick-btn').forEach(b => b.addEventListener('click', () => {
      tmplClose()
      openNewDocForm(b.dataset.type)
    }))
  })

  if (container.__routerGen === myGen) await loadData()
}

function openNewDocForm(preType = '') {
  const { el, close } = openModal({
    title: '📄 สร้างเอกสารใหม่',
    size: 'sm',
    body: `
      <div style="display:flex;flex-direction:column;gap:14px">
        <div class="input-group">
          <label class="input-label">ประเภทเอกสาร <span class="required">*</span></label>
          <select class="input" id="new-doc-type">
            ${Object.entries(DOC_TYPES).map(([k,v])=>`<option value="${k}" ${k===preType?'selected':''}>${v.label}</option>`).join('')}
          </select>
        </div>
        <div class="input-group">
          <label class="input-label">ชื่อเอกสาร <span class="required">*</span></label>
          <input class="input" id="new-doc-title" placeholder="เช่น ใบจอง BYD Seal — สมชาย">
          <span class="input-error" id="new-doc-err"></span>
        </div>
        <div class="input-group">
          <label class="input-label">ลูกค้า</label>
          <input class="input" id="new-doc-customer" placeholder="ชื่อลูกค้า">
        </div>
      </div>
    `,
    footer: `<button class="btn btn-secondary" id="ndc">ยกเลิก</button><button class="btn btn-primary" id="nds">📄 สร้าง</button>`
  })
  el.querySelector('#new-doc-type').addEventListener('change', e => {
    const type = DOC_TYPES[e.target.value]
    const cust = el.querySelector('#new-doc-customer').value
    el.querySelector('#new-doc-title').value = type ? `${type.label.slice(2)} — ${cust}` : ''
  })
  el.querySelector('#new-doc-customer').addEventListener('input', e => {
    const type = DOC_TYPES[el.querySelector('#new-doc-type').value]
    if (type) el.querySelector('#new-doc-title').value = `${type.label.slice(2)} — ${e.target.value}`
  })
  el.querySelector('#ndc').addEventListener('click', close)
  el.querySelector('#nds').addEventListener('click', async () => {
    const title = el.querySelector('#new-doc-title').value.trim()
    if (!title) { el.querySelector('#new-doc-err').textContent = 'กรุณาระบุชื่อ'; return }
    const btn = el.querySelector('#nds'); btn.disabled=true; btn.textContent='⏳'
    try {
      const id = await createDoc('documents', { type: el.querySelector('#new-doc-type').value, title, status:'draft', content:'', customer: el.querySelector('#new-doc-customer').value })
      showToast('สร้างเอกสารแล้ว','success')
      close()
      openDocEditor({ id, type: el.querySelector('#new-doc-type')?.value, title, status:'draft', content:'' })
    } catch { btn.disabled=false; btn.textContent='✅ สร้าง'; showToast('สร้างไม่สำเร็จ','error') }
  })
  if (preType) {
    const type = DOC_TYPES[preType]
    if (type) el.querySelector('#new-doc-title').placeholder = `เช่น ${type.label.slice(2)} — ชื่อลูกค้า`
  }
}

function openDocEditor(doc) {
  const type = DOC_TYPES[doc.type] || { label: escHtml(doc.type), color:'primary' }
  const status = STATUS_INFO[doc.status] || { label: escHtml(doc.status), badge:'primary' }

  const { el, close } = openModal({
    title: type.label + ' — ' + escHtml(doc.title),
    size: 'xl',
    body: `
      <div style="display:flex;gap:16px;height:520px">
        <!-- Left: Editor -->
        <div style="flex:1;display:flex;flex-direction:column;gap:10px">
          <div style="display:flex;gap:8px;flex-wrap:wrap;border-bottom:1px solid var(--border);padding-bottom:10px">
            <button class="btn btn-ghost btn-sm" data-fmt="bold" title="Bold"><b>B</b></button>
            <button class="btn btn-ghost btn-sm" data-fmt="italic" title="Italic"><i>I</i></button>
            <button class="btn btn-ghost btn-sm" data-fmt="underline" title="Underline"><u>U</u></button>
            <span style="width:1px;background:var(--border);margin:0 4px"></span>
            <button class="btn btn-ghost btn-sm" data-fmt="h2" title="หัวข้อ">H</button>
            <button class="btn btn-ghost btn-sm" data-fmt="ul" title="รายการ">≡</button>
            <span style="width:1px;background:var(--border);margin:0 4px"></span>
            <select class="input" id="doc-status-sel" style="height:28px;font-size:0.78rem;padding:2px 6px;width:130px">
              ${Object.entries(STATUS_INFO).map(([k,v])=>`<option value="${k}" ${doc.status===k?'selected':''}>${v.label}</option>`).join('')}
            </select>
          </div>
          <div id="doc-editor" contenteditable="true" spellcheck="false"
            style="flex:1;overflow-y:auto;border:1px solid var(--border);border-radius:var(--radius-md);padding:16px;font-size:0.875rem;line-height:1.7;color:var(--text-2);background:var(--surface-2);outline:none"
          >${doc.content || getTemplate(doc.type, doc)}</div>
        </div>

        <!-- Right: Info Panel -->
        <div style="width:220px;display:flex;flex-direction:column;gap:12px;flex-shrink:0">
          <div class="card" style="padding:12px">
            <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);margin-bottom:8px">ข้อมูลเอกสาร</div>
            <div style="font-size:0.8rem;color:var(--text-2);display:flex;flex-direction:column;gap:6px">
              <div><span style="color:var(--text-muted)">ประเภท: </span>${type.label}</div>
              <div><span style="color:var(--text-muted)">สถานะ: </span><span class="badge badge-${status.badge}" style="font-size:0.72rem">${status.label}</span></div>
              <div><span style="color:var(--text-muted)">วันที่สร้าง: </span>${formatDate(doc.createdAt)}</div>
            </div>
          </div>
          <div class="card" style="padding:12px">
            <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);margin-bottom:8px">การกระทำ</div>
            <div style="display:flex;flex-direction:column;gap:6px">
              <button class="btn btn-secondary btn-sm" id="doc-print-btn" style="justify-content:center">🖨️ พิมพ์</button>
              <button class="btn btn-secondary btn-sm" id="doc-pdf-btn" style="justify-content:center">📥 บันทึก PDF</button>
              <button class="btn btn-ghost btn-sm" id="doc-share-btn" style="justify-content:center">📤 แชร์ LINE</button>
            </div>
          </div>
          <div class="card" style="padding:12px">
            <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);margin-bottom:6px">Dynamic Fields</div>
            <div style="font-size:0.75rem;color:var(--text-muted);line-height:1.6">
              พิมพ์ <code style="background:var(--surface-3);padding:1px 4px;border-radius:4px">{{ชื่อ}}</code> เพื่อแทรกข้อมูลลูกค้าอัตโนมัติ
            </div>
          </div>
        </div>
      </div>
    `,
    footer: `
      <button class="btn btn-secondary" id="doc-close-btn">ปิด</button>
      <button class="btn btn-primary" id="doc-save-btn">💾 บันทึก</button>
    `
  })

  el.querySelector('#doc-close-btn').addEventListener('click', close)
  el.querySelector('#doc-save-btn').addEventListener('click', async () => {
    const content = el.querySelector('#doc-editor').innerHTML
    const newStatus = el.querySelector('#doc-status-sel').value
    try {
      await updateDocData('documents', doc.id, { content, status: newStatus })
      showToast('บันทึกแล้ว', 'success')
      doc.content = content; doc.status = newStatus
      close()
    } catch { showToast('บันทึกไม่สำเร็จ','error') }
  })

  // Format buttons
  el.querySelectorAll('[data-fmt]').forEach(btn => {
    btn.addEventListener('click', () => {
      const fmt = btn.dataset.fmt
      if (fmt === 'h2') document.execCommand('formatBlock', false, 'h2')
      else if (fmt === 'ul') document.execCommand('insertUnorderedList')
      else document.execCommand(fmt)
      el.querySelector('#doc-editor')?.focus()
    })
  })

  el.querySelector('#doc-print-btn').addEventListener('click', () => printDocument(doc))
  el.querySelector('#doc-pdf-btn').addEventListener('click', () => { printDocument(doc); showToast('ใช้ "Save as PDF" ในหน้าต่างพิมพ์', 'warning') })
  el.querySelector('#doc-share-btn').addEventListener('click', () => {
    const shareUrl = `https://lamom.app/docs/${doc.id}`
    openModal({
      title: '📤 แชร์เอกสาร',
      size: 'sm',
      body: `
        <div style="text-align:center;padding:4px">
          <div style="font-size:0.82rem;font-weight:600;margin-bottom:8px">${escHtml(doc.title)}</div>
          <div style="background:var(--surface-2);border-radius:8px;padding:8px 10px;font-family:monospace;font-size:0.7rem;word-break:break-all;margin-bottom:14px;color:var(--text-muted)">${shareUrl}</div>
          <div style="display:flex;gap:8px;justify-content:center">
            <button class="btn" id="share-line-btn" style="background:#06C755;color:#fff;border-color:#06C755">💚 แชร์ LINE</button>
            <button class="btn btn-secondary" id="share-copy-btn">📋 Copy Link</button>
          </div>
        </div>
      `
    })
    document.getElementById('share-line-btn')?.addEventListener('click', () => {
      window.open(`https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(shareUrl)}`, '_blank', 'noopener,noreferrer')
      showToast('เปิด LINE Share แล้ว', 'success')
    })
    document.getElementById('share-copy-btn')?.addEventListener('click', () => {
      navigator.clipboard?.writeText(shareUrl).then(() => showToast('📋 Copy Link แล้ว', 'success'))
        .catch(() => showToast('📋 Copy: ' + shareUrl, 'success'))
    })
  })
}

function printDocument(doc) {
  const content = doc.content || getTemplate(doc.type, doc)
  const win = window.open('', '_blank', 'width=800,height=900')
  win.document.write(`
    <!DOCTYPE html><html><head>
    <meta charset="UTF-8">
    <title>${doc.title}</title>
    <style>
      body { font-family: 'Sarabun', sans-serif; font-size: 14px; line-height: 1.8; color: #111; margin: 40px; }
      h1 { font-size: 18px; text-align: center; margin-bottom: 4px; }
      h2 { font-size: 15px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
      .header { text-align: center; margin-bottom: 24px; }
      .footer { margin-top: 48px; display: flex; justify-content: space-around; }
      .sig-box { text-align: center; border-top: 1px solid #555; padding-top: 4px; width: 160px; font-size: 12px; }
      table { width: 100%; border-collapse: collapse; margin: 12px 0; }
      td, th { border: 1px solid #ccc; padding: 6px 10px; font-size: 13px; }
      th { background: #f0f0f0; }
      @media print { body { margin: 20px; } }
    </style>
    </head><body>
    <div class="header">
      <div style="font-size:20px;font-weight:bold">LAMOM AUTO GROUP</div>
      <h1>${escHtml(doc.title)}</h1>
      <div style="font-size:12px;color:#666">วันที่: ${formatDate(doc.createdAt || new Date().toISOString())}</div>
    </div>
    ${content}
    <div class="footer">
      <div class="sig-box">ผู้ซื้อ / ลูกค้า</div>
      <div class="sig-box">ผู้ขาย / พนักงาน</div>
      <div class="sig-box">ผู้จัดการ</div>
    </div>
    </body></html>
  `)
  win.document.close()
  setTimeout(() => win.print(), 400)
}

function getTemplate(type, doc) {
  const templates = {
    booking: `<h2>ข้อมูลการจอง</h2>
<table><tr><th>รายการ</th><th>รายละเอียด</th></tr>
<tr><td>ชื่อลูกค้า</td><td>{{ชื่อ-นามสกุล}}</td></tr>
<tr><td>เบอร์โทร</td><td>{{โทรศัพท์}}</td></tr>
<tr><td>รุ่นรถที่จอง</td><td>{{รุ่นรถ}}</td></tr>
<tr><td>สี</td><td>{{สี}}</td></tr>
<tr><td>ราคาขาย</td><td>{{ราคา}} บาท</td></tr>
<tr><td>มัดจำ</td><td>{{มัดจำ}} บาท</td></tr>
<tr><td>กำหนดส่งมอบ</td><td>{{วันส่งมอบ}}</td></tr>
</table>
<p>ข้อตกลง: ใบจองนี้ถือเป็นการยืนยันการสั่งจองรถยนต์...</p>`,

    quote: `<h2>ใบเสนอราคา</h2>
<table><tr><th>รายการ</th><th>จำนวน</th><th>ราคา/หน่วย</th><th>รวม</th></tr>
<tr><td>{{รุ่นรถ}} — {{สีรถ}}</td><td>1</td><td>{{ราคา}}</td><td>{{ราคา}}</td></tr>
<tr><td>ส่วนลดพิเศษ</td><td></td><td></td><td>-{{ส่วนลด}}</td></tr>
<tr><td colspan="3"><b>ยอดรวม</b></td><td><b>{{ยอดรวม}}</b></td></tr>
</table>
<p>หมายเหตุ: ราคานี้มีผลถึงวันที่ {{วันหมดอายุ}}</p>`,

    contract: `<h2>สัญญาจะซื้อจะขายรถยนต์</h2>
<p>ทำขึ้น ณ {{สถานที่}} วันที่ {{วันที่}}</p>
<p><b>ผู้ขาย:</b> LAMOM AUTO GROUP</p>
<p><b>ผู้ซื้อ:</b> {{ชื่อ-นามสกุล}} เลขบัตรประชาชน: {{เลขบัตร}}</p>
<h2>รายละเอียดรถยนต์</h2>
<table><tr><th>รายการ</th><th>รายละเอียด</th></tr>
<tr><td>ยี่ห้อ/รุ่น</td><td>{{ยี่ห้อ}} {{รุ่น}}</td></tr>
<tr><td>ปีรถ</td><td>{{ปีรถ}}</td></tr>
<tr><td>เลขตัวถัง</td><td>{{VIN}}</td></tr>
<tr><td>ราคาซื้อขาย</td><td>{{ราคา}} บาท</td></tr>
</table>`,

    delivery: `<h2>ใบส่งมอบรถยนต์</h2>
<p>วันที่ส่งมอบ: {{วันส่งมอบ}}</p>
<table><tr><th>รายการตรวจสอบ</th><th>สภาพ</th><th>หมายเหตุ</th></tr>
<tr><td>สภาพภายนอกรถ</td><td>✅</td><td></td></tr>
<tr><td>ภายในรถ</td><td>✅</td><td></td></tr>
<tr><td>เอกสารรถ</td><td>✅</td><td></td></tr>
<tr><td>กุญแจ</td><td>✅</td><td></td></tr>
<tr><td>คู่มือรถ</td><td>✅</td><td></td></tr>
</table>`,

    jobcard: `<h2>Job Card</h2>
<p>เลขที่: {{เลข JC}} | วันที่รับงาน: {{วันที่}}</p>
<table><tr><th>รายการ</th><th>รายละเอียด</th></tr>
<tr><td>ทะเบียนรถ</td><td>{{ทะเบียน}}</td></tr>
<tr><td>เลขไมล์</td><td>{{ไมล์}} km</td></tr>
<tr><td>อาการที่แจ้ง</td><td>{{อาการ}}</td></tr>
<tr><td>ช่างผู้รับผิดชอบ</td><td>{{ช่าง}}</td></tr>
</table>`,
  }
  return templates[type] || `<h2>${DOC_TYPES[type]?.label || type}</h2><p>เริ่มพิมพ์เนื้อหาเอกสารที่นี่...</p>`
}
