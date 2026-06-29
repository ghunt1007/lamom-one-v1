import { formatCurrency, formatDate } from '../../utils/format.js'
import { openModal, confirmDialog } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { exportToExcel } from '../../utils/importExport.js'
import { listDocs } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const SUPPLIER_STATUS = {
  active:   { label: 'ใช้งาน', color: 'success' },
  inactive: { label: 'หยุดใช้', color: 'secondary' },
  blacklist:{ label: 'Blacklist', color: 'danger' },
}

const SUPPLIER_CATS = {
  parts:     { label: 'อะไหล่รถ', icon: '🔩' },
  tires:     { label: 'ยางรถยนต์', icon: '🛞' },
  lubricant: { label: 'น้ำมันหล่อลื่น', icon: '🛢' },
  battery:   { label: 'แบตเตอรี่', icon: '🔋' },
  body:      { label: 'อุปกรณ์ตัวถัง', icon: '🔧' },
  electrical:{ label: 'อิเล็กทรอนิกส์', icon: '⚡' },
  consumable:{ label: 'วัสดุสิ้นเปลือง', icon: '📦' },
  other:     { label: 'อื่นๆ', icon: '📎' },
}

const PO_STATUS = {
  draft:     { label: 'ร่าง', color: 'secondary' },
  pending:   { label: 'รอยืนยัน', color: 'warning' },
  confirmed: { label: 'ยืนยันแล้ว', color: 'primary' },
  received:  { label: 'รับของแล้ว', color: 'success' },
  cancelled: { label: 'ยกเลิก', color: 'danger' },
}

const DEMO_SUPPLIERS = [
  { id: 'S001', name: 'บริษัท อะไหล่ยนต์ ไทย จำกัด', shortName: 'ATJ', category: 'parts',
    contact: 'คุณสมชาย ใจดี', phone: '02-234-5678', email: 'somchai@atj.co.th', address: 'กรุงเทพฯ',
    taxId: '1234567890123', paymentTerms: 30, creditLimit: 500000, status: 'active',
    rating: 4.5, totalPO: 45, totalAmount: 1850000, notes: '' },
  { id: 'S002', name: 'บริษัท ยางไทย กู๊ดเยียร์ จำกัด', shortName: 'TGY', category: 'tires',
    contact: 'คุณวิไล รักงาน', phone: '02-345-6789', email: 'wilai@tgy.co.th', address: 'นนทบุรี',
    taxId: '2345678901234', paymentTerms: 45, creditLimit: 300000, status: 'active',
    rating: 4.2, totalPO: 28, totalAmount: 720000, notes: '' },
  { id: 'S003', name: 'บริษัท น้ำมัน และ ไขข้อ จำกัด', shortName: 'NOI', category: 'lubricant',
    contact: 'คุณประยุทธ์ ขยัน', phone: '02-456-7890', email: 'prayuth@noi.co.th', address: 'สมุทรปราการ',
    taxId: '3456789012345', paymentTerms: 30, creditLimit: 200000, status: 'active',
    rating: 3.8, totalPO: 60, totalAmount: 420000, notes: 'ส่งทุกวันจันทร์' },
  { id: 'S004', name: 'บริษัท แบตเตอรี่ EV ยุคใหม่ จำกัด', shortName: 'BEV', category: 'battery',
    contact: 'คุณสุภาพร ฉลาด', phone: '02-567-8901', email: 'supaporn@bev.co.th', address: 'บางนา',
    taxId: '4567890123456', paymentTerms: 60, creditLimit: 1000000, status: 'active',
    rating: 4.8, totalPO: 12, totalAmount: 3200000, notes: 'เฉพาะรถ EV' },
  { id: 'S005', name: 'ห้างหุ้นส่วน อุปกรณ์เก่า', shortName: 'OLD', category: 'other',
    contact: 'คุณมาลี เก่า', phone: '02-678-9012', email: '', address: 'ลาดพร้าว',
    taxId: '5678901234567', paymentTerms: 15, creditLimit: 50000, status: 'blacklist',
    rating: 1.5, totalPO: 3, totalAmount: 28000, notes: 'ของไม่ได้คุณภาพ สินค้าไม่ตรงปก' },
]

