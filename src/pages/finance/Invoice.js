import { formatCurrency, formatDate } from '../../utils/format.js'
import { openModal, confirmDialog } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { exportToExcel } from '../../utils/importExport.js'
import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const DOC_TYPES = {
  quotation:    { label: 'ใบเสนอราคา', short: 'QT', color: 'primary' },
  invoice:      { label: 'ใบแจ้งหนี้', short: 'INV', color: 'warning' },
  receipt:      { label: 'ใบเสร็จ', short: 'REC', color: 'success' },
  tax_invoice:  { label: 'ใบกำกับภาษี', short: 'TAX', color: 'accent' },
  credit_note:  { label: 'ใบลดหนี้', short: 'CN', color: 'danger' },
}

const DOC_STATUS = {
  draft:    { label: 'Draft', color: 'primary' },
  sent:     { label: 'ส่งแล้ว', color: 'primary' },
  paid:     { label: 'ชำระแล้ว', color: 'success' },
  overdue:  { label: 'เกินกำหนด', color: 'danger' },
  cancelled:{ label: 'ยกเลิก', color: 'danger' },
}

function calcDoc(doc) {
  const subtotal = doc.items.reduce((a, i) => a + i.qty * i.price, 0)
  const vat = doc.items.reduce((a, i) => a + i.qty * i.price * (i.vat / 100), 0)
  return { subtotal, vat, total: subtotal + vat }
}

