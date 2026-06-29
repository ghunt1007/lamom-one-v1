/**
 * Partner Portal — พอร์ทัลพาร์ทเนอร์
 * Route: /b2b/partners
 */
import { formatCurrency, formatDate, timeAgo } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'

const PARTNER_TYPES = {
  reseller:  { label: 'Reseller', color: 'primary', icon: '🤝' },
  referral:  { label: 'Referral', color: 'success', icon: '👥' },
  insurance: { label: 'ประกัน', color: 'warning', icon: '🛡' },
  finance:   { label: 'ไฟแนนซ์', color: 'secondary', icon: '💳' },
  service:   { label: 'ศูนย์บริการ', color: 'warning', icon: '🔧' },
  ev_infra:  { label: 'EV Infrastructure', color: 'success', icon: '⚡' },
}

const PARTNER_STATUS = {
  active:  { label: 'Active', color: 'success' },
  pending: { label: 'รออนุมัติ', color: 'warning' },
  inactive:{ label: 'Inactive', color: 'secondary' },
}

function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }

const DEMO_PARTNERS = [
  { id: 'PRT001', name: 'บ. Thai EV Leasing', type: 'finance', status: 'active', contact: 'สมหมาย ผู้จัดการ', email: 'partner@evlease.co.th', phone: '02-xxx-xxxx', commissionRate: 1.5, totalLeads: 42, closedDeals: 28, revenue: 44520000, joinDate: addDays(-180) },
  { id: 'PRT002', name: 'บ. กรุงเทพประกันภัย', type: 'insurance', status: 'active', contact: 'วิชัย ตัวแทน', email: 'ev@bki.co.th', phone: '02-yyy-yyyy', commissionRate: 8.0, totalLeads: 85, closedDeals: 71, revenue: 2840000, joinDate: addDays(-365) },
  { id: 'PRT003', name: 'EV Connect Thailand', type: 'ev_infra', status: 'active', contact: 'ปทิตา CEO', email: 'info@evconnect.th', phone: '081-xxx-xxxx', commissionRate: 2.0, totalLeads: 15, closedDeals: 12, revenue: 480000, joinDate: addDays(-90) },
  { id: 'PRT004', name: 'รีวิวเวอร์ YT: TheEVGuruTH', type: 'referral', status: 'active', contact: 'ธนา Youtuber', email: 'theevguru@gmail.com', phone: '086-xxx-xxxx', commissionRate: 3.0, totalLeads: 28, closedDeals: 8, revenue: 1272000, joinDate: addDays(-60) },
  { id: 'PRT005', name: 'บ. Fast Charge Plus', type: 'ev_infra', status: 'pending', contact: 'ชัยวัฒน์ COO', email: 'biz@fastcharge.th', phone: '089-xxx-xxxx', commissionRate: 1.5, totalLeads: 0, closedDeals: 0, revenue: 0, joinDate: addDays(-7) },
]

