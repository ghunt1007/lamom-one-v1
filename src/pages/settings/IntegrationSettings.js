/**
 * Integration Settings — ตั้งค่าการเชื่อมต่อ
 * Route: /integrations/settings
 */
import { timeAgo } from '../../utils/format.js'
import { openModal, confirmDialog } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, updateDocData, seedDemoData } from '../../core/db.js'
import { isProgramOwner } from '../../core/hierarchy.js'

// (v1.0.330) เดิมปุ่ม "เชื่อมต่อ" รับ API Key อะไรก็ได้ที่ไม่ว่างเปล่า แล้วขึ้น "✅ เชื่อมต่อสำเร็จ!" ทันที
// โดยไม่เคยเรียกไปตรวจสอบกับผู้ให้บริการจริงเลย (ไม่มี backend/worker เชื่อม provider จริงสำหรับ 6 หมวดนี้
// — มีแค่ workers/comms-send.js สำหรับ SMS/LINE/Email เท่านั้น สร้าง backend เชื่อมจริงทุก provider เป็นงาน
// เฉพาะกองใหญ่เกินกว่าการแก้บัคเดียว) ปุ่ม "Sync" ก็แค่อัปเดต timestamp ไม่ได้ sync อะไรจริง — แก้ให้พูด
// ตรงกับความจริง: เปลี่ยนเป็น "บันทึก API Key" (ไม่ใช่ "เชื่อมต่อสำเร็จ") ระบุชัดว่ายังไม่ได้ตรวจสอบกับผู้
// ให้บริการจริงโดยอัตโนมัติ และตัดปุ่ม Sync ออก (ไม่มีอะไรให้ sync จริง)

