/**
 * Notification Settings — ตั้งค่าการแจ้งเตือน
 * Route: /settings/notifications
 */
import { openModal } from '../../utils/modal.js'
import { showToast, getState } from '../../core/store.js'
import { listDocs, createDoc, updateDocData } from '../../core/db.js'

const NOTIF_CHANNELS = {
  inapp:    { label: 'In-App', icon: '🔔', desc: 'แจ้งเตือนในระบบ' },
  email:    { label: 'Email', icon: '📧', desc: 'ส่ง Email' },
  line:     { label: 'LINE', icon: '💬', desc: 'ส่ง LINE Notify' },
  push:     { label: 'Push', icon: '📱', desc: 'Push Notification บนมือถือ' },
}

const NOTIF_EVENTS = [
  { id: 'new_lead',      group: 'CRM', label: 'Lead ใหม่เข้า', icon: '🧲', inapp: true, email: false, line: true, push: false, critical: false },
  { id: 'hot_lead',      group: 'CRM', label: 'Lead Hot Score > 80%', icon: '🔥', inapp: true, email: true, line: true, push: true, critical: false },
  { id: 'booking',       group: 'CRM', label: 'มีการจองรถใหม่', icon: '📝', inapp: true, email: true, line: false, push: false, critical: false },
  { id: 'complaint',     group: 'CRM', label: 'ร้องเรียนใหม่', icon: '😤', inapp: true, email: true, line: true, push: true, critical: true },
  { id: 'pdi_done',      group: 'DMS', label: 'PDI เสร็จสิ้น', icon: '✅', inapp: true, email: false, line: false, push: false, critical: false },
  { id: 'stock_low',     group: 'DMS', label: 'สต็อกต่ำกว่า 3 คัน', icon: '📦', inapp: true, email: true, line: true, push: false, critical: false },
  { id: 'job_complete',  group: 'Service', label: 'งานซ่อมเสร็จแล้ว', icon: '🔧', inapp: true, email: true, line: true, push: false, critical: false },
  { id: 'recall_alert',  group: 'Service', label: 'มีการเรียกคืนรถ', icon: '🚨', inapp: true, email: true, line: true, push: true, critical: true },
  { id: 'invoice_due',   group: 'Finance', label: 'Invoice ถึงกำหนดชำระ', icon: '🧾', inapp: true, email: true, line: false, push: false, critical: false },
  { id: 'payroll',       group: 'Finance', label: 'ถึงรอบจ่ายเงินเดือน', icon: '💰', inapp: true, email: true, line: false, push: false, critical: false },
  { id: 'leave_request', group: 'HR', label: 'พนักงานยื่นลา', icon: '🏖', inapp: true, email: false, line: false, push: false, critical: false },
  { id: 'ins_expiry',    group: 'Insurance', label: 'ประกันหมดอายุใน 7 วัน', icon: '🛡', inapp: true, email: true, line: true, push: false, critical: false },
  { id: 'login_fail',    group: 'Security', label: 'Login ล้มเหลว 3 ครั้ง', icon: '🔒', inapp: true, email: true, line: true, push: true, critical: true },
]

const GROUPS = [...new Set(NOTIF_EVENTS.map(e => e.group))]

