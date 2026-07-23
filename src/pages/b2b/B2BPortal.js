import { watchDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'
import { showToast } from '../../core/store.js'
import { formatCurrency, formatDate, timeAgo } from '../../utils/format.js'
import { openModal, confirmDialog } from '../../utils/modal.js'
import { exportToExcel } from '../../utils/importExport.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const PARTNER_TYPES = {
  broker: { label: '🤝 นายหน้า/Broker', badge: 'primary' },
  fleet: { label: '🏢 Fleet/Corporate', badge: 'accent' },
  government: { label: '🏛 ราชการ', badge: 'accent' },
  leasing: { label: '🔑 Leasing', badge: 'warning' },
  dealer: { label: '🚗 Dealer Network', badge: 'success' },
}

const DEAL_STATUS = {
  prospect: { label: '🔍 พิจารณา', badge: 'primary' },
  negotiating: { label: '🤝 เจรจา', badge: 'primary' },
  approved: { label: '✅ อนุมัติ', badge: 'success' },
  contracted: { label: '📝 ทำสัญญา', badge: 'accent' },
  completed: { label: '🏆 ปิดดีล', badge: 'success' },
  cancelled: { label: '❌ ยกเลิก', badge: 'danger' },
}

export default async function B2BPortalPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let partners = []
  let activeTab = 'partners' // partners | deals | leaderboard
  let filterType = 'all'

  container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`

  // Real-time: อัปเดตสดเมื่อมีคนเพิ่ม/แก้ไขพาร์ทเนอร์หรือดีลจากเครื่องอื่น — หน้านี้ไม่มีช่องค้นหาจึงไม่ต้องกันโฟกัส
  const unsubPartners = watchDocs('b2b_corporate_partners', [], 'name', 'asc', 500, rows => {
    if (container.__routerGen !== myGen) { unsubPartners(); return }
    partners = rows
    renderPage()
  })

  function getTotals() {
    return partners.reduce((a, p) => ({
      revenue: a.revenue + p.totalRevenue,
      deals: a.deals + p.totalDeals,
      partners: a.partners + 1,
    }), { revenue: 0, deals: 0, partners: 0 })
  }

  function renderPage() {
    const tot = getTotals()
    const filtered = filterType === 'all' ? partners : partners.filter(p => p.type === filterType)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🤝 B2B & Partner Portal</div>
            <div class="page-subtitle">นายหน้า · Fleet · ราชการ · Leasing · Network</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="b2b-export">📥 Export</button>
            <button class="btn btn-primary" id="new-partner-btn">➕ พาร์ทเนอร์ใหม่</button>
          </div>
        </div>

        <!-- KPI -->
        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:20px">
          ${kpi('🤝 พาร์ทเนอร์', `${tot.partners}`, 'primary')}
          ${kpi('💼 ดีลทั้งหมด', `${tot.deals}`, 'accent')}
          ${kpi('💰 Revenue รวม', formatCurrency(tot.revenue), 'success')}
          ${kpi('📊 Active', `${partners.filter(p=>p.status==='active').length}`, 'primary')}
        </div>

        <!-- Tabs -->
        <div style="display:flex;gap:4px;margin-bottom:16px">
          ${[['partners','🤝 Partners'],['deals','💼 Active Deals'],['leaderboard','🏆 Leaderboard']].map(([t,l]) =>
            `<button class="btn btn-sm ${activeTab===t?'btn-primary':'btn-secondary'} b2b-tab" data-t="${t}">${l}</button>`
          ).join('')}
        </div>

        <!-- Type filter -->
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px">
          <button class="btn btn-sm tf-btn ${filterType==='all'?'btn-primary':'btn-secondary'}" data-tf="all">ทั้งหมด</button>
          ${Object.entries(PARTNER_TYPES).map(([k,v]) => `<button class="btn btn-sm tf-btn ${filterType===k?'btn-primary':'btn-secondary'}" data-tf="${k}">${v.label}</button>`).join('')}
        </div>

        <div id="b2b-content">${renderTab(filtered)}</div>
      </div>
    `

    document.querySelectorAll('.b2b-tab').forEach(btn => { btn.addEventListener('click', () => { activeTab = btn.dataset.t; renderPage() }) })
    document.querySelectorAll('.tf-btn').forEach(btn => { btn.addEventListener('click', () => { filterType = btn.dataset.tf; renderPage() }) })
    document.getElementById('new-partner-btn')?.addEventListener('click', () => openPartnerForm())
    document.getElementById('b2b-export')?.addEventListener('click', () => {
      exportToExcel(partners.map(p => ({ 'ชื่อ': p.name, 'ประเภท': PARTNER_TYPES[p.type]?.label, 'ติดต่อ': p.contact, 'ดีล': p.totalDeals, 'Revenue': p.totalRevenue, 'Commission%': p.commission_rate })), 'B2B_Partners')
    })
    document.querySelectorAll('.partner-view-btn').forEach(btn => {
      btn.addEventListener('click', () => { const p = partners.find(x => x.id === btn.dataset.id); if (p) openPartnerDetail(p) })
    })
  }

  function renderTab(filtered) {
    if (activeTab === 'partners') return renderPartners(filtered)
    if (activeTab === 'deals') return renderDeals(filtered)
    if (activeTab === 'leaderboard') return renderLeaderboard()
    return ''
  }

  function renderPartners(filtered) {
    if (!filtered.length) return `<div class="empty-state"><div class="empty-icon">🤝</div><div class="empty-title">ยังไม่มีพาร์ทเนอร์</div></div>`
    return `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px">
        ${filtered.map(p => {
          const tp = PARTNER_TYPES[p.type]
          return `<div class="card" style="padding:16px">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
              <div>
                <div style="font-weight:700;margin-bottom:3px">${escHtml(p.name)}</div>
                <span class="badge badge-${tp?.badge}">${tp?.label}</span>
              </div>
              <span class="badge badge-${p.status==='active'?'success':'warning'}">${p.status==='active'?'🟢 Active':'🟡 ดำเนินการ'}</span>
            </div>
            <div style="font-size:0.8rem;color:var(--text-muted);display:flex;flex-direction:column;gap:3px;margin-bottom:12px">
              <span>👤 ${escHtml(p.contact)}</span>
              <span>📞 ${escHtml(p.phone)}</span>
              <span>📧 ${escHtml(p.email)}</span>
              <span>🤝 ร่วมงานตั้งแต่ ${formatDate(p.since)}</span>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
              <div style="background:var(--surface-2);border-radius:var(--radius-md);padding:10px;text-align:center">
                <div style="font-weight:700;color:var(--primary)">${p.totalDeals}</div>
                <div style="font-size:0.7rem;color:var(--text-muted)">ดีลทั้งหมด</div>
              </div>
              <div style="background:var(--surface-2);border-radius:var(--radius-md);padding:10px;text-align:center">
                <div style="font-weight:700;color:var(--success);font-size:0.85rem">${(p.totalRevenue/1000000).toFixed(1)}M</div>
                <div style="font-size:0.7rem;color:var(--text-muted)">Revenue</div>
              </div>
            </div>
            ${p.commission_rate > 0 ? `<div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:10px">Commission Rate: ${p.commission_rate}%</div>` : ''}
            <button class="btn btn-secondary btn-sm partner-view-btn" data-id="${p.id}" style="width:100%">ดูรายละเอียด</button>
          </div>`
        }).join('')}
      </div>
    `
  }

  function renderDeals(filtered) {
    const allDeals = filtered.flatMap(p => p.deals.map(d => ({ ...d, partnerName: p.name, partnerType: p.type })))
    if (!allDeals.length) return `<div class="empty-state"><div class="empty-icon">💼</div><div class="empty-title">ยังไม่มี Deal</div></div>`
    return `
      <div class="card" style="padding:0;overflow:hidden">
        <table class="table">
          <thead><tr><th>พาร์ทเนอร์</th><th>Deal</th><th class="text-right">คัน</th><th class="text-right">มูลค่า</th><th>สถานะ</th></tr></thead>
          <tbody>
            ${allDeals.map(d => {
              const st = DEAL_STATUS[d.status] || DEAL_STATUS.prospect
              const tp = PARTNER_TYPES[d.partnerType]
              return `<tr>
                <td><div style="font-size:0.83rem;font-weight:600">${escHtml(d.partnerName)}</div><span class="badge badge-${tp?.badge}" style="font-size:0.65rem">${tp?.label}</span></td>
                <td style="font-size:0.85rem">${escHtml(d.desc)}</td>
                <td class="text-right">${d.units} คัน</td>
                <td class="text-right" style="font-weight:700;color:var(--success)">${formatCurrency(d.value)}</td>
                <td><span class="badge badge-${st.badge}">${st.label}</span></td>
              </tr>`
            }).join('')}
          </tbody>
        </table>
      </div>
    `
  }

  function renderLeaderboard() {
    const sorted = [...partners].sort((a, b) => b.totalRevenue - a.totalRevenue)
    const medals = ['🥇','🥈','🥉']
    return `
      <div style="display:flex;flex-direction:column;gap:10px">
        ${sorted.map((p, i) => {
          const pct = Math.round(p.totalRevenue / sorted[0].totalRevenue * 100)
          return `<div class="card" style="padding:14px;${i===0?'border:1px solid var(--warning)':''}">
            <div style="display:flex;align-items:center;gap:12px">
              <div style="font-size:1.8rem;flex-shrink:0">${medals[i] || '#' + (i+1)}</div>
              <div style="flex:1">
                <div style="font-weight:700;margin-bottom:4px">${escHtml(p.name)}</div>
                <div style="background:var(--surface-3);border-radius:99px;height:8px;overflow:hidden">
                  <div style="height:100%;width:${pct}%;background:${i===0?'var(--warning)':i===1?'var(--text-muted)':'var(--accent)'};border-radius:99px"></div>
                </div>
              </div>
              <div style="text-align:right">
                <div style="font-weight:700;color:var(--success)">${formatCurrency(p.totalRevenue)}</div>
                <div style="font-size:0.75rem;color:var(--text-muted)">${p.totalDeals} ดีล</div>
              </div>
            </div>
          </div>`
        }).join('')}
      </div>
    `
  }

  function openPartnerDetail(p) {
    const tp = PARTNER_TYPES[p.type]
    openModal({
      title: `🤝 ${escHtml(p.name)}`, size: 'lg',
      body: `
        <div style="display:flex;flex-direction:column;gap:14px">
          <div style="display:flex;gap:8px">
            <span class="badge badge-${tp?.badge}">${tp?.label}</span>
            <span class="badge badge-${p.status==='active'?'success':'warning'}">${p.status}</span>
          </div>
          <div class="grid-2">
            ${dr('👤','ติดต่อ',escHtml(p.contact))}${dr('📞','โทร',escHtml(p.phone))}
            ${dr('📧','อีเมล',escHtml(p.email))}${dr('📅','ร่วมงาน',formatDate(p.since))}
            ${dr('💰','Commission',p.commission_rate+'%')}${dr('💼','ดีลรวม',p.totalDeals+' ดีล')}
          </div>
          <div>
            <div style="font-weight:700;margin-bottom:10px">💼 Deals (${p.deals.length})</div>
            ${p.deals.map(d => {
              const st = DEAL_STATUS[d.status] || DEAL_STATUS.prospect
              return `<div style="display:flex;gap:10px;align-items:center;padding:10px;background:var(--surface-2);border-radius:var(--radius-md);margin-bottom:8px">
                <div style="flex:1">
                  <div style="font-size:0.88rem;font-weight:600">${escHtml(d.desc)}</div>
                  <div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px">${d.units} คัน · ${formatCurrency(d.value)}</div>
                </div>
                <span class="badge badge-${st.badge}">${st.label}</span>
              </div>`
            }).join('')}
          </div>
        </div>
      `,
      footer: `<button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">ปิด</button>
               <button class="btn btn-primary" id="add-deal-btn">➕ Deal ใหม่</button>`
    })
    document.getElementById('add-deal-btn')?.addEventListener('click', () => {
      document.querySelector('.modal-overlay')?.remove()
      openDealForm(p)
    })
  }

  function openDealForm(p) {
    const { el, close } = openModal({
      title: `➕ Deal ใหม่ — ${escHtml(p.name)}`, size: 'md',
      body: `<div style="display:flex;flex-direction:column;gap:12px">
        <div class="input-group"><label class="input-label">รายละเอียด Deal *</label><input class="input" id="df-desc" placeholder="เช่น BYD Seal x5 Fleet"></div>
        <div class="grid-2">
          <div class="input-group"><label class="input-label">จำนวนคัน</label><input class="input" id="df-units" type="number" min="1" value="1"></div>
          <div class="input-group"><label class="input-label">มูลค่า (บาท)</label><input class="input" id="df-value" type="number" value="0"></div>
        </div>
        <div class="input-group"><label class="input-label">สถานะ</label>
          <select class="input" id="df-status">
            ${Object.entries(DEAL_STATUS).map(([k,v]) => `<option value="${k}">${v.label}</option>`).join('')}
          </select>
        </div>
      </div>`,
      footer: `<button class="btn btn-secondary" id="dfc">ยกเลิก</button><button class="btn btn-primary" id="dfs">💾 บันทึก</button>`
    })
    el.querySelector('#dfc').addEventListener('click', close)
    el.querySelector('#dfs').addEventListener('click', async () => {
      const desc = el.querySelector('#df-desc').value.trim()
      if (!desc) return
      const deal = {
        id: 'D' + Date.now(),
        desc, units: +el.querySelector('#df-units').value || 1,
        value: +el.querySelector('#df-value').value || 0,
        status: el.querySelector('#df-status').value,
      }
      const btn = el.querySelector('#dfs'); btn.disabled = true
      try {
        await updateDocData('b2b_corporate_partners', p.id, {
          deals: [...p.deals, deal], totalDeals: p.totalDeals + 1, totalRevenue: p.totalRevenue + deal.value,
        })
        showToast('✅ เพิ่ม Deal แล้ว', 'success'); close()
      } catch (e) { btn.disabled = false; showToast('บันทึกไม่สำเร็จ', 'error') }
    })
  }

  function openPartnerForm() {
    const { el, close } = openModal({
      title: '➕ พาร์ทเนอร์ใหม่', size: 'md',
      body: `<div style="display:flex;flex-direction:column;gap:12px">
        <div class="input-group"><label class="input-label">ชื่อบริษัท/พาร์ทเนอร์ *</label><input class="input" id="pf-name"></div>
        <div class="grid-2">
          <div class="input-group"><label class="input-label">ประเภท</label>
            <select class="input" id="pf-type">
              ${Object.entries(PARTNER_TYPES).map(([k,v]) => `<option value="${k}">${v.label}</option>`).join('')}
            </select>
          </div>
          <div class="input-group"><label class="input-label">Commission Rate (%)</label><input class="input" id="pf-comm" type="number" step="0.5" value="1"></div>
        </div>
        <div class="input-group"><label class="input-label">ชื่อผู้ติดต่อ</label><input class="input" id="pf-contact"></div>
        <div class="grid-2">
          <div class="input-group"><label class="input-label">โทรศัพท์</label><input class="input" id="pf-phone"></div>
          <div class="input-group"><label class="input-label">อีเมล</label><input class="input" id="pf-email" type="email"></div>
        </div>
      </div>`,
      footer: `<button class="btn btn-secondary" id="pfc">ยกเลิก</button><button class="btn btn-primary" id="pfs">💾 บันทึก</button>`
    })
    el.querySelector('#pfc').addEventListener('click', close)
    el.querySelector('#pfs').addEventListener('click', async () => {
      const name = el.querySelector('#pf-name').value.trim()
      if (!name) return
      const btn = el.querySelector('#pfs'); btn.disabled = true
      try {
        await createDoc('b2b_corporate_partners', {
          name,
          type: el.querySelector('#pf-type').value,
          contact: el.querySelector('#pf-contact').value,
          phone: el.querySelector('#pf-phone').value,
          email: el.querySelector('#pf-email').value,
          commission_rate: +el.querySelector('#pf-comm').value,
          totalDeals: 0, totalRevenue: 0, status: 'active',
          since: new Date().toISOString().slice(0, 10),
          deals: [],
        })
        showToast('✅ เพิ่มพาร์ทเนอร์แล้ว', 'success'); close()
      } catch (e) { btn.disabled = false; showToast('บันทึกไม่สำเร็จ', 'error') }
    })
  }

  return function cleanupB2BPortal() { unsubPartners() }
}

function kpi(title, value, color, sub = '') {
  return `<div class="kpi-card"><div class="kpi-title">${title}</div><div class="kpi-value" style="color:var(--${color})">${value}</div>${sub ? `<div class="kpi-sub">${sub}</div>` : ''}</div>`
}
function dr(icon, label, val) {
  return `<div style="font-size:0.83rem;display:flex;gap:6px"><span>${icon}</span><span style="color:var(--text-muted);min-width:80px">${label}</span><span>${val}</span></div>`
}
