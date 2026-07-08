/**
 * Integration Settings — ตั้งค่าการเชื่อมต่อ
 * Route: /integrations/settings
 */
import { timeAgo } from '../../utils/format.js'
import { openModal, confirmDialog } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, updateDocData, seedDemoData } from '../../core/db.js'

const INTEGRATION_CATS = {
  payment:   { label: 'การชำระเงิน', icon: '💳' },
  messaging: { label: 'การสื่อสาร', icon: '💬' },
  crm:       { label: 'CRM ภายนอก', icon: '👥' },
  accounting:{ label: 'บัญชี', icon: '📊' },
  ai:        { label: 'AI & Analytics', icon: '🤖' },
  logistics: { label: 'โลจิสติกส์', icon: '🚚' },
}

export default async function IntegrationSettingsPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let integrations = []
  let catFilter = 'all'
  let loading = true

  async function loadData() {
    loading = true
    try { integrations = await listDocs('system_integrations', [], 'name', 'asc', 200) } catch (e) { integrations = [] }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const connected = integrations.filter(i => i.status === 'connected').length
    const errors = integrations.filter(i => i.status === 'error').length
    const list = catFilter === 'all' ? integrations : integrations.filter(i => i.cat === catFilter)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🔗 Integrations</div>
            <div class="page-subtitle">เชื่อมต่อกับระบบภายนอก — Payment, Messaging, CRM, Accounting</div>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('🔗 ทั้งหมด', integrations.length, 'primary')}
          ${kpi('✅ เชื่อมต่อแล้ว', connected, 'success')}
          ${kpi('❌ ยังไม่เชื่อม', integrations.filter(i=>i.status==='disconnected').length, 'secondary')}
          ${kpi('⚠️ มีปัญหา', errors, errors > 0 ? 'danger' : 'secondary')}
        </div>

        <div style="display:flex;gap:4px;margin-bottom:14px;flex-wrap:wrap">
          <button class="btn btn-xs ${catFilter==='all'?'btn-primary':'btn-secondary'} cf-btn" data-c="all">ทั้งหมด</button>
          ${Object.entries(INTEGRATION_CATS).map(([k,v]) => `<button class="btn btn-xs ${catFilter===k?'btn-primary':'btn-secondary'} cf-btn" data-c="${k}">${v.icon} ${v.label}</button>`).join('')}
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:12px">
          ${list.map(int => {
            const cat = INTEGRATION_CATS[int.cat]
            return `<div class="card" style="padding:14px;border-left:3px solid var(--${int.status==='connected'?'success':int.status==='error'?'danger':'border'})">
              <div style="display:flex;justify-content:space-between;margin-bottom:10px">
                <div style="display:flex;gap:10px;align-items:center">
                  <div style="font-size:1.5rem">${int.icon}</div>
                  <div>
                    <div style="font-weight:700;font-size:0.88rem">${int.name}</div>
                    <div style="font-size:0.72rem;color:var(--text-muted)">${cat?.icon} ${cat?.label}</div>
                  </div>
                </div>
                <span class="badge badge-${int.status==='connected'?'success':int.status==='error'?'danger':'secondary'}" style="font-size:0.65rem">
                  ${int.status==='connected'?'● เชื่อมแล้ว':int.status==='error'?'● ผิดพลาด':'○ ยังไม่เชื่อม'}
                </span>
              </div>
              <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:10px">${int.desc}</div>
              ${int.lastSync ? `<div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:10px">Sync ล่าสุด: ${timeAgo(int.lastSync)}</div>` : ''}
              <div style="display:flex;gap:6px">
                ${int.status === 'connected' ? `
                  <button class="btn btn-xs btn-secondary config-btn" data-id="${int.id}">⚙️ Config</button>
                  <button class="btn btn-xs btn-secondary sync-btn" data-id="${int.id}">🔄 Sync</button>
                  <button class="btn btn-xs btn-danger disconnect-btn" data-id="${int.id}">ตัดการเชื่อม</button>
                ` : int.status === 'error' ? `
                  <button class="btn btn-xs btn-warning reconnect-btn" data-id="${int.id}">🔄 เชื่อมใหม่</button>
                  <button class="btn btn-xs btn-secondary config-btn" data-id="${int.id}">⚙️ Config</button>
                ` : `
                  <button class="btn btn-xs btn-primary connect-btn" data-id="${int.id}">+ เชื่อมต่อ</button>
                `}
              </div>
            </div>`
          }).join('')}
        </div>
      </div>
    `

    container.querySelectorAll('.cf-btn').forEach(b => b.addEventListener('click', () => { catFilter = b.dataset.c; renderPage() }))
    container.querySelectorAll('.config-btn').forEach(b => b.addEventListener('click', () => {
      const int = integrations.find(x => x.id === b.dataset.id); if (int) openConfig(int)
    }))
    container.querySelectorAll('.sync-btn').forEach(b => b.addEventListener('click', async () => {
      const int = integrations.find(x => x.id === b.dataset.id)
      if (!int) return
      try {
        await updateDocData('system_integrations', int.id, { lastSync: new Date().toISOString() })
        showToast(`🔄 Sync ${int.name} แล้ว`, 'success')
        await loadData()
      } catch (e) { showToast('Sync ไม่สำเร็จ', 'error') }
    }))
    container.querySelectorAll('.disconnect-btn').forEach(b => b.addEventListener('click', async () => {
      const int = integrations.find(x => x.id === b.dataset.id)
      if (!int) return
      try {
        await updateDocData('system_integrations', int.id, { status: 'disconnected', lastSync: null })
        showToast(`❌ ตัดการเชื่อมต่อ ${int.name} แล้ว`, 'warning')
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    }))
    container.querySelectorAll('.connect-btn, .reconnect-btn').forEach(b => b.addEventListener('click', () => {
      const int = integrations.find(x => x.id === b.dataset.id); if (int) openConnectModal(int)
    }))
  }

  function openConfig(int) {
    openModal({
      title: `⚙️ Config: ${int.name}`,
      size: 'md',
      body: `
        <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:12px">${int.desc}</div>
        ${int.webhookUrl ? `
          <div class="input-group"><label class="input-label">Webhook URL</label>
            <div style="display:flex;gap:6px">
              <input class="input" value="${int.webhookUrl}" readonly style="flex:1;font-size:0.78rem;font-family:monospace">
              <button class="btn btn-xs btn-secondary" onclick="navigator.clipboard.writeText('${int.webhookUrl}');window.__showToast?.('✅ Copied!','success')">Copy</button>
            </div>
          </div>
        ` : ''}
        ${Object.entries(int.config).map(([k,v]) => `
          <div class="input-group"><label class="input-label">${k}</label>
            <input class="input" value="${v}" style="font-size:0.83rem" ${v.includes('*')?'type="password"':''}>
          </div>
        `).join('')}
        <div style="padding:10px;background:rgba(34,197,94,.1);border-radius:var(--radius-sm);font-size:0.78rem;color:var(--success);margin-top:12px">
          ✅ Integration นี้เชื่อมต่ออยู่และทำงานปกติ
        </div>
      `
    })
  }

  function openConnectModal(int) {
    openModal({
      title: `+ เชื่อมต่อ: ${int.name}`,
      size: 'md',
      body: `
        <div style="font-size:0.85rem;margin-bottom:14px">${int.desc}</div>
        <div class="input-group"><label class="input-label">API Key / Token *</label><input class="input" id="conn-apikey" type="password" placeholder="กรอก API Key"></div>
        <div class="input-group"><label class="input-label">Client ID / Merchant ID</label><input class="input" id="conn-clientid" placeholder="กรอก ID (ถ้ามี)"></div>
      `,
      async onConfirm() {
        const apiKey = document.getElementById('conn-apikey')?.value?.trim()
        if (!apiKey) { showToast('❗ กรุณากรอก API Key', 'error'); return false }
        try {
          await updateDocData('system_integrations', int.id, { status: 'connected', lastSync: new Date().toISOString(), config: { apiKey: '****', clientId: document.getElementById('conn-clientid')?.value || '' } })
          showToast(`✅ เชื่อมต่อ ${int.name} สำเร็จ!`, 'success')
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      }
    })
  }

  await loadData()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
