import { formatCurrency, formatDate, timeAgo } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { exportToExcel } from '../../utils/importExport.js'
import { listDocs, createDoc, seedDemoData } from '../../core/db.js'

const CHANNEL_MAP = {
  facebook:  { label: 'Facebook Ads', color: 'primary', icon: '📘' },
  google:    { label: 'Google Ads', color: 'warning', icon: '🔍' },
  line:      { label: 'LINE OA', color: 'success', icon: '💬' },
  organic:   { label: 'Organic SEO', color: 'secondary', icon: '🌱' },
  referral:  { label: 'Referral', color: 'danger', icon: '🤝' },
  walkin:    { label: 'Walk-in', color: 'secondary', icon: '🚶' },
  event:     { label: 'Event/Expo', color: 'primary', icon: '🎪' },
}

const CAMPAIGN_STATUS = {
  active:   { label: 'กำลังรัน', color: 'success' },
  paused:   { label: 'หยุดชั่วคราว', color: 'warning' },
  ended:    { label: 'สิ้นสุด', color: 'secondary' },
  draft:    { label: 'ร่าง', color: 'secondary' },
}

function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }

const DEMO_LEADS_RECENT = [
  { name: 'ประยุทธ ดีใจ', phone: '085-xxx-xxxx', campaign: 'LG001', channel: 'facebook', date: addDays(-1), model: 'BYD Seal', status: 'qualified', score: 85 },
  { name: 'มาลี สุขสันต์', phone: '086-xxx-xxxx', campaign: 'LG002', channel: 'line', date: addDays(-2), model: 'MG ZS EV', status: 'new', score: 62 },
  { name: 'สุรชาติ มั่งมี', phone: '087-xxx-xxxx', campaign: 'LG003', channel: 'google', date: addDays(-1), model: 'BYD Atto 3', status: 'new', score: 78 },
  { name: 'ชนัญชิดา รวย', phone: '088-xxx-xxxx', campaign: 'LG001', channel: 'facebook', date: addDays(0), model: 'BYD Seal AWD', status: 'hot', score: 92 },
]

