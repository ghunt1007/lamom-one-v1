/**
 * User Management — สร้าง/จัดการบัญชีพนักงาน (เชื่อม Firebase Auth จริง)
 * Route: /settings/users-manage
 * กติกา: สร้าง user ได้เฉพาะ owner/admin/manager และสร้างได้เฉพาะระดับที่ "ต่ำกว่า" ตัวเองเท่านั้น
 */
import { formatDate, timeAgo } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast, getState } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, isDemoMode, seedDemoData } from '../../core/db.js'
import { createStaffAccount, sendStaffPasswordReset } from '../../core/auth.js'

function esc(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }

const ROLES = {
  owner:   { label: 'เจ้าของ',      icon: '🏆', level: 100 },
  admin:   { label: 'แอดมิน',       icon: '🔑', level: 90 },
  manager: { label: 'ผู้จัดการ',    icon: '🎯', level: 70 },
  finance: { label: 'การเงิน',      icon: '💰', level: 60 },
  hr:      { label: 'HR',           icon: '👨‍💼', level: 60 },
  sales:   { label: 'เซลส์',        icon: '💼', level: 40 },
  service: { label: 'ช่าง/บริการ',  icon: '🔧', level: 40 },
  staff:   { label: 'พนักงาน',      icon: '👤', level: 20 },
}
const MIN_CREATE_LEVEL = 60

function canCreate(myRole, targetRole) {
  const myLevel = ROLES[myRole]?.level || 0
  const targetLevel = ROLES[targetRole]?.level || 0
  return myLevel >= MIN_CREATE_LEVEL && myLevel > targetLevel
}

function genPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let p = ''
  for (let i = 0; i < 8; i++) p += chars[Math.floor(Math.random() * chars.length)]
  return p + '#' + Math.floor(Math.random() * 90 + 10)
}