export default async function PartnerPortalPage(container) {
  let partners = DEMO_PARTNERS.map(p => ({ ...p }))
  let typeFilter = 'all'

  function renderPage() {
    const list = typeFilter === 'all' ? partners : partners.filter(p => p.type === typeFilter)
    const active = partners.filter(p => p.status === 'active').length
    const totalRevenue = partners.reduce((a, p) => a + p.revenue, 0)
    const totalLeads = partners.reduce((a, p) => a + p.totalLeads, 0)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🤝 Partner Portal</div>
            <div class="page-subtitle">จัดการพาร์ทเนอร์ — Reseller, Referral, Finance, Insurance</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="add-partner-btn">+ เพิ่มพาร์ทเนอร์</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('🤝 พาร์ทเนอร์ทั้งหมด', partners.length, 'primary')}
          ${kpi('✅ Active', active, 'success')}
          ${kpi('🧲 Leads รวม', totalLeads, 'primary')}
          ${kpi('💰 Revenue จากพาร์ทเนอร์', formatCurrency(totalRevenue), 'success')}
        </div>

        <div style="display:flex;gap:4px;margin-bottom:12px;flex-wrap:wrap">
          <button class="btn btn-xs ${typeFilter==='all'?'btn-primary':'btn-secondary'} tf-btn" data-t="all">ทั้งหมด</button>
          ${Object.entries(PARTNER_TYPES).map(([k,v]) => `<button class="btn btn-xs ${typeFilter===k?'btn-'+v.color:'btn-secondary'} tf-btn" data-t="${k}">${v.icon} ${v.label}</button>`).join('')}
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:12px">
          ${list.map(p => {
            const pt = PARTNER_TYPES[p.type]
            const ps = PARTNER_STATUS[p.status]
            const convRate = p.totalLeads > 0 ? Math.round(p.closedDeals / p.totalLeads * 100) : 0
            return `<div class="card" style="padding:14px;border-top:3px solid var(--${pt?.color})">
              <div style="display:flex;justify-content:space-between;margin-bottom:8px">
                <div style="display:flex;gap:10px;align-items:center">
                  <div style="font-size:1.4rem">${pt?.icon}</div>
                  <div>
                    <div style="font-weight:700;font-size:0.88rem">${p.name}</div>
                    <div style="font-size:0.72rem;color:var(--text-muted)">${pt?.label}</div>
                  </div>
                </div>
                <span class="badge badge-${ps?.color}" style="font-size:0.65rem">${ps?.label}</span>
              </div>

              <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:10px">
                ${miniStat('🧲 Leads', p.totalLeads)}
                ${miniStat('✅ Closed', p.closedDeals)}
                ${miniStat('📊 Conv.', convRate + '%')}
              </div>

              <div style="margin-bottom:10px">
                ${row('ค่าคอม', p.commissionRate + '%')}
                ${p.revenue > 0 ? row('Revenue', formatCurrency(p.revenue)) : ''}
                ${row('ติดต่อ', p.contact)}
              </div>

              <div style="display:flex;gap:6px">
                <button class="btn btn-xs btn-secondary view-btn" data-id="${p.id}" style="flex:1">ดูรายละเอียด</button>
                ${p.status === 'pending' ? `<button class="btn btn-xs btn-success approve-btn" data-id="${p.id}">อนุมัติ</button>` : ''}
              </div>
            </div>`
          }).join('')}
        </div>
      </div>
    `

    container.querySelectorAll('.tf-btn').forEach(b => b.addEventListener('click', () => { typeFilter = b.dataset.t; renderPage() }))
    document.getElementById('add-partner-btn')?.addEventListener('click', openAddForm)
    container.querySelectorAll('.view-btn').forEach(b => b.addEventListener('click', () => {
      const p = partners.find(x => x.id === b.dataset.id); if (p) openDetail(p)
    }))
    container.querySelectorAll('.approve-btn').forEach(b => b.addEventListener('click', () => {
      const p = partners.find(x => x.id === b.dataset.id)
      if (p) { p.status = 'active'; showToast(`✅ อนุมัติ ${p.name} แล้ว`, 'success'); renderPage() }
    }))
  }

  function openDetail(p) {
    const pt = PARTNER_TYPES[p.type]
    const ps = PARTNER_STATUS[p.status]
    openModal({
      title: `${pt?.icon} ${p.name}`,
      size: 'md',
      body: `
        <div style="display:flex;gap:8px;margin-bottom:12px">
          <span class="badge badge-${pt?.color}">${pt?.label}</span>
          <span class="badge badge-${ps?.color}">${ps?.label}</span>
        </div>
        ${row('ผู้ติดต่อ', p.contact)}
        ${row('Email', p.email)}
        ${row('โทรศัพท์', p.phone)}
        ${row('ค่าคอมมิชชั่น', p.commissionRate + '%')}
        ${row('Leads ทั้งหมด', p.totalLeads + ' ราย')}
        ${row('ปิดดีล', p.closedDeals + ' ราย')}
        ${p.revenue > 0 ? row('Revenue รวม', formatCurrency(p.revenue)) : ''}
        ${row('เข้าร่วมเมื่อ', formatDate(p.joinDate))}
      `
    })
  }

  function openAddForm() {
    openModal({
      title: '+ เพิ่มพาร์ทเนอร์',
      size: 'md',
      body: `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="input-group" style="grid-column:1/-1"><label class="input-label">ชื่อพาร์ทเนอร์ *</label><input class="input" id="pf-name"></div>
          <div class="input-group"><label class="input-label">ประเภท</label>
            <select class="input" id="pf-type">${Object.entries(PARTNER_TYPES).map(([k,v])=>`<option value="${k}">${v.icon} ${v.label}</option>`).join('')}</select>
          </div>
          <div class="input-group"><label class="input-label">ค่าคอม (%)</label><input type="number" class="input" id="pf-comm" value="2.0" step="0.5"></div>
          <div class="input-group"><label class="input-label">ผู้ติดต่อ</label><input class="input" id="pf-contact"></div>
          <div class="input-group"><label class="input-label">Email</label><input type="email" class="input" id="pf-email"></div>
        </div>
      `,
      onConfirm() {
        const name = document.getElementById('pf-name')?.value?.trim()
        if (!name) { showToast('❗ กรุณากรอกชื่อ', 'error'); return }
        partners.unshift({
          id: `PRT${String(partners.length+1).padStart(3,'0')}`, name,
          type: document.getElementById('pf-type')?.value||'referral', status: 'pending',
          contact: document.getElementById('pf-contact')?.value||'', email: document.getElementById('pf-email')?.value||'', phone: '',
          commissionRate: +document.getElementById('pf-comm')?.value||2.0,
          totalLeads: 0, closedDeals: 0, revenue: 0, joinDate: addDays(0)
        })
        showToast('✅ เพิ่มพาร์ทเนอร์แล้ว!', 'success'); renderPage()
      }
    })
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
function miniStat(l, v) { return `<div style="text-align:center;padding:6px;background:var(--surface-2);border-radius:var(--radius-sm)"><div style="font-size:0.65rem;color:var(--text-muted)">${l}</div><div style="font-size:0.85rem;font-weight:700">${v}</div></div>` }
function row(l, v) { return `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);font-size:0.82rem"><span style="color:var(--text-muted)">${l}</span><span>${v}</span></div>` }
