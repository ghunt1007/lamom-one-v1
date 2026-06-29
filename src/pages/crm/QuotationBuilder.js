/**
 * Quotation Builder — สร้างใบเสนอราคา
 * Route: /crm/quotation
 */
import { formatCurrency, formatDate } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { exportToExcel } from '../../utils/importExport.js'
import { getVehicles } from '../../data/vehicleDatabase.js'
import { getAccessories, getSalesStaff } from '../../data/masterData.js'
import { listDocs } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const QT_STATUS = {
  draft:    { label: 'ร่าง', color: 'secondary' },
  sent:     { label: 'ส่งแล้ว', color: 'primary' },
  accepted: { label: 'ลูกค้ายอมรับ', color: 'success' },
  rejected: { label: 'ลูกค้าปฏิเสธ', color: 'danger' },
  expired:  { label: 'หมดอายุ', color: 'secondary' },
}

const MODELS = [
  { id: 'M001', brand: 'BYD', model: 'Seal', variant: 'Standard Range', price: 1199000 },
  { id: 'M002', brand: 'BYD', model: 'Seal', variant: 'AWD Performance', price: 1449000 },
  { id: 'M003', brand: 'BYD', model: 'Atto 3', variant: 'Extended', price: 1099000 },
  { id: 'M004', brand: 'MG', model: 'ZS EV', variant: 'Grand Luxury', price: 1059000 },
  { id: 'M005', brand: 'Neta', model: 'V', variant: 'Standard', price: 619000 },
]

const ACCESSORIES_CATALOG = [
  { id: 'A001', name: 'ฟิล์มกันรอย Full Body', price: 18000 },
  { id: 'A002', name: 'พรมรถยนต์ Premium', price: 4500 },
  { id: 'A003', name: 'Wall Charger 7kW (ติดตั้ง)', price: 8500 },
  { id: 'A004', name: 'แผ่นยางรองเท้า OEM', price: 2800 },
  { id: 'A005', name: 'Car Charger Type 2', price: 1200 },
  { id: 'A006', name: 'กล้องหน้า-หลัง', price: 5500 },
  { id: 'A007', name: 'ฟิล์มกรองแสง 4 ประตู', price: 7800 },
]

function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }

const DEMO_QUOTES = [
  {
    id: 'QT001', customerId: 'C001', customerName: 'วิชาญ มีโชค', phone: '081-234-5678',
    vehicleId: 'M002', vehicleLabel: 'BYD Seal AWD Performance', basePrice: 1449000,
    color: 'Cosmos Black', downPayment: 290000, term: 60, rate: 2.75,
    accessories: ['A001', 'A003', 'A004'],
    discount: 20000, tradeIn: 0, finalPrice: 1429000, monthlyPayment: 22500,
    status: 'accepted', createdDate: addDays(-14), validUntil: addDays(16), salesperson: 'อรนุช สายใจ',
    notes: 'ลูกค้าตัดสินใจซื้อ'
  },
  {
    id: 'QT002', customerId: 'C005', customerName: 'ประยุทธ ดีใจ', phone: '085-678-9012',
    vehicleId: 'M001', vehicleLabel: 'BYD Seal Standard Range', basePrice: 1199000,
    color: 'Sky Blue', downPayment: 200000, term: 60, rate: 2.99,
    accessories: ['A001', 'A007'],
    discount: 10000, tradeIn: 150000, finalPrice: 1039000, monthlyPayment: 16800,
    status: 'sent', createdDate: addDays(-3), validUntil: addDays(27), salesperson: 'อรนุช สายใจ',
    notes: 'รอลูกค้าตัดสินใจ'
  },
  {
    id: 'QT003', customerId: 'C006', customerName: 'มาลี สุขสันต์', phone: '086-789-0123',
    vehicleId: 'M004', vehicleLabel: 'MG ZS EV Grand Luxury', basePrice: 1059000,
    color: 'Pearl White', downPayment: 150000, term: 72, rate: 3.15,
    accessories: ['A001', 'A003'],
    discount: 0, tradeIn: 0, finalPrice: 1059000, monthlyPayment: 17200,
    status: 'draft', createdDate: addDays(-1), validUntil: addDays(29), salesperson: 'วิชาญ มีโชค',
    notes: ''
  },
]

