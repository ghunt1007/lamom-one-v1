/**
 * Insurance Renewal — ต่ออายุประกันภัย
 * Route: /insurance/renewal
 */
import { formatCurrency, formatDate } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { exportToExcel } from '../../utils/importExport.js'
import { getInsurers } from '../../data/masterData.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const INS_TYPE = {
  class1:    { label: 'ประกันชั้น 1', color: 'success' },
  class2:    { label: 'ประกันชั้น 2', color: 'warning' },
  class2plus:{ label: 'ประกันชั้น 2+', color: 'primary' },
  class3:    { label: 'ประกันชั้น 3', color: 'secondary' },
  class3plus:{ label: 'ประกันชั้น 3+', color: 'warning' },
  compulsory:{ label: 'ประกัน พ.ร.บ.', color: 'secondary' },
}

const RENEWAL_STATUS = {
  upcoming:  { label: 'ใกล้หมดอายุ', color: 'warning' },
  expired:   { label: 'หมดอายุแล้ว', color: 'danger' },
  renewed:   { label: 'ต่อแล้ว', color: 'success' },
  cancelled: { label: 'ยกเลิก', color: 'secondary' },
}

const INSURERS = getInsurers()

function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }

const DEMO_POLICIES = [
  { id: 'INS001', customerId: 'C001', customerName: 'วิชาญ มีโชค', phone: '081-234-5678',
    vehiclePlate: 'กก 1234', vehicleModel: 'BYD Seal AWD', vehicleYear: 2024,
    insurer: 'เมืองไทยประกันภัย', policyNo: 'MTI-2024-123456', type: 'class1',
    premium: 28500, coverAmount: 1449000, expiryDate: addDays(30),
    startDate: addDays(-335), status: 'upcoming', lastRenewedDate: addDays(-335), salesperson: 'อรนุช สายใจ',
    notes: 'ลูกค้าสนใจต่อกับ insurer เดิม' },
  { id: 'INS002', customerId: 'C002', customerName: 'อรนุช สาวสวย', phone: '082-345-6789',
    vehiclePlate: 'ขข 5678', vehicleModel: 'MG ZS EV', vehicleYear: 2024,
    insurer: 'กรุงเทพประกันภัย', policyNo: 'BKK-2024-789012', type: 'class1',
    premium: 22000, coverAmount: 1059000, expiryDate: addDays(-5),
    startDate: addDays(-370), status: 'expired', lastRenewedDate: addDays(-370), salesperson: 'วิชาญ มีโชค',
    notes: 'ต้องรีบต่อด่วน' },
  { id: 'INS003', customerId: 'C003', customerName: 'ธีรยุทธ เก่งกาจ', phone: '083-456-7890',
    vehiclePlate: 'คค 9012', vehicleModel: 'BYD Atto 3', vehicleYear: 2024,
    insurer: 'วิริยะประกันภัย', policyNo: 'VIR-2024-345678', type: 'class2plus',
    premium: 15800, coverAmount: 1099000, expiryDate: addDays(65),
    startDate: addDays(-300), status: 'upcoming', lastRenewedDate: addDays(-300), salesperson: 'อรนุช สายใจ',
    notes: '' },
  { id: 'INS004', customerId: 'C004', customerName: 'สมใจ รักรถ', phone: '084-567-8901',
    vehiclePlate: 'งง 3456', vehicleModel: 'BYD Seal SR', vehicleYear: 2024,
    insurer: 'ทิพยประกันภัย', policyNo: 'TIP-2024-567890', type: 'class1',
    premium: 26000, coverAmount: 1199000, expiryDate: addDays(180),
    startDate: addDays(-185), status: 'renewed', lastRenewedDate: addDays(-185), salesperson: 'อรนุช สายใจ',
    notes: '' },
]

