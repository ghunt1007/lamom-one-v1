/**
 * User Management — สร้าง/จัดการผู้ใช้ (ภายในเท่านั้น)
 * Route: /settings/users-manage
 * กติกา: สร้าง user ได้เฉพาะ แอดมิน/เจ้าของ/แอดมินโชว์รูม/บริหาร/หัวหน้างาน
 *        และสร้างได้เฉพาะระดับที่ "ต่ำกว่า" ตัวเองเท่านั้น
 */
import { formatDate, timeAgo } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast, getState } from '../../core/store.js'
import { ROLES, MIN_CREATE_LEVEL, getUsers, createUser, canCreate, setPassword, toggleActive, getResetRequests, getAuthLog } from '../../core/userDb.js'

const LOG_ICONS = { create: '➕', reset: '🔑', reset_request: '📨', pw_change: '🔄', login: '✅', login_fail: '⚠️', login_blocked: '⛔', suspend: '⛔', enable: '✅' }

function genPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let p = ''
  for (let i = 0; i < 8; i++) p += chars[Math.floor(Math.random() * chars.length)]
  return p + '#' + Math.floor(Math.random() * 90 + 10)
}

export default async function UserManagementPage(container) {
  const me = getState('user') || {}
  const myRole = me.role || 'staff'
  const myLevel = ROLES[myRole]?.level || 0
  const canCreateUsers = myLevel >= MIN_CREATE_LEVEL

  function renderPage() {
    const users = getUsers()
    const requests = getResetRequests()
    const pendingReqs = requests.filter(r => r.status === 'pending')
    // คำขอที่ฉันจัดการได้: เป็น supervisor ของคนขอ หรือเป็น แอดมินโชว์รูมขึ้นไป
    const myReqs = pendingReqs.filter(r =>
      r.supervisorEmail === (me.email || '').toLowerCase() || myLevel >= 80
    )
    const creatableRoles = Object.entries(ROLES).filter(([k]) => canCreate(myRole, k))

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">👥 User Management</div>
            <div class="page-subtitle">สร้างผู้ใช้จากภายในเท่านั้น — สิทธิ์ของคุณ: ${ROLES[myRole]?.icon || ''} ${ROLES[myRole]?.label || myRole}</div>
          </div>
          <div class="page-actions">
            ${canCreateUsers ? `<button class="btn btn-primary" id="add-user-btn">+ สร้างผู้ใช้ใหม่</button>` : ''}
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:16px">
          ${kpi('👥 ผู้ใช้ทั้งหมด', users.length, 'primary')}
          ${kpi('✅ ใช้งานอยู่', users.filter(u=>u.active).length, 'success')}
          ${kpi('🔑 คำขอรีเซ็ตรหัส', myReqs.length, myReqs.length > 0 ? 'danger' : 'secondary')}
        </div>

        ${!canCreateUsers ? `
          <div style="padding:10px 14px;background:var(--warning)11;border:1px solid var(--warning)33;border-radius:var(--radius);margin-bottom:12px;font-size:0.78rem">
            🔒 ระดับสิทธิ์ของคุณสร้างผู้ใช้ไม่ได้ — เฉพาะ <strong>หัวหน้างานขึ้นไป</strong> เท่านั้น (และสร้างได้เฉพาะระดับต่ำกว่าตัวเอง)
          </div>
        ` : `
          <div style="padding:10px 14px;background:var(--surface-2);border-left:3px solid var(--primary);border-radius:var(--radius-sm);margin-bottom:12px;font-size:0.78rem">
            💡 คุณสร้างได้เฉพาะ: ${creatableRoles.map(([k,v]) => v.icon + ' ' + v.label).join(' · ') || '— ไม่มี —'}
          </div>
        `}

        <!-- คำขอรีเซ็ตรหัสผ่าน -->
        ${myReqs.length > 0 ? `
          <div style="font-size:0.8rem;font-weight:700;color:var(--danger);margin-bottom:8px">🔑 คำขอรีเซ็ตรหัสผ่าน (ส่งถึงคุณ)</div>
          <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px">
            ${myReqs.map(r => `
              <div class="card" style="padding:11px 14px;border-left:3px solid var(--danger);display:flex;justify-content:space-between;align-items:center">
                <div>
                  <div style="font-weight:700;font-size:0.83rem">${r.name}</div>
                  <div style="font-size:0.7rem;color:var(--text-muted)">${r.email} · ขอเมื่อ ${timeAgo(r.requestedAt)}</div>
                </div>
                <button class="btn btn-xs btn-danger reset-req-btn" data-email="${r.email}">🔑 ตั้งรหัสใหม่ให้</button>
              </div>
            `).join('')}
          </div>
        ` : ''}

        <!-- รายชื่อผู้ใช้ -->
        <div class="card" style="overflow:hidden">
          <div style="padding:10px 14px;border-bottom:1px solid var(--border);font-size:0.8rem;font-weight:700;color:var(--text-muted)">👥 ผู้ใช้ในระบบ</div>
          ${users.length === 0 ? `
            <div style="padding:30px;text-align:center;color:var(--text-muted);font-size:0.82rem">
              ยังไม่มีผู้ใช้ — ${canCreateUsers ? 'กด "+ สร้างผู้ใช้ใหม่" เพื่อเริ่มต้น' : 'รอผู้มีสิทธิ์สร้างให้'}
            </div>
          ` : `
            <table style="width:100%;border-collapse:collapse">
              <thead>
                <tr style="border-bottom:1px solid var(--border);font-size:0.72rem;color:var(--text-muted)">
                  <th style="padding:8px 14px;text-align:left">ผู้ใช้</th>
                  <th style="padding:8px 10px">ระดับ</th>
                  <th style="padding:8px 10px;text-align:left">ผู้บังคับบัญชา</th>
                  <th style="padding:8px 10px">สถานะ</th>
                  <th style="padding:8px 14px"></th>
                </tr>
              </thead>
              <tbody>
                ${users.map(u => {
                  const r = ROLES[u.role]
                  const iManage = canCreate(myRole, u.role) // จัดการได้เฉพาะระดับต่ำกว่าตัวเอง
                  return `<tr style="border-bottom:1px solid var(--border);font-size:0.8rem${u.active?'':';opacity:0.5'}">
                    <td style="padding:8px 14px">
                      <div style="font-weight:600">${u.name}</div>
                      <div style="font-size:0.65rem;color:var(--text-muted)">${u.email} · สร้างโดย ${u.createdBy} · ${formatDate(u.createdAt)}</div>
                    </td>
                    <td style="padding:8px 10px;text-align:center"><span class="badge badge-secondary" style="font-size:0.62rem">${r?.icon} ${r?.label}</span></td>
                    <td style="padding:8px 10px;font-size:0.72rem;color:var(--text-muted)">${u.supervisorEmail || '—'}</td>
                    <td style="padding:8px 10px;text-align:center">
                      ${u.active ? '<span class="badge badge-success" style="font-size:0.6rem">✅ ใช้งาน</span>' : '<span class="badge badge-danger" style="font-size:0.6rem">⛔ ระงับ</span>'}
                      ${u.mustChangePw ? '<div style="font-size:0.58rem;color:var(--warning)">ต้องเปลี่ยนรหัสครั้งแรก</div>' : ''}
                    </td>
                    <td style="padding:8px 14px;text-align:right;white-space:nowrap">
                      ${iManage ? `
                        <button class="btn btn-xs btn-warning resetpw-btn" data-email="${u.email}">🔑 รีเซ็ตรหัส</button>
                        <button class="btn btn-xs ${u.active?'btn-danger':'btn-success'} toggle-btn" data-email="${u.email}">${u.active?'⛔ ระงับ':'✅ เปิด'}</button>
                      ` : '<span style="font-size:0.62rem;color:var(--text-muted)">🔒 ระดับสูงกว่า/เท่าคุณ</span>'}
                    </td>
                  </tr>`
                }).join('')}
              </tbody>
            </table>
          `}
        </div>

        <!-- Audit log (แอดมินโชว์รูมขึ้นไป) -->
        ${myLevel >= 80 ? `
          <div class="card" style="padding:12px 14px;margin-top:14px">
            <div style="font-size:0.78rem;font-weight:700;color:var(--text-muted);margin-bottom:8px">📋 ประวัติเหตุการณ์บัญชี (50 ล่าสุด)</div>
            ${getAuthLog().slice(0, 50).map(l => `
              <div style="display:flex;gap:8px;padding:5px 0;border-bottom:1px solid var(--border);font-size:0.73rem">
                <span>${LOG_ICONS[l.type] || '·'}</span>
                <span style="flex:1;color:${['login_fail','login_blocked','suspend'].includes(l.type)?'var(--danger)':'var(--text)'}">${l.detail}</span>
                <span style="color:var(--text-muted);font-size:0.64rem;white-space:nowrap">${timeAgo(l.at)}</span>
              </div>
            `).join('') || '<div style="font-size:0.74rem;color:var(--text-muted)">— ยังไม่มีเหตุการณ์ —</div>'}
          </div>
        ` : ''}

        <!-- กติกา -->
        <div class="card" style="padding:12px 14px;margin-top:14px">
          <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);margin-bottom:8px">📜 ลำดับสิทธิ์การสร้างผู้ใช้</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:0.72rem">
            ${Object.values(ROLES).sort((a,b)=>b.level-a.level).map((r, i, arr) =>
              `<span style="background:var(--surface-2);padding:4px 10px;border-radius:10px;${r.level>=MIN_CREATE_LEVEL?'border:1px solid var(--primary)':''}">${r.icon} ${r.label}</span>${i<arr.length-1?'<span style="color:var(--text-muted)">›</span>':''}`
            ).join('')}
          </div>
          <p style="font-size:0.68rem;color:var(--text-muted);margin-top:8px">
            · กรอบสีน้ำเงิน = มีสิทธิ์สร้างผู้ใช้ (หัวหน้างานขึ้นไป) — สร้างได้เฉพาะระดับ<strong>ต่ำกว่า</strong>ตัวเองเท่านั้น<br>
            · "ลืมรหัสผ่าน" ที่หน้า Login จะส่งคำขอถึง<strong>ผู้บังคับบัญชา</strong>ของคนนั้น หรือ<strong>แอดมินโชว์รูมขึ้นไป</strong>เพื่อตั้งรหัสใหม่ให้<br>
            · รหัสที่ตั้งให้เป็นรหัสชั่วคราว — ผู้ใช้ต้องเปลี่ยนเองเมื่อ login ครั้งแรก
          </p>
        </div>
      </div>
    `

    document.getElementById('add-user-btn')?.addEventListener('click', openCreateForm)
    container.querySelectorAll('.resetpw-btn, .reset-req-btn').forEach(b => b.addEventListener('click', () => openResetPw(b.dataset.email)))
    container.querySelectorAll('.toggle-btn').forEach(b => b.addEventListener('click', () => {
      const nowActive = toggleActive(b.dataset.email, me.displayName || me.email)
      showToast(nowActive ? '✅ เปิดใช้งานบัญชีแล้ว' : '⛔ ระงับบัญชีแล้ว', nowActive ? 'success' : 'warning')
      renderPage()
    }))
  }

  function openCreateForm() {
    const creatable = Object.entries(ROLES).filter(([k]) => canCreate(myRole, k))
    const supervisors = getUsers().filter(u => (ROLES[u.role]?.level || 0) >= MIN_CREATE_LEVEL)
    const suggested = genPassword()
    openModal({
      title: '+ สร้างผู้ใช้ใหม่',
      size: 'md',
      body: `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="input-group"><label class="input-label">ชื่อ-นามสกุล *</label><input class="input" id="nu-name"></div>
        <div class="input-group"><label class="input-label">อีเมล (ใช้ login) *</label><input class="input" type="email" id="nu-email" placeholder="name@lamom.one"></div>
        <div class="input-group"><label class="input-label">ระดับสิทธิ์ * <span style="font-size:0.65rem;color:var(--text-muted)">(ต่ำกว่าคุณเท่านั้น)</span></label>
          <select class="input" id="nu-role">${creatable.map(([k,v])=>`<option value="${k}">${v.icon} ${v.label}</option>`).join('')}</select>
        </div>
        <div class="input-group"><label class="input-label">ผู้บังคับบัญชา (รับคำขอรีเซ็ตรหัส)</label>
          <select class="input" id="nu-supervisor">
            <option value="${(me.email||'').toLowerCase()}">${me.displayName || me.email || 'คุณ'} (ตัวคุณเอง)</option>
            ${supervisors.map(s=>`<option value="${s.email}">${s.name} (${ROLES[s.role]?.label})</option>`).join('')}
          </select>
        </div>
        <div class="input-group" style="grid-column:1/-1"><label class="input-label">รหัสผ่านชั่วคราว *</label>
          <div style="display:flex;gap:6px">
            <input class="input" id="nu-password" value="${suggested}" style="flex:1;font-family:monospace">
            <button type="button" class="btn btn-secondary" id="nu-gen">🎲 สุ่มใหม่</button>
          </div>
          <span style="font-size:0.65rem;color:var(--warning)">⚠️ ผู้ใช้ต้องเปลี่ยนรหัสเองเมื่อ login ครั้งแรก — ส่งรหัสนี้ให้ทางช่องทางปลอดภัย</span>
        </div>
      </div>`,
      confirmText: '✅ สร้างผู้ใช้',
      onConfirm() {
        const name = document.getElementById('nu-name')?.value?.trim()
        const email = document.getElementById('nu-email')?.value?.trim()
        const role = document.getElementById('nu-role')?.value
        const password = document.getElementById('nu-password')?.value
        if (!name || !email || !password) { showToast('❗ กรอกข้อมูลให้ครบ', 'error'); return }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showToast('❗ รูปแบบอีเมลไม่ถูกต้อง', 'error'); return }
        if (password.length < 8) { showToast('❗ รหัสผ่านอย่างน้อย 8 ตัว', 'error'); return }
        if (!canCreate(myRole, role)) { showToast('❗ คุณไม่มีสิทธิ์สร้างระดับนี้', 'error'); return }
        const result = createUser({ name, email, password, role, supervisorEmail: document.getElementById('nu-supervisor')?.value || '', createdBy: me.displayName || me.email || 'ระบบ' })
        if (!result.ok) { showToast('❗ ' + result.error, 'error'); return }
        showToast(`✅ สร้าง ${name} (${ROLES[role]?.label}) แล้ว — ส่งรหัสชั่วคราวให้ผู้ใช้`, 'success')
        renderPage()
      }
    })
    setTimeout(() => {
      document.getElementById('nu-gen')?.addEventListener('click', () => {
        const el = document.getElementById('nu-password'); if (el) el.value = genPassword()
      })
    }, 100)
  }

  function openResetPw(email) {
    const newPw = genPassword()
    openModal({
      title: '🔑 ตั้งรหัสผ่านใหม่: ' + email,
      size: 'sm',
      body: `<div style="display:grid;gap:10px">
        <div class="input-group"><label class="input-label">รหัสผ่านใหม่ (ชั่วคราว)</label>
          <input class="input" id="rp-password" value="${newPw}" style="font-family:monospace">
        </div>
        <div style="font-size:0.72rem;color:var(--warning)">⚠️ แจ้งรหัสนี้ให้ผู้ใช้ทางช่องทางปลอดภัย (โทร/พบตัว) — ห้ามส่งในแชทกลุ่ม · ผู้ใช้ต้องเปลี่ยนรหัสเองเมื่อเข้าระบบ</div>
      </div>`,
      confirmText: '🔑 ตั้งรหัสใหม่',
      onConfirm() {
        const pw = document.getElementById('rp-password')?.value
        if (!pw || pw.length < 8) { showToast('❗ รหัสผ่านอย่างน้อย 8 ตัว', 'error'); return }
        const r = setPassword(email, pw, me.displayName || me.email || 'ระบบ')
        if (!r.ok) { showToast('❗ ' + r.error, 'error'); return }
        showToast('🔑 ตั้งรหัสใหม่แล้ว — ปิดคำขอรีเซ็ต + บันทึก log', 'success')
        renderPage()
      }
    })
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
