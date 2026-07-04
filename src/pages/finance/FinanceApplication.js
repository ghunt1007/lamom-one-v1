import { formatCurrency } from '../../utils/format.js'
import { openModal, confirmDialog } from '../../utils/modal.js'
import { showToast, getState, setState } from '../../core/store.js'
import { exportToExcel } from '../../utils/importExport.js'
import { getBanks } from '../../data/masterData.js'
import { listDocs, createDoc, updateDocData, softDelete, seedDemoData } from '../../core/db.js'

function escHtml(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }

const APP_STATUS = {
  draft:     { label: 'Draft', color: 'primary' },
  submitted: { label: 'ส่งแล้ว', color: 'primary' },
  pending:   { label: 'รออนุมัติ', color: 'warning' },
  approved:  { label: 'อนุมัติ', color: 'success' },
  rejected:  { label: 'ไม่อนุมัติ', color: 'danger' },
  cancelled: { label: 'ยกเลิก', color: 'danger' },
}

// ดอกเบี้ยคงที่ (flat rate) — สูตรเดียวกับที่ใช้ทั่วทั้งระบบ (Bookings.js, LoanCalculator.js)
// เพื่อให้ยอดผ่อน/เดือนตรงกันไม่ว่าจะคำนวณจากหน้าไหน (เดิมหน้านี้ใช้สูตร reducing-balance
// ซึ่งให้ตัวเลขต่ำกว่าจริงเมื่อเทียบกับที่ไฟแนนซ์รถยนต์ในไทยคิดจริง)
function calcMonthly(amount, rate, months) {
  if (!amount || !months) return 0
  const years = months / 12
  const total = amount * (1 + (rate / 100) * years)
  return Math.round(total / months)
}

