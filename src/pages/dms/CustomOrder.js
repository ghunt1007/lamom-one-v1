/**
 * Vehicle Customization Order — ระบบสั่งแต่งรถครบวงจร
 * เซลล์คีย์สั่งแต่ง → ส่งต่อแผนก → ธุรการออก PO → ซัพพลายเออร์ติดตั้ง → ตรวจสอบ/QC → พร้อมส่งมอบ → เอกสารการเงิน/ทะเบียน/ประกัน
 * Route: /dms/custom-orders
 */
import { formatCurrency, formatDate, timeAgo } from '../../utils/format.js'
import { openModal, confirmDialog } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'
import {
  printCustomOrderPO, printCustomReceipt, printCustomTempReceipt,
  printCustomTaxInvoice, printCustomCreditNote, printRegistrationInquiry, printInsuranceNotify,
} from '../../utils/customOrderDocs.js'

function esc(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }
function today() { return new Date().toISOString().slice(0, 10) }
function nowIso() { return new Date().toISOString() }

const ORDER_STATUS = {
  new:               { label: 'สร้างใหม่', color: 'secondary', icon: '🆕' },
  routed:            { label: 'ส่งต่อแผนกแล้ว', color: 'primary', icon: '📨' },
  po_issued:         { label: 'ออก PO แล้ว', color: 'primary', icon: '📋' },
  install_scheduled: { label: 'นัดติดตั้งแล้ว', color: 'warning', icon: '📅' },
  installing:        { label: 'กำลังติดตั้ง', color: 'warning', icon: '🔧' },
  qc:                { label: 'ตรวจสอบคุณภาพ', color: 'warning', icon: '🔍' },
  issue_found:       { label: 'พบปัญหา', color: 'danger', icon: '⚠️' },
  ready:             { label: 'พร้อมส่งมอบ', color: 'success', icon: '✅' },
  delivered:         { label: 'ส่งมอบแล้ว', color: 'success', icon: '🚗' },
  cancelled:         { label: 'ยกเลิก', color: 'danger', icon: '❌' },
}

const DEPTS = [
  { key: 'warehouse',  label: 'คลังอะไหล่/อุปกรณ์' },
  { key: 'accounting', label: 'บัญชี-การเงิน' },
  { key: 'service',    label: 'ศูนย์บริการ (ติดตั้ง)' },
  { key: 'salesAdmin', label: 'ธุรการขาย' },
]

const DOC_TYPES = {
  receipt:      { label: 'ใบเสร็จรับเงิน', icon: '🧾', printer: printCustomReceipt },
  tax_invoice:  { label: 'ใบกำกับภาษี', icon: '📃', printer: printCustomTaxInvoice },
  temp_receipt: { label: 'ใบเสร็จรับเงินชั่วคราว', icon: '📝', printer: printCustomTempReceipt },
  credit_note:  { label: 'ใบลดหนี้', icon: '📉', printer: printCustomCreditNote },
  reg_inquiry:  { label: 'หนังสือสอบถามการจดทะเบียน', icon: '🚘', printer: printRegistrationInquiry },
  insurance:    { label: 'หนังสือแจ้งเลขรับแจ้งประกันภัย', icon: '🛡', printer: printInsuranceNotify },
}

