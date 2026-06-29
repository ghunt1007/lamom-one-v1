/**
 * Fleet Quote — ใบเสนอราคา Fleet
 * Route: /b2b/fleet-quote
 */
import { formatCurrency, formatDate } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'

function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10) }

const FLEET_STATUS = {
  draft:     { label: 'ร่าง', color: 'secondary', icon: '📝' },
  sent:      { label: 'ส่งแล้ว', color: 'primary', icon: '📤' },
  negotiate: { label: 'เจรจา', color: 'warning', icon: '🤝' },
  approved:  { label: 'อนุมัติ', color: 'success', icon: '✅' },
  rejected:  { label: 'ปฏิเสธ', color: 'danger', icon: '❌' },
}

const DEMO_FLEET_QUOTES = [
  { id: 'FQ001', company: 'บริษัท ABC จำกัด', contact: 'คุณประเสริฐ', units: 15, model: 'BYD Atto 3', unitPrice: 1050000, discount: 5, status: 'negotiate', created: addDays(-10), expiry: addDays(20), note: 'ต้องการรถสีขาว 10 คำ เทา 5 คัน' },
  { id: 'FQ002', company: 'ธนาคารแห่งชาติ', contact: 'คุณศักดา', units: 30, model: 'BYD Dolphin', unitPrice: 860000, discount: 8, status: 'approved', created: addDays(-20), expiry: addDays(10), note: 'สัญญา 3 ปี พร้อมบริการซ่อม' },
  { id: 'FQ003', company: 'โรงพยาบาลกรุงเทพ', contact: 'ฝ่ายจัดซื้อ', units: 8, model: 'BYD Seal AWD', unitPrice: 1620000, discount: 3, status: 'sent', created: addDays(-5), expiry: addDays(25), note: '' },
  { id: 'FQ004', company: 'SCG Group', contact: 'คุณวิชัย', units: 50, model: 'BYD Atto 3', unitPrice: 1020000, discount: 10, status: 'draft', created: addDays(-2), expiry: addDays(28), note: 'ต้องการ charging station ด้วย' },
]

const MODELS = ['BYD Dolphin', 'BYD Atto 3', 'BYD Seal AWD', 'MG ZS EV', 'BYD Han', 'BYD Atto 3 Pro']
const MSRP = { 'BYD Dolphin': 899000, 'BYD Atto 3': 1099000, 'BYD Seal AWD': 1699000, 'MG ZS EV': 799000, 'BYD Han': 2099000, 'BYD Atto 3 Pro': 1299000 }

function calcTotal(q) { return q.units * q.unitPrice * (1 - q.discount/100) }

