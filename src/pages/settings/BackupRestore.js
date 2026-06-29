/**
 * Backup & Restore — สำรองและกู้คืนข้อมูล
 * Route: /settings/backup
 */
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { formatDate, timeAgo } from '../../utils/format.js'

function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString() }
function addHours(n) { const d = new Date(); d.setHours(d.getHours() - n); return d.toISOString() }

const BACKUP_STATUS = {
  success: { label: 'สำเร็จ', color: 'success', icon: '✅' },
  running: { label: 'กำลังทำงาน', color: 'warning', icon: '🔄' },
  failed:  { label: 'ล้มเหลว', color: 'danger', icon: '❌' },
  partial: { label: 'บางส่วน', color: 'warning', icon: '⚠️' },
}

const BACKUP_TYPES = {
  full:         { label: 'Full Backup', color: 'primary', icon: '💾' },
  incremental:  { label: 'Incremental', color: 'secondary', icon: '📊' },
  config:       { label: 'Config Only', color: 'secondary', icon: '⚙️' },
}

const DEMO_BACKUPS = [
  { id: 'BK001', type: 'full', status: 'success', size: '2.4 GB', duration: '18 นาที', time: addHours(1), note: 'Auto backup' },
  { id: 'BK002', type: 'incremental', status: 'success', size: '145 MB', duration: '3 นาที', time: addHours(13), note: 'Auto backup' },
  { id: 'BK003', type: 'incremental', status: 'success', size: '98 MB', duration: '2 นาที', time: addHours(25), note: 'Auto backup' },
  { id: 'BK004', type: 'full', status: 'failed', size: '—', duration: '—', time: addHours(49), note: 'Error: disk quota exceeded' },
  { id: 'BK005', type: 'config', status: 'success', size: '12 KB', duration: '< 1 นาที', time: addHours(73), note: 'Manual — before upgrade' },
]

const MODULES_TO_BACKUP = [
  { id: 'crm', label: 'CRM / ลูกค้า', checked: true },
  { id: 'dms', label: 'DMS / สต็อก', checked: true },
  { id: 'finance', label: 'การเงิน', checked: true },
  { id: 'service', label: 'บริการ', checked: true },
  { id: 'hr', label: 'HR / พนักงาน', checked: true },
  { id: 'marketing', label: 'การตลาด', checked: false },
  { id: 'settings', label: 'ตั้งค่าระบบ', checked: true },
]

const SCHEDULE_OPTIONS = [
  { value: 'hourly', label: 'ทุก 1 ชั่วโมง' },
  { value: 'daily', label: 'ทุกวัน เที่ยงคืน' },
  { value: 'weekly', label: 'ทุกสัปดาห์ วันอาทิตย์' },
  { value: 'manual', label: 'Manual เท่านั้น' },
]