export default async function LeadGenerationPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let tab = 'campaigns'
  let statusFilter = 'all'
  let campaigns = []
  let loading = true

  async function loadData() {
    loading = true
    try { campaigns = await listDocs('lead_gen_campaigns', [], 'startDate', 'desc', 500) } catch (e) { campaigns = [] }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function filtered() {
    return campaigns.filter(c => statusFilter === 'all' || c.status === statusFilter)
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const cps = campaigns
    const totalSpent = cps.reduce((a, c) => a + c.spent, 0)
    const totalLeads = cps.reduce((a, c) => a + c.leads, 0)
    const totalClosed = cps.reduce((a, c) => a + c.closed, 0)
    const avgCPL = totalLeads ? Math.round(totalSpent / totalLeads) : 0
    const convRate = totalLeads ? (totalClosed / totalLeads * 100).toFixed(1) : 0

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🧲 Lead Generation</div>
            <div class="page-subtitle">แคมเปญสร้าง Lead — ติดตามผล ROI รายช่องทาง</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="export-btn">📥 Export</button>
            <button class="btn btn-primary" id="add-campaign-btn">+ สร้างแคมเปญ</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(5,1fr);margin-bottom:16px">
          ${kpi('💸 ใช้งบ', formatCurrency(totalSpent), 'warning')}
          ${kpi('🧲 Leads รวม', totalLeads, 'primary')}
          ${kpi('✅ ปิดได้', totalClosed, 'success')}
          ${kpi('💰 CPL avg', formatCurrency(avgCPL), 'secondary')}
          ${kpi('📈 Conv.Rate', convRate + '%', +convRate >= 10 ? 'success' : 'warning')}
        </div>

        <div class="tab-nav" style="margin-bottom:14px">
          ${[['campaigns','📋 แคมเปญ'],['funnel','🔽 Funnel'],['recent','🧲 Leads ล่าสุด']].map(([t,l]) => `<button class="tab-btn ${tab===t?'active':''}" data-tab="${t}">${l}</button>`).join('')}
        </div>

        ${tab === 'campaigns' ? renderCampaigns(filtered()) : tab === 'funnel' ? renderFunnel() : renderRecentLeads()}
      </div>
    `

    container.querySelectorAll('.tab-btn').forEach(b => b.addEventListener('click', () => { tab = b.dataset.tab; renderPage() }))
    container.querySelectorAll('.sf-btn').forEach(b => b.addEventListener('click', () => { statusFilter = b.dataset.s; renderPage() }))
    document.getElementById('add-campaign-btn')?.addEventListener('click', openCampaignForm)
    document.getElementById('export-btn')?.addEventListener('click', () => {
      exportToExcel(campaigns.map(c => ({ ID: c.id, ชื่อ: c.name, ช่องทาง: CHANNEL_MAP[c.channel]?.label, งบ: c.budget, ใช้ไป: c.spent, Leads: c.leads, ปิดได้: c.closed, CPL: c.cpl, CPA: c.cpa })), 'lead_generation')
      showToast('📥 Export แล้ว!', 'success')
    })
    container.querySelectorAll('.open-camp-btn').forEach(b => b.addEventListener('click', () => {
      const c = campaigns.find(x => x.id === b.dataset.id); if (c) openCampaignDetail(c)
    }))
  }

  function renderCampaigns(list) {
    return `<div>
      <div style="display:flex;gap:4px;margin-bottom:12px">
        <button class="btn btn-sm ${statusFilter==='all'?'btn-primary':'btn-secondary'} sf-btn" data-s="all">ทั้งหมด</button>
        ${Object.entries(CAMPAIGN_STATUS).map(([k,v]) => `<button class="btn btn-sm ${statusFilter===k?'btn-'+v.color:'btn-secondary'} sf-btn" data-s="${k}">${v.label}</button>`).join('')}
      </div>
      <div class="card" style="padding:0;overflow:hidden">
        <table class="table">
          <thead><tr><th>แคมเปญ</th><th>ช่องทาง</th><th>งบ/ใช้ไป</th><th class="text-right">Leads</th><th class="text-right">Qualified</th><th class="text-right">ปิดได้</th><th class="text-right">CPL</th><th class="text-right">CPA</th><th>สถานะ</th><th></th></tr></thead>
          <tbody>
            ${list.map(c => {
              const ch = CHANNEL_MAP[c.channel]
              const st = CAMPAIGN_STATUS[c.status]
              const budgetPct = Math.round(c.spent / c.budget * 100)
              return `<tr>
                <td>
                  <div style="font-weight:600;font-size:0.85rem">${c.name}</div>
                  <div style="font-size:0.72rem;color:var(--text-muted)">${formatDate(c.startDate)} — ${formatDate(c.endDate)}</div>
                </td>
                <td><span class="badge badge-${ch?.color}">${ch?.icon} ${ch?.label}</span></td>
                <td>
                  <div style="font-size:0.78rem">${formatCurrency(c.spent)} / ${formatCurrency(c.budget)}</div>
                  <div style="background:var(--surface-2);border-radius:3px;height:4px;margin-top:3px">
                    <div style="width:${budgetPct}%;background:${budgetPct>90?'var(--danger)':budgetPct>70?'var(--warning)':'var(--primary)'};height:4px;border-radius:3px"></div>
                  </div>
                </td>
                <td class="text-right" style="font-weight:700">${c.leads}</td>
                <td class="text-right">${c.qualified}</td>
                <td class="text-right" style="color:var(--success);font-weight:700">${c.closed}</td>
                <td class="text-right" style="font-size:0.82rem">${formatCurrency(c.cpl)}</td>
                <td class="text-right" style="font-size:0.82rem">${formatCurrency(c.cpa)}</td>
                <td><span class="badge badge-${st?.color}">${st?.label}</span></td>
                <td><button class="btn btn-xs btn-secondary open-camp-btn" data-id="${c.id}">ดู</button></td>
              </tr>`
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>`
  }

  function renderFunnel() {
    const stages = [
      { label: '📣 Impressions', value: campaigns.reduce((a,c)=>a+c.impressions,0).toLocaleString(), pct: 100 },
      { label: '👆 Clicks', value: campaigns.reduce((a,c)=>a+c.clicks,0).toLocaleString(), pct: 2.1 },
      { label: '🧲 Leads', value: campaigns.reduce((a,c)=>a+c.leads,0), pct: 100 },
      { label: '✅ Qualified', value: campaigns.reduce((a,c)=>a+c.qualified,0), pct: Math.round(campaigns.reduce((a,c)=>a+c.qualified,0)/campaigns.reduce((a,c)=>a+c.leads,0)*100) },
      { label: '💰 Closed Won', value: campaigns.reduce((a,c)=>a+c.closed,0), pct: Math.round(campaigns.reduce((a,c)=>a+c.closed,0)/campaigns.reduce((a,c)=>a+c.leads,0)*100) },
    ]
    const maxVal = campaigns.reduce((a,c)=>a+c.impressions,0)
    return `
      <div class="card" style="padding:20px;max-width:560px;margin:0 auto">
        <div style="font-weight:700;font-size:0.88rem;margin-bottom:16px">🔽 Marketing Funnel</div>
        ${stages.map(s => `
          <div style="margin-bottom:12px">
            <div style="display:flex;justify-content:space-between;font-size:0.8rem;margin-bottom:4px">
              <span style="font-weight:600">${s.label}</span>
              <span style="font-weight:700">${s.value}</span>
            </div>
            <div style="background:var(--surface-2);border-radius:4px;height:20px;position:relative">
              <div style="width:${s.pct}%;min-width:4%;background:var(--primary);height:20px;border-radius:4px;opacity:0.8;display:flex;align-items:center;justify-content:flex-end;padding-right:6px">
                <span style="font-size:0.68rem;font-weight:700;color:white">${s.pct}%</span>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `
  }

  function renderRecentLeads() {
    return `
      <div style="display:flex;flex-direction:column;gap:8px">
        ${DEMO_LEADS_RECENT.map(l => {
          const ch = CHANNEL_MAP[l.channel]
          const scoreColor = l.score >= 85 ? 'success' : l.score >= 70 ? 'warning' : 'secondary'
          const stColor = l.status === 'hot' ? 'danger' : l.status === 'qualified' ? 'success' : 'secondary'
          return `<div class="card" style="padding:12px 14px;display:flex;align-items:center;gap:12px">
            <div style="width:40px;height:40px;background:var(--primary-dim);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1rem">${ch?.icon}</div>
            <div style="flex:1">
              <div style="font-weight:700;font-size:0.88rem">${l.name}</div>
              <div style="font-size:0.75rem;color:var(--text-muted)">${l.phone} · ${l.model} · ${ch?.label}</div>
            </div>
            <span class="badge badge-${stColor}">${l.status === 'hot' ? '🔥 Hot' : l.status === 'qualified' ? '✅ Qualified' : 'New'}</span>
            <div style="text-align:center;min-width:56px">
              <div style="font-size:1rem;font-weight:800;color:var(--${scoreColor})">${l.score}</div>
              <div style="font-size:0.65rem;color:var(--text-muted)">Lead Score</div>
            </div>
            <div style="font-size:0.73rem;color:var(--text-muted)">${timeAgo(l.date)}</div>
            <button class="btn btn-xs btn-primary">ติดตาม</button>
          </div>`
        }).join('')}
      </div>
    `
  }

  function openCampaignDetail(c) {
    const ch = CHANNEL_MAP[c.channel]
    const st = CAMPAIGN_STATUS[c.status]
    const budgetPct = Math.round(c.spent / c.budget * 100)
    const convRate = c.leads ? (c.closed / c.leads * 100).toFixed(1) : 0
    openModal({
      title: `📋 ${c.id} — ${c.name}`,
      size: 'md',
      body: `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
          <div>
            ${row('ช่องทาง', `<span class="badge badge-${ch?.color}">${ch?.icon} ${ch?.label}</span>`)}
            ${row('สถานะ', `<span class="badge badge-${st?.color}">${st?.label}</span>`)}
            ${row('เริ่ม', formatDate(c.startDate))}${row('สิ้นสุด', formatDate(c.endDate))}
            ${row('รุ่นเป้าหมาย', c.targetModel)}
          </div>
          <div>
            ${row('งบ', formatCurrency(c.budget))}${row('ใช้ไป', `<strong style="color:${budgetPct>90?'var(--danger)':'var(--warning)'}">${formatCurrency(c.spent)} (${budgetPct}%)</strong>`)}
            ${row('Impressions', c.impressions.toLocaleString())}${row('Clicks', c.clicks.toLocaleString())}
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px">
          ${kpi('🧲 Leads', c.leads, 'primary')}
          ${kpi('✅ Qualified', c.qualified, 'success')}
          ${kpi('💰 ปิดได้', c.closed, 'success')}
          ${kpi('📈 Conv.', convRate + '%', +convRate >= 10 ? 'success' : 'warning')}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px">
          ${kpi('💸 CPL', formatCurrency(c.cpl), 'secondary')}
          ${kpi('💸 CPA', formatCurrency(c.cpa), 'secondary')}
        </div>
      `
    })
  }

  function openCampaignForm() {
    openModal({
      title: '+ สร้างแคมเปญใหม่',
      size: 'md',
      body: `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="input-group" style="grid-column:1/-1"><label class="input-label">ชื่อแคมเปญ *</label><input class="input" id="cf-name" placeholder="BYD Summer 2025..."></div>
          <div class="input-group"><label class="input-label">ช่องทาง</label><select class="input" id="cf-channel">${Object.entries(CHANNEL_MAP).map(([k,v]) => `<option value="${k}">${v.icon} ${v.label}</option>`).join('')}</select></div>
          <div class="input-group"><label class="input-label">รุ่นรถเป้าหมาย</label><input class="input" id="cf-model" placeholder="BYD Seal / ทุกรุ่น" value="ทุกรุ่น"></div>
          <div class="input-group"><label class="input-label">งบประมาณ (บาท)</label><input type="number" class="input" id="cf-budget" placeholder="50000"></div>
          <div class="input-group"><label class="input-label">วันเริ่ม</label><input type="date" class="input" id="cf-start" value="${addDays(0)}"></div>
          <div class="input-group"><label class="input-label">วันสิ้นสุด</label><input type="date" class="input" id="cf-end" value="${addDays(30)}"></div>
          <div class="input-group" style="grid-column:1/-1"><label class="input-label">กลุ่มเป้าหมาย</label><input class="input" id="cf-audience" placeholder="อายุ 28-45 สนใจรถยนต์ EV"></div>
        </div>
      `,
      async onConfirm() {
        const name = document.getElementById('cf-name')?.value?.trim()
        if (!name) { showToast('❗ กรุณากรอกชื่อแคมเปญ', 'error'); return false }
        try {
          await createDoc('lead_gen_campaigns', {
            name,
            channel: document.getElementById('cf-channel')?.value||'facebook',
            status: 'draft', budget: +document.getElementById('cf-budget')?.value||0, spent: 0,
            impressions: 0, clicks: 0, leads: 0, qualified: 0, closed: 0,
            cpc: 0, cpl: 0, cpa: 0,
            startDate: document.getElementById('cf-start')?.value||addDays(0),
            endDate: document.getElementById('cf-end')?.value||addDays(30),
            targetModel: document.getElementById('cf-model')?.value||'ทุกรุ่น',
            audience: document.getElementById('cf-audience')?.value||''
          })
          showToast('✅ สร้างแคมเปญแล้ว!', 'success')
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      }
    })
  }

  await loadData()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
function row(l, v) { return `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);font-size:0.82rem"><span style="color:var(--text-muted)">${l}</span><span>${v}</span></div>` }