export default async function InvoicePage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let docs = []
  let bookingDocs = []
  let typeFilter = 'all'
  let statusFilter = 'all'
  let search = ''
  let loading = true

  async function loadData() {
    loading = true
    try {
      docs = await listDocs('invoices', [], 'date', 'desc', 500)
      const bookings = await listDocs('bookings', [], 'createdAt', 'desc', 200)
      const billable = bookings.filter(b => ['ยืนยัน', 'รอส่งมอบ', 'ส่งมอบแล้ว'].includes(b.status))
      bookingDocs = billable.map((b, i) => {
        const no = 'INV-' + (b.bookingNo || (new Date().getFullYear() + '-' + String(i + 1).padStart(3, '0')))
        const price = b.salePrice || b.price || 0
        const status = b.status === 'ส่งมอบแล้ว' ? 'paid' : 'sent'
        return {
          id: 'bk-' + b.id, type: 'invoice', no,
          custName: b.custName || 'ลูกค้า', custTax: b.custTax || '',
          date: b.bookingDate || b.createdAt?.toDate?.().toISOString().slice(0, 10) || '',
          dueDate: (() => { const d = new Date(b.bookingDate || new Date()); d.setDate(d.getDate() + 15); return d.toISOString().slice(0, 10) })(),
          items: [{ desc: ((b.brand || '') + ' ' + (b.model || '') + (b.variant ? ' ' + b.variant : '')).trim() || 'รถยนต์', qty: 1, unit: 'คัน', price, vat: 7 }],
          status, paidDate: b.actualDeliveryDate || '', note: b.note || '', _live: true,
        }
      })
    } catch (e) { docs = []; bookingDocs = [] }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function allDocs() { return [...docs, ...bookingDocs] }

  function getFiltered() {
    const docsSrc = allDocs()
    let list = docs
    if (typeFilter !== 'all') list = list.filter(d => d.type === typeFilter)
    if (statusFilter !== 'all') list = list.filter(d => d.status === statusFilter)
    if (search) list = list.filter(d => d.custName.includes(search) || d.no.includes(search))
    return list.sort((a, b) => b.date.localeCompare(a.date))
  }

  function getSummary() {
    const today = new Date().toISOString().slice(0, 10)
    const invoices = allDocs().filter(d => d.type === 'invoice')
    return {
      outstanding: invoices.filter(d => d.status === 'sent' && d.dueDate >= today).reduce((a, d) => a + calcDoc(d).total, 0),
      overdue: invoices.filter(d => d.status === 'sent' && d.dueDate < today).reduce((a, d) => a + calcDoc(d).total, 0),
      paid: invoices.filter(d => d.status === 'paid').reduce((a, d) => a + calcDoc(d).total, 0),
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
            <div class="page-title">🧾 Invoice & Documents</div>
            <div class="page-subtitle">ใบแจ้งหนี้ / ใบเสร็จ / ใบกำกับภาษี
              <span style="font-size:0.72rem;color:var(--success);margin-left:8px">● รวมจากใบจองจริง</span>
            </div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="inv-export">📥 Export</button>
            <button class="btn btn-primary" id="new-inv-btn">➕ สร้างเอกสาร</button>
          </div>
        </div>

        <!-- KPI -->
        <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:20px">
          ${kpi('⏳ รอชำระ', formatCurrency(s.outstanding), 'warning')}
          ${kpi('⚠️ เกินกำหนด', formatCurrency(s.overdue), 'danger')}
          ${kpi('✅ ชำระแล้ว', formatCurrency(s.paid), 'success')}
        </div>

        <!-- Filters -->
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px;align-items:center">
          <input class="input" id="inv-search" placeholder="🔍 ค้นหา..." value="${escHtml(search)}" style="width:200px">
          <div style="display:flex;gap:4px">
            <button class="btn btn-sm ${typeFilter==='all'?'btn-primary':'btn-secondary'} tf-btn" data-t="all">ทั้งหมด</button>
            ${Object.entries(DOC_TYPES).map(([k,v]) => `<button class="btn btn-sm ${typeFilter===k?'btn-primary':'btn-secondary'} tf-btn" data-t="${k}">${v.short}</button>`).join('')}
          </div>
          <div style="display:flex;gap:4px;margin-left:auto">
            ${Object.entries(DOC_STATUS).map(([k,v]) => `<button class="btn btn-sm ${statusFilter===k?'btn-primary':'btn-secondary'} sf-btn" data-s="${k}">${v.label}</button>`).join('')}
          </div>
        </div>

        <!-- Table -->
        <div class="card" style="padding:0;overflow:hidden">
          <table class="table">
            <thead><tr><th>เลขที่</th><th>ประเภท</th><th>ลูกค้า</th><th>วันที่</th><th>ครบกำหนด</th><th class="text-right">มูลค่า</th><th>สถานะ</th><th></th></tr></thead>
            <tbody>
              ${filtered.map(d => {
                const dt = DOC_TYPES[d.type]
                const today = new Date().toISOString().slice(0, 10)
                const effStatus = d.status === 'sent' && d.dueDate < today ? 'overdue' : d.status
                const st = DOC_STATUS[effStatus]
                const { total } = calcDoc(d)
                const isOverdue = effStatus === 'overdue'
                return `<tr class="doc-row" data-id="${d.id}" style="cursor:pointer">
                  <td style="font-family:monospace;font-size:0.8rem">${escHtml(d.no)}</td>
                  <td><span class="badge badge-${dt.color}" style="font-size:0.68rem">${dt.label}</span></td>
                  <td style="font-size:0.85rem">${escHtml(d.custName)}</td>
                  <td style="font-size:0.8rem">${escHtml(d.date)}</td>
                  <td style="font-size:0.8rem;color:${isOverdue?'var(--danger)':'inherit'}">${escHtml(d.dueDate)} ${isOverdue?'⚠️':''}</td>
                  <td class="text-right" style="font-weight:700">${formatCurrency(total)}</td>
                  <td><span class="badge badge-${st.color}">${st.label}</span></td>
                  <td>
                    ${!d._live && d.status !== 'paid' && d.status !== 'cancelled' && d.type === 'invoice' ? `<button class="btn btn-xs btn-success pay-btn" data-id="${d.id}">รับชำระ</button>` : ''}
                  </td>
                </tr>`
              }).join('')}
              ${!filtered.length ? `<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--text-muted)">ไม่มีเอกสาร</td></tr>` : ''}
            </tbody>
          </table>
        </div>
      </div>
    `

    document.getElementById('inv-search')?.addEventListener('input', e => { search = e.target.value; renderPage() })
    document.querySelectorAll('.tf-btn').forEach(b => b.addEventListener('click', () => { typeFilter = b.dataset.t; renderPage() }))
    document.querySelectorAll('.sf-btn').forEach(b => b.addEventListener('click', () => { statusFilter = b.dataset.s; renderPage() }))
    document.getElementById('new-inv-btn')?.addEventListener('click', () => openDocForm())
    document.getElementById('inv-export')?.addEventListener('click', () => exportToExcel(filtered.map(d => { const {total,vat,subtotal}=calcDoc(d); return { เลขที่:d.no, ประเภท:DOC_TYPES[d.type].label, ลูกค้า:d.custName, วันที่:d.date, ครบกำหนด:d.dueDate, ก่อนVAT:subtotal, VAT:vat, รวม:total, สถานะ:DOC_STATUS[d.status].label } }), 'Invoices'))
    document.querySelectorAll('.doc-row').forEach(row => {
      row.addEventListener('click', e => { if (e.target.tagName === 'BUTTON') return; const d = allDocs().find(x => x.id === row.dataset.id); if (d) openDocDetail(d) })
    })
    document.querySelectorAll('.pay-btn').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.stopPropagation()
        const d = allDocs().find(x => x.id === btn.dataset.id)
        if (!d || d._live) return
        try {
          await updateDocData('invoices', d.id, { status: 'paid', paidDate: new Date().toISOString().slice(0,10) })
          showToast('✅ บันทึกการชำระแล้ว', 'success')
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      })
    })
  }

  function openDocForm(doc = null) {
    const today = new Date().toISOString().slice(0, 10)
    const { el, close } = openModal({
      title: doc ? '✏️ แก้ไขเอกสาร' : '🧾 สร้างเอกสารใหม่', size: 'lg',
      body: `<div style="display:flex;flex-direction:column;gap:12px">
        <div class="grid-2">
          <div class="input-group"><label class="input-label">ประเภทเอกสาร</label>
            <select class="input" id="dc-type">
              ${Object.entries(DOC_TYPES).map(([k,v]) => `<option value="${k}" ${(doc?.type||'invoice')===k?'selected':''}>${v.label}</option>`).join('')}
            </select>
          </div>
          <div class="input-group"><label class="input-label">ชื่อลูกค้า *</label><input class="input" id="dc-cust" value="${escHtml(doc?.custName||'')}" placeholder="ชื่อลูกค้า"></div>
        </div>
        <div class="grid-2">
          <div class="input-group"><label class="input-label">วันที่เอกสาร</label><input class="input" type="date" id="dc-date" value="${doc?.date||today}"></div>
          <div class="input-group"><label class="input-label">ครบกำหนด</label><input class="input" type="date" id="dc-due" value="${doc?.dueDate||today}"></div>
        </div>
        <div style="border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px">
          <div style="font-weight:600;margin-bottom:8px;font-size:0.85rem">รายการสินค้า/บริการ</div>
          <div id="dc-items">
            <div style="display:grid;grid-template-columns:3fr 1fr 2fr 1fr;gap:8px;margin-bottom:8px">
              <div class="input-group" style="margin:0"><input class="input" id="item-desc-0" placeholder="รายการ" style="font-size:0.83rem"></div>
              <div class="input-group" style="margin:0"><input class="input" type="number" id="item-qty-0" value="1" style="font-size:0.83rem"></div>
              <div class="input-group" style="margin:0"><input class="input" type="number" id="item-price-0" placeholder="ราคา" style="font-size:0.83rem"></div>
              <div class="input-group" style="margin:0"><select class="input" id="item-vat-0" style="font-size:0.83rem"><option value="0">0%</option><option value="7" selected>7%</option></select></div>
            </div>
          </div>
        </div>
        <div class="input-group"><label class="input-label">หมายเหตุ</label><input class="input" id="dc-note" value="${escHtml(doc?.note||'')}" placeholder="หมายเหตุ (ถ้ามี)"></div>
      </div>`,
      footer: `<button class="btn btn-secondary" id="dc-c">ยกเลิก</button><button class="btn btn-primary" id="dc-s">💾 บันทึก</button>`
    })
    el.querySelector('#dc-c').addEventListener('click', close)
    el.querySelector('#dc-s').addEventListener('click', async () => {
      const custName = el.querySelector('#dc-cust').value.trim()
      if (!custName) return showToast('❗ ระบุชื่อลูกค้า', 'warning')
      const type = el.querySelector('#dc-type').value
      const types = { quotation:'QT', invoice:'INV', receipt:'REC', tax_invoice:'TAX', credit_note:'CN' }
      const no = types[type] + '-' + new Date().getFullYear() + '-' + String(docs.length + 1).padStart(3, '0')
      const items = [{ desc: el.querySelector('#item-desc-0').value||'รายการ', qty: +el.querySelector('#item-qty-0').value||1, unit:'ชิ้น', price: +el.querySelector('#item-price-0').value||0, vat: +el.querySelector('#item-vat-0').value }]
      try {
        await createDoc('invoices', { type, no, custName, custTax:'', date: el.querySelector('#dc-date').value, dueDate: el.querySelector('#dc-due').value, items, status:'draft', note: el.querySelector('#dc-note').value })
        showToast('🧾 สร้างเอกสารแล้ว', 'success'); close()
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    })
  }

  function openDocDetail(d) {
    const dt = DOC_TYPES[d.type]; const st = DOC_STATUS[d.status]
    const { subtotal, vat, total } = calcDoc(d)
    openModal({
      title: '🧾 ' + dt.label + ' ' + escHtml(d.no), size: 'md',
      body: `<div style="display:flex;flex-direction:column;gap:12px;font-size:0.85rem">
        <div style="display:flex;gap:8px;flex-wrap:wrap"><span class="badge badge-${dt.color}">${dt.label}</span><span class="badge badge-${st.color}">${st.label}</span></div>
        <div class="grid-2"><div>👤 ${escHtml(d.custName)}</div><div>📅 ${escHtml(d.date)}</div><div>📋 ครบกำหนด: ${escHtml(d.dueDate)}</div>${d.paidDate?`<div>✅ ชำระวันที่: ${escHtml(d.paidDate)}</div>`:''}</div>
        <table class="table" style="font-size:0.8rem">
          <thead><tr><th>รายการ</th><th class="text-right">จำนวน</th><th class="text-right">ราคา/หน่วย</th><th class="text-right">VAT</th><th class="text-right">รวม</th></tr></thead>
          <tbody>${d.items.map(i=>`<tr><td>${escHtml(i.desc)}</td><td class="text-right">${i.qty}</td><td class="text-right">${formatCurrency(i.price)}</td><td class="text-right">${i.vat}%</td><td class="text-right">${formatCurrency(i.qty*i.price*(1+i.vat/100))}</td></tr>`).join('')}</tbody>
          <tfoot>
            <tr><td colspan="4" class="text-right">ยอดก่อน VAT</td><td class="text-right">${formatCurrency(subtotal)}</td></tr>
            <tr><td colspan="4" class="text-right">VAT 7%</td><td class="text-right">${formatCurrency(vat)}</td></tr>
            <tr style="font-weight:700"><td colspan="4" class="text-right">รวมทั้งสิ้น</td><td class="text-right" style="color:var(--primary)">${formatCurrency(total)}</td></tr>
          </tfoot>
        </table>
        ${d.note?`<div style="color:var(--text-muted)">📝 ${escHtml(d.note)}</div>`:''}
      </div>`,
      footer: `${!d._live&&d.status!=='paid'&&d.type==='invoice'?`<button class="btn btn-success" id="detail-pay-btn">✅ บันทึกรับชำระ</button>`:''}
               <button class="btn btn-primary" onclick="window.print()">🖨 พิมพ์</button>`
    })
    document.getElementById('detail-pay-btn')?.addEventListener('click', async () => {
      try {
        await updateDocData('invoices', d.id, { status: 'paid', paidDate: new Date().toISOString().slice(0,10) })
        document.querySelector('.modal-overlay')?.remove(); showToast('✅ บันทึกการชำระแล้ว', 'success')
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    })
  }

  await loadData()
}

function kpi(title, value, color) {
  return `<div class="kpi-card"><div class="kpi-title">${title}</div><div class="kpi-value" style="color:var(--${color})">${value}</div></div>`
}