export default async function InsuranceRenewalPage(container) {
  let statusFilter = 'all'
  let policies = DEMO_POLICIES.map(p => ({ ...p }))

  const today = addDays(0)

  function daysUntilExpiry(p) {
    return Math.ceil((new Date(p.expiryDate) - new Date(today)) / 86400000)
  }

  function filtered() {
    return policies.filter(p => statusFilter === 'all' || p.status === statusFilter)
      .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate))
  }

  function renderPage() {
    const list = filtered()
    const expired = policies.filter(p => p.status === 'expired').length
    const upcoming30 = policies.filter(p => p.status === 'upcoming' && daysUntilExpiry(p) <= 30).length
    const totalPremium = policies.filter(p => p.status === 'renewed').reduce((a, p) => a + p.premium, 0)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🛡 ต่ออายุประกันภัย</div>
            <div class="page-subtitle">Insurance Renewal — ติดตามและต่ออายุกรมธรรม์</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="export-btn">📥 Export</button>
            <button class="btn btn-primary" id="add-ins-btn">+ เพิ่มกรมธรรม์</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('❗ หมดอายุแล้ว', expired, expired > 0 ? 'danger' : 'secondary')}
          ${kpi('⚠️ หมดใน 30 วัน', upcoming30, upcoming30 > 0 ? 'warning' : 'secondary')}
          ${kpi('✅ ต่อแล้ว', policies.filter(p=>p.status==='renewed').length, 'success')}
          ${kpi('💰 เบี้ยรวม (ต่อแล้ว)', formatCurrency(totalPremium), 'primary')}
        </div>

        <div style="display:flex;gap:4px;margin-bottom:12px;flex-wrap:wrap">
          <button class="btn btn-sm ${statusFilter==='all'?'btn-primary':'btn-secondary'} sf-btn" data-s="all">ทั้งหมด</button>
          ${Object.entries(RENEWAL_STATUS).map(([k,v]) => `<button class="btn btn-sm ${statusFilter===k?'btn-'+v.color:'btn-secondary'} sf-btn" data-s="${k}">${v.label}</button>`).join('')}
        </div>

        <div style="display:flex;flex-direction:column;gap:8px">
          ${list.map(p => {
            const st = RENEWAL_STATUS[p.status]
            const it = INS_TYPE[p.type]
            const days = daysUntilExpiry(p)
            const isExpired = days < 0
            return `<div class="card" style="padding:12px 14px;border-left:3px solid var(--${st?.color})">
              <div style="display:flex;align-items:center;gap:12px">
                <div style="flex:1">
                  <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
                    <span style="font-weight:700;font-size:0.9rem">${escHtml(p.customerName)}</span>
                    <span class="badge badge-${it?.color}">${it?.label}</span>
                    <span class="badge badge-${st?.color}">${st?.label}</span>
                  </div>
                  <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:4px">${escHtml(p.vehicleModel)} · ${escHtml(p.vehiclePlate)} · ${escHtml(p.insurer)}</div>
                  <div style="display:flex;gap:16px;font-size:0.78rem">
                    <span>📋 ${escHtml(p.policyNo)}</span>
                    <span>💰 เบี้ย <strong>${formatCurrency(p.premium)}</strong>/ปี</span>
                    <span style="color:${isExpired?'var(--danger)':days<=30?'var(--warning)':'inherit'}">
                      📅 หมดอายุ ${formatDate(p.expiryDate)}
                      ${isExpired ? `(เกิน ${Math.abs(days)} วัน!)` : days <= 30 ? `(อีก ${days} วัน)` : ''}
                    </span>
                  </div>
                </div>
                <div style="display:flex;flex-direction:column;gap:4px">
                  <button class="btn btn-xs btn-secondary open-ins-btn" data-id="${p.id}">ดู</button>
                  ${p.status !== 'renewed' && p.status !== 'cancelled' ? `<button class="btn btn-xs btn-success renew-ins-btn" data-id="${p.id}">✓ ต่อแล้ว</button>` : ''}
                </div>
              </div>
            </div>`
          }).join('')}
          ${!list.length ? `<div class="empty-state"><div class="empty-state-icon">🛡</div><div>ไม่พบกรมธรรม์</div></div>` : ''}
        </div>
      </div>
    `

    container.querySelectorAll('.sf-btn').forEach(b => b.addEventListener('click', () => { statusFilter = b.dataset.s; renderPage() }))
    document.getElementById('add-ins-btn')?.addEventListener('click', openAddForm)
    document.getElementById('export-btn')?.addEventListener('click', () => {
      exportToExcel(policies.map(p => ({ ID: p.id, ลูกค้า: p.customerName, รถ: p.vehicleModel, ทะเบียน: p.vehiclePlate, บริษัท: p.insurer, ประเภท: INS_TYPE[p.type]?.label, เบี้ย: p.premium, หมดอายุ: p.expiryDate, สถานะ: RENEWAL_STATUS[p.status]?.label })), 'insurance_renewals')
      showToast('📥 Export แล้ว!', 'success')
    })
    container.querySelectorAll('.open-ins-btn').forEach(b => b.addEventListener('click', () => {
      const p = policies.find(x => x.id === b.dataset.id); if (p) openDetail(p)
    }))
    container.querySelectorAll('.renew-ins-btn').forEach(b => b.addEventListener('click', () => {
      const p = policies.find(x => x.id === b.dataset.id)
      if (p) openRenewModal(p)
    }))
  }

  function openDetail(p) {
    const st = RENEWAL_STATUS[p.status]
    const it = INS_TYPE[p.type]
    const days = daysUntilExpiry(p)
    openModal({
      title: '🛡 ' + escHtml(p.id) + ' — ' + escHtml(p.customerName),
      size: 'md',
      body: `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
          <div>
            <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);margin-bottom:6px">รถ</div>
            ${row('รุ่น', escHtml(p.vehicleModel))}${row('ทะเบียน', escHtml(p.vehiclePlate))}${row('ปี', p.vehicleYear)}
          </div>
          <div>
            <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);margin-bottom:6px">กรมธรรม์</div>
            ${row('บริษัท', escHtml(p.insurer))}${row('เลขที่', escHtml(p.policyNo))}${row('ประเภท', `<span class="badge badge-${it?.color}">${it?.label}</span>`)}
          </div>
        </div>
        <div style="margin-top:14px">
          ${row('เบี้ยประกัน', `<strong>${formatCurrency(p.premium)}/ปี</strong>`)}
          ${row('ทุนประกัน', formatCurrency(p.coverAmount))}
          ${row('เริ่ม', formatDate(p.startDate))}
          ${row('หมดอายุ', `<span style="color:${days<0?'var(--danger)':days<=30?'var(--warning)':'inherit'}">${formatDate(p.expiryDate)} ${days<0?'(หมดอายุ '+Math.abs(days)+' วันที่แล้ว)':days<=30?'(อีก '+days+' วัน)':''}</span>`)}
          ${row('สถานะ', `<span class="badge badge-${st?.color}">${st?.label}</span>`)}
        </div>
        ${p.notes ? `<div style="margin-top:10px;padding:10px;background:var(--surface-2);border-radius:var(--radius-sm);font-size:0.82rem">📌 ${escHtml(p.notes)}</div>` : ''}
      `,
      footer: p.status !== 'renewed' && p.status !== 'cancelled' ? `<button class="btn btn-success renew-modal-btn">✓ บันทึกการต่อประกัน</button>` : ''
    })
    setTimeout(() => {
      document.querySelector('.modal .renew-modal-btn')?.addEventListener('click', () => {
        document.querySelector('.modal-close-btn')?.click()
        openRenewModal(p)
      })
    }, 50)
  }

  function openRenewModal(p) {
    openModal({
      title: '✓ ต่อประกัน — ' + escHtml(p.customerName),
      size: 'md',
      body: `
        <div style="padding:10px;background:var(--surface-2);border-radius:var(--radius-sm);margin-bottom:12px;font-size:0.83rem">
          <strong>${escHtml(p.vehicleModel)} ${escHtml(p.vehiclePlate)}</strong>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="input-group"><label class="input-label">บริษัทประกัน</label>
            <select class="input" id="rn-insurer">${INSURERS.map(i => `<option ${i===p.insurer?'selected':''}>${i}</option>`).join('')}</select>
          </div>
          <div class="input-group"><label class="input-label">ประเภทประกัน</label>
            <select class="input" id="rn-type">${Object.entries(INS_TYPE).map(([k,v]) => `<option value="${k}" ${p.type===k?'selected':''}>${v.label}</option>`).join('')}</select>
          </div>
          <div class="input-group"><label class="input-label">เบี้ยประกัน (บาท)</label><input type="number" class="input" id="rn-premium" value="${p.premium}"></div>
          <div class="input-group"><label class="input-label">วันเริ่มกรมธรรม์ใหม่</label><input type="date" class="input" id="rn-start" value="${today}"></div>
        </div>
      `,
      confirmLabel: '✅ บันทึกการต่อประกัน',
      confirmClass: 'btn-success',
      onConfirm() {
        const newStart = document.getElementById('rn-start')?.value || today
        const expiry = new Date(newStart); expiry.setFullYear(expiry.getFullYear() + 1)
        p.status = 'renewed'
        p.insurer = document.getElementById('rn-insurer')?.value || p.insurer
        p.type = document.getElementById('rn-type')?.value || p.type
        p.premium = +document.getElementById('rn-premium')?.value || p.premium
        p.startDate = newStart
        p.expiryDate = expiry.toISOString().slice(0, 10)
        p.lastRenewedDate = today
        showToast(`✅ ต่อประกัน ${p.customerName} เรียบร้อย!`, 'success')
        renderPage()
      }
    })
  }

  function openAddForm() {
    openModal({
      title: '+ เพิ่มกรมธรรม์ประกัน',
      size: 'lg',
      body: `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="input-group"><label class="input-label">ชื่อลูกค้า *</label><input class="input" id="inf-name" placeholder="ชื่อลูกค้า"></div>
          <div class="input-group"><label class="input-label">โทรศัพท์</label><input class="input" id="inf-phone" placeholder="08x-xxx-xxxx"></div>
          <div class="input-group"><label class="input-label">รุ่นรถ</label><input class="input" id="inf-model" placeholder="BYD Seal AWD"></div>
          <div class="input-group"><label class="input-label">ทะเบียนรถ</label><input class="input" id="inf-plate" placeholder="กก 1234"></div>
          <div class="input-group"><label class="input-label">บริษัทประกัน</label>
            <select class="input" id="inf-insurer">${INSURERS.map(i => `<option>${i}</option>`).join('')}</select>
          </div>
          <div class="input-group"><label class="input-label">ประเภท</label>
            <select class="input" id="inf-type">${Object.entries(INS_TYPE).map(([k,v]) => `<option value="${k}">${v.label}</option>`).join('')}</select>
          </div>
          <div class="input-group"><label class="input-label">เลขกรมธรรม์</label><input class="input" id="inf-policy" placeholder="ABC-2025-XXXXXX"></div>
          <div class="input-group"><label class="input-label">เบี้ยประกัน (บาท)</label><input type="number" class="input" id="inf-premium" placeholder="25000"></div>
          <div class="input-group"><label class="input-label">วันเริ่ม</label><input type="date" class="input" id="inf-start" value="${today}"></div>
          <div class="input-group"><label class="input-label">เซลส์</label><input class="input" id="inf-sales" placeholder="ชื่อเซลส์"></div>
        </div>
      `,
      onConfirm() {
        const name = document.getElementById('inf-name')?.value?.trim()
        if (!name) { showToast('❗ กรุณากรอกชื่อลูกค้า', 'error'); return }
        const start = document.getElementById('inf-start')?.value || today
        const expiry = new Date(start); expiry.setFullYear(expiry.getFullYear() + 1)
        policies.unshift({
          id: `INS${String(policies.length+1).padStart(3,'0')}`,
          customerId: '', customerName: name, phone: document.getElementById('inf-phone')?.value||'',
          vehiclePlate: document.getElementById('inf-plate')?.value||'',
          vehicleModel: document.getElementById('inf-model')?.value||'', vehicleYear: 2024,
          insurer: document.getElementById('inf-insurer')?.value||'',
          policyNo: document.getElementById('inf-policy')?.value||'',
          type: document.getElementById('inf-type')?.value||'class1',
          premium: +document.getElementById('inf-premium')?.value||0,
          coverAmount: 0, expiryDate: expiry.toISOString().slice(0,10),
          startDate: start, status: 'renewed', lastRenewedDate: start,
          salesperson: document.getElementById('inf-sales')?.value||'', notes: ''
        })
        showToast('✅ เพิ่มกรมธรรม์แล้ว!', 'success')
        renderPage()
      }
    })
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
function row(l, v) { return `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);font-size:0.82rem"><span style="color:var(--text-muted)">${l}</span><span>${v}</span></div>` }