export default async function UserManagementPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  const me = getState('user') || {}
  const myRole = me.role || 'staff'
  const myLevel = ROLES[myRole]?.level || 0
  const canCreateUsers = myLevel >= MIN_CREATE_LEVEL

  let users = []
  let loading = true

  async function loadData() {
    loading = true
    try { users = await listDocs('users', [], 'createdAt', 'desc', 200) } catch (e) { users = [] }
    loading = false
    if (container.__routerGen === myGen) render()
  }

  function render() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const creatableRoles = Object.entries(ROLES).filter(([k]) => canCreate(myRole, k))

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">👥 User Management</div>
            <div class="page-subtitle">จัดการบัญชีพนักงาน — เชื่อม Firebase Auth จริง${isDemoMode() ? ' <span style="color:var(--warning);font-size:0.72rem">(โหมด Demo: บัญชีที่สร้างจะไม่ใช่บัญชี Login จริง)</span>' : ''} · สิทธิ์ของคุณ: ${ROLES[myRole]?.icon || ''} ${ROLES[myRole]?.label || myRole}</div>
          </div>
          <div class="page-actions">
            ${canCreateUsers ? `<button class="btn btn-primary" id="add-user-btn">+ สร้างบัญชีใหม่</button>` : ''}
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('👥 ผู้ใช้ทั้งหมด', users.length, 'primary')}
          ${kpi('✅ ใช้งานอยู่', users.filter(u=>u.active !== false && u.role !== 'pending').length, 'success')}
          ${kpi('⏳ รออนุมัติสิทธิ์', users.filter(u=>u.role === 'pending').length, users.filter(u=>u.role==='pending').length ? 'warning' : 'secondary')}
          ${kpi('⛔ ถูกระงับ', users.filter(u=>u.active === false).length, 'secondary')}
        </div>
        ${users.some(u=>u.role==='pending') ? `
          <div style="padding:10px 14px;background:var(--warning)11;border:1px solid var(--warning)33;border-radius:var(--radius);margin-bottom:12px;font-size:0.78rem">
            ⏳ มีผู้สมัครใหม่ ${users.filter(u=>u.role==='pending').length} คนรอกำหนดสิทธิ์ — กด "✏️ กำหนดสิทธิ์" ที่แถวนั้นเพื่ออนุมัติ
          </div>
        ` : ''}

        ${!canCreateUsers ? `
          <div style="padding:10px 14px;background:var(--warning)11;border:1px solid var(--warning)33;border-radius:var(--radius);margin-bottom:12px;font-size:0.78rem">
            🔒 ระดับสิทธิ์ของคุณสร้างบัญชีไม่ได้ — เฉพาะ <strong>ผู้จัดการขึ้นไป</strong> เท่านั้น
          </div>
        ` : `
          <div style="padding:10px 14px;background:var(--surface-2);border-left:3px solid var(--primary);border-radius:var(--radius-sm);margin-bottom:12px;font-size:0.78rem">
            💡 คุณสร้างได้เฉพาะ: ${creatableRoles.map(([k,v]) => v.icon + ' ' + v.label).join(' · ') || '— ไม่มี —'}
          </div>
        `}

        <div class="card" style="overflow:hidden">
          <div style="padding:10px 14px;border-bottom:1px solid var(--border);font-size:0.8rem;font-weight:700;color:var(--text-muted)">👥 ผู้ใช้ในระบบ</div>
          ${users.length === 0 ? `
            <div style="padding:30px;text-align:center;color:var(--text-muted);font-size:0.82rem">
              ยังไม่มีผู้ใช้ — ${canCreateUsers ? 'กด "+ สร้างบัญชีใหม่" เพื่อเริ่มต้น' : 'รอผู้มีสิทธิ์สร้างให้'}
            </div>
          ` : `
            <table style="width:100%;border-collapse:collapse">
              <thead>
                <tr style="border-bottom:1px solid var(--border);font-size:0.72rem;color:var(--text-muted)">
                  <th style="padding:8px 14px;text-align:left">ผู้ใช้</th>
                  <th style="padding:8px 10px">ระดับ</th>
                  <th style="padding:8px 10px">สถานะ</th>
                  <th style="padding:8px 14px"></th>
                </tr>
              </thead>
              <tbody>
                ${users.map(u => {
                  const isPending = u.role === 'pending'
                  const r = ROLES[u.role] || {}
                  const active = u.active !== false && !isPending
                  const iManage = canCreate(myRole, u.role)
                  return `<tr style="border-bottom:1px solid var(--border);font-size:0.8rem${active?'':';opacity:0.5'}">
                    <td style="padding:8px 14px">
                      <div style="font-weight:600">${esc(u.displayName || u.email)}</div>
                      <div style="font-size:0.65rem;color:var(--text-muted)">${esc(u.email)} · สร้างเมื่อ ${u.createdAt ? formatDate(u.createdAt) : '-'}</div>
                    </td>
                    <td style="padding:8px 10px;text-align:center">${isPending ? '<span class="badge badge-warning" style="font-size:0.62rem">⏳ รอกำหนดสิทธิ์</span>' : `<span class="badge badge-secondary" style="font-size:0.62rem">${r.icon||''} ${r.label||u.role}</span>`}</td>
                    <td style="padding:8px 10px;text-align:center">
                      ${isPending ? '<span class="badge badge-warning" style="font-size:0.6rem">⏳ สมัครใหม่</span>' : active ? '<span class="badge badge-success" style="font-size:0.6rem">✅ ใช้งาน</span>' : '<span class="badge badge-danger" style="font-size:0.6rem">⛔ ระงับ</span>'}
                    </td>
                    <td style="padding:8px 14px;text-align:right;white-space:nowrap">
                      ${iManage ? `
                        ${isPending ? `<button class="btn btn-xs btn-primary setrole-btn" data-uid="${u.id}" data-name="${esc(u.displayName || u.email)}">✏️ กำหนดสิทธิ์</button>` : ''}
                        <button class="btn btn-xs btn-warning resetpw-btn" data-uid="${u.id}" data-email="${esc(u.email)}">🔑 รีเซ็ตรหัส</button>
                        ${!isPending ? `<button class="btn btn-xs ${active?'btn-danger':'btn-success'} toggle-btn" data-uid="${u.id}" data-active="${active}">${active?'⛔ ระงับ':'✅ เปิด'}</button>` : ''}
                      ` : '<span style="font-size:0.62rem;color:var(--text-muted)">🔒 ระดับสูงกว่า/เท่าคุณ</span>'}
                    </td>
                  </tr>`
                }).join('')}
              </tbody>
            </table>
          `}
        </div>

        <div class="card" style="padding:12px 14px;margin-top:14px">
          <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);margin-bottom:8px">📜 ลำดับสิทธิ์การสร้างบัญชี</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:0.72rem">
            ${Object.entries(ROLES).sort((a,b)=>b[1].level-a[1].level).map(([k,r], i, arr) =>
              `<span style="background:var(--surface-2);padding:4px 10px;border-radius:10px;${r.level>=MIN_CREATE_LEVEL?'border:1px solid var(--primary)':''}">${r.icon} ${r.label}</span>${i<arr.length-1?'<span style="color:var(--text-muted)">›</span>':''}`
            ).join('')}
          </div>
          <p style="font-size:0.68rem;color:var(--text-muted);margin-top:8px">
            · กรอบสีน้ำเงิน = มีสิทธิ์สร้างบัญชี (ผู้จัดการขึ้นไป) — สร้างได้เฉพาะระดับ<strong>ต่ำกว่า</strong>ตัวเองเท่านั้น<br>
            · การระงับบัญชีจะบล็อกการ login จริงในครั้งถัดไปทันที (ตรวจสอบตอน login)<br>
            · "รีเซ็ตรหัส" จะส่งอีเมลลิงก์ตั้งรหัสผ่านใหม่ไปที่อีเมลผู้ใช้จริง (Firebase Auth)
          </p>
        </div>
      </div>
    `

    document.getElementById('add-user-btn')?.addEventListener('click', openCreateForm)
    container.querySelectorAll('.setrole-btn').forEach(b => b.addEventListener('click', () => openAssignRoleForm(b.dataset.uid, b.dataset.name)))
    container.querySelectorAll('.resetpw-btn').forEach(b => b.addEventListener('click', () => confirmResetPw(b.dataset.email)))
    container.querySelectorAll('.toggle-btn').forEach(b => b.addEventListener('click', async () => {
      const nowActive = b.dataset.active !== 'true'
      try {
        await updateDocData('users', b.dataset.uid, { active: nowActive })
        showToast(nowActive ? '✅ เปิดใช้งานบัญชีแล้ว' : '⛔ ระงับบัญชีแล้ว — จะบล็อกการ login ครั้งถัดไป', nowActive ? 'success' : 'warning')
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    }))
  }

  function openCreateForm() {
    const creatable = Object.entries(ROLES).filter(([k]) => canCreate(myRole, k))
    const suggested = genPassword()
    openModal({
      title: '+ สร้างบัญชีพนักงานใหม่',
      size: 'md',
      body: `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="input-group"><label class="input-label">ชื่อ-นามสกุล *</label><input class="input" id="nu-name"></div>
        <div class="input-group"><label class="input-label">อีเมล (ใช้ login) *</label><input class="input" type="email" id="nu-email" placeholder="name@lamom.one"></div>
        <div class="input-group" style="grid-column:1/-1"><label class="input-label">ระดับสิทธิ์ * <span style="font-size:0.65rem;color:var(--text-muted)">(ต่ำกว่าคุณเท่านั้น)</span></label>
          <select class="input" id="nu-role">${creatable.map(([k,v])=>`<option value="${k}">${v.icon} ${v.label}</option>`).join('')}</select>
        </div>
        <div class="input-group" style="grid-column:1/-1"><label class="input-label">รหัสผ่านชั่วคราว *</label>
          <div style="display:flex;gap:6px">
            <input class="input" id="nu-password" value="${suggested}" style="flex:1;font-family:monospace">
            <button type="button" class="btn btn-secondary" id="nu-gen">🎲 สุ่มใหม่</button>
          </div>
          <span style="font-size:0.65rem;color:var(--warning)">⚠️ ส่งรหัสนี้ให้ผู้ใช้ทางช่องทางปลอดภัย — แนะนำให้ผู้ใช้กด "ลืมรหัสผ่าน" เพื่อตั้งรหัสเองทันทีที่ login ครั้งแรก</span>
        </div>
      </div>`,
      confirmText: '✅ สร้างบัญชี',
      async onConfirm() {
        const name = document.getElementById('nu-name')?.value?.trim()
        const email = document.getElementById('nu-email')?.value?.trim()
        const role = document.getElementById('nu-role')?.value
        const password = document.getElementById('nu-password')?.value
        if (!name || !email || !password) { showToast('❗ กรอกข้อมูลให้ครบ', 'error'); return false }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showToast('❗ รูปแบบอีเมลไม่ถูกต้อง', 'error'); return false }
        if (password.length < 8) { showToast('❗ รหัสผ่านอย่างน้อย 8 ตัว', 'error'); return false }
        if (!canCreate(myRole, role)) { showToast('❗ คุณไม่มีสิทธิ์สร้างระดับนี้', 'error'); return false }
        try {
          if (isDemoMode()) {
            await createDoc('users', { displayName: name, email, role, active: true, permissions: [], createdBy: me.displayName || me.email || 'Demo' })
          } else {
            const result = await createStaffAccount({ name, email, password, role })
            if (!result.ok) { showToast('❗ ' + result.error, 'error'); return false }
          }
          showToast(`✅ สร้าง ${name} (${ROLES[role]?.label}) แล้ว`, 'success')
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      }
    })
    setTimeout(() => {
      document.getElementById('nu-gen')?.addEventListener('click', () => {
        const el = document.getElementById('nu-password'); if (el) el.value = genPassword()
      })
    }, 100)
  }

  function openAssignRoleForm(uid, name) {
    const creatable = Object.entries(ROLES).filter(([k]) => canCreate(myRole, k))
    openModal({
      title: `✏️ กำหนดสิทธิ์ให้ ${esc(name)}`,
      size: 'sm',
      body: `<div class="input-group">
        <label class="input-label">ระดับสิทธิ์ *</label>
        <select class="input" id="ar-role">${creatable.map(([k,v])=>`<option value="${k}">${v.icon} ${v.label}</option>`).join('')}</select>
        <p style="font-size:0.68rem;color:var(--text-muted);margin-top:6px">อนุมัติแล้วผู้ใช้จะเข้าใช้งานระบบได้ทันทีตามสิทธิ์ที่เลือก</p>
      </div>`,
      confirmText: '✅ อนุมัติสิทธิ์',
      async onConfirm() {
        const role = document.getElementById('ar-role')?.value
        if (!canCreate(myRole, role)) { showToast('❗ คุณไม่มีสิทธิ์กำหนดระดับนี้', 'error'); return false }
        try {
          await updateDocData('users', uid, { role, active: true })
          showToast(`✅ กำหนดสิทธิ์ ${ROLES[role]?.label} ให้ ${name} แล้ว`, 'success')
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      }
    })
  }

  async function confirmResetPw(email) {
    if (isDemoMode()) { showToast('📧 โหมด Demo — ในระบบจริงจะส่งอีเมลลิงก์ตั้งรหัสผ่านใหม่ไปที่ ' + email, 'primary', 6000); return }
    const r = await sendStaffPasswordReset(email)
    if (r.ok) showToast('📧 ส่งอีเมลลิงก์ตั้งรหัสผ่านใหม่ไปที่ ' + email + ' แล้ว', 'success')
    else showToast('❗ ' + r.error, 'error')
  }

  await loadData()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
