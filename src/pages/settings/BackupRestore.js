/**
 * Backup & Restore — สำรองและกู้คืนข้อมูลจริง (v1.0.316)
 * Route: /settings/backup
 *
 * เดิมทั้งหน้านี้ไม่แตะข้อมูลจริงเลย — กด "Backup"/"กู้คืน" แค่บันทึก log ว่า "สำเร็จ" พร้อมขนาดไฟล์/
 * เวลาที่ใช้ปลอมที่ hardcode ไว้ (2.6 GB, 20 นาที) ไม่มีการอ่าน/เขียนข้อมูลจริงจาก collection อื่นเลย
 * แม้แต่จุดเดียว ("Storage Destinations" ที่บอกว่าเชื่อมต่อ Firebase Storage/Google Drive แล้วก็ปลอมเช่นกัน)
 *
 * Scope ที่ตกลงกับเจ้าของแล้ว: export/import ข้อมูลจริงเป็นไฟล์ JSON ดาวน์โหลดเก็บไว้ในเครื่องเอง
 * (เก็บเพื่อดู/กู้คืนด้วยมือ) ไม่ใช่ automated cloud disaster-recovery เต็มรูปแบบ — นั่นต้องใช้ Firebase
 * native export ไป Google Cloud Storage ซึ่งต้องเปิด billing + สร้าง bucket ผ่าน Firebase Console/gcloud
 * เอง (นอกเหนือโค้ดนี้ทั้งหมด) เจ้าของทราบแล้วว่าไม่มีค่าใช้จ่ายเพิ่มถ้าไม่กดเปิดใช้งานส่วนนั้น
 *
 * เข้าถึงได้เฉพาะเจ้าของ/แอดมิน (ตรวจสอบทั้งฐานข้อมูลทุก collection ความเสี่ยงสูงกว่าฟีเจอร์อื่นในระบบ)
 */
import { openModal, confirmDialog } from '../../utils/modal.js'
import { showToast, getState } from '../../core/store.js'
import { formatDate, timeAgo } from '../../utils/format.js'
import { listDocs, createDoc, setDocData, seedDemoData } from '../../core/db.js'
import { ALL_COLLECTIONS, exportAllData, downloadBackupFile, summarizeBackupData, restoreFromBackupData } from '../../core/backup.js'

function esc(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }

const BACKUP_STATUS = {
  success: { label: 'สำเร็จ', color: 'success', icon: '✅' },
  partial: { label: 'บางส่วน', color: 'warning', icon: '⚠️' },
  failed:  { label: 'ล้มเหลว', color: 'danger', icon: '❌' },
}

const MANAGE_BACKUP_ROLES = ['owner', 'admin']

function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0, n = bytes
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++ }
  return `${n.toFixed(n >= 10 || i === 0 ? 0 : 1)} ${units[i]}`
}

