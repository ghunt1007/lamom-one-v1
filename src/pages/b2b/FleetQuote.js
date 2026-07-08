/**
 * Fleet Quote — ใบเสนอราคา Fleet
 * Route: /b2b/fleet-quote
 */
import { formatCurrency, formatDate } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'

function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10) }

const FLEET_STATUS = {
  draft:     { label: 'ร่าง', color: 'secondary', icon: '📝' },
  sent:      { label: 'ส่งแล้ว', color: 'primary', icon: '📤' },
  negotiate: { label: 'เจรจา', color: 'warning', icon: '🤝' },
  approved:  { label: 'อนุมัติ', color: 'success', icon: '✅' },
  rejected:  { label: 'ปฏิเสธ', color: 'danger', icon: '❌' },
}

const MODELS = ['BYD Dolphin', 'BYD Atto 3', 'BYD Seal AWD', 'MG ZS EV', 'BYD Han', 'BYD Atto 3 Pro']
const MSRP = { 'BYD Dolphin': 899000, 'BYD Atto 3': 1099000, 'BYD Seal AWD': 1699000, 'MG ZS EV': 799000, 'BYD Han': 2099000, 'BYD Atto 3 Pro': 1299000 }

function calcTotal(q) { return q.units * q.unitPrice * (1 - q.discount/100) }

export default async function FleetQuotePage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let quotes = []
  let statusFilter = 'all'
  let loading = true

  async function loadData() {
    loading = true
    try { quotes = await listDocs('fleet_quotes', [], 'created', 'desc', 500) } catch (e) { quotes = [] }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
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
    const setStatus = async (id, status, msg, type) => {
      try {
        await updateDocData('fleet_quotes', id, { status })
        if (msg) showToast(msg, type)
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    }
    container.querySelectorAll('.send-btn').forEach(b => b.addEventListener('click', () => setStatus(b.dataset.id, 'sent', '📤 ส่ง Quote แล้ว', 'primary')))
    container.querySelectorAll('.negotiate-btn').forEach(b => b.addEventListener('click', () => setStatus(b.dataset.id, 'negotiate', '🤝 เปลี่ยนสถานะเป็นเจรจา', 'warning')))
    container.querySelectorAll('.approve-btn').forEach(b => b.addEventListener('click', () => setStatus(b.dataset.id, 'approved', '✅ อนุมัติ Fleet Quote!', 'success')))
    container.querySelectorAll('.reject-btn').forEach(b => b.addEventListener('click', () => setStatus(b.dataset.id, 'rejected')))
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
      async onConfirm() {
        const company = document.getElementById('fq-company')?.value?.trim()
        if (!company) { showToast('❗ กรุณากรอกชื่อบริษัท','error'); return false }
        const data = {
          company, contact: document.getElementById('fq-contact')?.value||'',
          model: document.getElementById('fq-model')?.value||(q?.model||MODELS[0]),
          units: parseInt(document.getElementById('fq-units')?.value)||1,
          unitPrice: parseInt(document.getElementById('fq-price')?.value)||1000000,
          discount: parseInt(document.getElementById('fq-discount')?.value)||0,
          expiry: document.getElementById('fq-expiry')?.value||addDays(30),
          note: document.getElementById('fq-note')?.value||'',
        }
        try {
          if (q) await updateDocData('fleet_quotes', q.id, data)
          else await createDoc('fleet_quotes', { ...data, status:'draft', created: addDays(0) })
          showToast('✅ บันทึก Quote แล้ว','success')
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      }
    })
  }

  await loadData()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
