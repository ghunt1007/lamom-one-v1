import { formatCurrency } from '../../utils/format.js'
import { openModal, confirmDialog } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { exportToExcel } from '../../utils/importExport.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const CAMPAIGN_TYPES = {
  social:   { label: 'Social Media', icon: '📱', color: 'primary' },
  line:     { label: 'LINE Broadcast', icon: '💚', color: 'success' },
  email:    { label: 'Email', icon: '📧', color: 'accent' },
  sms:      { label: 'SMS', icon: '💬', color: 'warning' },
  event:    { label: 'Event / ออกบูธ', icon: '🎪', color: 'accent' },
  google:   { label: 'Google Ads', icon: '🔍', color: 'danger' },
}

const CAMPAIGN_STATUS = {
  draft:    { label: 'Draft', color: 'primary' },
  planned:  { label: 'วางแผนแล้ว', color: 'primary' },
  active:   { label: 'กำลังดำเนิน', color: 'success' },
  paused:   { label: 'หยุดชั่วคราว', color: 'warning' },
  ended:    { label: 'สิ้นสุดแล้ว', color: 'danger' },
}

const DEMO_CAMPAIGNS = [
  { id:'C001', name:'BYD Seal Launch Sale มิ.ย.', type:'social', status:'active', budget:50000, spent:32000, reach:45200, clicks:1230, leads:87, sales:5, startDate:'2025-06-01', endDate:'2025-06-30', target:'EV Enthusiast 25-45', channels:['Facebook','TikTok'], note:'Boost ทุกวันจันทร์-ศุกร์' },
  { id:'C002', name:'LINE OA Broadcast – ลูกค้าเก่า', type:'line', status:'active', budget:5000, spent:4800, reach:3200, clicks:340, leads:28, sales:2, startDate:'2025-06-05', endDate:'2025-06-30', target:'ลูกค้าเก่าทุกคน', channels:['LINE OA'], note:'' },
  { id:'C003', name:'Mid-Year Sale Google Ads', type:'google', status:'planned', budget:80000, spent:0, reach:0, clicks:0, leads:0, sales:0, startDate:'2025-07-01', endDate:'2025-07-31', target:'Search: EV ราคา', channels:['Google Search','Google Display'], note:'ใช้ keyword EV ราคาถูก' },
  { id:'C004', name:'Motor Expo Thailand', type:'event', status:'ended', budget:200000, spent:185000, reach:12000, clicks:0, leads:245, sales:18, startDate:'2025-05-15', endDate:'2025-05-25', target:'งานแสดงรถ', channels:['Offline'], note:'บูธ B12 ฮอลล์ 3' },
  { id:'C005', name:'Email Newsletter มิ.ย.', type:'email', status:'draft', budget:2000, spent:0, reach:0, clicks:0, leads:0, sales:0, startDate:'2025-06-15', endDate:'2025-06-15', target:'รายชื่อ Email ทั้งหมด', channels:['Email'], note:'' },
]

