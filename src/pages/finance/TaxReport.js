import { formatCurrency, formatDate, todayBangkok } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { exportToExcel } from '../../utils/importExport.js'
import { getSalesData, listDocs, listAllDocs, createDoc, updateDocData } from '../../core/db.js'

function escHtml(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }

const TAX_TYPES = {
  pp30:  { label: 'ภพ.30 (VAT)', color: 'primary', due: 15 },
  pp36:  { label: 'ภพ.36 (VAT นำเข้า)', color: 'warning', due: 7 },
  pnd1:  { label: 'ภงด.1 (หัก ณ ที่จ่ายรายเดือน)', color: 'success', due: 7 },
  pnd3:  { label: 'ภงด.3 (บุคคลธรรมดา)', color: 'secondary', due: 7 },
  pnd53: { label: 'ภงด.53 (นิติบุคคล)', color: 'secondary', due: 7 },
  pnd51: { label: 'ภงด.51 (กลางปี)', color: 'danger', due: 30 },
  pnd50: { label: 'ภงด.50 (ประจำปี)', color: 'danger', due: 150 },
}

const FILING_STATUS = {
  pending:  { label: 'รอยื่น', color: 'warning' },
  filed:    { label: 'ยื่นแล้ว', color: 'success' },
  late:     { label: 'ยื่นช้า', color: 'danger' },
  amended:  { label: 'แก้ไข', color: 'secondary' },
}

// เดิม new Date().setMonth() คืนเดือนตาม UTC เสมอ ทำให้ "เดือนนี้" ผิดไป 1 วันทุกครั้งที่เวลาไทยยังไม่ถึง
// 07:00 น. (เที่ยงคืน UTC ตรงกับเวลาไทย 07:00 น.) — แก้ให้ยึดวันที่ไทยจริงจาก todayBangkok() เป็นจุดตั้งต้นเสมอ
// แล้วบวก/ลบเดือนด้วย UTC methods (ไม่ผูกกับ timezone ของเครื่อง/เบราว์เซอร์ผู้ใช้)
function addMonths(n) {
  const [y, m, d] = todayBangkok().split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCMonth(dt.getUTCMonth() + n)
  return dt.toISOString().slice(0, 7)
}
function thisMonth() { return todayBangkok().slice(0, 7) }

// (v1.0.487) ราคา/ต้นทุนรถและมูลค่า PO เก็บเป็น "ราคารวม VAT แล้ว" เสมอตามกฎหมาย (ยืนยันใน
// QuotationBuilder.js) — เดิมแท็บ "ใบกำกับภาษี" ในไฟล์นี้เอาราคารวม VAT ไปคูณ 7% ซ้ำอีกชั้น ทำให้ VAT สูงเกิน
// จริง ~6.5% (ขัดแย้งกันเองกับ KPI "VAT สะสม" ด้านบนที่ใช้สูตรถูกอยู่แล้วที่บรรทัด pp30 taxBase/vatAmount)
// แก้ให้ใช้สูตรถอด VAT เดียวกัน (fullPrice × 7/107) ทั้งไฟล์ — ดู extractVat() เดียวกันใน VatReport.js
function extractVat(fullPrice) {
  const vat = Math.round((fullPrice || 0) * 7 / 107)
  return { amount: (fullPrice || 0) - vat, vat }
}