export default async function FleetQuotePage(container) {
  let quotes = DEMO_FLEET_QUOTES.map(q => ({ ...q }))
  let statusFilter = 'all'

  function renderPage() {
    const list = quotes.filter(q => statusFilter === 'all' || q.status === statusFilter)
    const totalValue = quotes.reduce((a, q) => a + calcTotal(q), 0)
    const approved = quotes.filter(q => q.status === 'approved')
    const approvedValue = approved.reduce((a, q) => a + calcTotal(q), 0)
    const totalUnits = quotes.reduce((a, q) => a + q.units, 0)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🚌 Fleet Quote</div>
            <div class="page-subtitle">ใบเสนอราคากลุ่มองค์กร / Fleet</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="create-quote-btn">+ สร้างใบเสนอราคา</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('📄 Quotes ทั้งหมด', quotes.length, 'primary')}
          ${kpi('🚗 รถรวม', totalUnits + ' คัน', 'secondary')}
          ${kpi('💰 มูลค่ารวม', formatCurrency(totalValue), 'warning')}
          ${kpi('✅ อนุมัติแล้ว', formatCurrency(approvedValue), 'success')}
        </div>

        <!-- Status filter -->
        <div style="display:flex;gap:4px;margin-bottom:12px;flex-wrap:wrap">
          <button class="btn btn-xs ${statusFilter==='all'?'btn-primary':'btn-secondary'} sf-btn" data-s="all">ทั้งหมด</button>
          ${Object.entries(FLEET_STATUS).map(([k,v]) => `<button class="btn btn-xs ${statusFilter===k?'btn-'+v.color:'btn-secondary'} sf-btn" data-s="${k}">${v.icon} ${v.label}</button>`).join('')}
        </div>

        <!-- Quote cards -->
        <div style="display:flex;flex-direction:column;gap:10px">
          ${list.map(q => {
            const fs = FLEET_STATUS[q.status]
            const total = calcTotal(q)
            const isExpiringSoon = q.expiry <= addDays(7)
            return `<div class="card" style="padding:14px;border-left:3px solid var(--${fs?.color})">
              <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px">
                <div>
                  <div style="font-weight:700;font-size:0.92rem">${q.company}</div>
                  <div style="font-size:0.72rem;color:var(--text-muted)">👤 ${q.contact} · 🚗 ${q.units} × ${q.model}</div>
                  <div style="font-size:0.72rem;color:var(--text-muted)">📅 สร้าง ${formatDate(q.created)} · หมดอายุ ${formatDate(q.expiry)}${isExpiringSoon?' ⚠️':''}</div>
                </div>
                <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
                  <span class="badge badge-${fs?.color}" style="font-size:0.63rem">${fs?.icon} ${fs?.label}</span>
                  <div style="font-weight:700;font-size:0.92rem;color:var(--success)">${formatCurrency(total)}</div>
                  <div style="font-size:0.67rem;color:var(--text-muted)">ส่วนลด ${q.discount}%</div>
                </div>
              </div>
              ${q.note ? `<div style="font-size:0.73rem;color:var(--text-muted);font-style:italic;margin-bottom:8px">📌 ${q.note}</div>` : ''}
              <div style="display:flex;gap:6px;flex-wrap:wrap">
                ${q.status === 'draft' ? `<button class="btn btn-xs btn-primary send-btn" data-id="${q.id}">📤 ส่ง</button>` : ''}
                ${q.status === 'sent' ? `<button class="btn btn-xs btn-warning negotiate-btn" data-id="${q.id}">🤝 เจรจา</button>` : ''}
                ${q.status === 'negotiate' ? `<button class="btn btn-xs btn-success approve-btn" data-id="${q.id}">✅ อนุมัติ</button><button class="btn btn-xs btn-danger reject-btn" data-id="${q.id}">❌</button>` : ''}
                <button class="btn btn-xs btn-secondary edit-btn" data-id="${q.id}">✏️ แก้ไข</button>
              </div>
            </div>`
          }).join('')}
        </div>
      </div>
    `

    container.querySelectorAll('.sf-btn').forEach(b => b.addEventListener('click', () => { statusFilter = b.dataset.s; renderPage() }))
    container.querySelectorAll('.send-btn').forEach(b => b.addEventListener('click', () => { const q = quotes.find(x=>x.id===b.dataset.id); if(q){q.status='sent'; showToast('📤 ส่ง Quote แล้ว','primary'); renderPage()} }))
    container.querySelectorAll('.negotiate-btn').forEach(b => b.addEventListener('click', () => { const q = quotes.find(x=>x.id===b.dataset.id); if(q){q.status='negotiate'; showToast('🤝 เปลี่ยนสถานะเป็นเจรจา','warning'); renderPage()} }))
    container.querySelectorAll('.approve-btn').forEach(b => b.addEventListener('click', () => { const q = quotes.find(x=>x.id===b.dataset.id); if(q){q.status='approved'; showToast('✅ อนุมัติ Fleet Quote!','success'); renderPage()} }))
    container.querySelectorAll('.reject-btn').forEach(b => b.addEventListener('click', () => { const q = quotes.find(x=>x.id===b.dataset.id); if(q){q.status='rejected'; renderPage()} }))
    container.querySelectorAll('.edit-btn').forEach(b => b.addEventListener('click', () => { const q = quotes.find(x=>x.id===b.dataset.id); if(q) openEditModal(q) }))
    document.getElementById('create-quote-btn')?.addEventListener('click', () => openEditModal())
  }

  function openEditModal(q = null) {
    openModal({
      title: q ? '✏️ แก้ไข Quote' : '+ สร้าง Fleet Quote',
      size: 'md',
      body: `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="input-group" style="grid-column:1/-1"><label class="input-label">บริษัท *</label><input class="input" id="fq-company" value="${q?.company||''}"></div>
        <div class="input-group"><label class="input-label">ผู้ติดต่อ</label><input class="input" id="fq-contact" value="${q?.contact||''}"></div>
        <div class="input-group"><label class="input-label">รุ่นรถ</label>
          <select class="input" id="fq-model">${MODELS.map(m=>`<option ${q?.model===m?'selected':''}>${m}</option>`).join('')}</select>
        </div>
        <div class="input-group"><label class="input-label">จำนวน (คัน)</label><input class="input" type="number" id="fq-units" value="${q?.units||1}"></div>
        <div class="input-group"><label class="input-label">ราคาต่อคัน</label><input class="input" type="number" id="fq-price" value="${q?.unitPrice||1000000}"></div>
        <div class="input-group"><label class="input-label">ส่วนลด (%)</label><input class="input" type="number" id="fq-discount" min="0" max="30" value="${q?.discount||0}"></div>
        <div class="input-group"><label class="input-label">วันหมดอายุ</label><input class="input" type="date" id="fq-expiry" value="${q?.expiry||addDays(30)}"></div>
        <div class="input-group" style="grid-column:1/-1"><label class="input-label">หมายเหตุ</label><input class="input" id="fq-note" value="${q?.note||''}"></div>
      </div>`,
      onConfirm() {
        const company = document.getElementById('fq-company')?.value?.trim()
        if (!company) { showToast('❗ กรุณากรอกชื่อบริษัท','error'); return }
        if (q) {
          q.company = company; q.contact = document.getElementById('fq-contact')?.value||''
          q.model = document.getElementById('fq-model')?.value||q.model
          q.units = parseInt(document.getElementById('fq-units')?.value)||q.units
          q.unitPrice = parseInt(document.getElementById('fq-price')?.value)||q.unitPrice
          q.discount = parseInt(document.getElementById('fq-discount')?.value)||0
          q.expiry = document.getElementById('fq-expiry')?.value||q.expiry
          q.note = document.getElementById('fq-note')?.value||''
        } else {
          quotes.unshift({ id:`FQ${String(quotes.length+1).padStart(3,'0')}`, company, contact: document.getElementById('fq-contact')?.value||'', model: document.getElementById('fq-model')?.value||MODELS[0], units: parseInt(document.getElementById('fq-units')?.value)||1, unitPrice: parseInt(document.getElementById('fq-price')?.value)||1000000, discount: parseInt(document.getElementById('fq-discount')?.value)||0, status:'draft', created: addDays(0), expiry: document.getElementById('fq-expiry')?.value||addDays(30), note: document.getElementById('fq-note')?.value||'' })
        }
        showToast('✅ บันทึก Quote แล้ว','success'); renderPage()
      }
    })
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