export default async function BackupRestorePage(container) {
  let backups = DEMO_BACKUPS.map(b => ({ ...b }))
  let schedule = 'daily'
  let retention = 30
  let isRunning = false

  function renderPage() {
    const lastOk = backups.find(b => b.status === 'success')
    const successCount = backups.filter(b => b.status === 'success').length
    const failCount = backups.filter(b => b.status === 'failed').length

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">💾 Backup & Restore</div>
            <div class="page-subtitle">สำรองข้อมูล — อัตโนมัติ + กู้คืน</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="restore-btn">♻️ กู้คืน</button>
            <button class="btn btn-primary ${isRunning?'disabled':''}" id="run-backup-btn">
              ${isRunning ? '🔄 กำลัง Backup...' : '💾 Backup ทันที'}
            </button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('💾 Backup ล่าสุด', lastOk ? timeAgo(lastOk.time) : 'ไม่มี', 'primary')}
          ${kpi('✅ สำเร็จ (7 วัน)', successCount, 'success')}
          ${kpi('❌ ล้มเหลว', failCount, failCount > 0 ? 'danger' : 'secondary')}
          ${kpi('📅 ตั้งเวลา', SCHEDULE_OPTIONS.find(s=>s.value===schedule)?.label || schedule, 'secondary')}
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
          <!-- Schedule settings -->
          <div class="card" style="padding:14px">
            <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);margin-bottom:12px">⚙️ ตั้งค่า Auto Backup</div>
            <div class="input-group" style="margin-bottom:10px">
              <label class="input-label">ความถี่</label>
              <select class="input" id="schedule-select">
                ${SCHEDULE_OPTIONS.map(s => `<option value="${s.value}" ${schedule===s.value?'selected':''}>${s.label}</option>`).join('')}
              </select>
            </div>
            <div class="input-group" style="margin-bottom:10px">
              <label class="input-label">เก็บไว้ (วัน)</label>
              <input class="input" id="retention-input" type="number" min="7" max="365" value="${retention}">
            </div>
            <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);margin-bottom:8px">โมดูลที่ Backup</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px">
              ${MODULES_TO_BACKUP.map(m => `
                <label style="display:flex;align-items:center;gap:6px;font-size:0.78rem;cursor:pointer">
                  <input type="checkbox" ${m.checked ? 'checked' : ''} style="accent-color:var(--primary)"> ${m.label}
                </label>
              `).join('')}
            </div>
            <button class="btn btn-secondary" style="margin-top:12px;width:100%" id="save-schedule-btn">💾 บันทึกตั้งค่า</button>
          </div>

          <!-- Storage info -->
          <div class="card" style="padding:14px">
            <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);margin-bottom:12px">📦 พื้นที่จัดเก็บ</div>
            ${storageBar('Firebase Storage', 5.2, 10)}
            ${storageBar('Local Export', 1.8, 5)}
            <div style="margin-top:14px">
              <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:6px">🌐 Backup Destinations</div>
              ${dest('✅', 'Firebase Storage', 'เชื่อมต่อแล้ว')}
              ${dest('✅', 'Google Drive', 'เชื่อมต่อแล้ว')}
              ${dest('❌', 'AWS S3', 'ยังไม่ได้ตั้งค่า')}
            </div>
          </div>
        </div>

        <!-- Backup history -->
        <div class="card" style="overflow:hidden">
          <div style="padding:10px 14px;border-bottom:1px solid var(--border);font-size:0.8rem;font-weight:700;color:var(--text-muted)">📋 ประวัติ Backup</div>
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="border-bottom:1px solid var(--border);font-size:0.73rem;color:var(--text-muted)">
                <th style="padding:8px 14px;text-align:left">เวลา</th>
                <th style="padding:8px 10px;text-align:left">ประเภท</th>
                <th style="padding:8px 10px;text-align:left">สถานะ</th>
                <th style="padding:8px 10px;text-align:right">ขนาด</th>
                <th style="padding:8px 10px;text-align:right">เวลาที่ใช้</th>
                <th style="padding:8px 14px;text-align:left">หมายเหตุ</th>
                <th style="padding:8px 14px"></th>
              </tr>
            </thead>
            <tbody>
              ${backups.map(b => {
                const bs = BACKUP_STATUS[b.status]
                const bt = BACKUP_TYPES[b.type]
                return `<tr style="border-bottom:1px solid var(--border);font-size:0.8rem">
                  <td style="padding:8px 14px;color:var(--text-muted)">${timeAgo(b.time)}</td>
                  <td style="padding:8px 10px"><span class="badge badge-${bt?.color}" style="font-size:0.6rem">${bt?.icon} ${bt?.label}</span></td>
                  <td style="padding:8px 10px"><span class="badge badge-${bs?.color}" style="font-size:0.6rem">${bs?.icon} ${bs?.label}</span></td>
                  <td style="padding:8px 10px;text-align:right">${b.size}</td>
                  <td style="padding:8px 10px;text-align:right">${b.duration}</td>
                  <td style="padding:8px 14px;color:var(--text-muted);font-size:0.73rem">${b.note}</td>
                  <td style="padding:8px 14px;text-align:right">
                    ${b.status === 'success' ? `<button class="btn btn-xs btn-secondary restore-item-btn" data-id="${b.id}">♻️ กู้คืน</button>` : ''}
                  </td>
                </tr>`
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `

    document.getElementById('run-backup-btn')?.addEventListener('click', () => {
      if (isRunning) return
      isRunning = true
      showToast('🔄 เริ่ม Backup ทันที...', 'primary')
      renderPage()
      setTimeout(() => {
        backups.unshift({ id: `BK${String(backups.length+1).padStart(3,'0')}`, type: 'full', status: 'success', size: '2.6 GB', duration: '20 นาที', time: new Date().toISOString(), note: 'Manual backup' })
        isRunning = false
        showToast('✅ Backup สำเร็จ!', 'success')
        renderPage()
      }, 3000)
    })
    document.getElementById('save-schedule-btn')?.addEventListener('click', () => {
      schedule = document.getElementById('schedule-select')?.value || schedule
      retention = parseInt(document.getElementById('retention-input')?.value) || retention
      showToast('✅ บันทึกตั้งค่า Auto Backup แล้ว', 'success'); renderPage()
    })
    document.getElementById('restore-btn')?.addEventListener('click', openRestoreModal)
    container.querySelectorAll('.restore-item-btn').forEach(b => b.addEventListener('click', () => {
      const backup = backups.find(x => x.id === b.dataset.id)
      if (backup) confirmRestore(backup)
    }))
  }

  function confirmRestore(backup) {
    openModal({
      title: '♻️ ยืนยันกู้คืนข้อมูล',
      size: 'sm',
      body: `<div style="font-size:0.85rem;line-height:1.7">
        <p>⚠️ <strong>คำเตือน:</strong> การกู้คืนจะแทนที่ข้อมูลปัจจุบัน</p>
        <p>📅 Backup: <strong>${timeAgo(backup.time)}</strong></p>
        <p>📦 ขนาด: <strong>${backup.size}</strong></p>
      </div>`,
      confirmText: '♻️ ยืนยันกู้คืน',
      onConfirm() {
        const label = timeAgo(backup.time)
        backups.unshift({ id:'BK'+Date.now(), type:'full', status:'success', size:backup.size, duration:'< 1 นาที', time:new Date().toISOString(), note:`✅ กู้คืนจาก Backup ${label}` })
        renderPage()
        showToast(`♻️ กู้คืนข้อมูลจาก Backup ${label} เสร็จแล้ว`, 'success')
      }
    })
  }

  function openRestoreModal() {
    openModal({
      title: '♻️ กู้คืนข้อมูล',
      size: 'sm',
      body: `<div style="display:grid;gap:10px">
        <div class="input-group"><label class="input-label">เลือก Backup</label>
          <select class="input" id="restore-sel">${backups.filter(b=>b.status==='success').map(b=>`<option value="${b.id}">${timeAgo(b.time)} — ${b.type} (${b.size})</option>`).join('')}</select>
        </div>
        <div style="padding:10px;background:var(--surface-2);border-radius:var(--radius-sm);font-size:0.78rem;color:var(--warning)">
          ⚠️ ระบบจะ Backup ข้อมูลปัจจุบันก่อนกู้คืนโดยอัตโนมัติ
        </div>
      </div>`,
      confirmText: '♻️ กู้คืน',
      onConfirm() {
        const selId = document.getElementById('restore-sel')?.value
        const src = backups.find(b => b.id === selId) || backups.find(b => b.status === 'success')
        if (!src) { showToast('ไม่พบ Backup', 'warning'); return }
        const label = timeAgo(src.time)
        backups.unshift({ id:'BK'+Date.now(), type:'full', status:'success', size:src.size, duration:'< 1 นาที', time:new Date().toISOString(), note:`✅ กู้คืนจาก Backup ${label}` })
        renderPage()
        showToast(`♻️ กู้คืนข้อมูลจาก Backup ${label} เสร็จแล้ว`, 'success')
      }
    })
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
function storageBar(label, used, total) {
  const pct = Math.round(used/total*100)
  return `<div style="margin-bottom:10px">
    <div style="display:flex;justify-content:space-between;font-size:0.75rem;margin-bottom:3px">
      <span>${label}</span><span style="color:var(--text-muted)">${used} / ${total} GB</span>
    </div>
    <div style="background:var(--surface-2);border-radius:4px;height:8px">
      <div style="width:${pct}%;background:${pct>80?'var(--danger)':pct>50?'var(--warning)':'var(--primary)'};height:8px;border-radius:4px"></div>
    </div>
  </div>`
}
function dest(icon, name, status) {
  return `<div style="display:flex;justify-content:space-between;font-size:0.75rem;padding:4px 0;border-bottom:1px solid var(--border)">
    <span>${icon} ${name}</span><span style="color:var(--text-muted)">${status}</span>
  </div>`
}