function escHtml(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;') }

const INTEGRATION_CATS = {
  payment:   { label: 'การชำระเงิน', icon: '💳' },
  messaging: { label: 'การสื่อสาร', icon: '💬' },
  crm:       { label: 'CRM ภายนอก', icon: '👥' },
  accounting:{ label: 'บัญชี', icon: '📊' },
  ai:        { label: 'AI & Analytics', icon: '🤖' },
  logistics: { label: 'โลจิสติกส์', icon: '🚚' },
}

export default async function IntegrationSettingsPage(container) {
  if (!isProgramOwner()) {
    container.innerHTML = `<div class="page-content"><div class="empty-state" style="padding:60px 20px"><div class="empty-icon">🔒</div><div class="empty-title">ไม่มีสิทธิ์เข้าถึงหน้านี้</div><div class="empty-desc">การเชื่อมต่อระบบภายนอก (API Key/Credential) กระทบทุกบริษัทพร้อมกัน เปิดให้เฉพาะเจ้าของโปรแกรมเท่านั้น</div></div></div>`
    return
  }
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
          ${kpi('🔑 บันทึก Key แล้ว', connected, 'success')}
          ${kpi('○ ยังไม่บันทึก', integrations.filter(i=>i.status==='disconnected').length, 'secondary')}
          ${kpi('⚠️ มีปัญหา', errors, errors > 0 ? 'danger' : 'secondary')}
        </div>
        <div style="padding:10px 14px;background:var(--surface-2);border-radius:var(--radius-sm);font-size:0.75rem;color:var(--text-muted);margin-bottom:14px">
          ℹ️ หน้านี้เป็นที่บันทึก API Key/Credential ไว้ใช้งานเท่านั้น ระบบไม่ได้เชื่อมต่อ/ตรวจสอบกับผู้ให้บริการจริงโดยอัตโนมัติ กรุณาทดสอบการทำงานจริงกับผู้ให้บริการด้วยตนเองก่อนใช้งานจริง
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
                  ${int.status==='connected'?'🔑 บันทึก Key แล้ว':int.status==='error'?'● ผิดพลาด':'○ ยังไม่บันทึก'}
                </span>
              </div>
              <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:10px">${int.desc}</div>
              ${int.lastSync ? `<div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:10px">บันทึก Key ล่าสุด: ${timeAgo(int.lastSync)}</div>` : ''}
              <div style="display:flex;gap:6px">
                ${int.status === 'connected' ? `
                  <button class="btn btn-xs btn-secondary config-btn" data-id="${int.id}">⚙️ Config</button>
                  <button class="btn btn-xs btn-danger disconnect-btn" data-id="${int.id}">ลบ Key</button>
                ` : int.status === 'error' ? `
                  <button class="btn btn-xs btn-warning reconnect-btn" data-id="${int.id}">🔄 บันทึก Key ใหม่</button>
                  <button class="btn btn-xs btn-secondary config-btn" data-id="${int.id}">⚙️ Config</button>
                ` : `
                  <button class="btn btn-xs btn-primary connect-btn" data-id="${int.id}">+ บันทึก API Key</button>
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
    container.querySelectorAll('.disconnect-btn').forEach(b => b.addEventListener('click', async () => {
      const int = integrations.find(x => x.id === b.dataset.id)
      if (!int) return
      try {
        await updateDocData('system_integrations', int.id, { status: 'disconnected', lastSync: null })
        showToast(`🗑 ลบ API Key ของ ${int.name} แล้ว`, 'warning')
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
              <input class="input" value="${escHtml(int.webhookUrl)}" readonly style="flex:1;font-size:0.78rem;font-family:monospace">
              <button class="btn btn-xs btn-secondary" onclick="navigator.clipboard.writeText('${escHtml(int.webhookUrl).replace(/'/g, "\\'")}');window.__showToast?.('✅ Copied!','success')">Copy</button>
            </div>
          </div>
        ` : ''}
        ${Object.entries(int.config).map(([k,v]) => `
          <div class="input-group"><label class="input-label">${escHtml(k)}</label>
            <input class="input" value="${escHtml(v)}" style="font-size:0.83rem" ${String(v).includes('*')?'type="password"':''}>
          </div>
        `).join('')}
        <div style="padding:10px;background:var(--surface-2);border-radius:var(--radius-sm);font-size:0.78rem;color:var(--text-muted);margin-top:12px">
          🔑 มี API Key บันทึกไว้แล้ว — ระบบยังไม่ได้ตรวจสอบกับ ${int.name} จริงโดยอัตโนมัติ กรุณาทดสอบการทำงานจริงด้วยตนเอง
        </div>
      `
    })
  }

  function openConnectModal(int) {
    openModal({
      title: `+ บันทึก API Key: ${int.name}`,
      size: 'md',
      body: `
        <div style="font-size:0.85rem;margin-bottom:14px">${int.desc}</div>
        <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:10px">⚠️ ระบบจะบันทึก Key ไว้ใช้งานเท่านั้น ไม่ได้ตรวจสอบกับผู้ให้บริการจริงโดยอัตโนมัติ กรุณาตรวจสอบว่า Key ถูกต้องเอง</div>
        <div class="input-group"><label class="input-label">API Key / Token *</label><input class="input" id="conn-apikey" type="password" placeholder="กรอก API Key"></div>
        <div class="input-group"><label class="input-label">Client ID / Merchant ID</label><input class="input" id="conn-clientid" placeholder="กรอก ID (ถ้ามี)"></div>
      `,
      confirmText: '💾 บันทึก API Key',
      async onConfirm() {
        const apiKey = document.getElementById('conn-apikey')?.value?.trim()
        if (!apiKey) { showToast('❗ กรุณากรอก API Key', 'error'); return false }
        try {
          await updateDocData('system_integrations', int.id, { status: 'connected', lastSync: new Date().toISOString(), config: { apiKey: '****', clientId: document.getElementById('conn-clientid')?.value || '' } })
          showToast(`🔑 บันทึก API Key ของ ${int.name} แล้ว — ยังไม่ได้ตรวจสอบกับผู้ให้บริการจริง`, 'success')
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      }
    })
  }

  await loadData()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