export default async function FinanceApplicationPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let apps = []
  let statusFilter = 'all'
  let search = ''
  let loading = true

  async function loadData() {
    loading = true
    try { apps = await listDocs('finance_applications', [], 'submittedDate', 'desc', 300) } catch (e) { apps = [] }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function getFiltered() {
    let list = apps
    if (statusFilter !== 'all') list = list.filter(a => a.status === statusFilter)
    if (search) list = list.filter(a => a.custName.includes(search) || a.vehicle.includes(search))
    return list
  }

  function getSummary() {
    return {
      total: apps.length,
      pending: apps.filter(a => ['submitted','pending'].includes(a.status)).length,
      approved: apps.filter(a => a.status === 'approved').length,
      totalLoan: apps.filter(a => a.status === 'approved').reduce((a, x) => a + x.loanAmount, 0),
    }
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const s = getSummary()
    const filtered = getFiltered()

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🏦 Finance Application</div>
            <div class="page-subtitle">ยื่นขอสินเชื่อและติดตามสถานะ</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="fa-export">📥 Export</button>
            <button class="btn btn-primary" id="new-app-btn">➕ ยื่นไฟแนนซ์ใหม่</button>
          </div>
        </div>

        <!-- KPI -->
        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:20px">
          ${kpi('📋 ทั้งหมด', s.total, 'primary')}
          ${kpi('⏳ รอผล', s.pending, 'warning')}
          ${kpi('✅ อนุมัติแล้ว', s.approved, 'success')}
          ${kpi('💰 ยอดสินเชื่อรวม', formatCurrency(s.totalLoan), 'success')}
        </div>

        <!-- Filters -->
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px;align-items:center">
          <input class="input" id="fa-search" placeholder="🔍 ค้นหาลูกค้า..." value="${escHtml(search)}" style="width:200px">
          <div style="display:flex;gap:4px;margin-left:auto">
            <button class="btn btn-sm ${statusFilter==='all'?'btn-primary':'btn-secondary'} sf-btn" data-s="all">ทั้งหมด</button>
            ${Object.entries(APP_STATUS).map(([k,v]) => `<button class="btn btn-sm ${statusFilter===k?'btn-primary':'btn-secondary'} sf-btn" data-s="${k}">${v.label}</button>`).join('')}
          </div>
        </div>

        <!-- Cards -->
        <div style="display:flex;flex-direction:column;gap:12px">
          ${filtered.map(a => renderAppCard(a)).join('')}
          ${!filtered.length ? `<div class="empty-state"><div class="empty-icon">🏦</div><div class="empty-title">ไม่มีรายการ</div></div>` : ''}
        </div>
      </div>
    `

    document.getElementById('fa-search')?.addEventListener('input', e => { search = e.target.value; renderPage() })
    document.querySelectorAll('.sf-btn').forEach(b => b.addEventListener('click', () => { statusFilter = b.dataset.s; renderPage() }))
    document.getElementById('new-app-btn')?.addEventListener('click', () => openAppForm())
    document.getElementById('fa-export')?.addEventListener('click', () => exportToExcel(filtered.map(a => ({ ลูกค้า:a.custName, รถ:a.vehicle, วงเงิน:a.loanAmount, งวด:a.tenure, ธนาคาร:a.bank, ผ่อน:a.monthlyPayment, สถานะ:APP_STATUS[a.status].label })), 'FinanceApps'))
    document.querySelectorAll('.app-card').forEach(card => {
      card.addEventListener('click', () => { const a = apps.find(x => x.id === card.dataset.id); if (a) openAppDetail(a) })
    })
    document.querySelectorAll('.app-status-btn').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.stopPropagation()
        const a = apps.find(x => x.id === btn.dataset.id)
        if (!a) return
        const newStatus = btn.dataset.s
        const patch = { status: newStatus }
        if (newStatus === 'approved') patch.approvedDate = new Date().toISOString().slice(0,10)
        await updateDocData('finance_applications', a.id, patch)
        try {
          await createDoc('notifications', {
            type: 'finance',
            title: newStatus === 'approved' ? 'ไฟแนนซ์อนุมัติแล้ว' : 'ไฟแนนซ์ไม่อนุมัติ',
            body: `${a.custName} — ${a.vehicle} (${a.bank})`,
            read: false, link: '/finance/application', createdAt: new Date().toISOString(),
          })
          setState('unreadCount', (getState('unreadCount') || 0) + 1)
        } catch { /* แจ้งเตือนพลาดได้ ไม่กระทบสถานะที่บันทึกไปแล้ว */ }
        showToast('✅ อัพเดตสถานะแล้ว', 'success')
        await loadData()
      })
    })
    document.querySelectorAll('.app-del-btn').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.stopPropagation()
        const a = apps.find(x => x.id === btn.dataset.id)
        if (!a) return
        const ok = await confirmDialog({ title: '🗑️ ลบรายการยื่นไฟแนนซ์', message: `ยืนยันลบรายการของ "${escHtml(a.custName)}" — ${escHtml(a.vehicle)}? การลบนี้ไม่สามารถย้อนกลับได้`, confirmText: 'ลบ', danger: true })
        if (!ok) return
        await softDelete('finance_applications', a.id)
        showToast('🗑️ ลบรายการแล้ว', 'success')
        await loadData()
      })
    })
  }

  function renderAppCard(a) {
    const st = APP_STATUS[a.status]
    return `<div class="app-card" data-id="${a.id}" style="
      padding:16px;background:var(--surface);border:1px solid var(--border);
      border-radius:var(--radius-md);cursor:pointer;
    ">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:10px">
        <div>
          <div style="font-weight:700;font-size:0.9rem">${escHtml(a.custName)}</div>
          <div style="font-size:0.78rem;color:var(--text-muted)">${escHtml(a.phone)}</div>
        </div>
        <span class="badge badge-${st.color}">${st.label}</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:10px">
        ${metric('🚗 รถ', escHtml(a.vehicle))}
        ${metric('💰 วงเงิน', formatCurrency(a.loanAmount))}
        ${metric('🏦 ธนาคาร', escHtml(a.bank))}
        ${metric('📅 ผ่อน', formatCurrency(a.monthlyPayment) + ' x ' + a.tenure + ' งวด')}
      </div>
      <!-- Documents checklist mini -->
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
        ${['บัตรประชาชน','สลิปเงินเดือน','Statement 3 เดือน','ทะเบียนบ้าน'].map(doc => `<span style="font-size:0.7rem;padding:2px 6px;border-radius:99px;background:${(a.documents||[]).includes(doc)?'var(--success-dim)':'var(--surface-3)'};color:${(a.documents||[]).includes(doc)?'var(--success)':'var(--text-muted)'}">${(a.documents||[]).includes(doc)?'✅':''} ${doc}</span>`).join('')}
      </div>
      <div style="display:flex;gap:6px;margin-top:10px;padding-top:10px;border-top:1px solid var(--border)" onclick="event.stopPropagation()">
        ${['submitted','pending'].includes(a.status) ? `
          <button class="btn btn-xs btn-success app-status-btn" data-id="${a.id}" data-s="approved">✅ อนุมัติ</button>
          <button class="btn btn-xs btn-danger app-status-btn" data-id="${a.id}" data-s="rejected">❌ ไม่อนุมัติ</button>
          ${a.status === 'draft' ? `<button class="btn btn-xs btn-primary app-status-btn" data-id="${a.id}" data-s="submitted">📤 ส่งธนาคาร</button>` : ''}
        ` : ''}
        <button class="btn btn-xs btn-secondary app-del-btn" data-id="${a.id}" style="margin-left:auto">🗑️ ลบ</button>
      </div>
    </div>`
  }

  function metric(label, value) {
    return `<div><div style="font-size:0.7rem;color:var(--text-muted)">${label}</div><div style="font-size:0.82rem;font-weight:600">${value}</div></div>`
  }

  function openAppForm() {
    const { el, close } = openModal({
      title: '🏦 ยื่นไฟแนนซ์ใหม่', size: 'md',
      body: `<div style="display:flex;flex-direction:column;gap:12px">
        <div class="grid-2">
          <div class="input-group"><label class="input-label">ลูกค้า *</label><input class="input" id="fa-cust" placeholder="ชื่อ-นามสกุล"></div>
          <div class="input-group"><label class="input-label">เบอร์โทร</label><input class="input" id="fa-phone" placeholder="08x-xxx-xxxx"></div>
        </div>
        <div class="grid-2">
          <div class="input-group"><label class="input-label">รุ่นรถ *</label><input class="input" id="fa-vehicle" placeholder="เช่น BYD Seal AWD"></div>
          <div class="input-group"><label class="input-label">ราคารถ (฿)</label><input class="input" type="number" id="fa-price" placeholder="0"></div>
        </div>
        <div class="grid-2">
          <div class="input-group"><label class="input-label">เงินดาวน์ (฿)</label><input class="input" type="number" id="fa-down" placeholder="0" oninput="document.getElementById('fa-loan-calc').textContent='วงเงิน: ฿'+(+document.getElementById('fa-price').value - +this.value).toLocaleString()"></div>
          <div class="input-group"><label class="input-label">จำนวนงวด (เดือน)</label>
            <select class="input" id="fa-tenure">
              ${[24,36,48,60,72,84].map(t => `<option value="${t}" ${t===60?'selected':''}>${t} เดือน</option>`).join('')}
            </select>
          </div>
        </div>
        <div id="fa-loan-calc" style="font-size:0.82rem;color:var(--primary)"></div>
        <div class="grid-2">
          <div class="input-group"><label class="input-label">ธนาคาร</label>
            <select class="input" id="fa-bank">
              ${getBanks().map(b => `<option>${b}</option>`).join('')}
            </select>
          </div>
          <div class="input-group"><label class="input-label">ดอกเบี้ย (%/ปี)</label><input class="input" type="number" id="fa-rate" value="2.79" step="0.01"></div>
        </div>
        <div class="input-group"><label class="input-label">หมายเหตุ</label><input class="input" id="fa-note" placeholder="หมายเหตุ (ถ้ามี)"></div>
      </div>`,
      footer: `<button class="btn btn-secondary" id="fa-c">ยกเลิก</button><button class="btn btn-primary" id="fa-s">📤 ส่งขอสินเชื่อ</button>`
    })
    el.querySelector('#fa-c').addEventListener('click', close)
    el.querySelector('#fa-s').addEventListener('click', async () => {
      const custName = el.querySelector('#fa-cust').value.trim()
      const vehicle = el.querySelector('#fa-vehicle').value.trim()
      if (!custName || !vehicle) return showToast('❗ กรุณากรอกข้อมูลให้ครบ', 'warning')
      const price = +el.querySelector('#fa-price').value || 0
      const down = +el.querySelector('#fa-down').value || 0
      const loanAmount = price - down
      const tenure = +el.querySelector('#fa-tenure').value
      const rate = +el.querySelector('#fa-rate').value
      const monthly = calcMonthly(loanAmount, rate, tenure)
      await createDoc('finance_applications', { custName, phone: el.querySelector('#fa-phone').value, vehicle, vehiclePrice:price, downPayment:down, loanAmount, tenure, bank: el.querySelector('#fa-bank').value, monthlyPayment:monthly, rate, status:'submitted', submittedDate:new Date().toISOString().slice(0,10), approvedDate:null, note: el.querySelector('#fa-note').value, documents:[] })
      showToast('📤 ส่งขอสินเชื่อแล้ว', 'success'); close(); await loadData()
    })
  }

  function openAppDetail(a) {
    const st = APP_STATUS[a.status]
    openModal({
      title: '🏦 ' + escHtml(a.custName) + ' — ' + escHtml(a.bank), size: 'md',
      body: `<div style="display:flex;flex-direction:column;gap:12px">
        <div><span class="badge badge-${st.color}">${st.label}</span></div>
        <div style="background:var(--primary-dim);padding:14px;border-radius:var(--radius-md);text-align:center">
          <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:4px">ค่างวดต่อเดือน</div>
          <div style="font-size:2rem;font-weight:900;color:var(--primary)">${formatCurrency(a.monthlyPayment)}</div>
          <div style="font-size:0.78rem;color:var(--text-muted)">${a.tenure} งวด · ดอกเบี้ย ${a.rate}%/ปี</div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:0.83rem">
          <div><div style="color:var(--text-muted);font-size:0.72rem">ราคารถ</div><div>${formatCurrency(a.vehiclePrice)}</div></div>
          <div><div style="color:var(--text-muted);font-size:0.72rem">เงินดาวน์</div><div>${formatCurrency(a.downPayment)}</div></div>
          <div><div style="color:var(--text-muted);font-size:0.72rem">วงเงินกู้</div><div style="font-weight:700;color:var(--primary)">${formatCurrency(a.loanAmount)}</div></div>
          <div><div style="color:var(--text-muted);font-size:0.72rem">ธนาคาร</div><div>${a.bank}</div></div>
          <div><div style="color:var(--text-muted);font-size:0.72rem">ยื่นวันที่</div><div>${a.submittedDate}</div></div>
          ${a.approvedDate ? `<div><div style="color:var(--text-muted);font-size:0.72rem">อนุมัติวันที่</div><div style="color:var(--success)">${a.approvedDate}</div></div>` : ''}
        </div>
        <div>
          <div style="font-size:0.8rem;font-weight:600;margin-bottom:8px">เอกสารที่มี</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px">
            ${['บัตรประชาชน','สลิปเงินเดือน','Statement 3 เดือน','ทะเบียนบ้าน'].map(doc => `<span style="font-size:0.75rem;padding:4px 10px;border-radius:99px;border:1px solid var(--border);background:${(a.documents||[]).includes(doc)?'var(--success-dim)':'transparent'};color:${(a.documents||[]).includes(doc)?'var(--success)':'var(--text-muted)'};cursor:pointer" class="doc-toggle" data-doc="${doc}">${(a.documents||[]).includes(doc)?'✅ ':''} ${doc}</span>`).join('')}
          </div>
        </div>
        ${a.note ? `<div style="background:var(--surface-2);padding:10px;border-radius:var(--radius-sm);font-size:0.82rem">📝 ${escHtml(a.note)}</div>` : ''}
      </div>`,
      footer: ''
    })
    document.querySelectorAll('.doc-toggle').forEach(tog => {
      tog.addEventListener('click', async () => {
        const doc = tog.dataset.doc
        const documents = [...(a.documents || [])]
        const idx = documents.indexOf(doc)
        if (idx >= 0) documents.splice(idx, 1); else documents.push(doc)
        a.documents = documents
        await updateDocData('finance_applications', a.id, { documents })
        document.querySelector('.modal-overlay')?.remove(); openAppDetail(a)
      })
    })
  }

  await loadData()
}

function kpi(title, value, color) {
  return `<div class="kpi-card"><div class="kpi-title">${title}</div><div class="kpi-value" style="color:var(--${color})">${value}</div></div>`
}
