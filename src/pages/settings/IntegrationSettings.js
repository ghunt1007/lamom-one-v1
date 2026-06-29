/**
 * Integration Settings — ตั้งค่าการเชื่อมต่อ
 * Route: /integrations/settings
 */
import { timeAgo } from '../../utils/format.js'
import { openModal, confirmDialog } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'

const INTEGRATION_CATS = {
  payment:   { label: 'การชำระเงิน', icon: '💳' },
  messaging: { label: 'การสื่อสาร', icon: '💬' },
  crm:       { label: 'CRM ภายนอก', icon: '👥' },
  accounting:{ label: 'บัญชี', icon: '📊' },
  ai:        { label: 'AI & Analytics', icon: '🤖' },
  logistics: { label: 'โลจิสติกส์', icon: '🚚' },
}

const INTEGRATIONS = [
  { id: 'INT001', name: 'LINE Official Account', cat: 'messaging', icon: '💬', status: 'connected', desc: 'รับส่งข้อความ LINE ลูกค้า', lastSync: new Date(Date.now() - 600000).toISOString(), webhookUrl: 'https://api.lamom.one/webhook/line', config: { channelId: 'xxxxx', secretKey: '****' } },
  { id: 'INT002', name: 'Facebook Messenger', cat: 'messaging', icon: '📘', status: 'connected', desc: 'ตอบ Chat Facebook Page', lastSync: new Date(Date.now() - 1800000).toISOString(), webhookUrl: 'https://api.lamom.one/webhook/fb', config: { pageId: 'xxxxx', token: '****' } },
  { id: 'INT003', name: 'SCB Easy Payment', cat: 'payment', icon: '💳', status: 'connected', desc: 'รับชำระผ่าน SCB Easy', lastSync: new Date(Date.now() - 3600000).toISOString(), webhookUrl: '', config: { merchantId: 'xxxxx', apiKey: '****' } },
  { id: 'INT004', name: 'KBank Payment Gateway', cat: 'payment', icon: '💰', status: 'disconnected', desc: 'รับชำระผ่าน KBank', lastSync: null, webhookUrl: '', config: {} },
  { id: 'INT005', name: 'QuickBooks', cat: 'accounting', icon: '📊', status: 'error', desc: 'ส่งข้อมูลบัญชีอัตโนมัติ', lastSync: new Date(Date.now() - 86400000).toISOString(), webhookUrl: '', config: { companyId: 'xxxxx', token: '****' } },
  { id: 'INT006', name: 'OpenAI GPT-4', cat: 'ai', icon: '🤖', status: 'connected', desc: 'AI สำหรับ LAMI Brain', lastSync: new Date(Date.now() - 300000).toISOString(), webhookUrl: '', config: { apiKey: '****', model: 'gpt-4o' } },
  { id: 'INT007', name: 'Google Analytics 4', cat: 'ai', icon: '📈', status: 'connected', desc: 'วิเคราะห์ traffic เว็บไซต์', lastSync: new Date(Date.now() - 7200000).toISOString(), webhookUrl: '', config: { measurementId: 'G-xxxxx' } },
  { id: 'INT008', name: 'Salesforce CRM', cat: 'crm', icon: '☁️', status: 'disconnected', desc: 'Sync ข้อมูล Lead กับ Salesforce', lastSync: null, webhookUrl: '', config: {} },
  { id: 'INT009', name: 'BYD Dealer Portal', cat: 'logistics', icon: '🚗', status: 'connected', desc: 'ดึงข้อมูลสั่งรถและสต็อก', lastSync: new Date(Date.now() - 14400000).toISOString(), webhookUrl: '', config: { dealerCode: 'BYD-TH-001' } },
  { id: 'INT010', name: 'SendGrid Email', cat: 'messaging', icon: '📧', status: 'connected', desc: 'ส่ง Email อัตโนมัติ', lastSync: new Date(Date.now() - 900000).toISOString(), webhookUrl: '', config: { apiKey: '****', fromEmail: 'noreply@lamom.one' } },
]

export default async function IntegrationSettingsPage(container) {
  let integrations = INTEGRATIONS.map(i => ({ ...i }))
  let catFilter = 'all'

  function renderPage() {
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
    container.querySelectorAll('.sync-btn').forEach(b => b.addEventListener('click', () => {
      const int = integrations.find(x => x.id === b.dataset.id)
      if (int) { int.lastSync = new Date().toISOString(); showToast(`🔄 Sync ${int.name} แล้ว`, 'success'); renderPage() }
    }))
    container.querySelectorAll('.disconnect-btn').forEach(b => b.addEventListener('click', () => {
      const int = integrations.find(x => x.id === b.dataset.id)
      if (int) { int.status = 'disconnected'; int.lastSync = null; showToast(`❌ ตัดการเชื่อมต่อ ${int.name} แล้ว`, 'warning'); renderPage() }
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
      onConfirm() {
        const apiKey = document.getElementById('conn-apikey')?.value?.trim()
        if (!apiKey) { showToast('❗ กรุณากรอก API Key', 'error'); return }
        int.status = 'connected'
        int.lastSync = new Date().toISOString()
        int.config = { apiKey: '****', clientId: document.getElementById('conn-clientid')?.value || '' }
        showToast(`✅ เชื่อมต่อ ${int.name} สำเร็จ!`, 'success')
        renderPage()
      }
    })
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