export default async function CampaignBuilderPage(container) {
  const myGen = container.__routerGen
  let campaigns = DEMO_CAMPAIGNS.map(c => ({ ...c }))
  let statusFilter = 'all'
  let typeFilter = 'all'

  function getFiltered() {
    let list = campaigns
    if (statusFilter !== 'all') list = list.filter(c => c.status === statusFilter)
    if (typeFilter !== 'all') list = list.filter(c => c.type === typeFilter)
    return list
  }

  function getOverall() {
    const active = campaigns.filter(c => c.status === 'active')
    return {
      totalBudget: active.reduce((a, c) => a + c.budget, 0),
      totalSpent: active.reduce((a, c) => a + c.spent, 0),
      totalLeads: campaigns.reduce((a, c) => a + c.leads, 0),
      totalSales: campaigns.reduce((a, c) => a + c.sales, 0),
    }
  }

  function renderPage() {
    const s = getOverall()
    const filtered = getFiltered()

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">📣 Campaign Builder</div>
            <div class="page-subtitle">จัดการแคมเปญการตลาด</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="camp-export">📥 Export</button>
            <button class="btn btn-primary" id="new-camp-btn">➕ แคมเปญใหม่</button>
          </div>
        </div>

        <!-- KPI -->
        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:20px">
          ${kpi('💰 งบกำลังใช้', formatCurrency(s.totalBudget), 'primary')}
          ${kpi('💸 ใช้ไปแล้ว', formatCurrency(s.totalSpent), 'warning')}
          ${kpi('🧲 Leads รวม', s.totalLeads, 'success')}
          ${kpi('🏆 ยอดขายจาก Campaign', s.totalSales, 'success')}
        </div>

        <!-- Filters -->
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px">
          <div style="display:flex;gap:4px">
            <button class="btn btn-sm ${statusFilter==='all'?'btn-primary':'btn-secondary'} sf-btn" data-s="all">ทั้งหมด</button>
            ${Object.entries(CAMPAIGN_STATUS).map(([k,v]) => `<button class="btn btn-sm ${statusFilter===k?'btn-primary':'btn-secondary'} sf-btn" data-s="${k}">${v.label}</button>`).join('')}
          </div>
          <div style="display:flex;gap:4px;margin-left:auto">
            <button class="btn btn-sm ${typeFilter==='all'?'btn-primary':'btn-secondary'} tf-btn" data-t="all">ทุกประเภท</button>
            ${Object.entries(CAMPAIGN_TYPES).map(([k,v]) => `<button class="btn btn-sm ${typeFilter===k?'btn-primary':'btn-secondary'} tf-btn" data-t="${k}">${v.icon}</button>`).join('')}
          </div>
        </div>

        <!-- Campaign cards -->
        <div style="display:flex;flex-direction:column;gap:12px">
          ${filtered.map(c => renderCampaignCard(c)).join('')}
          ${!filtered.length ? `<div class="empty-state"><div class="empty-icon">📣</div><div class="empty-title">ไม่มีแคมเปญ</div></div>` : ''}
        </div>
      </div>
    `

    document.querySelectorAll('.sf-btn').forEach(b => b.addEventListener('click', () => { statusFilter = b.dataset.s; renderPage() }))
    document.querySelectorAll('.tf-btn').forEach(b => b.addEventListener('click', () => { typeFilter = b.dataset.t; renderPage() }))
    document.getElementById('new-camp-btn')?.addEventListener('click', () => openCampForm())
    document.getElementById('camp-export')?.addEventListener('click', () => exportToExcel(filtered.map(c => ({ ชื่อ:c.name, ประเภท:c.type, สถานะ:c.status, งบ:c.budget, ใช้ไป:c.spent, Leads:c.leads, Sales:c.sales })), 'Campaigns'))
    document.querySelectorAll('.camp-card').forEach(card => {
      card.addEventListener('click', () => { const c = campaigns.find(x => x.id === card.dataset.id); if (c) openCampDetail(c) })
    })
  }

  function renderCampaignCard(c) {
    const ct = CAMPAIGN_TYPES[c.type]
    const st = CAMPAIGN_STATUS[c.status]
    const spentPct = c.budget > 0 ? Math.min(100, Math.round(c.spent / c.budget * 100)) : 0
    const cpl = c.leads > 0 ? (c.spent / c.leads).toFixed(0) : '-' // cost per lead
    return `
      <div class="camp-card" data-id="${c.id}" style="
        padding:16px;background:var(--surface);border:1px solid var(--border);
        border-radius:var(--radius-md);cursor:pointer;
      ">
        <div style="display:flex;align-items:flex-start;gap:12px">
          <div style="width:40px;height:40px;border-radius:var(--radius-sm);background:var(--${ct.color}-dim);display:flex;align-items:center;justify-content:center;font-size:1.3rem;flex-shrink:0">${ct.icon}</div>
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
              <span style="font-weight:700;font-size:0.9rem">${c.name}</span>
              <span class="badge badge-${st.color}" style="font-size:0.65rem">${st.label}</span>
              <span class="badge badge-${ct.color}" style="font-size:0.65rem">${ct.label}</span>
            </div>
            <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:10px">${c.startDate} → ${c.endDate} · 🎯 ${c.target}</div>
            <!-- Metrics -->
            <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:10px">
              ${metric('งบ', formatCurrency(c.budget))}
              ${metric('ใช้แล้ว', formatCurrency(c.spent))}
              ${metric('Reach', c.reach.toLocaleString())}
              ${metric('Leads', c.leads)}
              ${metric('CPL', c.leads > 0 ? '฿'+Number(cpl).toLocaleString() : '-')}
            </div>
            <!-- Budget bar -->
            <div style="display:flex;justify-content:space-between;font-size:0.72rem;color:var(--text-muted);margin-bottom:3px">
              <span>งบที่ใช้ไป</span><span>${spentPct}%</span>
            </div>
            <div style="height:4px;background:var(--surface-3);border-radius:99px"><div style="height:100%;width:${spentPct}%;background:${spentPct>90?'var(--danger)':spentPct>70?'var(--warning)':'var(--primary)'};border-radius:99px"></div></div>
          </div>
        </div>
      </div>
    `
  }

  function metric(label, value) {
    return `<div style="text-align:center"><div style="font-weight:700;font-size:0.85rem">${value}</div><div style="font-size:0.67rem;color:var(--text-muted)">${label}</div></div>`
  }

  function openCampForm(camp = null) {
    const today = new Date().toISOString().slice(0, 10)
    const { el, close } = openModal({
      title: camp ? '✏️ แก้ไขแคมเปญ' : '📣 แคมเปญใหม่', size: 'md',
      body: `<div style="display:flex;flex-direction:column;gap:12px">
        <div class="input-group"><label class="input-label">ชื่อแคมเปญ *</label><input class="input" id="cn-name" value="${camp?.name||''}" placeholder="ชื่อแคมเปญ"></div>
        <div class="grid-2">
          <div class="input-group"><label class="input-label">ประเภท</label>
            <select class="input" id="cn-type">
              ${Object.entries(CAMPAIGN_TYPES).map(([k,v]) => `<option value="${k}" ${camp?.type===k?'selected':''}>${v.icon} ${v.label}</option>`).join('')}
            </select>
          </div>
          <div class="input-group"><label class="input-label">สถานะ</label>
            <select class="input" id="cn-status">
              ${Object.entries(CAMPAIGN_STATUS).map(([k,v]) => `<option value="${k}" ${(camp?.status||'draft')===k?'selected':''}>${v.label}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="grid-2">
          <div class="input-group"><label class="input-label">วันเริ่ม</label><input class="input" type="date" id="cn-start" value="${camp?.startDate||today}"></div>
          <div class="input-group"><label class="input-label">วันสิ้นสุด</label><input class="input" type="date" id="cn-end" value="${camp?.endDate||today}"></div>
        </div>
        <div class="grid-2">
          <div class="input-group"><label class="input-label">งบประมาณ (฿)</label><input class="input" type="number" id="cn-budget" value="${camp?.budget||0}"></div>
          <div class="input-group"><label class="input-label">กลุ่มเป้าหมาย</label><input class="input" id="cn-target" value="${camp?.target||''}" placeholder="เช่น EV ใน กทม."></div>
        </div>
        <div class="input-group"><label class="input-label">หมายเหตุ</label><textarea class="input" id="cn-note" rows="2">${escHtml(camp?.note||'')}</textarea></div>
      </div>`,
      footer: `<button class="btn btn-secondary" id="cn-c">ยกเลิก</button><button class="btn btn-primary" id="cn-s">💾 บันทึก</button>`
    })
    el.querySelector('#cn-c').addEventListener('click', close)
    el.querySelector('#cn-s').addEventListener('click', () => {
      const name = el.querySelector('#cn-name').value.trim()
      if (!name) return showToast('❗ กรุณาใส่ชื่อแคมเปญ', 'warning')
      const data = { name, type: el.querySelector('#cn-type').value, status: el.querySelector('#cn-status').value, budget: +el.querySelector('#cn-budget').value, startDate: el.querySelector('#cn-start').value, endDate: el.querySelector('#cn-end').value, target: el.querySelector('#cn-target').value, note: el.querySelector('#cn-note').value }
      if (camp) Object.assign(camp, data)
      else campaigns.push({ id:'C'+Date.now(), spent:0, reach:0, clicks:0, leads:0, sales:0, channels:[], ...data })
      showToast('💾 บันทึกแคมเปญแล้ว', 'success'); close(); renderPage()
    })
  }

  function openCampDetail(c) {
    const ct = CAMPAIGN_TYPES[c.type]
    const st = CAMPAIGN_STATUS[c.status]
    const roi = c.spent > 0 ? ((c.sales * 200000 - c.spent) / c.spent * 100).toFixed(1) : '0'
    openModal({
      title: `${ct.icon} ${c.name}`, size: 'md',
      body: `<div style="display:flex;flex-direction:column;gap:12px">
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <span class="badge badge-${st.color}">${st.label}</span>
          <span class="badge badge-${ct.color}">${ct.label}</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">
          ${bigMetric('💰 งบ', formatCurrency(c.budget))}
          ${bigMetric('💸 ใช้แล้ว', formatCurrency(c.spent))}
          ${bigMetric('📊 ROI', roi + '%', roi > 0 ? 'success' : 'danger')}
          ${bigMetric('👁 Reach', c.reach.toLocaleString())}
          ${bigMetric('🖱 Clicks', c.clicks.toLocaleString())}
          ${bigMetric('🧲 Leads', c.leads)}
          ${bigMetric('🏆 Sales', c.sales)}
          ${bigMetric('💵 CPL', c.leads>0?formatCurrency(c.spent/c.leads):'-')}
          ${bigMetric('📅 ระยะเวลา', c.startDate + ' → ' + c.endDate)}
        </div>
        ${c.note ? `<div style="background:var(--surface-2);padding:10px;border-radius:var(--radius-sm);font-size:0.83rem">📝 ${escHtml(c.note)}</div>` : ''}
        <div style="display:flex;gap:6px;padding-top:8px;border-top:1px solid var(--border)">
          <button class="btn btn-sm btn-primary" id="edit-camp-btn">✏️ แก้ไข</button>
          <button class="btn btn-sm btn-danger" id="del-camp-btn">🗑 ลบ</button>
        </div>
      </div>`,
      footer: ''
    })
    document.getElementById('edit-camp-btn')?.addEventListener('click', () => { document.querySelector('.modal-overlay')?.remove(); openCampForm(c) })
    document.getElementById('del-camp-btn')?.addEventListener('click', async () => {
      const ok = await confirmDialog({ title:'🗑 ลบแคมเปญ', message:`ลบ "${c.name}" ออกจากระบบ?`, confirmText:'ลบ', danger:true })
      if (!ok) return
      campaigns = campaigns.filter(x => x.id !== c.id)
      document.querySelector('.modal-overlay')?.remove()
      showToast('🗑 ลบแล้ว', 'success')
      if (container.__routerGen !== myGen) return
      renderPage()
    })
  }

  function bigMetric(label, value, color = '') {
    return `<div style="background:var(--surface-2);padding:10px;border-radius:var(--radius-sm);text-align:center">
      <div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:4px">${label}</div>
      <div style="font-weight:700;font-size:0.9rem;${color?'color:var(--'+color+')':''}">${value}</div>
    </div>`
  }

  renderPage()
}

function kpi(title, value, color) {
  return `<div class="kpi-card"><div class="kpi-title">${title}</div><div class="kpi-value" style="color:var(--${color})">${value}</div></div>`
}
