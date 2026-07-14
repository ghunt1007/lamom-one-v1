/**
 * System Health — สถานะระบบ
 * Route: /settings/health
 * เดิมทั้งหน้าเป็นข้อมูลปลอมทั้งหมด (SERVICES/RECENT_ERRORS/USAGE hardcoded, ปุ่มรีเฟรชไม่ทำอะไรจริง)
 * แก้ให้ใช้สัญญาณจริงเท่าที่วัดได้จริงจากฝั่ง client: เวลาตอบสนอง Firestore จริง (วัดจริงตอนโหลดหน้า),
 * สถานะ Integration จริงจาก system_integrations, Error จริงจาก error_log, และกิจกรรมวันนี้ประมาณจาก audit_log
 * (ระบุชัดเจนว่าเป็นค่าประมาณ ไม่ใช่ตัวเลข Firebase Billing Quota จริงซึ่งดึงจากฝั่ง client ไม่ได้)
 */
import { timeAgo } from '../../utils/format.js'
import { showToast } from '../../core/store.js'
import { listDocs } from '../../core/db.js'

function todayStr() { return new Date().toISOString().slice(0, 10) }

export default async function SystemHealthPage(container) {
  async function loadData() {
    const t0 = performance.now()
    let integrations = [], errors = [], auditToday = []
    let firestoreOk = true
    try {
      integrations = await listDocs('system_integrations', [], 'name', 'asc', 200)
    } catch (e) { firestoreOk = false }
    const firestoreLatency = Math.round(performance.now() - t0)
    try { errors = await listDocs('error_log', [], 'createdAt', 'desc', 10) } catch (e) {}
    try { auditToday = await listDocs('audit_log', [], 'ts', 'desc', 500) } catch (e) {}

    const todayAudit = auditToday.filter(a => (a.ts || '').startsWith(todayStr()))
    const activeUsersToday = new Set(todayAudit.map(a => a.user).filter(Boolean)).size
    const errorsToday = errors.filter(e => (e.createdAt || '').startsWith(todayStr())).length

    return { firestoreOk, firestoreLatency, integrations, errors, todayAudit, activeUsersToday, errorsToday }
  }

  async function renderPage() {
    container.innerHTML = `<div class="page-content"><div class="spinner"></div></div>`
    const data = await loadData()
    const { firestoreOk, firestoreLatency, integrations, errors, todayAudit, activeUsersToday, errorsToday } = data

    const connected = integrations.filter(i => i.status === 'connected').length
    const errored = integrations.filter(i => i.status === 'error')
    const disconnected = integrations.filter(i => i.status === 'disconnected')
    const allOk = firestoreOk && errored.length === 0
    const degradedNote = !firestoreOk
      ? 'เชื่อมต่อ Firestore ไม่สำเร็จ'
      : errored.length
        ? errored.map(i => i.name).join(', ') + ' — สถานะ Error'
        : ''

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">💟 System Health</div>
            <div class="page-subtitle">สถานะระบบจากข้อมูลจริง — Firestore / Integrations / Error Log / กิจกรรมวันนี้</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="refresh-btn">🔄 รีเฟรช</button>
          </div>
        </div>

        <!-- Overall status -->
        <div style="padding:14px;border-radius:var(--radius);margin-bottom:16px;background:var(--${allOk?'success':'warning'})11;border:1px solid var(--${allOk?'success':'warning'})33;display:flex;align-items:center;gap:10px">
          <span style="font-size:1.5rem">${allOk ? '✅' : '⚠️'}</span>
          <div>
            <div style="font-weight:700;font-size:0.9rem">${allOk ? 'ระบบทำงานปกติ' : 'พบสิ่งที่ควรตรวจสอบ'}</div>
            <div style="font-size:0.72rem;color:var(--text-muted)">${allOk ? `Firestore ตอบสนอง ${firestoreLatency}ms · Integration เชื่อมต่ออยู่ ${connected}/${integrations.length}` : degradedNote}</div>
          </div>
        </div>

        <!-- Services -->
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;margin-bottom:16px">
          <div class="card" style="padding:12px 14px;border-left:3px solid var(--${firestoreOk?'success':'danger'})">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
              <div style="font-weight:700;font-size:0.8rem">🗄 Firestore (วัดจริง)</div>
              <span style="width:10px;height:10px;border-radius:50%;background:var(--${firestoreOk?'success':'danger'});display:inline-block"></span>
            </div>
            <div style="font-size:0.7rem;color:var(--text-muted)">⚡ ${firestoreLatency}ms ${firestoreLatency > 800 ? '⚠️ ช้ากว่าปกติ' : ''} · วัดตอนโหลดหน้านี้</div>
          </div>
          ${integrations.map(s => {
            const color = s.status === 'connected' ? 'success' : s.status === 'error' ? 'danger' : 'secondary'
            return `<div class="card" style="padding:12px 14px;border-left:3px solid var(--${color})">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                <div style="font-weight:700;font-size:0.8rem">${s.icon || '🔌'} ${s.name}</div>
                <span style="width:10px;height:10px;border-radius:50%;background:var(--${color});display:inline-block"></span>
              </div>
              <div style="font-size:0.7rem;color:var(--text-muted)">
                ${s.status === 'connected' ? '✅ เชื่อมต่ออยู่' : s.status === 'error' ? '⚠️ มีปัญหา' : '⭕ ไม่ได้เชื่อมต่อ'} ${s.lastSync ? '· Sync ล่าสุด ' + timeAgo(s.lastSync) : ''}
              </div>
            </div>`
          }).join('')}
          ${!integrations.length ? `<div class="card" style="padding:12px 14px;grid-column:1/-1;text-align:center;color:var(--text-muted);font-size:0.8rem">ยังไม่มี Integration ตั้งค่าไว้ — ดูที่ /integrations/settings</div>` : ''}
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
          <!-- Activity today (ประมาณจาก audit_log จริง — ไม่ใช่ Firebase Billing Quota จริง เพราะดึงจากฝั่ง client ไม่ได้) -->
          <div class="card" style="padding:14px">
            <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);margin-bottom:4px">📊 กิจกรรมวันนี้ (ประมาณจาก Audit Log จริง)</div>
            <div style="font-size:0.68rem;color:var(--text-muted);margin-bottom:12px">* ไม่ใช่ตัวเลข Firebase Billing Quota จริง เพราะดึงจากฝั่ง client ไม่ได้ — นี่คือกิจกรรมที่ระบบบันทึกจริงวันนี้</div>
            ${activityRow('📝 การเปลี่ยนแปลงข้อมูล (create/update/delete)', todayAudit.length)}
            ${activityRow('👥 ผู้ใช้ที่มีกิจกรรมวันนี้', activeUsersToday)}
            ${activityRow('🐞 Error ที่เกิดวันนี้', errorsToday, errorsToday > 0 ? 'danger' : 'success')}
          </div>

          <!-- Recent errors: จาก error_log จริง -->
          <div class="card" style="padding:14px">
            <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);margin-bottom:12px">📋 Error ล่าสุด (จาก Error Log จริง)</div>
            ${errors.length ? errors.map(e => `
              <div style="padding:7px 0;border-bottom:1px solid var(--border)">
                <div style="display:flex;justify-content:space-between;font-size:0.73rem">
                  <span style="font-weight:600">⚠️ ${(e.message || 'Unknown error').slice(0, 40)}</span>
                  <span style="color:var(--text-muted);font-size:0.65rem">${e.createdAt ? timeAgo(e.createdAt) : '-'}</span>
                </div>
                <div style="font-size:0.7rem;color:var(--text-muted)">${e.url || '-'} · ${e.userName || 'unknown'}</div>
              </div>
            `).join('') : `<div style="text-align:center;padding:20px;color:var(--success);font-size:0.85rem">✅ ไม่พบ Error — ดูรายละเอียดที่ /settings/errors</div>`}
          </div>
        </div>
      </div>
    `

    document.getElementById('refresh-btn')?.addEventListener('click', async () => { await renderPage(); showToast('🔄 รีเฟรชสถานะแล้ว (ข้อมูลจริง)', 'primary') })
  }

  await renderPage()
}

function activityRow(label, value, color) {
  return `<div style="display:flex;justify-content:space-between;font-size:0.78rem;padding:6px 0;border-bottom:1px solid var(--border)">
    <span>${label}</span><span style="font-weight:700;color:var(--${color || 'text'})">${value.toLocaleString()}</span>
  </div>`
}
