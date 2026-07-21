import { showToast, getState } from '../../core/store.js'
import { changeOwnPassword } from '../../core/auth.js'
import { listDocs } from '../../core/db.js'
import { timeAgo } from '../../utils/format.js'

const ROLES = {
  owner:   { label: 'เจ้าของ',      icon: '🏆' },
  admin:   { label: 'แอดมิน',       icon: '🔑' },
  manager: { label: 'ผู้จัดการ',    icon: '🎯' },
  finance: { label: 'การเงิน',      icon: '💰' },
  hr:      { label: 'HR',           icon: '👨‍💼' },
  sales:   { label: 'เซลส์',        icon: '💼' },
  service: { label: 'ช่าง/บริการ',  icon: '🔧' },
  staff:   { label: 'พนักงาน',      icon: '👤' },
}

const AVATAR_COLORS = [
  { name:'blue',    val:'#2563eb' },
  { name:'violet',  val:'#7c3aed' },
  { name:'green',   val:'#059669' },
  { name:'orange',  val:'#ea580c' },
  { name:'rose',    val:'#e11d48' },
  { name:'teal',    val:'#0891b2' },
]

// Action → คำอธิบายภาษาไทยสำหรับแสดงในกิจกรรมล่าสุด (ตรงกับ ACTION_TYPES ใน AuditLog.js)
const ACTIVITY_LABELS = {
  login:    '🔐 เข้าสู่ระบบ',
  logout:   '🚪 ออกจากระบบ',
  create:   '➕ สร้างข้อมูล',
  update:   '✏️ แก้ไขข้อมูล',
  delete:   '🗑 ลบข้อมูล',
  export:   '📥 Export ข้อมูล',
  view:     '👁 ดูข้อมูล',
  approve:  '✅ อนุมัติ',
  reject:   '❌ ปฏิเสธ',
}