export default async function QuotationBuilderPage(container) {
  const myGen = container.__routerGen
  let quotes = DEMO_QUOTES.map(q => ({ ...q }))
  let dataSource = 'demo'
  let statusFilter = 'all'

  try {
    const docs = await listDocs('quotations', [], 'createdDate', 'desc', 200).catch(() => [])
    if (container.__routerGen !== myGen) return
    if (docs.length >= 2) {
      const mapped = docs.map((d, i) => ({
        id: d.id || `QT${i+1}`,
        customerName: d.customerName || d.customer || 'ลูกค้า',
        phone: d.phone || '',
        vehicleLabel: d.vehicleLabel || d.model || '',
        basePrice: d.basePrice || 0,
        color: d.color || '',
        downPayment: d.downPayment || 0,
        term: d.term || 60,
        rate: d.rate || 2.99,
        accessories: d.accessories || [],
        discount: d.discount || 0,
        tradeIn: d.tradeIn || 0,
        finalPrice: d.finalPrice || d.basePrice || 0,
        monthlyPayment: d.monthlyPayment || 0,
        status: d.status || 'draft',
        createdDate: d.createdDate || new Date().toISOString().slice(0, 10),
        validUntil: d.validUntil || addDays(30),
        salesperson: d.salesperson || '',
        notes: d.notes || '',
      }))
      quotes = [...mapped, ...DEMO_QUOTES]
      dataSource = 'live'
    }
  } catch {}

  function filtered() {
    return quotes.filter(q => statusFilter === 'all' || q.status === statusFilter)
      .sort((a, b) => b.createdDate.localeCompare(a.createdDate))
  }

  function renderPage() {
    const list = filtered()
    const totalValue = quotes.filter(q => q.status === 'accepted').reduce((a, q) => a + q.finalPrice, 0)
    const convRate = quotes.length ? Math.round(quotes.filter(q => q.status === 'accepted').length / quotes.filter(q => q.status !== 'draft').length * 100) : 0

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">📄 ใบเสนอราคา</div>
            <div class="page-subtitle">Quotation Builder — สร้างและส่งใบเสนอราคา${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ข้อมูลจริง</span>' : ''}</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="export-btn">📥 Export</button>
            <button class="btn btn-primary" id="add-qt-btn">+ สร้างใบเสนอราคา</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('📄 ทั้งหมด', quotes.length, 'primary')}
          ${kpi('✅ ยอมรับ', quotes.filter(q=>q.status==='accepted').length, 'success')}
          ${kpi('💰 มูลค่ายอมรับ', formatCurrency(totalValue), 'success')}
          ${kpi('📈 Conv.Rate', (isNaN(convRate) ? 0 : convRate) + '%', convRate >= 50 ? 'success' : 'warning')}
        </div>

        <div style="display:flex;gap:4px;margin-bottom:12px;flex-wrap:wrap">
          <button class="btn btn-sm ${statusFilter==='all'?'btn-primary':'btn-secondary'} sf-btn" data-s="all">ทั้งหมด</button>
          ${Object.entries(QT_STATUS).map(([k,v]) => `<button class="btn btn-sm ${statusFilter===k?'btn-'+v.color:'btn-secondary'} sf-btn" data-s="${k}">${v.label}</button>`).join('')}
        </div>

        <div class="card" style="padding:0;overflow:hidden">
          <table class="table">
            <thead><tr><th>เลขที่</th><th>ลูกค้า</th><th>รถ</th><th class="text-right">ราคาสุทธิ</th><th class="text-right">ดาวน์</th><th class="text-right">ผ่อน/เดือน</th><th>วันหมดอายุ</th><th>สถานะ</th><th></th></tr></thead>
            <tbody>
              ${list.map(q => {
                const st = QT_STATUS[q.status]
                const isExpired = q.validUntil < addDays(0) && !['accepted','rejected'].includes(q.status)
                return `<tr>
                  <td style="font-family:monospace;font-weight:700;font-size:0.8rem">${escHtml(q.id)}</td>
                  <td>
                    <div style="font-weight:600;font-size:0.85rem">${escHtml(q.customerName)}</div>
                    <div style="font-size:0.72rem;color:var(--text-muted)">${escHtml(q.phone)}</div>
                  </td>
                  <td>
                    <div style="font-size:0.85rem">${escHtml(q.vehicleLabel)}</div>
                    <div style="font-size:0.72rem;color:var(--text-muted)">${escHtml(q.color)}</div>
                  </td>
                  <td class="text-right" style="font-weight:700;color:var(--success)">${formatCurrency(q.finalPrice)}</td>
                  <td class="text-right" style="font-size:0.82rem">${formatCurrency(q.downPayment)}</td>
                  <td class="text-right" style="font-size:0.82rem">${formatCurrency(q.monthlyPayment)}</td>
                  <td style="font-size:0.82rem;color:${isExpired?'var(--danger)':'inherit'}">${formatDate(q.validUntil)}</td>
                  <td><span class="badge badge-${st?.color}">${st?.label}</span></td>
                  <td>
                    <div style="display:flex;gap:4px">
                      <button class="btn btn-xs btn-secondary open-qt-btn" data-id="${q.id}">ดู</button>
                      ${q.status === 'draft' ? `<button class="btn btn-xs btn-primary send-qt-btn" data-id="${q.id}">📤 ส่ง</button>` : ''}
                      ${q.status === 'sent' ? `<button class="btn btn-xs btn-success accept-qt-btn" data-id="${q.id}">✓ ยอมรับ</button>` : ''}
                    </div>
                  </td>
                </tr>`
              }).join('')}
              ${!list.length ? `<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--text-muted)">ไม่พบใบเสนอราคา</td></tr>` : ''}
            </tbody>
          </table>
        </div>
      </div>
    `

    container.querySelectorAll('.sf-btn').forEach(b => b.addEventListener('click', () => { statusFilter = b.dataset.s; renderPage() }))
    document.getElementById('add-qt-btn')?.addEventListener('click', openCreateForm)
    document.getElementById('export-btn')?.addEventListener('click', () => {
      exportToExcel(quotes.map(q => ({ เลขที่: q.id, ลูกค้า: q.customerName, รถ: q.vehicleLabel, ราคาสุทธิ: q.finalPrice, ดาวน์: q.downPayment, ผ่อน: q.monthlyPayment, สถานะ: QT_STATUS[q.status]?.label })), 'quotations')
      showToast('📥 Export แล้ว!', 'success')
    })
    container.querySelectorAll('.open-qt-btn').forEach(b => b.addEventListener('click', () => {
      const q = quotes.find(x => x.id === b.dataset.id); if (q) openQuoteDetail(q)
    }))
    container.querySelectorAll('.send-qt-btn').forEach(b => b.addEventListener('click', () => {
      const q = quotes.find(x => x.id === b.dataset.id)
      if (q) { q.status = 'sent'; showToast(`📤 ส่งใบเสนอราคา ${q.id} แล้ว!`, 'success'); renderPage() }
    }))
    container.querySelectorAll('.accept-qt-btn').forEach(b => b.addEventListener('click', () => {
      const q = quotes.find(x => x.id === b.dataset.id)
      if (q) { q.status = 'accepted'; showToast(`✅ ${q.customerName} ยอมรับใบเสนอราคาแล้ว!`, 'success'); renderPage() }
    }))
  }

  function openQuoteDetail(q) {
    const st = QT_STATUS[q.status]
    const accItems = q.accessories.map(id => ACCESSORIES_CATALOG.find(a => a.id === id)).filter(Boolean)
    const accTotal = accItems.reduce((a, i) => a + i.price, 0)
    openModal({
      title: '📄 ' + escHtml(q.id) + ' — ' + escHtml(q.customerName),
      size: 'lg',
      body: `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
          <div>
            <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);margin-bottom:6px">ลูกค้า</div>
            ${row('ชื่อ', escHtml(q.customerName))}${row('โทร', escHtml(q.phone))}${row('เซลส์', escHtml(q.salesperson))}${row('สถานะ', `<span class="badge badge-${st?.color}">${st?.label}</span>`)}
          </div>
          <div>
            <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);margin-bottom:6px">รถที่เสนอ</div>
            ${row('รุ่น', escHtml(q.vehicleLabel))}${row('สี', escHtml(q.color))}${row('ราคา', formatCurrency(q.basePrice))}${row('ส่วนลด', q.discount ? `<span style="color:var(--success)">- ${formatCurrency(q.discount)}</span>` : '-')}${row('เทิร์นอิน', q.tradeIn ? `<span style="color:var(--success)">- ${formatCurrency(q.tradeIn)}</span>` : '-')}
          </div>
        </div>
        ${accItems.length ? `<div style="margin-bottom:12px">
          <div style="font-size:0.78rem;font-weight:700;margin-bottom:6px">อุปกรณ์เสริม</div>
          ${accItems.map(a => `<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border);font-size:0.8rem"><span>✓ ${a.name}</span><span>${formatCurrency(a.price)}</span></div>`).join('')}
          <div style="display:flex;justify-content:space-between;font-size:0.8rem;font-weight:700;margin-top:4px"><span>รวมอุปกรณ์</span><span>${formatCurrency(accTotal)}</span></div>
        </div>` : ''}
        <div style="background:var(--primary-dim);border-radius:var(--radius-sm);padding:12px;display:grid;grid-template-columns:repeat(3,1fr);gap:12px">
          ${kpi('💰 ราคาสุทธิ', formatCurrency(q.finalPrice), 'success')}
          ${kpi('💳 เงินดาวน์', formatCurrency(q.downPayment), 'primary')}
          ${kpi('📅 ผ่อน/เดือน', formatCurrency(q.monthlyPayment), 'warning')}
        </div>
        <div style="margin-top:10px;font-size:0.78rem;display:flex;justify-content:space-between">
          <span style="color:var(--text-muted)">สร้างวันที่: ${formatDate(q.createdDate)}</span>
          <span style="color:var(--text-muted)">ใช้ได้ถึง: ${formatDate(q.validUntil)}</span>
        </div>
      `
    })
  }

  function openCreateForm() {
    let selectedAcc = []
    openModal({
      title: '+ สร้างใบเสนอราคา',
      size: 'lg',
      body: `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="input-group"><label class="input-label">ชื่อลูกค้า *</label><input class="input" id="qf-name" placeholder="ชื่อลูกค้า"></div>
          <div class="input-group"><label class="input-label">โทรศัพท์</label><input class="input" id="qf-phone" placeholder="08x-xxx-xxxx"></div>
          <div class="input-group" style="grid-column:1/-1">
            <label class="input-label">รถที่เสนอ *</label>
            <select class="input" id="qf-vehicle">
              ${getVehicles().map(m => `<option value="${m.id}">${m.brand} ${m.model} ${m.variant} — ${formatCurrency(m.price)}</option>`).join('')}
            </select>
          </div>
          <div class="input-group"><label class="input-label">สี</label><input class="input" id="qf-color" placeholder="Cosmos Black"></div>
          <div class="input-group"><label class="input-label">ส่วนลด (บาท)</label><input type="number" class="input" id="qf-discount" value="0"></div>
          <div class="input-group"><label class="input-label">มูลค่าเทิร์นอิน (บาท)</label><input type="number" class="input" id="qf-tradein" value="0"></div>
          <div class="input-group"><label class="input-label">เงินดาวน์ (บาท)</label><input type="number" class="input" id="qf-down" placeholder="200000"></div>
          <div class="input-group"><label class="input-label">ระยะผ่อน (เดือน)</label><select class="input" id="qf-term"><option>48</option><option selected>60</option><option>72</option></select></div>
          <div class="input-group"><label class="input-label">ดอกเบี้ย (%/ปี)</label><input type="number" class="input" id="qf-rate" value="2.99" step="0.01"></div>
          <div class="input-group" style="grid-column:1/-1">
            <label class="input-label">อุปกรณ์เสริม</label>
            <div style="display:flex;flex-wrap:wrap;gap:6px">
              ${getAccessories().map(a => `<label style="display:flex;align-items:center;gap:4px;font-size:0.78rem;cursor:pointer;padding:4px 8px;border:1px solid var(--border);border-radius:var(--radius-sm)"><input type="checkbox" class="acc-check" value="${a.id}"> ${a.name} (${formatCurrency(a.price)})</label>`).join('')}
            </div>
          </div>
          <div class="input-group"><label class="input-label">เซลส์</label><select class="input" id="qf-sales">${getSalesStaff().map(s => `<option>${s}</option>`).join('')}</select></div>
          <div class="input-group"><label class="input-label">หมายเหตุ</label><input class="input" id="qf-notes" placeholder="บันทึก..."></div>
        </div>
      `,
      onConfirm() {
        const name = document.getElementById('qf-name')?.value?.trim()
        if (!name) { showToast('❗ กรุณากรอกชื่อลูกค้า', 'error'); return }
        const vehicleId = document.getElementById('qf-vehicle')?.value
        const vehicle = getVehicles().find(m => m.id === vehicleId)
        const discount = +document.getElementById('qf-discount')?.value || 0
        const tradeIn = +document.getElementById('qf-tradein')?.value || 0
        const downPayment = +document.getElementById('qf-down')?.value || 0
        const term = +document.getElementById('qf-term')?.value || 60
        const rate = +document.getElementById('qf-rate')?.value || 2.99
        const accIds = [...document.querySelectorAll('.modal .acc-check:checked')].map(i => i.value)
        const accCatalog = getAccessories()
        const accTotal = accIds.reduce((a, id) => a + (accCatalog.find(x => x.id === id)?.price || 0), 0)
        const finalPrice = (vehicle?.price || 0) + accTotal - discount - tradeIn
        const loanAmount = finalPrice - downPayment
        const monthly = Math.round(loanAmount * (1 + rate / 100 * term / 12) / term)
        quotes.unshift({
          id: `QT${String(quotes.length+1).padStart(3,'0')}`,
          customerId: '', customerName: name, phone: document.getElementById('qf-phone')?.value||'',
          vehicleId, vehicleLabel: `${vehicle?.brand} ${vehicle?.model} ${vehicle?.variant}`,
          basePrice: vehicle?.price || 0, color: document.getElementById('qf-color')?.value||'',
          downPayment, term, rate, accessories: accIds,
          discount, tradeIn, finalPrice, monthlyPayment: monthly,
          status: 'draft', createdDate: addDays(0), validUntil: addDays(30),
          salesperson: document.getElementById('qf-sales')?.value||'',
          notes: document.getElementById('qf-notes')?.value||''
        })
        showToast('✅ สร้างใบเสนอราคาแล้ว!', 'success')
        renderPage()
      }
    })
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
function row(l, v) { return `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);font-size:0.82rem"><span style="color:var(--text-muted)">${l}</span><span>${v}</span></div>` }