const DEMO_POS = [
  { id: 'PO001', supplierId: 'S001', supplierName: 'บริษัท อะไหล่ยนต์ ไทย จำกัด', date: '2025-06-01', expectedDate: '2025-06-08', status: 'received', items: [{ name: 'ผ้าเบรก BYD Seal (คู่หน้า)', qty: 10, unit: 'ชุด', price: 1200 }, { name: 'กรองอากาศ BYD', qty: 20, unit: 'ชิ้น', price: 350 }], total: 19000, notes: 'รับของครบ' },
  { id: 'PO002', supplierId: 'S002', supplierName: 'บริษัท ยางไทย กู๊ดเยียร์ จำกัด', date: '2025-06-05', expectedDate: '2025-06-12', status: 'confirmed', items: [{ name: 'ยาง 205/55R16', qty: 16, unit: 'เส้น', price: 2800 }], total: 44800, notes: '' },
  { id: 'PO003', supplierId: 'S003', supplierName: 'บริษัท น้ำมัน และ ไขข้อ จำกัด', date: '2025-06-08', expectedDate: '2025-06-09', status: 'pending', items: [{ name: 'น้ำมันเครื่อง 5W-30 (4L)', qty: 30, unit: 'ขวด', price: 450 }], total: 13500, notes: 'ด่วน' },
]

