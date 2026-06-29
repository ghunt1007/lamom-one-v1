/**
 * System Health — สถานะระบบ
 * Route: /settings/health
 */
import { timeAgo } from '../../utils/format.js'
import { showToast } from '../../core/store.js'

function addMinutes(n) { const d = new Date(); d.setMinutes(d.getMinutes() - n); return d.toISOString() }

const SERVICES = [
  { name: 'Firebase Firestore', status: 'ok', latency: 45, uptime: 99.98, icon: '🗄' },
  { name: 'Firebase Auth', status: 'ok', latency: 120, uptime: 99.99, icon: '🔐' },
  { name: 'Firebase Storage', status: 'ok', latency: 88, uptime: 99.95, icon: '📦' },
  { name: 'LINE Messaging API', status: 'degraded', latency: 850, uptime: 98.2, icon: '💚' },
  { name: 'SMS Gateway', status: 'ok', latency: 210, uptime: 99.7, icon: '📱' },
  { name: 'Email Service', status: 'ok', latency: 340, uptime: 99.5, icon: '📧' },
]

const RECENT_ERRORS = [
  { time: addMinutes(12), service: 'LINE Messaging API', msg: 'Timeout ส่งข้อความ broadcast (retry สำเร็จ)', level: 'warn' },
  { time: addMinutes(125), service: 'Firestore', msg: 'Slow query: /crm/customers ใช้เวลา 3.2s', level: 'warn' },
  { time: addMinutes(480), service: 'SMS Gateway', msg: 'เครดิตต่ำกว่า 500 — แจ้งเติมแล้ว', level: 'info' },
]

const USAGE = {
  reads: { today: 42800, limit: 50000 },
  writes: { today: 8400, limit: 20000 },
  storage: { used: 5.2, limit: 10 },
  users: { active: 14, total: 16 },
}

export default async function SystemHealthPage(container) {
  function renderPage() {
    const allOk = SERVICES.every(s => s.status === 'ok')
    const degraded = SERVICES.filter(s => s.status !== 'ok')
    const readsPct = Math.round(USAGE.reads.today / USAGE.reads.limit * 100)
    const writesPct = Math.round(USAGE.writes.today / USAGE.writes.limit * 100)
    const storagePct = Math.round(USAGE.storage.used / USAGE.storage.limit * 100)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">💟 System Health</div>
            <div class="page-subtitle">สถานะระบบ — Services / Quota / Errors</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="refresh-btn">🔄 รีเฟรช</button>
          </div>
        </div>

        <!-- Overall status -->
        <div style="padding:14px;border-radius:var(--radius);margin-bottom:16px;background:var(--${allOk?'success':'warning'})11;border:1px solid var(--${allOk?'success':'warning'})33;display:flex;align-items:center;gap:10px">
          <span style="font-size:1.5rem">${allOk ? '✅' : '⚠️'}</span>
          <div>
            <div style="font-weight:700;font-size:0.9rem">${allOk ? 'ระบบทำงานปกติทั้งหมด' : 'มี ' + degraded.length + ' service ทำงานช้า'}</div>
            <div style="font-size:0.72rem;color:var(--text-muted)">${allOk ? 'ทุก service ตอบสนองดี' : degraded.map(s => s.name).join(', ') + ' — ตอบสนองช้ากว่าปกติ'}</div>
          </div>
        </div>

        <!-- Services -->
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;margin-bottom:16px">
          ${SERVICES.map(s => {
            const color = s.status === 'ok' ? 'success' : s.status === 'degraded' ? 'warning' : 'danger'
            return `<div class="card" style="padding:12px 14px;border-left:3px solid var(--${color})">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                <div style="font-weight:700;font-size:0.8rem">${s.icon} ${s.name}</div>
                <span style="width:10px;height:10px;border-radius:50%;background:var(--${color});display:inline-block"></span>
              </div>
              <div style="font-size:0.7rem;color:var(--text-muted)">
                ⚡ ${s.latency}ms ${s.latency > 500 ? '⚠️' : ''} · ⏱ Uptime ${s.uptime}%
              </div>
            </div>`
          }).join('')}
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
          <!-- Quota -->
          <div class="card" style="padding:14px">
            <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);margin-bottom:12px">📊 Quota วันนี้ (Firebase Free Tier)</div>
            ${quotaBar('📖 Reads', USAGE.reads.today.toLocaleString() + ' / ' + USAGE.reads.limit.toLocaleString(), readsPct)}
            ${quotaBar('✍️ Writes', USAGE.writes.today.toLocaleString() + ' / ' + USAGE.writes.limit.toLocaleString(), writesPct)}
            ${quotaBar('📦 Storage', USAGE.storage.used + ' / ' + USAGE.storage.limit + ' GB', storagePct)}
            ${readsPct >= 80 ? `<div style="font-size:0.7rem;color:var(--danger);margin-top:8px">⚠️ Reads ใกล้เต็ม quota — พิจารณาอัปเกรด Blaze plan</div>` : ''}
            <div style="font-size:0.72rem;color:var(--text-muted);margin-top:10px">👥 ผู้ใช้ online: ${USAGE.users.active}/${USAGE.users.total} คน</div>
          </div>

          <!-- Recent errors -->
          <div class="card" style="padding:14px">
            <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);margin-bottom:12px">📋 เหตุการณ์ล่าสุด</div>
            ${RECENT_ERRORS.map(e => `
              <div style="padding:7px 0;border-bottom:1px solid var(--border)">
                <div style="display:flex;justify-content:space-between;font-size:0.73rem">
                  <span style="font-weight:600">${e.level === 'warn' ? '⚠️' : 'ℹ️'} ${e.service}</span>
                  <span style="color:var(--text-muted);font-size:0.65rem">${timeAgo(e.time)}</span>
                </div>
                <div style="font-size:0.7rem;color:var(--text-muted)">${e.msg}</div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `

    document.getElementById('refresh-btn')?.addEventListener('click', () => { showToast('🔄 รีเฟรชสถานะแล้ว', 'primary'); renderPage() })
  }

  renderPage()
}

function quotaBar(label, text, pct) {
  const color = pct >= 80 ? 'danger' : pct >= 60 ? 'warning' : 'success'
  return `<div style="margin-bottom:10px">
    <div style="display:flex;justify-content:space-between;font-size:0.73rem;margin-bottom:3px">
      <span>${label}</span><span style="color:var(--${color})">${text} (${pct}%)</span>
    </div>
    <div style="background:var(--surface-2);border-radius:3px;height:8px">
      <div style="width:${pct}%;background:var(--${color});height:8px;border-radius:3px"></div>
    </div>
  </div>`
}