export default async function NotificationSettingsPage(container) {
  const myGen = container.__routerGen
  let settings = Object.fromEntries(NOTIF_EVENTS.map(e => [e.id, { inapp: e.inapp, email: e.email, line: e.line, push: e.push }]))
  let groupFilter = 'all'
  let settingsDocId = null
  const uid = (getState('user') || {}).uid || 'anonymous'

  async function loadSettings() {
    try {
      const rows = await listDocs('user_settings', [['uid', '==', uid]], 'updatedAt', 'desc', 1)
      if (rows.length) {
        settingsDocId = rows[0].id
        const saved = rows[0].notifSettings || {}
        settings = Object.fromEntries(NOTIF_EVENTS.map(e => [e.id, {
          inapp: saved[e.id]?.inapp ?? e.inapp,
          email: saved[e.id]?.email ?? e.email,
          line: saved[e.id]?.line ?? e.line,
          push: saved[e.id]?.push ?? e.push,
        }]))
      }
    } catch { /* ใช้ค่าเริ่มต้นถ้าโหลดไม่สำเร็จ */ }
    if (container.__routerGen === myGen) renderPage()
  }

  function renderPage() {
    const list = NOTIF_EVENTS.filter(e => groupFilter === 'all' || e.group === groupFilter)
    const enabledCount = Object.values(settings).filter(s => s.inapp || s.email || s.line || s.push).length

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🔔 Notification Settings</div>
            <div class="page-subtitle">ตั้งค่าการแจ้งเตือนทุกประเภท</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-success" id="save-settings-btn">💾 บันทึก</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('📋 เหตุการณ์ทั้งหมด', NOTIF_EVENTS.length, 'primary')}
          ${kpi('✅ เปิดอยู่', enabledCount, 'success')}
          ${kpi('🚨 Critical', NOTIF_EVENTS.filter(e=>e.critical).length, 'danger')}
          ${kpi('📱 ช่องทาง', Object.keys(NOTIF_CHANNELS).length, 'secondary')}
        </div>

        <!-- Channel legend -->
        <div style="display:flex;gap:16px;margin-bottom:16px;flex-wrap:wrap">
          ${Object.entries(NOTIF_CHANNELS).map(([k,v]) => `<span style="font-size:0.8rem">${v.icon} <strong>${v.label}</strong> — ${v.desc}</span>`).join('')}
        </div>

        <!-- Group filter -->
        <div style="display:flex;gap:4px;margin-bottom:12px;flex-wrap:wrap">
          <button class="btn btn-xs ${groupFilter==='all'?'btn-primary':'btn-secondary'} gf-btn" data-g="all">ทั้งหมด</button>
          ${GROUPS.map(g => `<button class="btn btn-xs ${groupFilter===g?'btn-primary':'btn-secondary'} gf-btn" data-g="${g}">${g}</button>`).join('')}
        </div>

        <div class="card" style="overflow:hidden">
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="border-bottom:1px solid var(--border);font-size:0.75rem;color:var(--text-muted)">
                <th style="padding:10px 14px;text-align:left">เหตุการณ์</th>
                <th style="padding:10px 14px;text-align:center">กลุ่ม</th>
                ${Object.entries(NOTIF_CHANNELS).map(([k,v]) => `<th style="padding:10px 14px;text-align:center">${v.icon} ${v.label}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${list.map(e => {
                const s = settings[e.id]
                return `<tr style="border-bottom:1px solid var(--border);${e.critical?'background:rgba(239,68,68,.04)':''}">
                  <td style="padding:10px 14px">
                    <div style="display:flex;align-items:center;gap:8px">
                      <span>${e.icon}</span>
                      <div>
                        <div style="font-size:0.85rem;font-weight:${e.critical?'700':'400'}">${e.label}</div>
                        ${e.critical ? '<div style="font-size:0.65rem;color:var(--danger)">🚨 Critical — แนะนำเปิดทุกช่องทาง</div>' : ''}
                      </div>
                    </div>
                  </td>
                  <td style="padding:10px 14px;text-align:center"><span class="badge badge-secondary" style="font-size:0.62rem">${e.group}</span></td>
                  ${Object.keys(NOTIF_CHANNELS).map(ch => `
                    <td style="padding:10px 14px;text-align:center">
                      <label style="cursor:pointer">
                        <input type="checkbox" class="notif-toggle" data-id="${e.id}" data-ch="${ch}" ${s[ch]?'checked':''}>
                      </label>
                    </td>
                  `).join('')}
                </tr>`
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `

    container.querySelectorAll('.gf-btn').forEach(b => b.addEventListener('click', () => { groupFilter = b.dataset.g; renderPage() }))
    container.querySelectorAll('.notif-toggle').forEach(cb => cb.addEventListener('change', () => {
      settings[cb.dataset.id][cb.dataset.ch] = cb.checked
    }))
    document.getElementById('save-settings-btn')?.addEventListener('click', async () => {
      const btn = document.getElementById('save-settings-btn')
      if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner spinner-sm"></span>' }
      try {
        if (settingsDocId) {
          await updateDocData('user_settings', settingsDocId, { uid, notifSettings: settings })
        } else {
          settingsDocId = await createDoc('user_settings', { uid, notifSettings: settings })
        }
        showToast('💾 บันทึกการตั้งค่าแจ้งเตือนแล้ว!', 'success')
      } catch {
        showToast('บันทึกไม่สำเร็จ', 'error')
      }
      if (btn) { btn.disabled = false; btn.textContent = '💾 บันทึก' }
    })
  }

  container.innerHTML = `<div class="page-content"><div class="skeleton" style="height:400px;border-radius:8px"></div></div>`
  await loadSettings()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