export default async function SupplierManagementPage(container) {
  const myGen = container.__routerGen
  let tab = 'suppliers'
  let catFilter = 'all'
  let statusFilter = 'all'
  let searchQ = ''
  let suppliers = DEMO_SUPPLIERS.map(s => ({ ...s }))
  let pos = DEMO_POS.map(p => ({ ...p, items: p.items.map(i => ({ ...i })) }))
  let dataSource = 'demo'

  try {
    const docs = await listDocs('suppliers', [], 'name', 'asc', 200).catch(() => [])
    if (container.__routerGen !== myGen) return
    if (docs.length >= 2) {
      const mapped = docs.map((d, i) => ({
        id: d.id || `S${String(i+1).padStart(3,'0')}`,
        name: d.name || d.supplierName || 'ซัพพลายเออร์',
        shortName: d.shortName || d.name?.slice(0,3).toUpperCase() || 'SUP',
        category: d.category || 'other',
        contact: d.contact || d.contactName || '',
        phone: d.phone || '',
        email: d.email || '',
        address: d.address || '',
        taxId: d.taxId || '',
        paymentTerms: d.paymentTerms || 30,
        creditLimit: d.creditLimit || 0,
        status: d.status || 'active',
        rating: d.rating || 3,
        totalPO: d.totalPO || 0,
        totalAmount: d.totalAmount || 0,
        notes: d.notes || '',
      }))
      suppliers = [...mapped, ...DEMO_SUPPLIERS]
      dataSource = 'live'
    }
  } catch {}

  function filtered() {
    return suppliers.filter(s => {
      if (catFilter !== 'all' && s.category !== catFilter) return false
      if (statusFilter !== 'all' && s.status !== statusFilter) return false
      if (searchQ && !s.name.toLowerCase().includes(searchQ.toLowerCase()) && !s.contact.includes(searchQ)) return false
      return true
    })
  }

  function renderPage() {
    const list = filtered()
    const totalSuppliers = suppliers.filter(s => s.status === 'active').length
    const totalSpend = suppliers.reduce((a, s) => a + s.totalAmount, 0)
    const pendingPO = pos.filter(p => p.status === 'pending').length
    const blacklisted = suppliers.filter(s => s.status === 'blacklist').length

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🤝 Supplier Management</div>
            <div class="page-subtitle">จัดการซัพพลายเออร์และใบสั่งซื้อ${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ข้อมูลจริง</span>' : ''}</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="export-btn">📥 Export</button>
            <button class="btn btn-primary" id="add-supplier-btn">+ เพิ่มซัพพลายเออร์</button>
          </div>
        </div>

        <!-- KPIs -->
        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:20px">
          ${kpi('🤝 ซัพพลายเออร์ Active', totalSuppliers, 'success')}
          ${kpi('💰 ยอดซื้อรวม', formatCurrency(totalSpend), 'primary')}
          ${kpi('📋 PO รอยืนยัน', pendingPO, 'warning')}
          ${kpi('🚫 Blacklist', blacklisted, 'danger')}
        </div>

        <!-- Tabs -->
        <div style="display:flex;gap:4px;margin-bottom:16px">
          ${[['suppliers','🤝 ซัพพลายเออร์'],['po','📋 Purchase Orders'],['performance','📊 Performance']].map(([t,l]) => `<button class="btn btn-sm ${tab===t?'btn-primary':'btn-secondary'} tab-btn" data-t="${t}">${l}</button>`).join('')}
        </div>

        ${tab === 'suppliers' ? renderSuppliers(list) : tab === 'po' ? renderPOs() : renderPerformance()}
      </div>
    `

    document.querySelectorAll('.tab-btn').forEach(b => b.addEventListener('click', () => { tab = b.dataset.t; renderPage() }))
    document.getElementById('add-supplier-btn')?.addEventListener('click', () => openSupplierForm(null))
    document.getElementById('add-po-btn')?.addEventListener('click', () => openPOForm(null))
    document.getElementById('export-btn')?.addEventListener('click', () => { exportToExcel(list.map(s => ({ ID: s.id, ชื่อ: s.name, หมวด: SUPPLIER_CATS[s.category]?.label, ติดต่อ: s.contact, โทร: s.phone, วงเครดิต: s.creditLimit, ยอดซื้อ: s.totalAmount, สถานะ: SUPPLIER_STATUS[s.status]?.label })), 'suppliers'); showToast('📥 Export แล้ว!', 'success') })
    document.getElementById('search-s')?.addEventListener('input', e => { searchQ = e.target.value; renderPage() })
    document.getElementById('cat-filter')?.addEventListener('change', e => { catFilter = e.target.value; renderPage() })
    document.getElementById('status-filter')?.addEventListener('change', e => { statusFilter = e.target.value; renderPage() })
    document.querySelectorAll('.open-s-btn').forEach(b => b.addEventListener('click', () => { const s = suppliers.find(x => x.id === b.dataset.id); if (s) openSupplierDetail(s) }))
    document.querySelectorAll('.edit-s-btn').forEach(b => b.addEventListener('click', () => { const s = suppliers.find(x => x.id === b.dataset.id); if (s) openSupplierForm(s) }))
    document.querySelectorAll('.open-po-btn').forEach(b => b.addEventListener('click', () => { const p = pos.find(x => x.id === b.dataset.id); if (p) openPODetail(p) }))
    document.querySelectorAll('.po-status-btn').forEach(b => b.addEventListener('click', () => {
      const p = pos.find(x => x.id === b.dataset.id)
      if (!p) return
      p.status = b.dataset.status
      showToast(`✅ อัปเดต PO ${p.id} แล้ว`, 'success')
      renderPage()
    }))
  }

  function renderSuppliers(list) {
    return `
      <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;align-items:center">
        <input class="input" id="search-s" placeholder="🔍 ชื่อ/ผู้ติดต่อ..." value="${escHtml(searchQ)}" style="width:200px">
        <select class="input" id="cat-filter" style="width:160px">
          <option value="all">หมวดหมู่ทั้งหมด</option>
          ${Object.entries(SUPPLIER_CATS).map(([k,v]) => `<option value="${k}" ${catFilter===k?'selected':''}>${v.icon} ${v.label}</option>`).join('')}
        </select>
        <select class="input" id="status-filter" style="width:130px">
          <option value="all">สถานะทั้งหมด</option>
          ${Object.entries(SUPPLIER_STATUS).map(([k,v]) => `<option value="${k}" ${statusFilter===k?'selected':''}>${v.label}</option>`).join('')}
        </select>
      </div>

      <div class="card" style="padding:0;overflow:hidden">
        <table class="table">
          <thead><tr><th>ซัพพลายเออร์</th><th>หมวด</th><th>ผู้ติดต่อ</th><th>เทอม</th><th>วงเครดิต</th><th>ยอดรวม</th><th>Rating</th><th>สถานะ</th><th></th></tr></thead>
          <tbody>
            ${list.map(s => {
              const cat = SUPPLIER_CATS[s.category]
              const st = SUPPLIER_STATUS[s.status]
              const stars = '⭐'.repeat(Math.round(s.rating))
              return `<tr>
                <td>
                  <div style="font-weight:700;font-size:0.88rem">${escHtml(s.name)}</div>
                  <div style="font-size:0.73rem;color:var(--text-muted)">${escHtml(s.taxId)}</div>
                </td>
                <td><span style="font-size:0.82rem">${cat?.icon} ${cat?.label}</span></td>
                <td>
                  <div style="font-size:0.82rem">${escHtml(s.contact)}</div>
                  <div style="font-size:0.73rem;color:var(--text-muted)">${escHtml(s.phone)}</div>
                </td>
                <td style="font-size:0.83rem">${s.paymentTerms} วัน</td>
                <td class="text-right" style="font-size:0.83rem">${formatCurrency(s.creditLimit)}</td>
                <td class="text-right" style="font-size:0.83rem;font-weight:600;color:var(--success)">${formatCurrency(s.totalAmount)}</td>
                <td style="font-size:0.82rem">${stars} ${s.rating}</td>
                <td><span class="badge badge-${st.color}">${st.label}</span></td>
                <td>
                  <div style="display:flex;gap:4px">
                    <button class="btn btn-xs btn-secondary open-s-btn" data-id="${s.id}">ดู</button>
                    <button class="btn btn-xs btn-secondary edit-s-btn" data-id="${s.id}">✏️</button>
                  </div>
                </td>
              </tr>`
            }).join('')}
            ${!list.length ? `<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--text-muted)">ไม่พบข้อมูล</td></tr>` : ''}
          </tbody>
        </table>
      </div>
    `
  }

  function renderPOs() {
    return `
      <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
        <button class="btn btn-primary" id="add-po-btn">+ สร้าง PO ใหม่</button>
      </div>
      <div class="card" style="padding:0;overflow:hidden">
        <table class="table">
          <thead><tr><th>PO#</th><th>ซัพพลายเออร์</th><th>วันที่</th><th>กำหนดรับ</th><th>จำนวนรายการ</th><th>มูลค่ารวม</th><th>สถานะ</th><th></th></tr></thead>
          <tbody>
            ${pos.map(p => {
              const st = PO_STATUS[p.status]
              return `<tr>
                <td><span style="font-family:monospace;font-weight:700">${escHtml(p.id)}</span></td>
                <td style="font-size:0.85rem">${escHtml(p.supplierName)}</td>
                <td style="font-size:0.82rem">${formatDate(p.date)}</td>
                <td style="font-size:0.82rem">${formatDate(p.expectedDate)}</td>
                <td style="text-align:center">${p.items.length} รายการ</td>
                <td class="text-right" style="font-weight:700;color:var(--success)">${formatCurrency(p.total)}</td>
                <td><span class="badge badge-${st.color}">${st.label}</span></td>
                <td>
                  <div style="display:flex;gap:4px">
                    <button class="btn btn-xs btn-secondary open-po-btn" data-id="${p.id}">ดู</button>
                    ${p.status === 'pending' ? `<button class="btn btn-xs btn-success po-status-btn" data-id="${p.id}" data-status="confirmed">✓ ยืนยัน</button>` : ''}
                    ${p.status === 'confirmed' ? `<button class="btn btn-xs btn-primary po-status-btn" data-id="${p.id}" data-status="received">รับของ</button>` : ''}
                  </div>
                </td>
              </tr>`
            }).join('')}
          </tbody>
        </table>
      </div>
    `
  }

  function renderPerformance() {
    const activeSups = suppliers.filter(s => s.status === 'active').sort((a, b) => b.totalAmount - a.totalAmount)
    const maxAmount = Math.max(...activeSups.map(s => s.totalAmount))
    return `
      <div style="display:flex;flex-direction:column;gap:12px">
        <div style="font-weight:700;font-size:0.88rem;margin-bottom:4px">📊 Top Suppliers by Spend</div>
        ${activeSups.map(s => {
          const pct = Math.round(s.totalAmount / maxAmount * 100)
          const cat = SUPPLIER_CATS[s.category]
          return `<div class="card" style="padding:14px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
              <div>
                <span style="font-weight:700;font-size:0.88rem">${escHtml(s.shortName)}</span>
                <span style="font-size:0.78rem;color:var(--text-muted);margin-left:8px">${cat?.icon} ${cat?.label}</span>
              </div>
              <div style="display:flex;gap:16px;font-size:0.82rem">
                <span style="color:var(--text-muted)">${s.totalPO} PO</span>
                <span style="font-weight:700;color:var(--success)">${formatCurrency(s.totalAmount)}</span>
                <span>⭐ ${s.rating}</span>
              </div>
            </div>
            <div style="height:6px;background:var(--surface-2);border-radius:3px;overflow:hidden">
              <div style="height:100%;width:${pct}%;background:var(--primary);border-radius:3px"></div>
            </div>
          </div>`
        }).join('')}
      </div>
    `
  }

  function openSupplierDetail(s) {
    const cat = SUPPLIER_CATS[s.category]
    const st = SUPPLIER_STATUS[s.status]
    const sPOs = pos.filter(p => p.supplierId === s.id)
    openModal({
      title: '🤝 ' + escHtml(s.shortName) + ' — ' + escHtml(s.name),
      size: 'lg',
      body: `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <div>
            <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);margin-bottom:8px">ข้อมูลบริษัท</div>
            ${row2('หมวดหมู่', `${cat?.icon} ${cat?.label}`)}
            ${row2('ผู้ติดต่อ', escHtml(s.contact))}
            ${row2('โทร', escHtml(s.phone))}
            ${row2('อีเมล', escHtml(s.email || '-'))}
            ${row2('ที่อยู่', escHtml(s.address))}
            ${row2('เลขภาษี', escHtml(s.taxId))}
          </div>
          <div>
            <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);margin-bottom:8px">เงื่อนไขการซื้อ</div>
            ${row2('เทอมชำระ', `${s.paymentTerms} วัน`)}
            ${row2('วงเครดิต', formatCurrency(s.creditLimit))}
            ${row2('PO ทั้งหมด', s.totalPO + ' รายการ')}
            ${row2('ยอดซื้อรวม', `<strong style="color:var(--success)">${formatCurrency(s.totalAmount)}</strong>`)}
            ${row2('Rating', `⭐ ${s.rating}`)}
            ${row2('สถานะ', `<span class="badge badge-${st.color}">${st.label}</span>`)}
          </div>
        </div>
        ${s.notes ? `<div style="margin-top:10px;padding:10px;background:var(--surface-2);border-radius:var(--radius-sm);font-size:0.82rem;color:var(--text-muted)">${escHtml(s.notes)}</div>` : ''}
        ${sPOs.length ? `<div style="margin-top:14px"><div style="font-size:0.78rem;font-weight:700;margin-bottom:8px">PO ล่าสุด</div><table class="table" style="font-size:0.8rem"><thead><tr><th>PO#</th><th>วันที่</th><th>มูลค่า</th><th>สถานะ</th></tr></thead><tbody>${sPOs.map(p => `<tr><td>${escHtml(p.id)}</td><td>${formatDate(p.date)}</td><td class="text-right">${formatCurrency(p.total)}</td><td><span class="badge badge-${PO_STATUS[p.status].color}">${PO_STATUS[p.status].label}</span></td></tr>`).join('')}</tbody></table></div>` : ''}
      `,
      footer: `<button class="btn btn-secondary edit-detail-btn">✏️ แก้ไข</button>`
    })
    setTimeout(() => { document.querySelector('.modal .edit-detail-btn')?.addEventListener('click', () => { document.querySelector('.modal-close-btn')?.click(); openSupplierForm(s) }) }, 50)
  }

  function openSupplierForm(s) {
    openModal({
      title: s ? '✏️ แก้ไข ' + escHtml(s.name) : '+ เพิ่มซัพพลายเออร์',
      size: 'lg',
      body: `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="input-group" style="grid-column:1/-1"><label class="input-label">ชื่อบริษัท *</label><input class="input" id="sf-name" value="${escHtml(s?.name||'')}"></div>
        <div class="input-group"><label class="input-label">ชื่อย่อ</label><input class="input" id="sf-short" value="${escHtml(s?.shortName||'')}"></div>
        <div class="input-group"><label class="input-label">หมวดหมู่</label><select class="input" id="sf-cat">${Object.entries(SUPPLIER_CATS).map(([k,v]) => `<option value="${k}" ${s?.category===k?'selected':''}>${v.icon} ${v.label}</option>`).join('')}</select></div>
        <div class="input-group"><label class="input-label">ผู้ติดต่อ</label><input class="input" id="sf-contact" value="${escHtml(s?.contact||'')}"></div>
        <div class="input-group"><label class="input-label">โทรศัพท์</label><input class="input" id="sf-phone" value="${escHtml(s?.phone||'')}"></div>
        <div class="input-group"><label class="input-label">อีเมล</label><input class="input" id="sf-email" value="${escHtml(s?.email||'')}"></div>
        <div class="input-group"><label class="input-label">เลขภาษี</label><input class="input" id="sf-tax" value="${escHtml(s?.taxId||'')}"></div>
        <div class="input-group"><label class="input-label">เทอมชำระ (วัน)</label><input type="number" class="input" id="sf-terms" value="${s?.paymentTerms||30}"></div>
        <div class="input-group"><label class="input-label">วงเครดิต (บาท)</label><input type="number" class="input" id="sf-credit" value="${s?.creditLimit||100000}"></div>
        <div class="input-group" style="grid-column:1/-1"><label class="input-label">ที่อยู่</label><input class="input" id="sf-addr" value="${escHtml(s?.address||'')}"></div>
        <div class="input-group" style="grid-column:1/-1"><label class="input-label">หมายเหตุ</label><input class="input" id="sf-notes" value="${escHtml(s?.notes||'')}"></div>
      </div>`,
      onConfirm() {
        const name = document.getElementById('sf-name')?.value?.trim()
        if (!name) { showToast('❗ กรุณากรอกชื่อบริษัท', 'error'); return }
        if (s) {
          Object.assign(s, { name, shortName: document.getElementById('sf-short').value, category: document.getElementById('sf-cat').value, contact: document.getElementById('sf-contact').value, phone: document.getElementById('sf-phone').value, email: document.getElementById('sf-email').value, taxId: document.getElementById('sf-tax').value, paymentTerms: +document.getElementById('sf-terms').value, creditLimit: +document.getElementById('sf-credit').value, address: document.getElementById('sf-addr').value, notes: document.getElementById('sf-notes').value })
          showToast('✅ แก้ไขซัพพลายเออร์แล้ว', 'success')
        } else {
          suppliers.unshift({ id: `S${String(suppliers.length+1).padStart(3,'0')}`, name, shortName: document.getElementById('sf-short').value, category: document.getElementById('sf-cat').value, contact: document.getElementById('sf-contact').value, phone: document.getElementById('sf-phone').value, email: document.getElementById('sf-email').value, taxId: document.getElementById('sf-tax').value, paymentTerms: +document.getElementById('sf-terms').value, creditLimit: +document.getElementById('sf-credit').value, address: document.getElementById('sf-addr').value, notes: document.getElementById('sf-notes').value, status: 'active', rating: 5.0, totalPO: 0, totalAmount: 0 })
          showToast('✅ เพิ่มซัพพลายเออร์แล้ว', 'success')
        }
        renderPage()
      }
    })
  }

  function openPODetail(p) {
    const st = PO_STATUS[p.status]
    openModal({
      title: '📋 ' + escHtml(p.id) + ' — Purchase Order',
      size: 'lg',
      body: `
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px">
          <div>
            <div style="font-weight:700">${escHtml(p.supplierName)}</div>
            <div style="font-size:0.8rem;color:var(--text-muted)">วันที่สั่ง: ${formatDate(p.date)} · กำหนดรับ: ${formatDate(p.expectedDate)}</div>
          </div>
          <span class="badge badge-${st.color} badge-lg">${st.label}</span>
        </div>
        <table class="table" style="font-size:0.83rem">
          <thead><tr><th>รายการ</th><th>จำนวน</th><th>หน่วย</th><th class="text-right">ราคา/หน่วย</th><th class="text-right">รวม</th></tr></thead>
          <tbody>
            ${p.items.map(item => `<tr><td>${escHtml(item.name)}</td><td style="text-align:center">${item.qty}</td><td>${escHtml(item.unit)}</td><td class="text-right">${formatCurrency(item.price)}</td><td class="text-right"><strong>${formatCurrency(item.qty * item.price)}</strong></td></tr>`).join('')}
          </tbody>
          <tfoot>
            <tr><td colspan="3"></td><td style="text-align:right;font-weight:700;padding:8px">รวมทั้งสิ้น</td><td class="text-right" style="font-weight:800;color:var(--success);font-size:1rem">${formatCurrency(p.total)}</td></tr>
          </tfoot>
        </table>
        ${p.notes ? `<div style="margin-top:10px;padding:10px;background:var(--surface-2);border-radius:var(--radius-sm);font-size:0.82rem">📌 ${escHtml(p.notes)}</div>` : ''}
      `,
      footer: ''
    })
  }

  function openPOForm(existing) {
    const s = suppliers.filter(x => x.status === 'active')
    openModal({
      title: '+ สร้าง Purchase Order',
      size: 'md',
      body: `<div style="display:flex;flex-direction:column;gap:12px">
        <div class="input-group"><label class="input-label">ซัพพลายเออร์ *</label>
          <select class="input" id="po-supplier">${s.map(x => `<option value="${escHtml(x.id)}">${escHtml(x.name)}</option>`).join('')}</select>
        </div>
        <div class="input-group"><label class="input-label">กำหนดรับ</label><input type="date" class="input" id="po-exp" value="${addDays(new Date(), 7).toISOString().slice(0,10)}"></div>
        <div class="input-group"><label class="input-label">รายการสั่งซื้อ (1 รายการ)</label>
          <input class="input" id="po-item-name" placeholder="ชื่อสินค้า">
          <div style="display:flex;gap:8px;margin-top:6px">
            <input type="number" class="input" id="po-qty" placeholder="จำนวน" style="width:80px">
            <input class="input" id="po-unit" placeholder="หน่วย" style="width:80px" value="ชิ้น">
            <input type="number" class="input" id="po-price" placeholder="ราคา">
          </div>
        </div>
        <div class="input-group"><label class="input-label">หมายเหตุ</label><input class="input" id="po-notes" placeholder="หมายเหตุ..."></div>
      </div>`,
      onConfirm() {
        const supId = document.getElementById('po-supplier')?.value
        const sup = suppliers.find(x => x.id === supId)
        const itemName = document.getElementById('po-item-name')?.value?.trim()
        const qty = +document.getElementById('po-qty')?.value || 1
        const price = +document.getElementById('po-price')?.value || 0
        if (!itemName) { showToast('❗ กรุณากรอกรายการสินค้า', 'error'); return }
        pos.unshift({ id: `PO${String(pos.length+1).padStart(3,'0')}`, supplierId: supId, supplierName: sup?.name || '', date: new Date().toISOString().slice(0,10), expectedDate: document.getElementById('po-exp')?.value, status: 'pending', items: [{ name: itemName, qty, unit: document.getElementById('po-unit')?.value||'ชิ้น', price }], total: qty * price, notes: document.getElementById('po-notes')?.value||'' })
        showToast('📋 สร้าง PO แล้ว!', 'success')
        tab = 'po'
        renderPage()
      }
    })
  }

  function addDays(d, n) { const dt = new Date(d); dt.setDate(dt.getDate()+n); return dt }

  renderPage()
}

function kpi(title, value, color) {
  return `<div class="kpi-card"><div class="kpi-title">${title}</div><div class="kpi-value" style="color:var(--${color})">${value}</div></div>`
}

function row2(label, value) {
  return `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);font-size:0.82rem"><span style="color:var(--text-muted)">${label}</span><span>${value}</span></div>`
}
