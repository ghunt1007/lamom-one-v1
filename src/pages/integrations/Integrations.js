import { showToast } from '../../core/store.js'
import { openModal } from '../../utils/modal.js'

const INTEGRATIONS = [
  {
    id: 'line', name: 'LINE Official Account', icon: '💚', category: 'messaging',
    desc: 'รับ Lead อัตโนมัติ + แจ้งเตือน + ตอบ Chatbot LINE OA', status: 'disconnected',
    fields: [
      { id: 'channel_id', label: 'Channel ID', type: 'text', placeholder: '1234567890' },
      { id: 'channel_secret', label: 'Channel Secret', type: 'password', placeholder: '••••••••' },
      { id: 'access_token', label: 'Channel Access Token', type: 'password', placeholder: '••••••••••••••••••••' },
    ],
    features: ['รับ Lead จาก LINE Forms', 'แจ้งเตือนพนักงาน', 'ตอบ Chatbot อัตโนมัติ', 'Broadcast Message'],
    docs: 'https://developers.line.biz/'
  },
  {
    id: 'facebook', name: 'Facebook Lead Ads', icon: '🔵', category: 'social',
    desc: 'ดึง Lead จาก Facebook/Instagram Lead Ads โดยอัตโนมัติ', status: 'disconnected',
    fields: [
      { id: 'app_id', label: 'App ID', type: 'text', placeholder: '1234567890123456' },
      { id: 'app_secret', label: 'App Secret', type: 'password', placeholder: '••••••••' },
      { id: 'page_token', label: 'Page Access Token', type: 'password', placeholder: 'EAABs...' },
      { id: 'page_id', label: 'Page ID', type: 'text', placeholder: '123456789' },
    ],
    features: ['Lead Ads Auto-pull', 'Messenger Bot', 'Page Insights', 'Comment Auto-reply'],
    docs: 'https://developers.facebook.com/'
  },
  {
    id: 'tiktok', name: 'TikTok Lead Generation', icon: '🎵', category: 'social',
    desc: 'ดึง Lead จาก TikTok Lead Ads เข้าระบบอัตโนมัติ', status: 'disconnected',
    fields: [
      { id: 'access_token', label: 'Access Token', type: 'password', placeholder: '••••••••' },
      { id: 'advertiser_id', label: 'Advertiser ID', type: 'text', placeholder: '7123456789' },
    ],
    features: ['Lead Ads Import', 'Campaign Analytics', 'Audience Insights'],
    docs: 'https://business-api.tiktok.com/'
  },
  {
    id: 'google', name: 'Google (Ads + Sheets)', icon: '🔴', category: 'google',
    desc: 'ซิงค์ข้อมูลกับ Google Sheets + ดึง Lead จาก Google Ads', status: 'disconnected',
    fields: [
      { id: 'client_id', label: 'OAuth Client ID', type: 'text', placeholder: '123-abc.apps.googleusercontent.com' },
      { id: 'client_secret', label: 'OAuth Client Secret', type: 'password', placeholder: '••••••••' },
      { id: 'spreadsheet_id', label: 'Spreadsheet ID (Sheets)', type: 'text', placeholder: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms' },
    ],
    features: ['Google Ads Lead Import', 'Sheets Export/Sync', 'Analytics 4 Integration'],
    docs: 'https://developers.google.com/'
  },
  {
    id: 'deepal', name: 'DEEPAL DMS', icon: '🚙', category: 'dms',
    desc: 'เชื่อมต่อ DMS DEEPAL (catdms.changan.co.th) เพื่อ Sync สต็อก/ออเดอร์', status: 'disconnected',
    fields: [
      { id: 'dealer_code', label: 'Dealer Code', type: 'text', placeholder: 'TH001' },
      { id: 'api_key', label: 'API Key', type: 'password', placeholder: '••••••••' },
      { id: 'endpoint', label: 'API Endpoint', type: 'text', placeholder: 'https://catdms.changan.co.th/api' },
    ],
    features: ['Stock Sync อัตโนมัติ', 'Order Status', 'Allocation Management'],
    docs: 'https://catdms.changan.co.th/'
  },
  {
    id: 'infinite', name: 'Infinite DMS (MG/BYD)', icon: '🔷', category: 'dms',
    desc: 'เชื่อมต่อ Infinite DMS (dms.infinite-automobile.com)', status: 'disconnected',
    fields: [
      { id: 'username', label: 'Username', type: 'text', placeholder: 'dealer@example.com' },
      { id: 'password', label: 'Password', type: 'password', placeholder: '••••••••' },
    ],
    features: ['Vehicle Allocation', 'PDI Status', 'Warranty Claims'],
    docs: 'https://dms.infinite-automobile.com/'
  },
  {
    id: 'payment', name: 'Payment Gateway (PromptPay/QR)', icon: '💳', category: 'payment',
    desc: 'รับชำระเงินผ่าน QR Code / PromptPay / บัตรเครดิต', status: 'disconnected',
    fields: [
      { id: 'merchant_id', label: 'Merchant ID', type: 'text', placeholder: 'MERCHANT_001' },
      { id: 'api_key', label: 'API Key', type: 'password', placeholder: '••••••••' },
      { id: 'webhook_url', label: 'Webhook URL', type: 'text', placeholder: 'https://...' },
    ],
    features: ['QR PromptPay', 'Credit Card', 'Receipt Auto-generate', 'Refund Management'],
    docs: '#'
  },
  {
    id: 'webhook', name: 'Custom Webhook', icon: '🔗', category: 'custom',
    desc: 'สร้าง Webhook รับข้อมูลจากทุก Platform ที่รองรับ HTTP', status: 'disconnected',
    fields: [
      { id: 'webhook_url', label: 'Incoming Webhook URL (ของระบบนี้)', type: 'text', placeholder: 'อ่านอย่างเดียว — ระบบสร้างให้', readonly: true, value: 'https://lamom-one.web.app/api/webhook/lamom' },
      { id: 'secret', label: 'Secret Key', type: 'password', placeholder: 'ตั้งค่า Secret สำหรับตรวจสอบ' },
    ],
    features: ['รับ POST Request', 'JSON Payload Parser', 'Auto-map ถึง Collection', 'Event Log'],
    docs: '#'
  },
]

const CATEGORY_LABELS = {
  messaging: '💬 Messaging', social: '📣 Social Media', google: '🔴 Google',
  dms: '🚗 DMS External', payment: '💳 Payment', custom: '🔗 Custom',
}

export default async function IntegrationsPage(container) {
  let configs = {}
  try { configs = JSON.parse(localStorage.getItem('lamom-integrations') || '{}') } catch {}

  INTEGRATIONS.forEach(i => {
    if (configs[i.id]) i.status = configs[i.id].connected ? 'connected' : 'disconnected'
  })

  let filterCat = 'all'

  function save() { try { localStorage.setItem('lamom-integrations', JSON.stringify(configs)) } catch {} }

  function renderPage() {
    const cats = [...new Set(INTEGRATIONS.map(i => i.category))]
    const filtered = filterCat === 'all' ? INTEGRATIONS : INTEGRATIONS.filter(i => i.category === filterCat)
    const connected = INTEGRATIONS.filter(i => i.status === 'connected').length

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🔗 Integrations & Hooks</div>
            <div class="page-subtitle">เชื่อมต่อ Platform ภายนอก</div>
          </div>
          <div class="page-actions">
            ${connected > 0 ? `<span class="badge badge-success">✅ Connected ${connected}</span>` : ''}
          </div>
        </div>

        <!-- Category filter -->
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:20px">
          <button class="btn btn-sm cat-btn ${filterCat==='all'?'btn-primary':'btn-secondary'}" data-cat="all">ทั้งหมด</button>
          ${cats.map(c => `<button class="btn btn-sm cat-btn ${filterCat===c?'btn-primary':'btn-secondary'}" data-cat="${c}">${CATEGORY_LABELS[c]||c}</button>`).join('')}
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px">
          ${filtered.map(i => integrationCard(i)).join('')}
        </div>
      </div>
    `

    document.querySelectorAll('.cat-btn').forEach(btn => {
      btn.addEventListener('click', () => { filterCat = btn.dataset.cat; renderPage() })
    })
    document.querySelectorAll('.int-setup-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const intg = INTEGRATIONS.find(x => x.id === btn.dataset.id)
        if (intg) openSetupModal(intg)
      })
    })
    document.querySelectorAll('.int-disconnect-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id
        if (configs[id]) { configs[id].connected = false; delete configs[id] }
        const found = INTEGRATIONS.find(x => x.id === id); if (found) found.status = 'disconnected'
        save(); showToast('ยกเลิกการเชื่อมต่อแล้ว', 'warning'); renderPage()
      })
    })
  }

  function integrationCard(intg) {
    const isConn = intg.status === 'connected'
    return `
      <div class="card" style="padding:16px;border:1px solid ${isConn ? 'var(--success)' : 'var(--border)'}">
        <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:12px">
          <div style="font-size:2rem;flex-shrink:0">${intg.icon}</div>
          <div style="flex:1">
            <div style="font-weight:700;font-size:0.95rem">${intg.name}</div>
            <div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px">${CATEGORY_LABELS[intg.category]||''}</div>
          </div>
          <span class="badge badge-${isConn ? 'success' : 'secondary'}">${isConn ? '🟢 Connected' : '⚫ Offline'}</span>
        </div>

        <div style="font-size:0.82rem;color:var(--text-muted);margin-bottom:12px">${intg.desc}</div>

        <div style="margin-bottom:14px">
          ${intg.features.map(f => `<div style="font-size:0.75rem;margin-bottom:3px;display:flex;gap:5px"><span style="color:var(--success)">✓</span><span>${f}</span></div>`).join('')}
        </div>

        <div style="display:flex;gap:6px">
          <button class="btn btn-${isConn ? 'secondary' : 'primary'} btn-sm int-setup-btn" data-id="${intg.id}" style="flex:1">
            ${isConn ? '⚙️ จัดการ' : '🔗 เชื่อมต่อ'}
          </button>
          ${isConn ? `<button class="btn btn-ghost btn-sm int-disconnect-btn" data-id="${intg.id}" style="color:var(--danger)">ยกเลิก</button>` : ''}
        </div>
      </div>
    `
  }

  function openSetupModal(intg) {
    const savedConfig = configs[intg.id] || {}
    const { el, close } = openModal({
      title: `${intg.icon} ตั้งค่า ${intg.name}`, size: 'md',
      body: `
        <div style="display:flex;flex-direction:column;gap:12px">
          <div style="font-size:0.78rem;background:var(--warning-bg,rgba(234,179,8,.1));border:1px solid var(--warning);border-radius:8px;padding:10px 12px;color:var(--text)">
            ⚠️ <strong>หน้านี้ยังไม่เชื่อมต่อ API จริง</strong> — เป็นเพียง UI จำลองสำหรับสาธิต ระบบไม่ได้ส่งข้อมูลไปยัง ${intg.name} จริง และไม่ได้รับ Lead/ข้อมูลใดๆ จากภายนอก<br>
            <strong>อย่ากรอก Secret/Token ของจริง</strong> — ข้อมูลที่กรอกจะถูกบันทึกไว้ในเบราว์เซอร์แบบไม่เข้ารหัส
          </div>
          ${intg.docs !== '#' ? `<div style="font-size:0.78rem;color:var(--text-muted)">📖 Docs: <a href="${intg.docs}" target="_blank" style="color:var(--primary)">${intg.docs}</a></div>` : ''}
          ${intg.fields.map(f => `
            <div class="input-group">
              <label class="input-label">${f.label}</label>
              <input class="input" id="f-${f.id}" type="${f.type}" placeholder="${f.placeholder}"
                ${f.readonly ? 'readonly' : ''} value="${f.value || savedConfig[f.id] || ''}">
            </div>
          `).join('')}
        </div>
      `,
      footer: `<button class="btn btn-secondary" id="ic">ยกเลิก</button><button class="btn btn-primary" id="is">🔗 บันทึกและเชื่อมต่อ</button>`
    })
    el.querySelector('#ic').addEventListener('click', close)
    el.querySelector('#is').addEventListener('click', () => {
      const cfg = {}
      intg.fields.forEach(f => { cfg[f.id] = el.querySelector('#f-' + f.id)?.value || '' })
      const btn = el.querySelector('#is'); btn.disabled = true; btn.innerHTML = '<span class="spinner spinner-sm"></span>'
      setTimeout(() => {
        cfg.connected = true
        configs[intg.id] = cfg
        intg.status = 'connected'
        save(); showToast(`✅ เชื่อมต่อ ${intg.name} สำเร็จ (Demo Mode)`, 'success')
        close(); renderPage()
      }, 1200)
    })
  }

  renderPage()
}
