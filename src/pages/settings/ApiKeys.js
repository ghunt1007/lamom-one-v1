/**
 * API Keys — จัดการ API Keys
 * Route: /settings/api-keys
 */
import { formatDate, timeAgo } from '../../utils/format.js'
import { openModal, confirmDialog } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'

function esc(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;') }

const KEY_SCOPES = {
  read:  { label: 'อ่านอย่างเดียว', color: 'success', icon: '👁' },
  write: { label: 'อ่าน + เขียน', color: 'warning', icon: '✏️' },
  admin: { label: 'Admin เต็มสิทธิ์', color: 'danger', icon: '🔑' },
}

function genKey() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let s = 'lmm_live_'
  for (let i = 0; i < 32; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}

export default async function ApiKeysPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let keys = []
  let loading = true

  async function loadData() {
    loading = true
    try { keys = await listDocs('api_keys', [], 'created', 'desc', 200) } catch (e) { keys = [] }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const active = keys.filter(k => k.active).length
    const totalReq = keys.reduce((a, k) => a + k.requests30d, 0)
    const stale = keys.filter(k => k.active && new Date(k.lastUsed) < new Date(Date.now() - 30 * 86400000)).length

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🔑 API Keys</div>
            <div class="page-subtitle">จัดการ Keys สำหรับ Integration ภายนอก</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="create-key-btn">+ สร้าง Key ใหม่</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:16px">
          ${kpi('🔑 Keys ใช้งาน', active + '/' + keys.length, 'primary')}
          ${kpi('📊 Requests 30 วัน', totalReq.toLocaleString(), 'secondary')}
          ${kpi('⚠️ ไม่ได้ใช้ 30+ วัน', stale, stale > 0 ? 'warning' : 'success')}
        </div>

        <div style="padding:10px 14px;background:var(--surface-2);border-left:3px solid var(--warning);border-radius:var(--radius-sm);margin-bottom:14px;font-size:0.78rem">
          🔒 <strong>ความปลอดภัย:</strong> Key เต็มจะแสดงครั้งเดียวตอนสร้างเท่านั้น — เก็บไว้ในที่ปลอดภัย ห้าม commit ลง git
        </div>

        <div class="card" style="overflow:hidden">
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="border-bottom:1px solid var(--border);font-size:0.73rem;color:var(--text-muted)">
                <th style="padding:8px 14px;text-align:left">ชื่อ</th>
                <th style="padding:8px 10px;text-align:left">Key</th>
                <th style="padding:8px 10px">สิทธิ์</th>
                <th style="padding:8px 10px;text-align:right">Req 30 วัน</th>
                <th style="padding:8px 10px">ใช้ล่าสุด</th>
                <th style="padding:8px 14px"></th>
              </tr>
            </thead>
            <tbody>
              ${keys.map(k => {
                const sc = KEY_SCOPES[k.scope]
                return `<tr style="border-bottom:1px solid var(--border);font-size:0.8rem${k.active?'':';opacity:0.5'}">
                  <td style="padding:8px 14px">
                    <div style="font-weight:600">${esc(k.name)}</div>
                    <div style="font-size:0.65rem;color:var(--text-muted)">สร้าง ${formatDate(k.created)}</div>
                  </td>
                  <td style="padding:8px 10px;font-family:monospace;font-size:0.73rem">${k.prefix}••••••••</td>
                  <td style="padding:8px 10px;text-align:center"><span class="badge badge-${sc?.color}" style="font-size:0.6rem">${sc?.icon} ${sc?.label}</span></td>
                  <td style="padding:8px 10px;text-align:right">${k.requests30d.toLocaleString()}</td>
                  <td style="padding:8px 10px;font-size:0.72rem;color:var(--text-muted)">${timeAgo(k.lastUsed)}</td>
                  <td style="padding:8px 14px;text-align:right;white-space:nowrap">
                    ${k.active
                      ? `<button class="btn btn-xs btn-danger revoke-btn" data-id="${k.id}">🚫 Revoke</button>`
                      : `<span class="badge badge-secondary" style="font-size:0.6rem">Revoked</span>`
                    }
                  </td>
                </tr>`
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `

    container.querySelectorAll('.revoke-btn').forEach(b => b.addEventListener('click', async () => {
      const k = keys.find(x => x.id === b.dataset.id)
      if (!k) return
      const ok = await confirmDialog({ title:`🚫 Revoke "${esc(k.name)}"?`, message:'Integration ที่ใช้ Key นี้จะหยุดทำงานทันที', confirmText:'Revoke', danger:true })
      if (!ok) return
      try {
        await updateDocData('api_keys', k.id, { active: false })
        showToast('🚫 Revoke Key แล้ว', 'warning')
        if (container.__routerGen !== myGen) return
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    }))
    document.getElementById('create-key-btn')?.addEventListener('click', openCreateForm)
  }

  function openCreateForm() {
    openModal({
      title: '+ สร้าง API Key',
      size: 'sm',
      body: `<div style="display:grid;gap:10px">
        <div class="input-group"><label class="input-label">ชื่อ Key *</label><input class="input" id="key-name" placeholder="เช่น LINE Integration"></div>
        <div class="input-group"><label class="input-label">สิทธิ์</label>
          <select class="input" id="key-scope">${Object.entries(KEY_SCOPES).map(([k,v])=>`<option value="${k}">${v.icon} ${v.label}</option>`).join('')}</select>
        </div>
      </div>`,
      confirmText: '🔑 สร้าง',
      async onConfirm() {
        const name = document.getElementById('key-name')?.value?.trim()
        if (!name) { showToast('❗ กรุณากรอกชื่อ', 'error'); return false }
        const fullKey = genKey()
        try {
          await createDoc('api_keys', { name, prefix: fullKey.slice(0, 13), scope: document.getElementById('key-scope')?.value||'read', created:new Date().toISOString(), lastUsed:new Date().toISOString(), requests30d:0, active:true })
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error'); return }
        await loadData()
        setTimeout(() => openModal({
          title: '🔑 Key ของคุณ (แสดงครั้งเดียว!)',
          size: 'sm',
          body: `<div style="font-family:monospace;font-size:0.8rem;padding:12px;background:var(--surface-2);border-radius:var(--radius-sm);word-break:break-all;user-select:all">${fullKey}</div>
            <p style="font-size:0.73rem;color:var(--warning);margin-top:10px">⚠️ คัดลอกเก็บไว้ทันที — จะไม่แสดงอีก</p>`,
          confirmText: '✅ คัดลอก Key',
          onConfirm() {
            navigator.clipboard?.writeText(fullKey)
              .then(() => showToast('🔑 คัดลอก Key เรียบร้อย — เก็บไว้อย่างปลอดภัย', 'success'))
              .catch(() => showToast('🔑 สร้าง Key สำเร็จ — คัดลอกด้วยตนเองจากหน้าต่างนี้', 'success'))
          }
        }), 200)
      }
    })
  }

  await loadData()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