function formatMs(ms) {
  if (ms < 1000) return `${ms} ms`
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(1)} วินาที`
  return `${Math.floor(s / 60)} นาที ${Math.round(s % 60)} วินาที`
}

export default async function BackupRestorePage(container) {
  const myGen = container.__routerGen
  seedDemoData()
  const myRole = getState('role') || getState('user')?.role || 'staff'
  const canManage = MANAGE_BACKUP_ROLES.includes(myRole)

  let backups = []
  let schedule = 'manual'
  let retention = 30
  let isRunning = false
  let progressText = ''
  let loading = true

  async function loadData() {
    loading = true
    try { backups = await listDocs('system_backups', [], 'time', 'desc', 200) } catch (e) { backups = [] }
    try {
      const cfg = await listDocs('system_backup_config', [], 'id', 'asc', 1)
      if (cfg[0]) { schedule = cfg[0].schedule || schedule; retention = cfg[0].retention || retention }
    } catch (e) {}
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    if (!canManage) {
      container.innerHTML = `<div class="page-content"><div class="empty-state" style="padding:60px 20px"><div class="empty-icon">🔒</div><div class="empty-title">ไม่มีสิทธิ์เข้าถึงหน้านี้</div><div class="empty-desc">สำรอง/กู้คืนข้อมูลทั้งระบบเปิดให้เฉพาะเจ้าของ/แอดมินเท่านั้น</div></div></div>`
      return
    }
    const lastOk = backups.find(b => b.status === 'success' || b.status === 'partial')
    const successCount = backups.filter(b => b.status === 'success').length
    const failCount = backups.filter(b => b.status === 'failed').length

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">💾 Backup & Restore</div>
            <div class="page-subtitle">สำรองข้อมูลจริงทั้งระบบ (${ALL_COLLECTIONS.length} collection) เป็นไฟล์ดาวน์โหลด + กู้คืนจากไฟล์</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="restore-btn" ${isRunning?'disabled':''}>♻️ กู้คืนจากไฟล์</button>
            <button class="btn btn-primary" id="run-backup-btn" ${isRunning?'disabled':''}>
              ${isRunning ? '🔄 กำลังทำงาน...' : '💾 Backup ทันที (ดาวน์โหลดไฟล์)'}
            </button>
          </div>
        </div>

        ${isRunning ? `<div class="card" style="padding:12px 16px;margin-bottom:14px;border-left:3px solid var(--primary);font-size:0.82rem">🔄 ${esc(progressText)}</div>` : ''}

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('💾 Backup ล่าสุด', lastOk ? timeAgo(lastOk.time) : 'ไม่มี', 'primary')}
          ${kpi('✅ สำเร็จ', successCount, 'success')}
          ${kpi('❌ ล้มเหลว', failCount, failCount > 0 ? 'danger' : 'secondary')}
          ${kpi('📦 Collection ทั้งหมด', ALL_COLLECTIONS.length, 'secondary')}
        </div>

        <div class="card" style="padding:14px;margin-bottom:14px;font-size:0.78rem;color:var(--text-muted)">
          ℹ️ ไฟล์ backup จะถูก<strong>ดาวน์โหลดเก็บไว้ในเครื่องของคุณเท่านั้น</strong> (เก็บเพื่อดู/กู้คืนด้วยมือ ไม่ใช่ระบบ cloud backup อัตโนมัติ) — แนะนำให้เก็บไฟล์ไว้หลายที่ (เครื่อง+USB/คลาวด์ส่วนตัว) ถ้าต้องการระบบสำรองอัตโนมัติจริงไปเก็บบน Google Cloud Storage (Firebase native export) ต้องเปิด billing + ตั้งค่าผ่าน Firebase Console เอง แยกจากฟีเจอร์นี้
        </div>

        <div class="card" style="padding:14px;margin-bottom:14px">
          <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);margin-bottom:12px">⚙️ ตั้งค่าความถี่ที่ต้องการ (บันทึกไว้เฉยๆ — ยังไม่มีการรันอัตโนมัติจริงจนกว่าจะตั้งค่า Cloud Scheduler แยกต่างหาก)</div>
          <div class="grid-2">
            <div class="input-group"><label class="input-label">ความถี่ที่ต้องการ</label>
              <select class="input" id="schedule-select">
                ${[['manual','Manual เท่านั้น (ตอนนี้)'],['daily','ทุกวัน (ต้องตั้ง Cloud Scheduler เพิ่ม)'],['weekly','ทุกสัปดาห์ (ต้องตั้ง Cloud Scheduler เพิ่ม)']].map(([v,l]) => `<option value="${v}" ${schedule===v?'selected':''}>${l}</option>`).join('')}
              </select>
            </div>
            <div class="input-group"><label class="input-label">เก็บไว้ (วัน)</label><input class="input" id="retention-input" type="number" min="7" max="365" value="${retention}"></div>
          </div>
          <button class="btn btn-secondary" style="margin-top:10px" id="save-schedule-btn">💾 บันทึกค่าที่ต้องการ</button>
        </div>

        <div class="card" style="overflow:hidden">
          <div style="padding:10px 14px;border-bottom:1px solid var(--border);font-size:0.8rem;font-weight:700;color:var(--text-muted)">📋 ประวัติ Backup/Restore</div>
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="border-bottom:1px solid var(--border);font-size:0.73rem;color:var(--text-muted)">
                <th style="padding:8px 14px;text-align:left">เวลา</th>
                <th style="padding:8px 10px;text-align:left">ประเภท</th>
                <th style="padding:8px 10px;text-align:left">สถานะ</th>
                <th style="padding:8px 10px;text-align:right">ขนาด/จำนวน</th>
                <th style="padding:8px 10px;text-align:right">เวลาที่ใช้</th>
                <th style="padding:8px 14px;text-align:left">หมายเหตุ</th>
              </tr>
            </thead>
            <tbody>
              ${!backups.length ? `<tr><td colspan="6" style="padding:20px;text-align:center;color:var(--text-muted)">ยังไม่มีประวัติ</td></tr>` : backups.map(b => {
                const bs = BACKUP_STATUS[b.status] || BACKUP_STATUS.failed
                return `<tr style="border-bottom:1px solid var(--border);font-size:0.8rem">
                  <td style="padding:8px 14px;color:var(--text-muted)">${timeAgo(b.time)}</td>
                  <td style="padding:8px 10px">${b.action === 'restore' ? '♻️ กู้คืน' : '💾 Backup'}</td>
                  <td style="padding:8px 10px"><span class="badge badge-${bs.color}" style="font-size:0.6rem">${bs.icon} ${bs.label}</span></td>
                  <td style="padding:8px 10px;text-align:right">${esc(b.size || '-')}</td>
                  <td style="padding:8px 10px;text-align:right">${esc(b.duration || '-')}</td>
                  <td style="padding:8px 14px;color:var(--text-muted);font-size:0.73rem">${esc(b.note || '')}</td>
                </tr>`
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `

    document.getElementById('run-backup-btn')?.addEventListener('click', runBackupNow)
    document.getElementById('restore-btn')?.addEventListener('click', openRestoreModal)
    document.getElementById('save-schedule-btn')?.addEventListener('click', async () => {
      schedule = document.getElementById('schedule-select')?.value || schedule
      retention = parseInt(document.getElementById('retention-input')?.value) || retention
      try {
        await setDocData('system_backup_config', 'default', { schedule, retention })
        showToast('✅ บันทึกค่าที่ต้องการแล้ว (ยังไม่มีการรันอัตโนมัติจริงจนกว่าจะตั้ง Cloud Scheduler)', 'success')
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    })
  }

  async function runBackupNow() {
    if (isRunning) return
    isRunning = true
    progressText = 'กำลังเริ่มสำรองข้อมูล...'
    renderPage()
    const startedAt = Date.now()
    try {
      const backupObj = await exportAllData(ALL_COLLECTIONS, ({ current, total, colName }) => {
        progressText = `กำลังสำรอง ${colName} (${current}/${total})...`
        renderPage()
      })
      const filename = `LAMOM_Backup_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`
      const bytes = downloadBackupFile(backupObj, filename)
      const durationMs = Date.now() - startedAt
      const skippedNote = backupObj.skipped.length ? ` (ข้าม ${backupObj.skipped.length} collection ที่อ่านไม่ได้)` : ''
      await createDoc('system_backups', {
        action: 'backup',
        status: backupObj.skipped.length ? 'partial' : 'success',
        size: formatBytes(bytes),
        duration: formatMs(durationMs),
        time: new Date().toISOString(),
        note: `${backupObj.collections} collection, ${backupObj.totalDocs.toLocaleString()} เอกสาร${skippedNote} — ไฟล์: ${filename}`,
      })
      showToast(`✅ Backup สำเร็จ! ดาวน์โหลด ${filename} แล้ว (${formatBytes(bytes)})`, 'success', 6000)
    } catch (e) {
      try { await createDoc('system_backups', { action: 'backup', status: 'failed', size: '-', duration: formatMs(Date.now() - startedAt), time: new Date().toISOString(), note: e.message || 'ล้มเหลวไม่ทราบสาเหตุ' }) } catch {}
      showToast('❌ Backup ไม่สำเร็จ: ' + (e.message || ''), 'error')
    }
    isRunning = false
    await loadData()
  }

  function openRestoreModal() {
    const { el, close } = openModal({
      title: '♻️ กู้คืนข้อมูลจากไฟล์',
      size: 'md',
      body: `<div style="display:flex;flex-direction:column;gap:10px">
        <div style="padding:10px;background:var(--surface-2);border-radius:var(--radius-sm);font-size:0.78rem;color:var(--warning)">
          ⚠️ การกู้คืนจะเขียนทับข้อมูลปัจจุบันในทุก collection ที่มีอยู่ในไฟล์ (แบบ merge — ไม่ลบข้อมูลใหม่ที่เพิ่มมาหลังจาก backup) แนะนำให้ Backup ข้อมูลปัจจุบันไว้ก่อนกู้คืนเสมอ
        </div>
        <div class="input-group"><label class="input-label">เลือกไฟล์ Backup (.json)</label><input class="input" type="file" id="restore-file" accept=".json,application/json"></div>
        <div id="restore-preview"></div>
      </div>`,
      footer: `<button class="btn btn-secondary" id="rm-close">ปิด</button>`,
    })
    el.querySelector('#rm-close').addEventListener('click', close)
    let parsedBackup = null
    el.querySelector('#restore-file').addEventListener('change', async (e) => {
      const file = e.target.files?.[0]
      const preview = el.querySelector('#restore-preview')
      if (!file) return
      preview.innerHTML = '<div style="text-align:center;padding:12px"><span class="spinner spinner-sm"></span></div>'
      try {
        const text = await file.text()
        parsedBackup = JSON.parse(text)
        if (!parsedBackup || typeof parsedBackup.data !== 'object') throw new Error('ไม่ใช่รูปแบบไฟล์ backup ที่ถูกต้อง')
        const summary = summarizeBackupData(parsedBackup)
        preview.innerHTML = `
          <div style="font-size:0.82rem;margin-top:6px">
            <div>📅 สร้างเมื่อ: <strong>${parsedBackup.exportedAt ? formatDate(parsedBackup.exportedAt) : 'ไม่ทราบ'}</strong></div>
            <div>📦 ${summary.collections.length} collection, ${summary.totalDocs.toLocaleString()} เอกสาร</div>
          </div>
          <div style="max-height:160px;overflow:auto;margin-top:8px;font-size:0.74rem;color:var(--text-muted)">
            ${summary.collections.slice(0, 30).map(c => `<div style="display:flex;justify-content:space-between;padding:2px 0">${esc(c.name)}<span>${c.count.toLocaleString()}</span></div>`).join('')}
            ${summary.collections.length > 30 ? `<div>...และอีก ${summary.collections.length - 30} collection</div>` : ''}
          </div>
          <div class="input-group" style="margin-top:10px"><label class="input-label">พิมพ์ "กู้คืนข้อมูล" เพื่อยืนยัน</label><input class="input" id="restore-confirm-text" placeholder="กู้คืนข้อมูล"></div>
          <button class="btn btn-danger" style="width:100%;margin-top:8px" id="restore-confirm-btn">♻️ ยืนยันกู้คืนข้อมูลจริง</button>
        `
        preview.querySelector('#restore-confirm-btn').addEventListener('click', async (ev) => {
          if (el.querySelector('#restore-confirm-text')?.value?.trim() !== 'กู้คืนข้อมูล') {
            showToast('❗ กรุณาพิมพ์ "กู้คืนข้อมูล" ให้ตรงเพื่อยืนยัน', 'error'); return
          }
          close()
          await runRestore(parsedBackup)
        })
      } catch (err) {
        preview.innerHTML = `<div style="color:var(--danger);font-size:0.8rem;margin-top:8px">❌ อ่านไฟล์ไม่สำเร็จ: ${esc(err.message || 'ไฟล์ไม่ถูกต้อง')}</div>`
      }
    })
  }

  async function runRestore(backupObj) {
    isRunning = true
    progressText = 'กำลังเริ่มกู้คืนข้อมูล...'
    renderPage()
    const startedAt = Date.now()
    try {
      const result = await restoreFromBackupData(backupObj, ({ colName, colIndex, colTotal, docIndex, docTotal }) => {
        progressText = `กำลังกู้คืน ${colName} (${colIndex}/${colTotal}) — เอกสาร ${docIndex}/${docTotal}`
        renderPage()
      })
      const durationMs = Date.now() - startedAt
      await createDoc('system_backups', {
        action: 'restore',
        status: result.failed ? 'partial' : 'success',
        size: `${result.restored.toLocaleString()} เอกสาร`,
        duration: formatMs(durationMs),
        time: new Date().toISOString(),
        note: result.failed ? `สำเร็จ ${result.restored} รายการ, ล้มเหลว ${result.failed} รายการ (${result.errors.slice(0,3).map(e=>e.colName).join(', ')}${result.errors.length>3?'...':''})` : `กู้คืนสำเร็จทั้งหมด ${result.restored.toLocaleString()} เอกสาร`,
      })
      showToast(result.failed ? `⚠️ กู้คืนสำเร็จ ${result.restored} รายการ, ล้มเหลว ${result.failed} รายการ` : `✅ กู้คืนข้อมูลสำเร็จ ${result.restored.toLocaleString()} เอกสาร`, result.failed ? 'warning' : 'success', 6000)
    } catch (e) {
      try { await createDoc('system_backups', { action: 'restore', status: 'failed', size: '-', duration: formatMs(Date.now() - startedAt), time: new Date().toISOString(), note: e.message || 'ล้มเหลวไม่ทราบสาเหตุ' }) } catch {}
      showToast('❌ กู้คืนไม่สำเร็จ: ' + (e.message || ''), 'error')
    }
    isRunning = false
    await loadData()
  }

  await loadData()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
