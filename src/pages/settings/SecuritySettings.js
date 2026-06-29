/**
 * Security Settings — ความปลอดภัยระบบ
 * Route: /settings/security
 */
import { timeAgo } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'

function addMinutes(n) { const d = new Date(); d.setMinutes(d.getMinutes() - n); return d.toISOString() }

const SECURITY_POLICIES = [
  { id: 'P1', name: 'บังคับ 2FA สำหรับ Admin/Manager', enabled: true, critical: true },
  { id: 'P2', name: 'บังคับ 2FA สำหรับพนักงานทุกคน', enabled: false, critical: false },
  { id: 'P3', name: 'รหัสผ่านขั้นต่ำ 10 ตัว + ตัวเลข + อักขระพิเศษ', enabled: true, critical: true },
  { id: 'P4', name: 'บังคับเปลี่ยนรหัสทุก 90 วัน', enabled: false, critical: false },
  { id: 'P5', name: 'Auto-logout เมื่อไม่ใช้งาน 30 นาที', enabled: true, critical: false },
  { id: 'P6', name: 'จำกัด login จาก IP ในไทยเท่านั้น', enabled: true, critical: false },
  { id: 'P7', name: 'แจ้งเตือน Owner เมื่อมี login จากอุปกรณ์ใหม่', enabled: true, critical: true },
  { id: 'P8', name: 'ห้าม export ข้อมูลลูกค้าโดยไม่มีการอนุมัติ', enabled: true, critical: true },
]

const ACTIVE_SESSIONS = [
  { id: 'S1', user: 'ทวีศักดิ์ (Owner)', device: 'Windows — Chrome', ip: '49.228.x.x (กรุงเทพ)', lastActive: addMinutes(0), current: true },
  { id: 'S2', user: 'สมศรี การเงิน', device: 'Windows — Edge', ip: '49.228.x.x (กรุงเทพ)', lastActive: addMinutes(8), current: false },
  { id: 'S3', user: 'วิชัย ยอดขาย', device: 'iPhone — Safari', ip: '184.22.x.x (มือถือ)', lastActive: addMinutes(25), current: false },
  { id: 'S4', user: 'วิชัย ยอดขาย', device: 'Android — Chrome', ip: '27.55.x.x (มือถือ)', lastActive: addMinutes(2880), current: false },
]

const RECENT_ALERTS = [
  { time: addMinutes(360), level: 'warn', msg: 'Login ผิดรหัส 3 ครั้งติด — บัญชี thana@lamom (ล็อค 15 นาทีแล้ว)' },
  { time: addMinutes(1440), level: 'info', msg: 'Login จากอุปกรณ์ใหม่ — วิชัย (Android) ยืนยันผ่าน OTP แล้ว' },
  { time: addMinutes(4320), level: 'warn', msg: 'มีการ export ข้อมูลลูกค้า 1,842 รายการ — อนุมัติโดย Owner' },
]