export default async function CustomOrderPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let orders = []
  let docsByOrder = {}
  let statusFilter = 'all'
  let selectedId = null
  let loading = true

  async function loadData() {
    loading = true
    try {
      orders = await listDocs('custom_orders', [], 'createdAt', 'desc', 500)
      const allDocs = await listDocs('custom_order_docs', [], 'issuedAt', 'desc', 500)
      docsByOrder = {}
      allDocs.forEach(d => { (docsByOrder[d.orderId] ||= []).push(d) })
    } catch (e) { orders = []; docsByOrder = {} }
    loading = false
    if (container.__routerGen === myGen) render()
  }

  function itemsTotal(o) {
    const sub = (o.items || []).reduce((a, i) => a + i.qty * i.unitPrice, 0)
    return Math.max(0, sub - (o.discount || 0))
  }

  async function logHistory(o, action, note = '') {
    const history = [...(o.history || []), { ts: nowIso(), action, note }]
    await updateDocData('custom_orders', o.id, { history })
  }

  function statusCard(o) {
    const st = ORDER_STATUS[o.status]
    const isSel = o.id === selectedId
    return `<div class="card order-card" data-id="${o.id}" style="padding:12px 14px;cursor:pointer;margin-bottom:8px;border:2px solid ${isSel?'var(--primary)':'transparent'}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
        <div>
          <div style="font-weight:700;font-size:0.85rem">${esc(o.orderNo)}</div>
          <div style="font-size:0.72rem;color:var(--text-muted)">${esc(o.customerName)} · ${esc(o.vehicleModel)}</div>
        </div>
        <span class="badge badge-${st?.color}" style="font-size:0.6rem;white-space:nowrap">${st?.icon} ${st?.label}</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:6px;font-size:0.7rem;color:var(--text-muted)">
        <span>${esc(o.salesName)}</span>
        <span style="font-weight:700;color:var(--success)">${formatCurrency(itemsTotal(o))}</span>
      </div>
    </div>`
  }

  function deptChecklist(o) {
    const routed = o.routedDepts || []
    return DEPTS.map(d => `
      <label style="display:flex;align-items:center;gap:8px;padding:6px 0;cursor:pointer;font-size:0.82rem">
        <input type="checkbox" class="dept-check" data-dept="${d.key}" ${routed.includes(d.key)?'checked':''}>
        <span>${routed.includes(d.key) ? '✅' : '⬜'} ${d.label}</span>
      </label>`).join('')
  }

  function docHistoryList(o) {
    const docs = docsByOrder[o.id] || []
    if (!docs.length) return '<div style="font-size:0.76rem;color:var(--text-muted)">ยังไม่มีเอกสารที่ออก</div>'
    return docs.map(d => {
      const dt = DOC_TYPES[d.type]
      return `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border-subtle);font-size:0.76rem">
        <span>${dt?.icon} ${dt?.label} — ${esc(d.docNo)}</span>
        <span style="color:var(--text-muted)">${timeAgo(d.issuedAt)}</span>
      </div>`
    }).join('')
  }

  function detailPanel(o) {
    if (!o) return `<div class="card" style="padding:40px;text-align:center;color:var(--text-muted)"><div style="font-size:2rem">🎨</div><div style="font-size:0.82rem;margin-top:8px">เลือกคำสั่งแต่งรถเพื่อดูรายละเอียด</div></div>`
    const st = ORDER_STATUS[o.status]
    const total = itemsTotal(o)

    return `<div class="card" style="padding:16px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
        <div>
          <div style="font-weight:700;font-size:0.95rem">${esc(o.orderNo)}</div>
          <div style="font-size:0.78rem;color:var(--text-muted)">${esc(o.customerName)} · ${esc(o.phone)}</div>
        </div>
        <span class="badge badge-${st?.color}">${st?.icon} ${st?.label}</span>
      </div>

      <table class="kv" style="width:100%;font-size:0.8rem;margin-bottom:10px">
        <tbody>
          <tr><td style="color:var(--text-muted);width:110px">รุ่นรถ</td><td>${esc(o.vehicleModel)}</td></tr>
          <tr><td style="color:var(--text-muted)">ทะเบียน/VIN</td><td>${esc([o.plate, o.vin].filter(Boolean).join(' / ') || '-')}</td></tr>
          <tr><td style="color:var(--text-muted)">พนักงานขาย</td><td>${esc(o.salesName)}</td></tr>
        </tbody>
      </table>

      <div style="font-size:0.78rem;font-weight:700;margin-bottom:6px">🎨 รายการสั่งแต่ง</div>
      <div style="overflow:hidden;border:1px solid var(--border);border-radius:var(--radius-sm);margin-bottom:8px">
        <table class="table" style="width:100%">
          <thead><tr><th>รายการ</th><th class="text-right">จำนวน</th><th class="text-right">ราคา/หน่วย</th><th class="text-right">รวม</th></tr></thead>
          <tbody>
            ${(o.items||[]).map(i => `<tr><td style="font-size:0.78rem">${esc(i.name)}</td><td class="text-right" style="font-size:0.78rem">${i.qty}</td><td class="text-right" style="font-size:0.78rem">${formatCurrency(i.unitPrice)}</td><td class="text-right" style="font-size:0.78rem;font-weight:700">${formatCurrency(i.qty*i.unitPrice)}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>
      ${o.discount ? `<div style="font-size:0.78rem;color:var(--danger);margin-bottom:4px">ส่วนลด: -${formatCurrency(o.discount)} ${o.discountNote ? '('+esc(o.discountNote)+')' : ''}</div>` : ''}
      ${(o.freebies||[]).length ? `<div style="font-size:0.76rem;color:var(--text-muted);margin-bottom:4px">🎁 ของแถม: ${o.freebies.map(f=>esc(f.name)+' × '+f.qty).join(', ')}</div>` : ''}
      <div style="font-weight:800;font-size:0.9rem;color:var(--success);margin-bottom:14px">รวมสุทธิ: ${formatCurrency(total)}</div>

      <div style="font-size:0.78rem;font-weight:700;margin-bottom:6px">📨 ส่งต่อแผนกที่เกี่ยวข้อง</div>
      <div class="card" style="padding:10px 14px;background:var(--surface-2);margin-bottom:14px">${deptChecklist(o)}</div>

      <div style="font-size:0.78rem;font-weight:700;margin-bottom:6px">📋 Purchase Order (PO)</div>
      <div class="card" style="padding:12px;background:var(--surface-2);margin-bottom:14px">
        ${o.poNo ? `
          <table class="kv" style="width:100%;font-size:0.78rem">
            <tbody>
              <tr><td style="color:var(--text-muted);width:110px">เลขที่ PO</td><td>${esc(o.poNo)}</td></tr>
              <tr><td style="color:var(--text-muted)">ซัพพลายเออร์</td><td>${esc(o.supplier)}</td></tr>
              <tr><td style="color:var(--text-muted)">วันที่ออก PO</td><td>${formatDate(o.poIssuedDate)}</td></tr>
            </tbody>
          </table>
          <button class="btn btn-xs btn-secondary print-po-btn" style="margin-top:8px">🖨 พิมพ์ PO</button>
        ` : `<button class="btn btn-sm btn-primary issue-po-btn">📋 ออก PO ส่งซัพพลายเออร์</button>`}
      </div>

      <div style="font-size:0.78rem;font-weight:700;margin-bottom:6px">🔧 การติดตั้ง / QC</div>
      <div class="card" style="padding:12px;background:var(--surface-2);margin-bottom:14px">
        <table class="kv" style="width:100%;font-size:0.78rem;margin-bottom:8px">
          <tbody>
            <tr><td style="color:var(--text-muted);width:110px">วันที่นัดติดตั้ง</td><td>${o.installDate ? formatDate(o.installDate) : 'ยังไม่กำหนด'}</td></tr>
            ${o.defectNotes ? `<tr><td style="color:var(--danger)">ปัญหา/ตำหนิ</td><td style="color:var(--danger)">${esc(o.defectNotes)}</td></tr>` : ''}
          </tbody>
        </table>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${o.poNo && !o.installDate ? `<button class="btn btn-xs btn-warning schedule-install-btn">📅 กำหนดวันติดตั้ง</button>` : ''}
          ${o.installDate && !['ready','delivered'].includes(o.status) ? `<button class="btn btn-xs btn-secondary update-install-btn">🔧 อัปเดตสถานะติดตั้ง</button>` : ''}
          ${o.status === 'qc' || o.status === 'issue_found' ? `<button class="btn btn-xs btn-success mark-ready-btn">✅ ยืนยันพร้อมส่งมอบ</button>` : ''}
          ${o.status === 'ready' ? `<button class="btn btn-xs btn-primary mark-delivered-btn">🚗 ส่งมอบรถแล้ว</button>` : ''}
        </div>
      </div>

      <div style="font-size:0.78rem;font-weight:700;margin-bottom:6px">📑 เอกสารที่เกี่ยวข้อง</div>
      <div class="card" style="padding:12px;background:var(--surface-2);margin-bottom:10px">
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">
          ${Object.entries(DOC_TYPES).map(([k,v]) => `<button class="btn btn-xs btn-secondary issue-doc-btn" data-type="${k}">${v.icon} ${v.label}</button>`).join('')}
        </div>
        ${docHistoryList(o)}
      </div>

      ${(o.history||[]).length ? `
      <div style="font-size:0.78rem;font-weight:700;margin-bottom:6px">🕒 ประวัติการดำเนินการ</div>
      <div class="card" style="padding:12px;background:var(--surface-2)">
        ${[...(o.history||[])].reverse().map(h => `<div style="font-size:0.74rem;color:var(--text-muted);padding:3px 0">• ${esc(h.action)}${h.note?' — '+esc(h.note):''} <span style="opacity:0.7">(${timeAgo(h.ts)})</span></div>`).join('')}
      </div>` : ''}
    </div>`
  }

  function render() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const list = statusFilter === 'all' ? orders : orders.filter(o => o.status === statusFilter)
    const active = orders.filter(o => !['delivered','cancelled'].includes(o.status)).length
    const issues = orders.filter(o => o.status === 'issue_found').length
    const ready = orders.filter(o => o.status === 'ready').length
    const totalValue = orders.reduce((a, o) => a + itemsTotal(o), 0)
    const selected = selectedId ? orders.find(o => o.id === selectedId) : null

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🎨 ระบบสั่งแต่งรถ</div>
            <div class="page-subtitle">Custom Order — สั่งแต่ง → ส่งต่อแผนก → PO → ติดตั้ง → QC → เอกสาร</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="new-order-btn">+ สร้างคำสั่งแต่งรถ</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:14px">
          ${kpi('🎨 กำลังดำเนินการ', active, 'primary')}
          ${kpi('⚠️ พบปัญหา', issues, issues>0?'danger':'secondary')}
          ${kpi('✅ พร้อมส่งมอบ', ready, 'success')}
          ${kpi('💰 มูลค่ารวม', formatCurrency(totalValue), 'primary')}
        </div>

        <div style="display:flex;gap:4px;margin-bottom:12px;flex-wrap:wrap">
          <button class="btn btn-xs ${statusFilter==='all'?'btn-primary':'btn-secondary'} sf-btn" data-s="all">ทั้งหมด</button>
          ${Object.entries(ORDER_STATUS).map(([k,v]) => `<button class="btn btn-xs ${statusFilter===k?'btn-'+v.color:'btn-secondary'} sf-btn" data-s="${k}">${v.icon} ${v.label}</button>`).join('')}
        </div>

        <div style="display:grid;grid-template-columns:340px 1fr;gap:14px">
          <div>
            ${list.length ? list.map(o => statusCard(o)).join('') : '<div class="card" style="padding:24px;text-align:center;color:var(--text-muted)">ไม่พบรายการ</div>'}
          </div>
          <div>${detailPanel(selected)}</div>
        </div>
      </div>
    `

    container.querySelectorAll('.sf-btn').forEach(b => b.addEventListener('click', () => { statusFilter = b.dataset.s; render() }))
    document.getElementById('new-order-btn')?.addEventListener('click', openNewOrderModal)
    container.querySelectorAll('.order-card').forEach(c => c.addEventListener('click', () => { selectedId = c.dataset.id; render() }))

    if (selected) {
      container.querySelectorAll('.dept-check').forEach(cb => cb.addEventListener('change', async () => {
        const routed = new Set(selected.routedDepts || [])
        if (cb.checked) routed.add(cb.dataset.dept); else routed.delete(cb.dataset.dept)
        const routedDepts = [...routed]
        try {
          await updateDocData('custom_orders', selected.id, { routedDepts, status: routedDepts.length && selected.status === 'new' ? 'routed' : selected.status })
          await logHistory(selected, cb.checked ? `ส่งต่อแผนก: ${DEPTS.find(d=>d.key===cb.dataset.dept)?.label}` : `ยกเลิกส่งต่อแผนก: ${DEPTS.find(d=>d.key===cb.dataset.dept)?.label}`)
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      }))
      document.querySelector('.issue-po-btn')?.addEventListener('click', () => openPOModal(selected))
      document.querySelector('.print-po-btn')?.addEventListener('click', () => printCustomOrderPO(selected))
      document.querySelector('.schedule-install-btn')?.addEventListener('click', () => openScheduleModal(selected))
      document.querySelector('.update-install-btn')?.addEventListener('click', () => openInstallUpdateModal(selected))
      document.querySelector('.mark-ready-btn')?.addEventListener('click', async () => {
        try {
          await updateDocData('custom_orders', selected.id, { status: 'ready', readyAt: nowIso() })
          await logHistory(selected, 'ยืนยันพร้อมส่งมอบ')
          showToast('✅ รถพร้อมส่งมอบแล้ว', 'success')
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      })
      document.querySelector('.mark-delivered-btn')?.addEventListener('click', async () => {
        const ok = await confirmDialog({ title: '🚗 ยืนยันส่งมอบรถ', message: `ยืนยันว่าได้ส่งมอบ ${selected.orderNo} ให้ลูกค้าแล้ว?`, confirmText: 'ส่งมอบแล้ว' })
        if (!ok) return
        try {
          await updateDocData('custom_orders', selected.id, { status: 'delivered', deliveredAt: nowIso() })
          await logHistory(selected, 'ส่งมอบรถให้ลูกค้าแล้ว')
          showToast('🚗 ส่งมอบรถแล้ว!', 'success')
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      })
      container.querySelectorAll('.issue-doc-btn').forEach(b => b.addEventListener('click', () => openIssueDocModal(selected, b.dataset.type)))
    }
  }

  function openNewOrderModal() {
    let lineCount = 1
    openModal({
      title: '+ สร้างคำสั่งแต่งรถใหม่',
      size: 'lg',
      body: `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
          <div class="input-group"><label class="input-label">ชื่อลูกค้า *</label><input class="input" id="co-cust"></div>
          <div class="input-group"><label class="input-label">โทรศัพท์</label><input class="input" id="co-phone"></div>
          <div class="input-group"><label class="input-label">รุ่นรถ *</label><input class="input" id="co-model"></div>
          <div class="input-group"><label class="input-label">ทะเบียน/VIN</label><input class="input" id="co-plate"></div>
          <div class="input-group"><label class="input-label">พนักงานขาย</label><input class="input" id="co-sales" value="คุณ (Demo)"></div>
          <div class="input-group"><label class="input-label">ส่วนลด (บาท)</label><input type="number" class="input" id="co-discount" value="0"></div>
          <div class="input-group" style="grid-column:1/-1"><label class="input-label">หมายเหตุส่วนลด</label><input class="input" id="co-discount-note" placeholder="เช่น โปรโมชั่นเดือนนี้"></div>
          <div class="input-group" style="grid-column:1/-1"><label class="input-label">ของแถม (คั่นด้วย , เช่น ฟิล์มกรองแสง, พรมยาง)</label><input class="input" id="co-freebies"></div>
        </div>
        <div style="font-size:0.8rem;font-weight:700;margin-bottom:8px">🎨 รายการอุปกรณ์ตกแต่ง</div>
        <div id="co-lines">
          <div style="display:grid;grid-template-columns:2fr 80px 100px;gap:6px;margin-bottom:6px">
            <input class="input co-name" placeholder="ชื่ออุปกรณ์ *">
            <input type="number" class="input co-qty" placeholder="จำนวน" min="1" value="1">
            <input type="number" class="input co-price" placeholder="ราคา/หน่วย">
          </div>
        </div>
        <button class="btn btn-sm btn-secondary" id="co-add-line-btn" style="margin-top:6px">+ เพิ่มรายการ</button>
      `,
      async onConfirm() {
        const customerName = document.getElementById('co-cust')?.value?.trim()
        const vehicleModel = document.getElementById('co-model')?.value?.trim()
        if (!customerName || !vehicleModel) { showToast('❗ กรุณากรอกชื่อลูกค้าและรุ่นรถ', 'error'); return false }
        const names = [...document.querySelectorAll('.modal .co-name')].map(i => i.value.trim())
        const qtys = [...document.querySelectorAll('.modal .co-qty')].map(i => +i.value || 1)
        const prices = [...document.querySelectorAll('.modal .co-price')].map(i => +i.value || 0)
        const items = names.map((n, idx) => ({ name: n, qty: qtys[idx], unitPrice: prices[idx] })).filter(i => i.name)
        if (!items.length) { showToast('❗ กรุณาเพิ่มรายการอย่างน้อย 1 รายการ', 'error'); return false }
        const freebiesRaw = document.getElementById('co-freebies')?.value?.trim() || ''
        const freebies = freebiesRaw ? freebiesRaw.split(',').map(s => s.trim()).filter(Boolean).map(name => ({ name, qty: 1 })) : []
        try {
          const orderNo = 'CO-' + new Date().getFullYear() + '-' + String(orders.length + 1).padStart(3, '0')
          await createDoc('custom_orders', {
            orderNo, customerName,
            phone: document.getElementById('co-phone')?.value?.trim() || '',
            vehicleModel,
            plate: document.getElementById('co-plate')?.value?.trim() || '',
            vin: '',
            salesName: document.getElementById('co-sales')?.value?.trim() || 'พนักงาน',
            items,
            discount: +document.getElementById('co-discount')?.value || 0,
            discountNote: document.getElementById('co-discount-note')?.value?.trim() || '',
            freebies,
            status: 'new',
            routedDepts: [],
            history: [{ ts: nowIso(), action: 'สร้างคำสั่งแต่งรถ', note: '' }],
          })
          showToast('✅ สร้างคำสั่งแต่งรถแล้ว!', 'success')
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      }
    })
    setTimeout(() => {
      document.getElementById('co-add-line-btn')?.addEventListener('click', () => {
        const line = document.createElement('div')
        line.style.cssText = 'display:grid;grid-template-columns:2fr 80px 100px;gap:6px;margin-bottom:6px'
        line.innerHTML = `<input class="input co-name" placeholder="ชื่ออุปกรณ์ *"><input type="number" class="input co-qty" placeholder="จำนวน" min="1" value="1"><input type="number" class="input co-price" placeholder="ราคา/หน่วย">`
        document.getElementById('co-lines')?.appendChild(line)
      })
    }, 50)
  }

  function openPOModal(o) {
    openModal({
      title: '📋 ออก PO ส่งซัพพลายเออร์ — ' + o.orderNo,
      size: 'md',
      body: `
        <div class="input-group"><label class="input-label">ซัพพลายเออร์ *</label><input class="input" id="po-supplier"></div>
        <div class="input-group"><label class="input-label">ผู้ติดต่อซัพพลายเออร์</label><input class="input" id="po-contact"></div>
      `,
      confirmText: '📋 ออก PO',
      async onConfirm() {
        const supplier = document.getElementById('po-supplier')?.value?.trim()
        if (!supplier) { showToast('❗ กรุณากรอกชื่อซัพพลายเออร์', 'error'); return false }
        try {
          const poNo = 'PO-' + new Date().getFullYear() + String(new Date().getMonth()+1).padStart(2,'0') + '-' + o.orderNo.slice(-3)
          await updateDocData('custom_orders', o.id, {
            poNo, supplier, supplierContact: document.getElementById('po-contact')?.value?.trim() || '',
            poIssuedDate: today(), status: 'po_issued',
          })
          await logHistory(o, 'ออก PO ส่งซัพพลายเออร์', supplier)
          showToast('📋 ออก PO แล้ว!', 'success')
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      }
    })
  }

  function openScheduleModal(o) {
    openModal({
      title: '📅 กำหนดวันติดตั้ง — ' + o.orderNo,
      size: 'sm',
      body: `<div class="input-group"><label class="input-label">วันที่ติดตั้ง *</label><input type="date" class="input" id="sch-date" value="${today()}"></div>`,
      confirmText: '📅 ยืนยันวันติดตั้ง',
      async onConfirm() {
        const installDate = document.getElementById('sch-date')?.value
        if (!installDate) { showToast('❗ กรุณาเลือกวันที่', 'error'); return false }
        try {
          await updateDocData('custom_orders', o.id, { installDate, status: 'install_scheduled' })
          await logHistory(o, 'กำหนดวันติดตั้ง', formatDate(installDate))
          showToast('📅 กำหนดวันติดตั้งแล้ว', 'success')
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      }
    })
  }

  function openInstallUpdateModal(o) {
    openModal({
      title: '🔧 อัปเดตสถานะการติดตั้ง — ' + o.orderNo,
      size: 'sm',
      body: `
        <div class="input-group"><label class="input-label">สถานะ</label>
          <select class="input" id="inst-status">
            <option value="installing" ${o.status==='installing'?'selected':''}>🔧 กำลังติดตั้ง</option>
            <option value="qc" ${o.status==='qc'?'selected':''}>🔍 ตรวจสอบคุณภาพ (QC)</option>
            <option value="issue_found" ${o.status==='issue_found'?'selected':''}>⚠️ พบปัญหา/ตำหนิ</option>
          </select>
        </div>
        <div class="input-group"><label class="input-label">บันทึกปัญหา/ตำหนิ (ถ้ามี)</label><textarea class="input" id="inst-notes" rows="3">${esc(o.defectNotes||'')}</textarea></div>
      `,
      confirmText: '💾 บันทึก',
      async onConfirm() {
        const status = document.getElementById('inst-status')?.value
        const defectNotes = document.getElementById('inst-notes')?.value?.trim() || ''
        try {
          await updateDocData('custom_orders', o.id, { status, defectNotes })
          await logHistory(o, 'อัปเดตสถานะติดตั้ง: ' + (ORDER_STATUS[status]?.label||status), defectNotes)
          showToast('✅ อัปเดตสถานะแล้ว', 'success')
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      }
    })
  }

  function openIssueDocModal(o, type) {
    const dt = DOC_TYPES[type]
    const total = itemsTotal(o)
    openModal({
      title: `${dt.icon} ออก${dt.label} — ${o.orderNo}`,
      size: 'sm',
      body: `
        ${['receipt','tax_invoice','temp_receipt','credit_note'].includes(type) ? `<div class="input-group"><label class="input-label">จำนวนเงิน (บาท)</label><input type="number" class="input" id="doc-amount" value="${type==='credit_note'?0:total}"></div>` : ''}
        ${type === 'credit_note' ? `<div class="input-group"><label class="input-label">เหตุผลการลดหนี้</label><textarea class="input" id="doc-note" rows="2"></textarea></div>` : ''}
        ${type === 'insurance' ? `<div class="input-group"><label class="input-label">บริษัทประกันภัย</label><input class="input" id="doc-insurer"></div>` : ''}
        <div class="input-group"><label class="input-label">ผู้ออกเอกสาร</label><input class="input" id="doc-issuer" value="คุณ (Demo)"></div>
      `,
      confirmText: `${dt.icon} ออกเอกสาร + พิมพ์`,
      async onConfirm() {
        const docNoPrefix = { receipt:'RC', tax_invoice:'TI', temp_receipt:'TR', credit_note:'CN', reg_inquiry:'RI', insurance:'IN' }[type]
        const docNo = docNoPrefix + '-' + new Date().getFullYear() + '-' + Date.now().toString().slice(-6)
        const payload = {
          orderId: o.id, type, docNo, issuedAt: nowIso(),
          issuedBy: document.getElementById('doc-issuer')?.value?.trim() || 'พนักงาน',
          amount: +document.getElementById('doc-amount')?.value || 0,
          note: document.getElementById('doc-note')?.value?.trim() || '',
          insurer: document.getElementById('doc-insurer')?.value?.trim() || '',
        }
        try {
          await createDoc('custom_order_docs', payload)
          await logHistory(o, `ออก${dt.label}`, docNo)
          showToast(`✅ ออก${dt.label}แล้ว — กำลังพิมพ์...`, 'success')
          dt.printer(o, payload)
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      }
    })
  }

  await loadData()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
