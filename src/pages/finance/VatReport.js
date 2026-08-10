/**
 * VAT Report — รายงานภาษีมูลค่าเพิ่ม
 * Route: /finance/vat
 */
import { formatCurrency, formatDate, todayBangkok } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { getSalesData, listAllDocs } from '../../core/db.js'
import { exportToExcel } from '../../utils/importExport.js'

function escHtml(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }

function addMonths(n) {
  const [y, m, d] = todayBangkok().split('-').map(Number)
  return new Date(Date.UTC(y, m - 1 + n, d)).toISOString().slice(0, 7)
}
function addDays(n) {
  const [y, m, d] = todayBangkok().split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

const VAT_RATE = 0.07

// (v1.0.320) เดิมถ้ามีข้อมูลจริงจาก collection 'vat_invoices' (ที่จริงไม่มีหน้าไหนในระบบเคยเขียนเข้าไปเลย
// แม้แต่รายการเดียว — เป็น collection ที่เตรียมชื่อไว้แต่ไม่ได้ใช้จริง) ก็จะเอาใบกำกับปลอมด้านล่างนี้
// (DEMO_INVOICES_OUT/IN) ผสมเข้าไปถาวรอยู่ดี ทำให้ "ภาษีสุทธิ" ที่ต้องชำระ/ขอคืนผิดจากความจริงเสมอ และ
// ปุ่มเปลี่ยนเดือน (◀/เดือนนี้) ก็ไม่ได้กรองข้อมูลตามเดือนที่เลือกจริงเลย (แค่เปลี่ยน label) — แก้ให้สร้าง
// ใบกำกับภาษีขาย/ซื้อจากข้อมูลจริงที่มีอยู่แล้วในระบบแทน: ขาออกจากยอดขายจริง (getSalesData), ขาเข้าจาก
// ต้นทุนรถจริงของแต่ละใบจอง (b.cost จริง ไม่ใช่ประมาณ 82% แบบที่ CashFlow.js เคยใช้) + ใบสั่งซื้อจริงที่
// สถานะ "รับแล้ว" (purchase_orders) สำหรับรายการที่ไม่ใช่รถ ใช้ของปลอมเฉพาะตอนยังไม่มีข้อมูลจริงเลยเท่านั้น
// และกรองตามเดือนที่เลือกจริงแล้ว (ไม่ใช่รวมทุกเดือนเข้าด้วยกันเหมือนเดิม)
const PO_CAT_LABELS = { vehicle: 'รถยนต์', parts: 'อะไหล่', supplies: 'อุปกรณ์', service: 'บริการ' }

const DEMO_INVOICES_OUT = [ // ขาออก
  { id: 'INV001', date: addDays(-5), customer: 'สมชาย ใจดี', amount: 1299000, vat: Math.round(1299000*VAT_RATE), category: 'รถยนต์' },
  { id: 'INV002', date: addDays(-7), customer: 'มาลี สุขใจ', amount: 899000, vat: Math.round(899000*VAT_RATE), category: 'รถยนต์' },
  { id: 'INV003', date: addDays(-10), customer: 'ABC Co Ltd', amount: 12500, vat: Math.round(12500*VAT_RATE), category: 'บริการ' },
  { id: 'INV004', date: addDays(-12), customer: 'ธนพล เที่ยงตรง', amount: 3500, vat: Math.round(3500*VAT_RATE), category: 'อะไหล่' },
  { id: 'INV005', date: addDays(-15), customer: 'SCG Group', amount: 75000, vat: Math.round(75000*VAT_RATE), category: 'ประกัน' },
]

const DEMO_INVOICES_IN = [ // ขาเข้า
  { id: 'PO001', date: addDays(-3), supplier: 'BYD Auto Thailand', amount: 8990000, vat: Math.round(8990000*VAT_RATE), category: 'ต้นทุนรถ' },
  { id: 'PO002', date: addDays(-8), supplier: 'บริษัทอะไหล่ไทย', amount: 45000, vat: Math.round(45000*VAT_RATE), category: 'อะไหล่' },
  { id: 'PO003', date: addDays(-10), supplier: 'True Corp', amount: 3500, vat: Math.round(3500*VAT_RATE), category: 'ค่าโทรศัพท์' },
  { id: 'PO004', date: addDays(-14), supplier: 'AXA Insurance', amount: 18000, vat: Math.round(18000*VAT_RATE), category: 'ประกันบริษัท' },
]

export default async function VatReportPage(container) {
  const myGen = container.__routerGen
  let viewMonth = addMonths(0)
  let activeTab = 'summary'
  let allInvoicesOut = []
  let allInvoicesIn = []
  let dataSource = 'demo'

  async function loadData() {
    const out = []
    const inp = []
    try {
      const sales = await getSalesData()
      sales.forEach(s => {
        const d = (s.date || '').slice(0, 10)
        if (!d) return
        if (s.salePrice > 0) out.push({ id: 'INV-' + s.id, date: d, customer: s.custName || 'ลูกค้า',
          amount: s.salePrice, vat: Math.round(s.salePrice * VAT_RATE), category: 'รถยนต์' })
        if (s.cost > 0) inp.push({ id: 'PO-' + s.id, date: d, supplier: s.brand || 'ผู้จัดจำหน่ายรถ',
          amount: s.cost, vat: Math.round(s.cost * VAT_RATE), category: 'ต้นทุนรถ' })
      })
    } catch {}
    try {
      const pos = await listAllDocs('purchase_orders', [], 'requestDate', 'desc')
      pos.filter(p => p.status === 'received' && p.cat !== 'vehicle' && p.amount > 0).forEach(p => {
        const d = (p.requestDate || '').slice(0, 10)
        if (!d) return
        inp.push({ id: 'PO-' + p.id, date: d, supplier: p.supplier || 'ผู้จัดหา',
          amount: p.amount, vat: Math.round(p.amount * VAT_RATE), category: PO_CAT_LABELS[p.cat] || 'อื่นๆ' })
      })
    } catch {}

    if (container.__routerGen !== myGen) return
    if (out.length || inp.length) {
      allInvoicesOut = out; allInvoicesIn = inp; dataSource = 'live'
    } else {
      allInvoicesOut = DEMO_INVOICES_OUT.map(i => ({ ...i }))
      allInvoicesIn = DEMO_INVOICES_IN.map(i => ({ ...i }))
      dataSource = 'demo'
    }
  }
  await loadData()

  function renderPage() {
    const invoicesOut = allInvoicesOut.filter(i => i.date.startsWith(viewMonth))
    const invoicesIn = allInvoicesIn.filter(i => i.date.startsWith(viewMonth))
    const vatOut = invoicesOut.reduce((a, i) => a + i.vat, 0)
    const vatIn = invoicesIn.reduce((a, i) => a + i.vat, 0)
    const netVat = vatOut - vatIn
    const salesTotal = invoicesOut.reduce((a, i) => a + i.amount, 0)
    const purchaseTotal = invoicesIn.reduce((a, i) => a + i.amount, 0)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🧾 VAT Report</div>
            <div class="page-subtitle">รายงานภาษีมูลค่าเพิ่ม — ${viewMonth}${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ข้อมูลจริง</span>' : ' <span style="color:var(--text-muted);font-size:0.75rem">Demo (ยังไม่มีข้อมูลจริง)</span>'}</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary btn-xs" id="prev-m-btn">◀</button>
            <button class="btn btn-secondary btn-xs" id="curr-m-btn">เดือนนี้</button>
            <button class="btn btn-primary" id="export-btn">📤 ส่ง สรรพากร</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('💰 ภาษีขาออก', formatCurrency(vatOut), 'warning')}
          ${kpi('💸 ภาษีขาเข้า', formatCurrency(vatIn), 'primary')}
          ${kpi('📊 ภาษีสุทธิ', formatCurrency(netVat), netVat >= 0 ? 'danger' : 'success')}
          ${kpi('📅 กำหนดนำส่ง', '15 เดือนหน้า', 'secondary')}
        </div>

        <!-- VAT summary card -->
        <div class="card" style="padding:14px;margin-bottom:14px">
          <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);margin-bottom:12px">📊 สรุป VAT</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div>
              <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:4px">ยอดขายรวม (ก่อน VAT)</div>
              <div style="font-weight:700;font-size:1.1rem">${formatCurrency(salesTotal)}</div>
              <div style="font-size:0.75rem;color:var(--warning)">VAT ขาออก: +${formatCurrency(vatOut)}</div>
            </div>
            <div>
              <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:4px">ยอดซื้อรวม (ก่อน VAT)</div>
              <div style="font-weight:700;font-size:1.1rem">${formatCurrency(purchaseTotal)}</div>
              <div style="font-size:0.75rem;color:var(--primary)">VAT ขาเข้า: -${formatCurrency(vatIn)}</div>
            </div>
          </div>
          <div style="margin-top:12px;padding:10px;background:var(--surface-2);border-radius:var(--radius-sm);display:flex;justify-content:space-between;align-items:center">
            <span style="font-weight:700">ต้องชำระ / ขอคืน:</span>
            <span style="font-size:1.2rem;font-weight:900;color:var(--${netVat>=0?'danger':'success'})">${netVat >= 0 ? '⚠️ ต้องชำระ' : '✅ ขอคืน'} ${formatCurrency(Math.abs(netVat))}</span>
          </div>
        </div>

        <!-- Tabs -->
        <div style="display:flex;gap:4px;margin-bottom:12px">
          <button class="btn btn-xs ${activeTab==='out'?'btn-warning':'btn-secondary'} tab-btn" data-t="out">📤 ใบกำกับขาออก (${invoicesOut.length})</button>
          <button class="btn btn-xs ${activeTab==='in'?'btn-primary':'btn-secondary'} tab-btn" data-t="in">📥 ใบกำกับขาเข้า (${invoicesIn.length})</button>
        </div>

        ${activeTab === 'out' ? `
          <div class="card" style="overflow:hidden">
            <table style="width:100%;border-collapse:collapse">
              <thead>
                <tr style="border-bottom:1px solid var(--border);font-size:0.73rem;color:var(--text-muted)">
                  <th style="padding:8px 14px;text-align:left">เลขที่</th>
                  <th style="padding:8px 10px;text-align:left">ลูกค้า</th>
                  <th style="padding:8px 10px">ประเภท</th>
                  <th style="padding:8px 10px;text-align:right">ยอดก่อน VAT</th>
                  <th style="padding:8px 14px;text-align:right">VAT (7%)</th>
                </tr>
              </thead>
              <tbody>
                ${invoicesOut.map(i => `
                  <tr style="border-bottom:1px solid var(--border);font-size:0.8rem">
                    <td style="padding:8px 14px">${i.id}</td>
                    <td style="padding:8px 10px">${escHtml(i.customer)}</td>
                    <td style="padding:8px 10px;text-align:center"><span class="badge badge-secondary" style="font-size:0.6rem">${escHtml(i.category)}</span></td>
                    <td style="padding:8px 10px;text-align:right">${formatCurrency(i.amount)}</td>
                    <td style="padding:8px 14px;text-align:right;font-weight:700;color:var(--warning)">${formatCurrency(i.vat)}</td>
                  </tr>
                `).join('')}
                <tr style="background:var(--surface-2);font-weight:700;font-size:0.82rem">
                  <td colspan="4" style="padding:8px 14px;text-align:right">รวม VAT ขาออก</td>
                  <td style="padding:8px 14px;text-align:right;color:var(--warning)">${formatCurrency(vatOut)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ` : `
          <div class="card" style="overflow:hidden">
            <table style="width:100%;border-collapse:collapse">
              <thead>
                <tr style="border-bottom:1px solid var(--border);font-size:0.73rem;color:var(--text-muted)">
                  <th style="padding:8px 14px;text-align:left">เลขที่</th>
                  <th style="padding:8px 10px;text-align:left">ผู้ขาย</th>
                  <th style="padding:8px 10px">ประเภท</th>
                  <th style="padding:8px 10px;text-align:right">ยอดก่อน VAT</th>
                  <th style="padding:8px 14px;text-align:right">VAT (7%)</th>
                </tr>
              </thead>
              <tbody>
                ${invoicesIn.map(i => `
                  <tr style="border-bottom:1px solid var(--border);font-size:0.8rem">
                    <td style="padding:8px 14px">${i.id}</td>
                    <td style="padding:8px 10px">${escHtml(i.supplier)}</td>
                    <td style="padding:8px 10px;text-align:center"><span class="badge badge-secondary" style="font-size:0.6rem">${escHtml(i.category)}</span></td>
                    <td style="padding:8px 10px;text-align:right">${formatCurrency(i.amount)}</td>
                    <td style="padding:8px 14px;text-align:right;font-weight:700;color:var(--primary)">${formatCurrency(i.vat)}</td>
                  </tr>
                `).join('')}
                <tr style="background:var(--surface-2);font-weight:700;font-size:0.82rem">
                  <td colspan="4" style="padding:8px 14px;text-align:right">รวม VAT ขาเข้า</td>
                  <td style="padding:8px 14px;text-align:right;color:var(--primary)">${formatCurrency(vatIn)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        `}
      </div>
    `

    container.querySelectorAll('.tab-btn').forEach(b => b.addEventListener('click', () => { activeTab = b.dataset.t; renderPage() }))
    document.getElementById('prev-m-btn')?.addEventListener('click', () => { const d = new Date(viewMonth+'-01'); d.setUTCMonth(d.getUTCMonth()-1); viewMonth = d.toISOString().slice(0,7); renderPage() })
    document.getElementById('curr-m-btn')?.addEventListener('click', () => { viewMonth = addMonths(0); renderPage() })
    document.getElementById('export-btn')?.addEventListener('click', () => {
      const outRows = invoicesOut.map(i => ({ 'ประเภท':'ขาออก (ภาษีขาย)', 'เลขที่ใบกำกับ':i.id, 'วันที่':i.date, 'ชื่อผู้ซื้อ':i.customer, 'หมวดหมู่':i.category, 'มูลค่า (บาท)':i.amount, 'VAT 7% (บาท)':i.vat }))
      const inRows  = invoicesIn.map(i  => ({ 'ประเภท':'ขาเข้า (ภาษีซื้อ)',  'เลขที่ใบกำกับ':i.id, 'วันที่':i.date, 'ชื่อผู้ขาย':i.supplier,  'หมวดหมู่':i.category, 'มูลค่า (บาท)':i.amount, 'VAT 7% (บาท)':i.vat }))
      exportToExcel([...outRows, ...inRows], `VAT_Report_${viewMonth}.xlsx`, `VAT ${viewMonth}`)
      showToast(`📥 Export VAT Report ${viewMonth} แล้ว`, 'success')
    })
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
