/**
 * Security Settings — ความปลอดภัยระบบ
 * Route: /settings/security
 */
import { timeAgo } from '../../utils/format.js'
import { openModal, confirmDialog } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, softDelete, seedDemoData } from '../../core/db.js'

function escHtml(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') }

// (v1.0.350) เดิม RECENT_ALERTS เป็นข้อความ hardcode ตายตัว 3 รายการ (มีชื่อพนักงาน/บัญชีสมมติปนอยู่ด้วย)
// ไม่เคยตรวจข้อมูลจริงเลย และ security_sessions ไม่มีจุดไหนในระบบเขียนจริงเลยแม้แต่จุดเดียว (ทั้งที่หน้านี้
// อ่าน/ลบได้) ทำให้แสดง Sessions ว่างตลอด — แก้ให้ auth.js เขียน session จริงตอน login ทุกครั้ง (ดู
// registerSecuritySession() ใน core/auth.js) และแจ้งเตือนจริงผ่าน security_alerts ถ้า login จาก IP ที่ไม่
// อยู่ใน ip_whitelist (เตือนเท่านั้น ไม่บล็อกจริง — Firestore Rules มองไม่เห็น IP ผู้เรียกได้เลย)
export default async function SecuritySettingsPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let policies = []
  let sessions = []
  let alerts = []
  let whitelist = []
  let loading = true
  const mySessionId = localStorage.getItem('lamom_session_id')

  async function loadData() {
    loading = true
    try {
      const [p, s, a, w] = await Promise.all([
        listDocs('security_policies', [], 'id', 'asc', 50),
        listDocs('security_sessions', [], 'lastActive', 'desc', 200),
        listDocs('security_alerts', [], 'createdAt', 'desc', 50).catch(() => []),
        listDocs('ip_whitelist', [], 'createdAt', 'desc', 200).catch(() => []),
      ])
      policies = p; sessions = s; alerts = a; whitelist = w.filter(x => !x.deleted)
    } catch (e) { policies = []; sessions = []; alerts = []; whitelist = [] }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
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
            ${sessions.length ? sessions.map(s => {
              const current = s.id === mySessionId
              const stale = s.lastActive && new Date(s.lastActive) < new Date(Date.now() - 24*3600000)
              return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)">
                <div>
                  <div style="font-size:0.78rem;font-weight:600">${escHtml(s.user)} ${current?'<span class="badge badge-success" style="font-size:0.55rem">เครื่องนี้</span>':''}</div>
                  <div style="font-size:0.66rem;color:var(--${stale?'warning':'text-muted'})">${escHtml(s.device)} · ${escHtml(s.ip)} · ${timeAgo(s.lastActive)}${stale?' ⚠️ ค้างนาน':''}</div>
                </div>
                ${!current ? `<button class="btn btn-xs btn-secondary kick-btn" data-id="${s.id}">🚪</button>` : ''}
              </div>`
            }).join('') : `<p style="font-size:0.76rem;color:var(--text-muted)">ยังไม่มี session ที่บันทึกไว้</p>`}
          </div>
        </div>

        <!-- IP Whitelist (เตือนเท่านั้น) -->
        <div class="card" style="padding:14px;margin-bottom:14px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted)">🌐 IP Whitelist (เตือนเท่านั้น ไม่บล็อก login จริง)</div>
            <button class="btn btn-xs btn-primary" id="add-ip-btn">+ เพิ่ม IP</button>
          </div>
          <p style="font-size:0.68rem;color:var(--text-muted);margin-bottom:8px">Firestore ไม่มีทางเช็ค IP ผู้ login ได้เอง — ระบบแค่แจ้งเตือนที่นี่เมื่อ login จาก IP นอกรายการ ไม่ได้บล็อกการเข้าใช้งานจริง</p>
          ${whitelist.length ? whitelist.map(w => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border);font-size:0.78rem">
              <span>${escHtml(w.label)} — <code>${escHtml(w.ip)}</code></span>
              <button class="btn btn-xs btn-ghost del-ip-btn" data-id="${w.id}" style="color:var(--danger)">✕</button>
            </div>
          `).join('') : `<p style="font-size:0.76rem;color:var(--text-muted)">ยังไม่มี IP ใน Whitelist — ยังไม่มีการเตือนใดๆจนกว่าจะเพิ่มรายการแรก</p>`}
        </div>

        <!-- Alerts -->
        <div class="card" style="padding:14px">
          <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);margin-bottom:10px">🔔 เหตุการณ์ความปลอดภัยล่าสุด</div>
          ${alerts.length ? alerts.map(a => `
            <div style="display:flex;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);font-size:0.76rem">
              <span>${a.level==='warning'?'⚠️':'ℹ️'}</span>
              <span style="flex:1">${escHtml(a.msg)}</span>
              <span style="color:var(--text-muted);font-size:0.65rem;white-space:nowrap">${timeAgo(a.createdAt)}</span>
            </div>
          `).join('') : `<p style="font-size:0.76rem;color:var(--text-muted)">✅ ไม่มีเหตุการณ์ผิดปกติ</p>`}
        </div>
      </div>
    `

    container.querySelectorAll('.pol-btn').forEach(b => b.addEventListener('click', () => {
      const p = policies.find(x => x.id === b.dataset.id)
      if (!p) return
      if (p.enabled && p.critical) {
        openModal({
          title: '⚠️ ปิดนโยบายสำคัญ?',
          size: 'sm',
          body: `<p style="font-size:0.82rem">"${p.name}" เป็นนโยบายสำคัญ — การปิดจะลดความปลอดภัยของระบบ</p>`,
          confirmText: '⚠️ ยืนยันปิด',
          async onConfirm() {
            try {
              await updateDocData('security_policies', p.id, { enabled: false })
              showToast('⚠️ ปิดนโยบายแล้ว — บันทึก log', 'warning')
              await loadData()
            } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
          }
        })
      } else {
        const enabled = !p.enabled
        updateDocData('security_policies', p.id, { enabled })
          .then(() => { showToast(enabled ? '✅ เปิดนโยบายแล้ว' : '⏸ ปิดนโยบายแล้ว', 'primary'); return loadData() })
          .catch(() => showToast('บันทึกไม่สำเร็จ', 'error'))
      }
    }))
    container.querySelectorAll('.kick-btn').forEach(b => b.addEventListener('click', async () => {
      const ok = await confirmDialog({ title: 'บังคับ Logout', message: 'ต้องการบังคับ Logout session นี้หรือไม่?', confirmText: 'Logout', danger: true })
      if (!ok) return
      try {
        await softDelete('security_sessions', b.dataset.id)
        showToast('🚪 Logout session แล้ว', 'warning')
        await loadData()
      } catch (e) { showToast('ไม่สำเร็จ', 'error') }
    }))
    document.getElementById('add-ip-btn')?.addEventListener('click', () => {
      openModal({
        title: '+ เพิ่ม IP เข้า Whitelist',
        size: 'sm',
        body: `<div style="display:flex;flex-direction:column;gap:10px">
          <div class="input-group"><label class="input-label">ชื่อ/สถานที่ *</label><input class="input" id="wl-label" placeholder="เช่น ออฟฟิศหลัก"></div>
          <div class="input-group"><label class="input-label">IP Address *</label><input class="input" id="wl-ip" placeholder="203.0.113.5"></div>
        </div>`,
        async onConfirm() {
          const label = document.getElementById('wl-label')?.value?.trim()
          const ip = document.getElementById('wl-ip')?.value?.trim()
          if (!label || !ip) { showToast('❗ กรอกชื่อและ IP ให้ครบ', 'error'); return false }
          try {
            await createDoc('ip_whitelist', { label, ip })
            showToast(`✅ เพิ่ม ${label} (${ip}) แล้ว`, 'success')
            await loadData()
          } catch (e) { showToast('บันทึกไม่สำเร็จ: ' + e.message, 'error') }
        }
      })
    })
    container.querySelectorAll('.del-ip-btn').forEach(b => b.addEventListener('click', async () => {
      const ok = await confirmDialog({ title: 'ลบ IP ออกจาก Whitelist', message: 'ต้องการลบรายการนี้หรือไม่?', confirmText: 'ลบ', danger: true })
      if (!ok) return
      try {
        await softDelete('ip_whitelist', b.dataset.id)
        showToast('ลบแล้ว', 'warning')
        await loadData()
      } catch (e) { showToast('ไม่สำเร็จ: ' + e.message, 'error') }
    }))
    document.getElementById('logout-all-btn')?.addEventListener('click', async () => {
      const targets = sessions.filter(s => s.id !== mySessionId)
      const ok = await confirmDialog({ title: 'Logout ทุก Session', message: `ต้องการบังคับ Logout ทุก session ที่ใช้งานอยู่ (${targets.length} session) ยกเว้นเครื่องนี้หรือไม่? การกระทำนี้มีผลกับทุกอุปกรณ์ที่ล็อกอินอยู่`, confirmText: 'Logout ทั้งหมด', danger: true })
      if (!ok) return
      try {
        await Promise.all(targets.map(s => softDelete('security_sessions', s.id)))
        showToast('🚪 Logout ทุก session แล้ว (ยกเว้นเครื่องนี้)', 'warning')
        await loadData()
      } catch (e) { showToast('ไม่สำเร็จ', 'error') }
    })
  }

  await loadData()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