const DEMO_FILINGS = [
  { id: 'TX001', type: 'pp30', period: addMonths(-1), dueDate: `${addMonths(-1)}-15`, filedDate: `${addMonths(-1)}-14`, status: 'filed', taxBase: 4820000, vatAmount: 337400, refundable: 0, notes: 'ยื่นออนไลน์', officer: 'นิภา บัญชีดี' },
  { id: 'TX002', type: 'pnd53', period: addMonths(-1), dueDate: `${addMonths(-1)}-07`, filedDate: `${addMonths(-1)}-07`, status: 'filed', taxBase: 285000, vatAmount: 28500, refundable: 0, notes: '', officer: 'นิภา บัญชีดี' },
  { id: 'TX003', type: 'pnd1', period: addMonths(-1), dueDate: `${addMonths(-1)}-07`, filedDate: `${addMonths(-1)}-06`, status: 'filed', taxBase: 520000, vatAmount: 38400, refundable: 0, notes: 'เงินเดือนพนักงาน 12 คน', officer: 'นิภา บัญชีดี' },
  { id: 'TX004', type: 'pp30', period: thisMonth(), dueDate: `${thisMonth()}-15`, filedDate: null, status: 'pending', taxBase: 5120000, vatAmount: 358400, refundable: 0, notes: '', officer: 'นิภา บัญชีดี' },
  { id: 'TX005', type: 'pnd1', period: thisMonth(), dueDate: `${thisMonth()}-07`, filedDate: null, status: 'pending', taxBase: 540000, vatAmount: 39200, refundable: 0, notes: '', officer: 'นิภา บัญชีดี' },
  { id: 'TX006', type: 'pnd51', period: addMonths(-6), dueDate: `${addMonths(-6)}-31`, filedDate: `${addMonths(-6)}-29`, status: 'filed', taxBase: 3200000, vatAmount: 320000, refundable: 0, notes: 'ภาษีกลางปี', officer: 'นิภา บัญชีดี' },
]

const DEMO_INVOICES = [
  { id: 'INV001', vendor: 'BYD Auto Thailand', date: `${addMonths(-1)}-05`, ...extractVat(8740000), withheld: 87400, type: 'purchase', taxInvNo: 'TIV0001234' },
  { id: 'INV002', vendor: 'LAMOM ONE (ขาย)', date: `${addMonths(-1)}-08`, ...extractVat(1449000), withheld: 0, type: 'sale', taxInvNo: 'TSV0009821' },
  { id: 'INV003', vendor: 'AIS Fiber', date: `${addMonths(-1)}-01`, ...extractVat(3200), withheld: 96, type: 'purchase', taxInvNo: 'TIV0001235' },
  { id: 'INV004', vendor: 'สำนักงานบัญชีดี', date: `${addMonths(-1)}-01`, ...extractVat(15000), withheld: 1500, type: 'purchase', taxInvNo: 'TIV0001236' },
]