export default async function SecuritySettingsPage(container) {
  let policies = SECURITY_POLICIES.map(p => ({ ...p }))
  let sessions = ACTIVE_SESSIONS.map(s => ({ ...s }))

  function renderPage() {
    const enabledCount = policies.filter(p => p.enabled).length
    const criticalOff = policies.filter(p => p.critical && !p.enabled).length
    const score = Math.round(enabledCount / policies.length * 100)
    const staleSessions = sessions.filter(s => new Date(s.lastActive) < new Date(Date.now() - 24*3600000))

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🔐 Security Settings</div>
            <div class="page-subtitle">ความปลอดภัยระบบ — นโยบาย / Sessions / การแจ้งเตือน</div>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:16px">
          ${kpi('🛡 Security Score', score + '%', score >= 80 ? 'success' : 'warning')}
          ${kpi('⚠️ นโยบายสำคัญที่ปิดอยู่', criticalOff, criticalOff > 0 ? 'danger' : 'success')}
          ${kpi('💻 Sessions active', sessions.length, staleSessions.length > 0 ? 'warning' : 'primary')}
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
          <!-- Policies -->
          <div class="card" style="padding:14px">
            <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);margin-bottom:10px">🛡 นโยบายความปลอดภัย</div>
            ${policies.map(p => `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--border)">
                <span style="font-size:0.76rem">${p.critical?'⭐ ':''}${p.name}</span>
                <button class="btn btn-xs ${p.enabled?'btn-success':'btn-secondary'} pol-btn" data-id="${p.id}">${p.enabled?'✅ เปิด':'⏸ ปิด'}</button>
              </div>
            `).join('')}
            <p style="font-size:0.65rem;color:var(--text-muted);margin-top:8px">⭐ = นโยบายสำคัญ แนะนำเปิดเสมอ</p>
          </div>

          <!-- Sessions -->
          <div class="card" style="padding:14px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
              <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted)">💻 Sessions ที่ login อยู่</div>
              ${sessions.length > 1 ? '<button class="btn btn-xs btn-danger" id="logout-all-btn">🚪 Logout ทั้งหมด</button>' : ''}
            </div>
            ${sessions.map(s => {
              const stale = new Date(s.lastActive) < new Date(Date.now() - 24*3600000)
              return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)">
                <div>
                  <div style="font-size:0.78rem;font-weight:600">${s.user} ${s.current?'<span class="badge badge-success" style="font-size:0.55rem">เครื่องนี้</span>':''}</div>
                  <div style="font-size:0.66rem;color:var(--${stale?'warning':'text-muted'})">${s.device} · ${s.ip} · ${timeAgo(s.lastActive)}${stale?' ⚠️ ค้างนาน':''}</div>
                </div>
                ${!s.current ? `<button class="btn btn-xs btn-secondary kick-btn" data-id="${s.id}">🚪</button>` : ''}
              </div>`
            }).join('')}
          </div>
        </div>

        <!-- Alerts -->
        <div class="card" style="padding:14px">
          <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);margin-bottom:10px">🔔 เหตุการณ์ความปลอดภัยล่าสุด</div>
          ${RECENT_ALERTS.map(a => `
            <div style="display:flex;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);font-size:0.76rem">
              <span>${a.level==='warn'?'⚠️':'ℹ️'}</span>
              <span style="flex:1">${a.msg}</span>
              <span style="color:var(--text-muted);font-size:0.65rem;white-space:nowrap">${timeAgo(a.time)}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `

    container.querySelectorAll('.pol-btn').forEach(b => b.addEventListener('click', () => {
      const p = policies.find(x => x.id === b.dataset.id)
      if (p) {
        if (p.enabled && p.critical) {
          openModal({
            title: '⚠️ ปิดนโยบายสำคัญ?',
            size: 'sm',
            body: `<p style="font-size:0.82rem">"${p.name}" เป็นนโยบายสำคัญ — การปิดจะลดความปลอดภัยของระบบ</p>`,
            confirmText: '⚠️ ยืนยันปิด',
            onConfirm() { p.enabled = false; showToast('⚠️ ปิดนโยบายแล้ว — บันทึก log', 'warning'); renderPage() }
          })
        } else {
          p.enabled = !p.enabled
          showToast(p.enabled ? '✅ เปิดนโยบายแล้ว' : '⏸ ปิดนโยบายแล้ว', 'primary'); renderPage()
        }
      }
    }))
    container.querySelectorAll('.kick-btn').forEach(b => b.addEventListener('click', () => {
      sessions = sessions.filter(x => x.id !== b.dataset.id)
      showToast('🚪 Logout session แล้ว', 'warning'); renderPage()
    }))
    document.getElementById('logout-all-btn')?.addEventListener('click', () => {
      sessions = sessions.filter(s => s.current)
      showToast('🚪 Logout ทุก session แล้ว (ยกเว้นเครื่องนี้)', 'warning'); renderPage()
    })
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
