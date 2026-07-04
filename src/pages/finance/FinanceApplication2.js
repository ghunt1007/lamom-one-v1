/**
 * Insurance & Finance Tracker — สถานะการยื่นไฟแนนซ์และประกัน
 * Route: /finance/tracker
 */
import { formatCurrency, formatDate, timeAgo } from '../../utils/format.js'
import { openModal, confirmDialog } from '../../utils/modal.js'
import { showToast, getState, setState } from '../../core/store.js'
import { exportToExcel } from '../../utils/importExport.js'
import { listDocs, createDoc, updateDocData, softDelete, seedDemoData } from '../../core/db.js'

function escHtml(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }

const APP_STATUS = {
  preparing:  { label: 'เตรียมเอกสาร', color: 'secondary', step: 1 },
  submitted:  { label: 'ยื่นแล้ว', color: 'primary', step: 2 },
  reviewing:  { label: 'ระหว่างพิจารณา', color: 'warning', step: 3 },
  conditional:{ label: 'อนุมัติมีเงื่อนไข', color: 'warning', step: 4 },
  approved:   { label: 'อนุมัติแล้ว', color: 'success', step: 5 },
  rejected:   { label: 'ปฏิเสธ', color: 'danger', step: -1 },
  cancelled:  { label: 'ยกเลิก', color: 'secondary', step: -1 },
}

const BANKS = ['Krungthai LEASE','Ayudhya Capital','TISCO Financial','BBL Hire Purchase','KBank Leasing','SCB Auto','TTB Auto Finance','บัวหลวงลีสซิ่ง']

function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }

export default async function FinanceTrackerPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let statusFilter = 'all'
  let apps = []
  let loading = true

  async function loadData() {
    loading = true
    try { apps = await listDocs('finance_tracker', [], 'createdAt', 'desc', 300) } catch (e) { apps = [] }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function filtered() {
    return apps.filter(a => statusFilter === 'all' || a.status === statusFilter)
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-state-icon">⏳</div><div>กำลังโหลด...</div></div></div>`
      return
    }
    const list = filtered()
    const pending = apps.filter(a => ['preparing','submitted','reviewing','conditional'].includes(a.status)).length
    const approved = apps.filter(a => a.status === 'approved').length
    const totalLoan = apps.filter(a => a.status === 'approved').reduce((s, a) => s + a.loanAmount, 0)
    const rejected = apps.filter(a => a.status === 'rejected').length

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🏦 Finance Tracker</div>
            <div class="page-subtitle">ติดตามสถานะการยื่นไฟแนนซ์รายคัน</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="export-btn">📥 Export</button>
            <button class="btn btn-primary" id="add-app-btn">+ ยื่นไฟแนนซ์</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('⏳ กำลังดำเนินการ', pending, 'warning')}
          ${kpi('✅ อนุมัติแล้ว', approved, 'success')}
          ${kpi('💰 ยอดสินเชื่อรวม', formatCurrency(totalLoan), 'primary')}
          ${kpi('❌ ปฏิเสธ', rejected, rejected > 0 ? 'danger' : 'secondary')}
        </div>

        <!-- Status filter -->
        <div style="display:flex;gap:4px;margin-bottom:12px;flex-wrap:wrap">
          <button class="btn btn-sm ${statusFilter==='all'?'btn-primary':'btn-secondary'} sf-btn" data-s="all">ทั้งหมด</button>
          ${Object.entries(APP_STATUS).map(([k,v]) => `<button class="btn btn-sm ${statusFilter===k?'btn-'+v.color:'btn-secondary'} sf-btn" data-s="${k}">${v.label}</button>`).join('')}
        </div>

        <div style="display:flex;flex-direction:column;gap:10px">
          ${list.map(a => renderAppCard(a)).join('')}
          ${!list.length ? `<div class="empty-state"><div class="empty-state-icon">🏦</div><div>ไม่พบรายการ</div></div>` : ''}
        </div>
      </div>
    `

    container.querySelectorAll('.sf-btn').forEach(b => b.addEventListener('click', () => { statusFilter = b.dataset.s; renderPage() }))
    document.getElementById('add-app-btn')?.addEventListener('click', openAddForm)
    document.getElementById('export-btn')?.addEventListener('click', () => {
      exportToExcel(apps.map(a => ({ ID: a.id, ลูกค้า: a.customerName, รถ: a.vehicleModel, ธนาคาร: a.bank, สินเชื่อ: a.loanAmount, ดอกเบี้ย: a.interestRate, สถานะ: APP_STATUS[a.status]?.label })), 'finance_applications')
      showToast('📥 Export แล้ว!', 'success')
    })
    container.querySelectorAll('.open-app-btn').forEach(b => b.addEventListener('click', () => {
      const a = apps.find(x => x.id === b.dataset.id); if (a) openAppDetail(a)
    }))
    container.querySelectorAll('.update-status-btn').forEach(b => b.addEventListener('click', () => {
      const a = apps.find(x => x.id === b.dataset.id); if (a) openStatusUpdate(a)
    }))
    container.querySelectorAll('.del-app-btn').forEach(b => b.addEventListener('click', async () => {
      const a = apps.find(x => x.id === b.dataset.id); if (!a) return
      const ok = await confirmDialog({ title: '🗑️ ลบรายการ', message: `ยืนยันลบรายการของ "${escHtml(a.customerName)}"? การลบนี้ไม่สามารถย้อนกลับได้`, confirmText: 'ลบ', danger: true })
      if (!ok) return
      await softDelete('finance_tracker', a.id)
      showToast('🗑️ ลบรายการแล้ว', 'success')
      await loadData()
    }))
  }

  function renderAppCard(a) {
    const st = APP_STATUS[a.status]
    const steps = ['preparing','submitted','reviewing','conditional','approved']
    const currentStep = Math.max(steps.indexOf(a.status), 0)
    return `<div class="card" style="padding:14px;border-left:3px solid var(--${st?.color})">
      <div style="display:flex;align-items:flex-start;gap:12px">
        <div style="flex:1">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
            <span style="font-weight:700;font-size:0.9rem">${escHtml(a.customerName)}</span>
            <span class="badge badge-${st?.color}">${st?.label}</span>
            ${a.conditions ? `<span class="badge badge-warning" style="font-size:0.65rem">มีเงื่อนไข</span>` : ''}
          </div>
          <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:8px">${escHtml(a.vehicleModel)} · ${escHtml(a.bank)} · ${a.term} เดือน</div>
          <!-- Progress steps -->
          <div style="display:flex;align-items:center;gap:0;margin-bottom:8px">
            ${steps.map((s, i) => {
              const done = i <= currentStep && a.status !== 'rejected' && a.status !== 'cancelled'
              return `<div style="display:flex;align-items:center;flex:1">
                <div style="width:20px;height:20px;border-radius:50%;border:2px solid ${done?'var(--success)':'var(--border)'};background:${done?'var(--success)':'transparent'};display:flex;align-items:center;justify-content:center;font-size:0.6rem;color:${done?'white':'var(--text-muted)'};flex-shrink:0">${done?'✓':i+1}</div>
                ${i < steps.length-1 ? `<div style="flex:1;height:2px;background:${i<currentStep&&!['rejected','cancelled'].includes(a.status)?'var(--success)':'var(--border)'}"></div>` : ''}
              </div>`
            }).join('')}
          </div>
          <div style="display:flex;gap:16px;font-size:0.78rem">
            <span>💰 สินเชื่อ: <strong>${formatCurrency(a.loanAmount)}</strong></span>
            <span>📅 ผ่อน: <strong>${formatCurrency(a.monthlyPayment)}/เดือน</strong></span>
            <span>📊 ดอกเบี้ย: <strong>${a.interestRate}%</strong></span>
          </div>
          ${a.conditions ? `<div style="margin-top:6px;padding:6px 10px;background:rgba(245,158,11,.1);border-radius:var(--radius-sm);font-size:0.78rem;color:var(--warning)">⚠️ ${escHtml(a.conditions)}</div>` : ''}
          ${a.notes ? `<div style="margin-top:4px;font-size:0.75rem;color:var(--text-muted)">📌 ${escHtml(a.notes)}</div>` : ''}
        </div>
        <div style="display:flex;flex-direction:column;gap:4px">
          <button class="btn btn-xs btn-secondary open-app-btn" data-id="${a.id}">ดู</button>
          ${!['approved','rejected','cancelled'].includes(a.status) ? `<button class="btn btn-xs btn-primary update-status-btn" data-id="${a.id}">อัพเดท</button>` : ''}
          <button class="btn btn-xs btn-secondary del-app-btn" data-id="${a.id}">🗑️</button>
        </div>
      </div>
    </div>`
  }

  function openAppDetail(a) {
    const st = APP_STATUS[a.status]
    openModal({
      title: '🏦 ' + escHtml(a.id) + ' — ' + escHtml(a.customerName),
      size: 'md',
      body: `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
          <div>
            ${row('รถ', escHtml(a.vehicleModel))}${row('ราคา', formatCurrency(a.vehiclePrice))}${row('ดาวน์', formatCurrency(a.downPayment))}${row('สินเชื่อ', formatCurrency(a.loanAmount))}
          </div>
          <div>
            ${row('ธนาคาร', escHtml(a.bank))}${row('ระยะเวลา', a.term + ' เดือน')}${row('ผ่อน/เดือน', formatCurrency(a.monthlyPayment))}${row('ดอกเบี้ย', a.interestRate + '%/ปี')}
          </div>
        </div>
        <div style="margin-top:14px">
          ${row('สถานะ', `<span class="badge badge-${st?.color}">${st?.label}</span>`)}
          ${row('ยื่นวันที่', a.submittedDate ? formatDate(a.submittedDate) : 'ยังไม่ยื่น')}
          ${a.approvedDate ? row('อนุมัติวันที่', formatDate(a.approvedDate)) : ''}
          ${row('เซลส์', escHtml(a.salesperson))}
        </div>
        ${a.conditions ? `<div style="margin-top:12px;padding:10px;background:rgba(245,158,11,.1);border-radius:var(--radius-sm);font-size:0.83rem;color:var(--warning)">⚠️ เงื่อนไข: ${escHtml(a.conditions)}</div>` : ''}
        ${a.notes ? `<div style="margin-top:8px;padding:10px;background:var(--surface-2);border-radius:var(--radius-sm);font-size:0.82rem;color:var(--text-muted)">📌 ${escHtml(a.notes)}</div>` : ''}
      `
    })
  }

  function openStatusUpdate(a) {
    const nextStatuses = Object.entries(APP_STATUS).filter(([k]) => !['preparing'].includes(k))
    openModal({
      title: '🔄 อัพเดทสถานะ — ' + escHtml(a.customerName),
      size: 'sm',
      body: `
        <div class="input-group"><label class="input-label">สถานะใหม่</label>
          <select class="input" id="su-status">
            ${nextStatuses.map(([k,v]) => `<option value="${k}" ${a.status===k?'selected':''}>${v.label}</option>`).join('')}
          </select>
        </div>
        <div class="input-group" style="margin-top:10px"><label class="input-label">หมายเหตุ / เงื่อนไข</label>
          <textarea class="input" id="su-notes" rows="2" placeholder="บันทึกเพิ่มเติม...">${escHtml(a.notes)}</textarea>
        </div>
      `,
      confirmLabel: 'บันทึก',
      async onConfirm() {
        const newStatus = document.getElementById('su-status')?.value
        if (!newStatus) return
        const patch = { status: newStatus, notes: document.getElementById('su-notes')?.value || a.notes }
        if (newStatus === 'approved') patch.approvedDate = addDays(0)
        if (newStatus === 'submitted') patch.submittedDate = addDays(0)
        await updateDocData('finance_tracker', a.id, patch)
        try {
          await createDoc('notifications', {
            type: 'finance',
            title: newStatus === 'approved' ? 'ไฟแนนซ์อนุมัติแล้ว' : `สถานะไฟแนนซ์: ${APP_STATUS[newStatus]?.label}`,
            body: `${a.customerName} — ${a.vehicleModel} (${a.bank})`,
            read: false, link: '/finance/tracker', createdAt: new Date().toISOString(),
          })
          setState('unreadCount', (getState('unreadCount') || 0) + 1)
        } catch { /* แจ้งเตือนพลาดได้ ไม่กระทบสถานะที่บันทึกไปแล้ว */ }
        showToast(`✅ อัพเดทสถานะ ${a.id} เป็น "${APP_STATUS[newStatus]?.label}" แล้ว`, 'success')
        await loadData()
      }
    })
  }

  function openAddForm() {
    openModal({
      title: '+ ยื่นไฟแนนซ์ใหม่',
      size: 'lg',
      body: `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="input-group"><label class="input-label">ชื่อลูกค้า *</label><input class="input" id="af-name" placeholder="ชื่อ-นามสกุล"></div>
          <div class="input-group"><label class="input-label">โทรศัพท์</label><input class="input" id="af-phone" placeholder="08x-xxx-xxxx"></div>
          <div class="input-group"><label class="input-label">รุ่นรถ</label><input class="input" id="af-model" placeholder="BYD Seal AWD"></div>
          <div class="input-group"><label class="input-label">ราคารถ (บาท)</label><input type="number" class="input" id="af-price" placeholder="1449000"></div>
          <div class="input-group"><label class="input-label">เงินดาวน์ (บาท)</label><input type="number" class="input" id="af-down" placeholder="290000"></div>
          <div class="input-group"><label class="input-label">ธนาคาร *</label><select class="input" id="af-bank">${BANKS.map(b => `<option>${b}</option>`).join('')}</select></div>
          <div class="input-group"><label class="input-label">ระยะเวลา (เดือน)</label><select class="input" id="af-term"><option>48</option><option selected>60</option><option>72</option><option>84</option></select></div>
          <div class="input-group"><label class="input-label">ดอกเบี้ย (% ต่อปี)</label><input type="number" class="input" id="af-rate" step="0.01" value="2.99"></div>
          <div class="input-group"><label class="input-label">เซลส์</label><input class="input" id="af-sales" placeholder="ชื่อเซลส์"></div>
          <div class="input-group"><label class="input-label">หมายเหตุ</label><input class="input" id="af-notes" placeholder="บันทึก..."></div>
        </div>
      `,
      async onConfirm() {
        const name = document.getElementById('af-name')?.value?.trim()
        if (!name) { showToast('❗ กรุณากรอกชื่อลูกค้า', 'error'); return }
        const price = +document.getElementById('af-price')?.value || 0
        const down = +document.getElementById('af-down')?.value || 0
        const loan = price - down
        const term = +document.getElementById('af-term')?.value || 60
        const rate = +document.getElementById('af-rate')?.value || 2.99
        const monthly = Math.round(loan * (1 + rate / 100 * term / 12) / term)
        await createDoc('finance_tracker', {
          customerId: '', customerName: name, phone: document.getElementById('af-phone')?.value||'',
          vehicleModel: document.getElementById('af-model')?.value||'',
          vehiclePrice: price, downPayment: down, loanAmount: loan,
          bank: document.getElementById('af-bank')?.value||'',
          term, monthlyPayment: monthly, interestRate: rate,
          status: 'preparing', submittedDate: null, approvedDate: null, conditions: '',
          salesperson: document.getElementById('af-sales')?.value||'',
          notes: document.getElementById('af-notes')?.value||''
        })
        showToast('✅ บันทึกการยื่นไฟแนนซ์แล้ว!', 'success')
        await loadData()
      }
    })
  }

  await loadData()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
function row(l, v) { return `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);font-size:0.82rem"><span style="color:var(--text-muted)">${l}</span><span>${v}</span></div>` }