export default async function TaxReportPage(container) {
  const myGen = container.__routerGen
  let tab = 'filings'
  let filingFilter = 'all'
  let liveVatBase = null
  // เดิมสถานะ "ยื่นแล้ว/ยื่นช้า" ที่กดจากปุ่มในหน้านี้อยู่ใน DEMO_FILINGS (ตัวแปร module-level) ในหน่วยความจำ
  // เท่านั้น รีเฟรชหน้าแล้วหายทุกครั้ง (ทีมบัญชีคิดว่ายื่นแล้วแต่ระบบไม่จำ) แก้ให้บันทึกจริงลง Firestore
  // collection ใหม่ tax_filings — filing จาก DEMO_FILINGS ใช้ baseId อ้างกลับ ส่วน filing ที่สร้างเองใหม่
  // ถือเป็นเอกสารของตัวเอง ไม่มี baseId
  let filings = DEMO_FILINGS.map(f => ({ ...f }))
  let sales = []

  try {
    sales = await getSalesData().catch(() => [])
    if (container.__routerGen !== myGen) return
    if (sales.length >= 2) {
      const now = new Date()
      const thisMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`
      const currSales = sales.filter(s => (s.bookingDate || s.deliveryDate || '').startsWith(thisMonth))
      if (currSales.length) {
        const totalRev = currSales.reduce((a, s) => a + (s.salePrice || 0), 0)
        liveVatBase = { taxBase: Math.round(totalRev / 1.07), vatAmount: Math.round(totalRev / 1.07 * 0.07) }
        const pp30 = filings.find(f => f.type === 'pp30' && f.period === thisMonth)
        if (pp30) { pp30.taxBase = liveVatBase.taxBase; pp30.vatAmount = liveVatBase.vatAmount }
      }
    }
  } catch {}

  try {
    const filingDocs = await listDocs('tax_filings', [], 'createdAt', 'desc', 300)
    if (container.__routerGen !== myGen) return
    filingDocs.slice().reverse().forEach(fd => {
      if (fd.baseId) {
        const base = filings.find(x => x.id === fd.baseId)
        if (base) { base.status = fd.status; base.filedDate = fd.filedDate }
      } else {
        const existing = filings.find(x => x.id === fd.id)
        if (existing) Object.assign(existing, fd, { id: fd.id })
        else filings.push({ ...fd, _custom: true })
      }
    })
  } catch {}

  // (v1.0.321) เดิม KPI "WHT สะสม" และแท็บ "ใบกำกับภาษี" ทั้งแท็บใช้ DEMO_INVOICES 4 รายการตายตัวเสมอ
  // ไม่มีทางเป็นข้อมูลจริงได้เลย ทั้งที่ระบบมีข้อมูลจริงพร้อมใช้อยู่แล้ว: ภาษีขายจากยอดขายรถจริง
  // (getSalesData เหมือนที่ VatReport.js ใช้ v1.0.320), ภาษีซื้อจากต้นทุนรถจริง + ใบสั่งซื้อจริงที่รับแล้ว
  // (purchase_orders), และ WHT จริงจากหนังสือรับรองหัก ณ ที่จ่ายที่ออกจริง (withholding_tax_certs — มีหน้า
  // WithholdingTax.js ออกใบจริงอยู่แล้ว) ใช้ของปลอมเฉพาะตอนยังไม่มีข้อมูลจริงเลยสักรายการเท่านั้น
  let liveInvoices = null
  let liveTotalWH = 0
  try {
    const out = [], inp = []
    sales.forEach(s => {
      const d = (s.date || '').slice(0, 10)
      if (!d) return
      if (s.salePrice > 0) out.push({ id: 'INV-'+s.id, vendor: s.custName || 'ลูกค้า', date: d, ...extractVat(s.salePrice), withheld: 0, type: 'sale', taxInvNo: 'TSV-'+s.id })
      if (s.cost > 0) inp.push({ id: 'PO-'+s.id, vendor: s.brand || 'ผู้จัดจำหน่ายรถ', date: d, ...extractVat(s.cost), withheld: 0, type: 'purchase', taxInvNo: 'TIV-'+s.id })
    })
    try {
      const pos = await listAllDocs('purchase_orders', [], 'requestDate', 'desc')
      pos.filter(p => p.status === 'received' && p.cat !== 'vehicle' && p.amount > 0).forEach(p => {
        const d = (p.requestDate || '').slice(0, 10)
        if (!d) return
        inp.push({ id: 'PO-'+p.id, vendor: p.supplier || 'ผู้จัดหา', date: d, ...extractVat(p.amount), withheld: 0, type: 'purchase', taxInvNo: 'TIV-'+p.id })
      })
    } catch {}
    const wht = []
    try {
      const certs = await listAllDocs('withholding_tax_certs', [], 'paymentDate', 'desc')
      certs.forEach(c => {
        const d = (c.paymentDate || '').slice(0, 10)
        if (!d) return
        wht.push({ id: c.id, vendor: c.payeeName || 'ผู้รับเงิน', date: d, amount: c.amountPaid || 0, vat: 0, withheld: c.taxWithheld || 0, type: 'purchase', taxInvNo: c.certNo || c.id })
      })
    } catch {}
    if (container.__routerGen !== myGen) return
    if (out.length || inp.length || wht.length) {
      liveInvoices = [...out, ...inp, ...wht]
      liveTotalWH = wht.reduce((a, w) => a + w.withheld, 0)
    }
  } catch {}

  function filteredFilings() {
    return filings.filter(f => filingFilter === 'all' || f.status === filingFilter)
      .sort((a, b) => b.dueDate.localeCompare(a.dueDate))
  }

  const today = todayBangkok()
  function isOverdue(f) { return f.status === 'pending' && f.dueDate < today }
  function daysUntilDue(f) {
    const diff = Math.ceil((new Date(f.dueDate) - new Date(today)) / 86400000)
    return diff
  }

  function renderPage() {
    const filteredList = filteredFilings()
    const pending = filings.filter(f => f.status === 'pending').length
    const overdue = filings.filter(f => isOverdue(f)).length
    // เดิมรวม vatAmount ของทุกประเภทการยื่นเข้าด้วยกันหมด รวม pnd1/pnd53/pnd51 (ภาษีหัก ณ ที่จ่าย ไม่ใช่ VAT)
    // เข้าไปใน KPI "VAT สะสม" ด้วย ทำให้ตัวเลขเพี้ยนสูงกว่า VAT จริงมาก — กรองเหลือแค่ pp30 (VAT ตัวจริง)
    const totalVat = filings.filter(f => f.type === 'pp30').reduce((a, f) => a + f.vatAmount, 0)
    const totalWH = liveInvoices ? liveTotalWH : DEMO_INVOICES.reduce((a, i) => a + i.withheld, 0)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🧾 Tax Report</div>
            <div class="page-subtitle">ภาษีมูลค่าเพิ่ม (VAT) และภาษีหัก ณ ที่จ่าย${liveVatBase ? ' <span style="color:var(--success);font-size:0.75rem">● VAT จากยอดขายจริง</span>' : ''}</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="export-btn">📥 Export</button>
            <button class="btn btn-primary" id="add-filing-btn">+ บันทึกการยื่น</button>
          </div>
        </div>

        <!-- KPIs -->
        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('⏳ รอยื่น', pending, 'warning')}
          ${kpi('❗ เกินกำหนด', overdue, overdue > 0 ? 'danger' : 'secondary')}
          ${kpi('💰 VAT สะสม', formatCurrency(totalVat), 'primary')}
          ${kpi('🔒 WHT สะสม', formatCurrency(totalWH), 'success')}
        </div>

        <!-- Tabs -->
        <div class="tab-nav" style="margin-bottom:14px">
          ${[['filings','📋 รายการยื่น'],['invoices','🧾 ใบกำกับภาษี'],['calendar','📅 ปฏิทินภาษี']].map(([t,l]) => `<button class="tab-btn ${tab===t?'active':''}" data-tab="${t}">${l}</button>`).join('')}
        </div>

        ${tab === 'filings' ? renderFilings(filteredList) : tab === 'invoices' ? renderInvoices() : renderCalendar()}
      </div>
    `

    container.querySelectorAll('.tab-btn').forEach(b => b.addEventListener('click', () => { tab = b.dataset.tab; renderPage() }))
    container.querySelectorAll('.ff-btn').forEach(b => b.addEventListener('click', () => { filingFilter = b.dataset.f; renderPage() }))
    document.getElementById('add-filing-btn')?.addEventListener('click', openFilingForm)
    document.getElementById('export-btn')?.addEventListener('click', () => {
      exportToExcel(filings.map(f => ({ ID: f.id, ประเภท: TAX_TYPES[f.type]?.label, งวด: f.period, ครบกำหนด: f.dueDate, สถานะ: FILING_STATUS[f.status]?.label, 'ฐานภาษี': f.taxBase, 'ภาษี': f.vatAmount })), 'tax_report')
      showToast('📥 Export แล้ว!', 'success')
    })
    container.querySelectorAll('.open-filing-btn').forEach(b => b.addEventListener('click', () => {
      const f = filings.find(x => x.id === b.dataset.id); if (f) openFilingDetail(f)
    }))
    container.querySelectorAll('.file-now-btn').forEach(b => b.addEventListener('click', async () => {
      const f = filings.find(x => x.id === b.dataset.id)
      if (!f) return
      const newStatus = isOverdue(f) ? 'late' : 'filed'
      try {
        if (f._custom) await updateDocData('tax_filings', f.id, { status: newStatus, filedDate: today })
        else await createDoc('tax_filings', { baseId: f.id, status: newStatus, filedDate: today })
        f.status = newStatus; f.filedDate = today
        showToast(`✅ บันทึกการยื่น ${TAX_TYPES[f.type]?.label} แล้ว`, 'success')
        renderPage()
      } catch { showToast('บันทึกไม่สำเร็จ', 'error') }
    }))
  }

  function renderFilings(filings) {
    return `<div>
      <div style="display:flex;gap:4px;margin-bottom:12px">
        <button class="btn btn-sm ${filingFilter==='all'?'btn-primary':'btn-secondary'} ff-btn" data-f="all">ทั้งหมด</button>
        ${Object.entries(FILING_STATUS).map(([k,v]) => `<button class="btn btn-sm ${filingFilter===k?'btn-'+v.color:'btn-secondary'} ff-btn" data-f="${k}">${v.label}</button>`).join('')}
      </div>
      <div class="card" style="padding:0;overflow:hidden">
        <div class="table-wrap"><table class="table">
          <thead><tr><th>รหัส</th><th>ประเภท</th><th>งวด</th><th>ครบกำหนด</th><th>ฐานภาษี</th><th>ภาษี</th><th>สถานะ</th><th></th></tr></thead>
          <tbody>
            ${filings.map(f => {
              const tt = TAX_TYPES[f.type]
              const st = FILING_STATUS[f.status]
              const overdue = isOverdue(f)
              const days = daysUntilDue(f)
              return `<tr>
                <td style="font-family:monospace;font-size:0.8rem">${f.id}</td>
                <td><span class="badge badge-${tt?.color}">${tt?.label}</span></td>
                <td style="font-size:0.83rem">${f.period}</td>
                <td>
                  <div style="font-size:0.83rem;color:${overdue ? 'var(--danger)' : days <= 3 && f.status==='pending' ? 'var(--warning)' : 'inherit'}">${formatDate(f.dueDate)}</div>
                  ${f.status === 'pending' ? `<div style="font-size:0.7rem;color:var(--text-muted)">${overdue ? '❗ เกิน '+Math.abs(days)+' วัน' : days <= 3 ? '⚠️ อีก '+days+' วัน' : 'อีก '+days+' วัน'}</div>` : ''}
                </td>
                <td class="text-right" style="font-size:0.83rem">${formatCurrency(f.taxBase)}</td>
                <td class="text-right" style="font-size:0.83rem;font-weight:700;color:var(--${tt?.color})">${formatCurrency(f.vatAmount)}</td>
                <td><span class="badge badge-${st?.color}">${st?.label}</span></td>
                <td>
                  <div style="display:flex;gap:4px">
                    <button class="btn btn-xs btn-secondary open-filing-btn" data-id="${f.id}">ดู</button>
                    ${f.status === 'pending' ? `<button class="btn btn-xs btn-success file-now-btn" data-id="${f.id}">✓ ยื่นแล้ว</button>` : ''}
                  </div>
                </td>
              </tr>`
            }).join('')}
            ${!filings.length ? `<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--text-muted)">ไม่พบรายการ</td></tr>` : ''}
          </tbody>
        </table></div>
      </div>
    </div>`
  }

  function renderInvoices() {
    const invoices = liveInvoices || DEMO_INVOICES
    const inputVat = invoices.filter(i => i.type === 'purchase').reduce((a, i) => a + i.vat, 0)
    const outputVat = invoices.filter(i => i.type === 'sale').reduce((a, i) => a + i.vat, 0)
    const netVat = outputVat - inputVat
    return `
      ${liveInvoices ? '' : `<div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:10px">Demo (ยังไม่มีข้อมูลจริง)</div>`}
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:14px">
        ${kpi('📤 VAT ขาออก', formatCurrency(outputVat), 'success')}
        ${kpi('📥 VAT ขาเข้า', formatCurrency(inputVat), 'warning')}
        ${kpi(netVat >= 0 ? '💸 ภาษีที่ต้องชำระ' : '💰 ขอคืน', formatCurrency(Math.abs(netVat)), netVat >= 0 ? 'danger' : 'success')}
      </div>
      <div class="card" style="padding:0;overflow:hidden">
        <div class="table-wrap"><table class="table">
          <thead><tr><th>เลขใบกำกับ</th><th>คู่ค้า</th><th>วันที่</th><th>ประเภท</th><th>มูลค่า</th><th>VAT</th><th>WHT</th></tr></thead>
          <tbody>
            ${invoices.map(i => `<tr>
              <td style="font-family:monospace;font-size:0.78rem">${escHtml(i.taxInvNo)}</td>
              <td style="font-size:0.83rem">${escHtml(i.vendor)}</td>
              <td style="font-size:0.82rem">${formatDate(i.date)}</td>
              <td><span class="badge badge-${i.type==='sale'?'success':'warning'}">${i.type==='sale'?'ขาออก':'ขาเข้า'}</span></td>
              <td class="text-right" style="font-size:0.83rem">${formatCurrency(i.amount)}</td>
              <td class="text-right" style="font-size:0.83rem;color:var(--${i.type==='sale'?'success':'warning'})">${formatCurrency(i.vat)}</td>
              <td class="text-right" style="font-size:0.83rem">${i.withheld ? formatCurrency(i.withheld) : '-'}</td>
            </tr>`).join('')}
            ${!invoices.length ? `<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--text-muted)">ไม่พบรายการ</td></tr>` : ''}
          </tbody>
        </table></div>
      </div>`
  }

  function renderCalendar() {
    const months = Array.from({ length: 12 }, (_, i) => i)
    const MONTH_TH = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']
    const currentMonth = new Date().getMonth()
    return `
      <div class="card" style="padding:14px">
        <div style="font-weight:700;font-size:0.85rem;margin-bottom:12px">📅 ปฏิทินภาษี 2025</div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px">
          ${months.map(m => {
            const isPast = m < currentMonth
            const isCurrent = m === currentMonth
            const duties = []
            if (m < 11) duties.push({ label: 'ภพ.30 (VAT)', due: 15, color: 'primary' })
            duties.push({ label: 'ภงด.1', due: 7, color: 'success' })
            duties.push({ label: 'ภงด.53', due: 7, color: 'secondary' })
            if (m === 5) duties.push({ label: 'ภงด.51 (กลางปี)', due: 31, color: 'danger' })
            if (m === 4) duties.push({ label: 'ภงด.50 (ประจำปี)', due: 31, color: 'danger' })
            return `<div style="padding:10px;background:${isCurrent?'var(--primary-dim)':'var(--surface-2)'};border-radius:var(--radius-sm);border:${isCurrent?'1px solid var(--primary)':'1px solid var(--border)'}">
              <div style="font-weight:700;font-size:0.82rem;margin-bottom:6px;color:${isCurrent?'var(--primary)':isPast?'var(--text-muted)':'inherit'}">${MONTH_TH[m]}${isCurrent?' ← ปัจจุบัน':''}</div>
              ${duties.map(d => `<div style="font-size:0.72rem;padding:2px 6px;border-radius:3px;background:var(--${d.color}-dim,var(--surface));color:var(--${d.color});margin-bottom:2px">วันที่ ${d.due}: ${d.label}</div>`).join('')}
            </div>`
          }).join('')}
        </div>
      </div>`
  }

  function openFilingDetail(f) {
    const tt = TAX_TYPES[f.type]
    const st = FILING_STATUS[f.status]
    openModal({
      title: `🧾 ${f.id} — ${tt?.label}`,
      size: 'md',
      body: `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
          <div>
            ${row('งวด', f.period)}${row('ครบกำหนด', formatDate(f.dueDate))}${row('ยื่นวันที่', f.filedDate ? formatDate(f.filedDate) : '-')}
            ${row('ผู้รับผิดชอบ', f.officer)}${row('สถานะ', `<span class="badge badge-${st?.color}">${st?.label}</span>`)}
          </div>
          <div>
            ${row('ฐานภาษี', formatCurrency(f.taxBase))}${row('ภาษี', `<strong style="color:var(--${tt?.color})">${formatCurrency(f.vatAmount)}</strong>`)}
            ${row('ขอคืน', formatCurrency(f.refundable))}
          </div>
        </div>
        ${f.notes ? `<div style="margin-top:12px;padding:10px;background:var(--surface-2);border-radius:var(--radius-sm);font-size:0.82rem">📌 ${escHtml(f.notes)}</div>` : ''}
      `,
      footer: f.status === 'pending' ? `<button class="btn btn-success mark-filed-btn" data-id="${f.id}">✓ บันทึกว่ายื่นแล้ว</button>` : ''
    })
    setTimeout(() => {
      document.querySelector('.modal .mark-filed-btn')?.addEventListener('click', async () => {
        const filing = filings.find(x => x.id === f.id)
        if (!filing) return
        const newStatus = isOverdue(filing) ? 'late' : 'filed'
        try {
          if (filing._custom) await updateDocData('tax_filings', filing.id, { status: newStatus, filedDate: today })
          else await createDoc('tax_filings', { baseId: filing.id, status: newStatus, filedDate: today })
          filing.status = newStatus; filing.filedDate = today
          document.querySelector('.modal-close-btn')?.click()
          showToast('✅ บันทึกการยื่นแล้ว!', 'success')
          renderPage()
        } catch { showToast('บันทึกไม่สำเร็จ', 'error') }
      })
    }, 50)
  }

  function openFilingForm() {
    openModal({
      title: '+ บันทึกการยื่นภาษี',
      size: 'md',
      body: `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="input-group" style="grid-column:1/-1">
            <label class="input-label">ประเภทภาษี *</label>
            <select class="input" id="ff-type">
              ${Object.entries(TAX_TYPES).map(([k,v]) => `<option value="${k}">${v.label}</option>`).join('')}
            </select>
          </div>
          <div class="input-group"><label class="input-label">งวด (เดือน-ปี)</label><input type="month" class="input" id="ff-period" value="${thisMonth()}"></div>
          <div class="input-group"><label class="input-label">วันครบกำหนด</label><input type="date" class="input" id="ff-due"></div>
          <div class="input-group"><label class="input-label">ฐานภาษี (บาท)</label><input type="number" class="input" id="ff-base" placeholder="0"></div>
          <div class="input-group"><label class="input-label">ภาษี (บาท)</label><input type="number" class="input" id="ff-tax" placeholder="0"></div>
          <div class="input-group" style="grid-column:1/-1"><label class="input-label">หมายเหตุ</label><textarea class="input" id="ff-notes" rows="2" placeholder="บันทึกเพิ่มเติม..."></textarea></div>
        </div>
      `,
      async onConfirm() {
        const type = document.getElementById('ff-type')?.value
        const period = document.getElementById('ff-period')?.value
        if (!type || !period) { showToast('❗ กรุณากรอกข้อมูลที่จำเป็น', 'error'); return }
        const newFiling = {
          type, period, dueDate: document.getElementById('ff-due')?.value||'',
          filedDate: null, status: 'pending',
          taxBase: +document.getElementById('ff-base')?.value||0,
          vatAmount: +document.getElementById('ff-tax')?.value||0,
          refundable: 0, notes: document.getElementById('ff-notes')?.value||'',
          officer: 'นิภา บัญชีดี'
        }
        try {
          const id = await createDoc('tax_filings', newFiling)
          filings.unshift({ id, ...newFiling, _custom: true })
          showToast('✅ บันทึกการยื่นภาษีแล้ว!', 'success')
          renderPage()
        } catch { showToast('บันทึกไม่สำเร็จ', 'error') }
      }
    })
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
function row(l, v) { return `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);font-size:0.82rem"><span style="color:var(--text-muted)">${l}</span><span>${v}</span></div>` }