export default function MyAccountPage(container) {
  const myGen = container.__routerGen
  const me = getState('user') || {}
  const isDemo = me.uid === 'demo-user'
  const role = ROLES[me.role] || { label: me.role || '—', icon:'👤' }
  const myName = me.displayName || me.email || me.uid || ''

  let prefs; try { prefs = JSON.parse(localStorage.getItem('lamom-my-prefs') || '{}') } catch { prefs = {} }
  let avatarColor = prefs.avatarColor || AVATAR_COLORS[0].val
  let activeTab = 'profile'
  let activityLogs = null // null = ยังไม่โหลด, [] = โหลดแล้วไม่มีข้อมูล

  function savePrefs() {
    try { localStorage.setItem('lamom-my-prefs', JSON.stringify({ ...prefs, avatarColor })) } catch {}
  }

  function renderPage() {
    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div style="display:flex;align-items:center;gap:14px">
            <div style="width:52px;height:52px;border-radius:50%;background:${avatarColor};display:flex;align-items:center;justify-content:center;font-size:1.5rem;font-weight:900;color:white;flex-shrink:0">
              ${(me.displayName||'U').charAt(0)}
            </div>
            <div>
              <div class="page-title" style="margin:0">${me.displayName || '—'}</div>
              <span class="badge badge-primary" style="font-size:0.65rem">${role.icon} ${role.label}</span>
            </div>
          </div>
        </div>

        <!-- Tabs -->
        <div style="display:flex;gap:6px;margin-bottom:14px;border-bottom:1px solid var(--border);padding-bottom:8px">
          ${[['profile','👤 โปรไฟล์'],['security','🔑 ความปลอดภัย'],['activity','📋 กิจกรรม']].map(([k,l]) =>
            `<button class="btn btn-sm ma-tab ${activeTab===k?'btn-primary':'btn-secondary'}" data-tab="${k}">${l}</button>`
          ).join('')}
        </div>

        <div id="ma-body" style="max-width:860px"></div>
      </div>
    `

    container.querySelectorAll('.ma-tab').forEach(b => b.addEventListener('click', () => {
      activeTab = b.dataset.tab; renderPage()
    }))

    const body = document.getElementById('ma-body')
    if (activeTab === 'profile') renderProfile(body)
    else if (activeTab === 'security') renderSecurity(body)
    else renderActivity(body)
  }

  function renderProfile(el) {
    el.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
        <!-- Left: Info -->
        <div style="display:flex;flex-direction:column;gap:12px">
          <div class="card" style="padding:16px">
            <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);margin-bottom:10px">📋 ข้อมูลบัญชี</div>
            ${row('👤 ชื่อ', me.displayName || '—')}
            ${row('📧 อีเมล (login)', me.email || '—')}
            ${row('🏷 บทบาท', `${role.icon} ${role.label}`)}
            ${row('🔐 ประเภทบัญชี', isDemo ? '🎮 Demo' : '🔥 Firebase Auth')}
          </div>
        </div>

        <!-- Right: Avatar color picker -->
        <div class="card" style="padding:16px;height:fit-content">
          <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);margin-bottom:12px">🎨 สีอวาตาร์ของฉัน</div>
          <div style="display:flex;justify-content:center;margin-bottom:18px">
            <div id="avatar-preview" style="width:80px;height:80px;border-radius:50%;background:${avatarColor};display:flex;align-items:center;justify-content:center;font-size:2rem;font-weight:900;color:white;transition:background 0.2s">
              ${(me.displayName||'U').charAt(0)}
            </div>
          </div>
          <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
            ${AVATAR_COLORS.map(c => `
              <button class="av-color" data-color="${c.val}" title="${c.name}"
                style="width:36px;height:36px;border-radius:50%;background:${c.val};border:3px solid ${c.val===avatarColor?'white':'transparent'};outline:${c.val===avatarColor?'2px solid var(--primary)':'none'};cursor:pointer;transition:all 0.15s"></button>
            `).join('')}
          </div>
          <div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--border)">
            <div style="font-size:0.78rem;font-weight:700;color:var(--text-muted);margin-bottom:8px">🔔 การแจ้งเตือน</div>
            ${toggle('notif-lead','🔥 Hot Lead', prefs.notifLead!==false)}
            ${toggle('notif-task','✅ งานที่มอบหมาย', prefs.notifTask!==false)}
            ${toggle('notif-report','📊 รายงานประจำวัน', prefs.notifReport===true)}
            ${toggle('notif-alert','⚠️ แจ้งเตือนสำคัญ', prefs.notifAlert!==false)}
          </div>
          <button class="btn btn-primary" id="save-prefs" style="width:100%;margin-top:14px">💾 บันทึกการตั้งค่า</button>
        </div>
      </div>
    `

    el.querySelectorAll('.av-color').forEach(b => b.addEventListener('click', () => {
      avatarColor = b.dataset.color
      el.querySelectorAll('.av-color').forEach(x => {
        x.style.border = `3px solid ${x.dataset.color===avatarColor?'white':'transparent'}`
        x.style.outline = x.dataset.color===avatarColor?'2px solid var(--primary)':'none'
      })
      const prev = document.getElementById('avatar-preview')
      if (prev) prev.style.background = avatarColor
    }))

    document.getElementById('save-prefs')?.addEventListener('click', () => {
      prefs.notifLead   = document.getElementById('notif-lead')?.checked
      prefs.notifTask   = document.getElementById('notif-task')?.checked
      prefs.notifReport = document.getElementById('notif-report')?.checked
      prefs.notifAlert  = document.getElementById('notif-alert')?.checked
      prefs.avatarColor = avatarColor
      Object.assign(prefs, { avatarColor })
      savePrefs()
      showToast('✅ บันทึกการตั้งค่าแล้ว', 'success')
      renderPage()
    })
  }

  function renderSecurity(el) {
    el.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
        <div class="card" style="padding:18px">
          <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);margin-bottom:14px">🔑 เปลี่ยนรหัสผ่าน</div>
          ${isDemo ? `
            <div style="padding:14px;background:var(--surface-2);border-radius:var(--radius-sm);font-size:0.8rem;color:var(--text-muted)">
              🎮 บัญชี Demo — ไม่สามารถเปลี่ยนรหัสผ่านได้
            </div>
          ` : `
            <div style="display:flex;flex-direction:column;gap:12px">
              <div class="input-group"><label class="input-label">รหัสผ่านปัจจุบัน *</label><input class="input" type="password" id="cp-old"></div>
              <div class="input-group"><label class="input-label">รหัสผ่านใหม่ (≥ 8 ตัว) *</label><input class="input" type="password" id="cp-new1"></div>
              <div class="input-group"><label class="input-label">ยืนยันรหัสผ่านใหม่ *</label><input class="input" type="password" id="cp-new2"></div>
              <div id="pw-strength" style="font-size:0.72rem"></div>
              <span class="input-error" id="cp-error"></span>
              <button class="btn btn-primary" id="cp-btn">🔑 เปลี่ยนรหัสผ่าน</button>
            </div>
            <p style="font-size:0.68rem;color:var(--text-muted);margin-top:10px">💡 ลืมรหัสปัจจุบัน? ออกจากระบบแล้วกด "ลืมรหัสผ่าน?" หน้า Login เพื่อรับอีเมลตั้งรหัสใหม่</p>
          `}
        </div>
        <div class="card" style="padding:18px">
          <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);margin-bottom:12px">🛡 ความปลอดภัยบัญชี</div>
          ${secRow('สถานะบัญชี', isDemo?'🎮 Demo':'✅ ใช้งานอยู่', isDemo?'warning':'success')}
          ${secRow('ประเภทบัญชี', '🔥 Firebase Auth', 'primary')}
          ${secRow('Session', 'ใช้งาน Session ปัจจุบัน', 'success')}
          <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border)">
            <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:8px">💡 คำแนะนำ</div>
            <ul style="font-size:0.74rem;color:var(--text-muted);padding-left:16px;line-height:2">
              <li>เปลี่ยนรหัสผ่านทุก 3 เดือน</li>
              <li>ใช้รหัสผ่านที่มีตัวเลข + ตัวอักษร + สัญลักษณ์</li>
              <li>ไม่แชร์รหัสผ่านกับผู้อื่น</li>
            </ul>
          </div>
        </div>
      </div>
    `

    document.getElementById('cp-new1')?.addEventListener('input', e => {
      const v = e.target.value
      const el = document.getElementById('pw-strength')
      if (!el) return
      if (!v) { el.textContent = ''; return }
      const score = (v.length>=8?1:0)+((/[0-9]/).test(v)?1:0)+((/[A-Z]/).test(v)?1:0)+((/[^A-Za-z0-9]/).test(v)?1:0)
      const levels = ['','ต่ำมาก ❌','พอใช้ ⚠️','ดี ✅','แข็งแกร่ง 🔒']
      const colors = ['','var(--danger)','var(--warning)','var(--success)','var(--success)']
      el.innerHTML = `ความแข็งแกร่ง: <strong style="color:${colors[score]}">${levels[score]||''}</strong>`
    })

    document.getElementById('cp-btn')?.addEventListener('click', async () => {
      const oldPw = document.getElementById('cp-old')?.value || ''
      const p1 = document.getElementById('cp-new1')?.value || ''
      const p2 = document.getElementById('cp-new2')?.value || ''
      const err = document.getElementById('cp-error')
      const btn = document.getElementById('cp-btn')
      if (err) err.textContent = ''
      if (!oldPw) { if (err) err.textContent = 'กรอกรหัสผ่านปัจจุบัน'; return }
      if (p1.length < 8) { if (err) err.textContent = 'รหัสผ่านใหม่อย่างน้อย 8 ตัว'; return }
      if (p1 !== p2) { if (err) err.textContent = 'รหัสผ่านใหม่ไม่ตรงกัน'; return }
      if (btn) { btn.disabled = true; btn.textContent = '⏳ กำลังเปลี่ยน...' }
      const r = await changeOwnPassword(oldPw, p1)
      if (btn) { btn.disabled = false; btn.textContent = '🔑 เปลี่ยนรหัสผ่าน' }
      if (!r.ok) { if (err) err.textContent = r.error; return }
      showToast('🔑 เปลี่ยนรหัสผ่านสำเร็จ', 'success')
      ;['cp-old','cp-new1','cp-new2'].forEach(id => { const el = document.getElementById(id); if (el) el.value = '' })
    })
  }

  function renderActivity(el) {
    if (activityLogs === null) {
      el.innerHTML = `<div class="card" style="padding:14px;max-width:600px"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      listDocs('audit_log', [], 'ts', 'desc', 200).then(logs => {
        activityLogs = logs.filter(l => l.user === myName)
        if (container.__routerGen !== myGen || activeTab !== 'activity') return
        renderPage()
      }).catch(() => {
        activityLogs = []
        if (container.__routerGen !== myGen || activeTab !== 'activity') return
        renderPage()
      })
      return
    }

    el.innerHTML = `
      <div class="card" style="padding:14px;max-width:600px">
        <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);margin-bottom:12px">📋 กิจกรรมล่าสุด</div>
        <div style="display:flex;flex-direction:column;gap:1px">
          ${activityLogs.map(a => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:9px 4px;border-bottom:1px solid var(--border-subtle)">
              <div>
                <div style="font-size:0.81rem;font-weight:600">${ACTIVITY_LABELS[a.action] || (a.action || '•')}</div>
                <div style="font-size:0.69rem;color:var(--text-muted)">${a.module || '-'}${a.detail ? ' · ' + a.detail : ''}</div>
              </div>
              <div style="font-size:0.69rem;color:var(--text-muted);text-align:right;white-space:nowrap">${a.ts ? timeAgo(a.ts) : '-'}</div>
            </div>
          `).join('')}
          ${!activityLogs.length ? `<div style="text-align:center;padding:24px;color:var(--text-muted);font-size:0.8rem">ยังไม่มีกิจกรรม</div>` : ''}
        </div>
      </div>
    `
  }

  renderPage()
}

function row(l, v) {
  return `<div style="display:flex;justify-content:space-between;font-size:0.79rem;padding:6px 0;border-bottom:1px solid var(--border-subtle)">
    <span style="color:var(--text-muted)">${l}</span><span style="font-weight:600">${v}</span>
  </div>`
}
function toggle(id, label, checked) {
  return `<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;font-size:0.78rem">
    <label for="${id}" style="cursor:pointer">${label}</label>
    <input type="checkbox" id="${id}" ${checked?'checked':''} style="accent-color:var(--primary);width:16px;height:16px">
  </div>`
}
function secRow(label, val, color) {
  return `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border-subtle);font-size:0.79rem">
    <span style="color:var(--text-muted)">${label}</span>
    <span class="badge badge-${color}" style="font-size:0.65rem">${val}</span>
  </div>`
}
