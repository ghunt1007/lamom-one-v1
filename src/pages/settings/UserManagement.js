/**
 * User Management — สร้าง/จัดการบัญชีพนักงาน (เชื่อม Firebase Auth จริง)
 * Route: /settings/users-manage
 * กติกา: สร้าง user ได้เฉพาะ owner/admin/manager และสร้างได้เฉพาะระดับที่ "ต่ำกว่า" ตัวเองเท่านั้น
 */
import { formatDate, timeAgo } from '../../utils/format.js'
import { openModal, confirmDialog } from '../../utils/modal.js'
import { showToast, getState } from '../../core/store.js'
import { listDocs, updateDocData, seedDemoData, backfillUserCompanyIds, hardDeleteDoc } from '../../core/db.js'
import { companyScopeFilters } from '../../core/companyScope.js'
import { createStaffAccount, sendStaffPasswordReset, updateCompanyMemberships } from '../../core/auth.js'
import { getPositions } from '../../data/masterData.js'
import { navigate } from '../../core/router.js'
import { isProgramOwner } from '../../core/hierarchy.js'

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

// สิทธิ์แบบจำกัดเวลา — เผื่อพนักงานชั่วคราว/ผู้รับเหมา/ผู้ตรวจสอบบัญชีที่ควรมีสิทธิ์แค่ช่วงเวลาหนึ่ง
// บังคับใช้จริงที่ Firestore Rules (accessExpiresAt) ไม่ใช่แค่ซ่อนปุ่มที่ UI
const EXPIRY_OPTIONS = [
  { days: null, label: 'ไม่จำกัดเวลา' },
  { days: 1,    label: '1 วัน' },
  { days: 7,    label: '7 วัน' },
  { days: 30,   label: '30 วัน' },
  { days: 90,   label: '90 วัน' },
  { days: 180,  label: '180 วัน' },
]

function computeExpiry(days) {
  const n = Number(days)
  return n > 0 ? new Date(Date.now() + n * 86400000) : null
}

// คืนค่า null ถ้าไม่มีวันหมดอายุ (ใช้งานได้ตลอด) — ไม่ใช่ null = { daysLeft, expired }
function expiryInfo(u) {
  if (!u.accessExpiresAt) return null
  const d = u.accessExpiresAt?.toDate ? u.accessExpiresAt.toDate() : new Date(u.accessExpiresAt)
  const daysLeft = Math.ceil((d.getTime() - Date.now()) / 86400000)
  return { daysLeft, expired: daysLeft < 0 }
}

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
  let companiesList = []
  let staffList = []
  let loading = true

  async function loadData() {
    loading = true
    try { users = await listDocs('users', [], 'createdAt', 'desc', 200) } catch (e) { users = [] }
    try { companiesList = await listDocs('org_companies', [], 'name', 'asc', 100) } catch (e) { companiesList = [] }
    // (v1.0.451) เดิมหน้านี้ไม่รู้จักข้อมูลพนักงาน (HR) เลย — บัญชี login กับข้อมูลพนักงานดูเป็นคนละระบบ
    // แยกขาดจากกัน ทั้งที่จริงเชื่อมกันผ่าน staff.uid (v1.0.430) ตามที่ขอ "บัญชีผู้ใช้ต้องสัมพันธ์กับข้อมูล
    // พนักงาน" — โหลดมาเพื่อโชว์สถานะการเชื่อมโยงให้เห็นชัดเจนตรงนี้เลย ไม่ต้องเดา/สลับหน้าไปเช็คเอง
    try { staffList = (await listDocs('staff', companyScopeFilters(), 'createdAt', 'desc', 500)).filter(s => !s.deleted) } catch (e) { staffList = [] }
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
            <div class="page-subtitle">จัดการบัญชีพนักงาน — เชื่อม Firebase Auth จริง · สิทธิ์ของคุณ: ${ROLES[myRole]?.icon || ''} ${ROLES[myRole]?.label || myRole}</div>
          </div>
          <div class="page-actions">
            ${(myRole === 'owner' || myRole === 'admin') ? `<button class="btn btn-secondary btn-sm" id="backfill-companyids-btn" title="เติม companyIds ให้บัญชีเก่าที่สร้างก่อน v1.0.453 (จำเป็นสำหรับการแยกข้อมูลตามบริษัท)">🔧 เติม companyIds บัญชีเก่า</button>` : ''}
            ${canCreateUsers ? `<button class="btn btn-primary" id="add-user-btn">+ สร้างบัญชีใหม่</button>` : ''}
          </div>
        </div>

        <div class="card" style="padding:10px 14px;margin-bottom:12px;border-left:3px solid var(--primary);font-size:0.78rem;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
          <span>💡 <b>ทำที่เดียวจบ:</b> จัดการชื่อ/ตำแหน่ง/บริษัท/สิทธิ์ login พร้อมกันได้ในหน้าเดียวที่ <b>Settings &gt; พนักงาน</b> แล้ว (แผง "🔐 สิทธิ์การเข้าใช้งาน" ในฟอร์มแก้ไขพนักงาน) — หน้านี้ยังใช้ดูรายชื่อบัญชีทั้งหมด/เติม companyIds บัญชีเก่าได้ตามปกติ</span>
          <button class="btn btn-secondary btn-sm" id="goto-staff-btn">👥 ไปหน้าพนักงาน</button>
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
                  const exp = expiryInfo(u)
                  const active = u.active !== false && !isPending && !(exp && exp.expired)
                  const iManage = canCreate(myRole, u.role)
                  // (v1.0.451) สถานะการเชื่อมกับข้อมูลพนักงาน (HR) — เชื่อมผ่าน staff.uid ตั้งแต่ v1.0.430
                  // (บัญชีที่สร้างใหม่ผ่านหน้านี้เชื่อมให้อัตโนมัติ ส่วนบัญชีเก่า/สมัครเองต้องเชื่อมย้อนหลังที่
                  // หน้า Staff เอง) โชว์ให้เห็นชัดตรงนี้เลยว่าเชื่อมแล้วหรือยัง ไม่ต้องเดา/สลับหน้าไปเช็คเอง
                  const linkedStaff = staffList.find(s => s.uid === u.id)
                  return `<tr style="border-bottom:1px solid var(--border);font-size:0.8rem${active?'':';opacity:0.5'}">
                    <td style="padding:8px 14px">
                      <div style="font-weight:600">${esc(u.displayName || u.email)}</div>
                      <div style="font-size:0.65rem;color:var(--text-muted)">${esc(u.email)} · สร้างเมื่อ ${u.createdAt ? formatDate(u.createdAt) : '-'}</div>
                      ${(u.companyMemberships || []).length ? `<div style="font-size:0.62rem;color:var(--text-muted);margin-top:2px">🏢 ${u.companyMemberships.map(m => esc(companiesList.find(c=>c.id===m.companyId)?.name || m.companyId)).join(', ')}${u.companyMemberships[0]?.position ? ' · ' + esc(u.companyMemberships[0].position) : ''}</div>` : ''}
                      ${linkedStaff
                        ? `<div class="staff-link-btn" data-nav-staff="1" style="font-size:0.62rem;color:var(--success);margin-top:2px;cursor:pointer">🔗 เชื่อมกับพนักงาน: ${esc(linkedStaff.firstName||'')} ${esc(linkedStaff.lastName||'')}${linkedStaff.position ? ' · '+esc(linkedStaff.position) : ''}</div>`
                        : !isPending ? `<div class="staff-link-btn" data-nav-staff="1" style="font-size:0.62rem;color:var(--warning);margin-top:2px;cursor:pointer">⚠️ ยังไม่เชื่อมกับข้อมูลพนักงาน — กดเพื่อไปเชื่อม</div>` : ''}
                    </td>
                    <td style="padding:8px 10px;text-align:center">
                      ${isPending ? '<span class="badge badge-warning" style="font-size:0.62rem">⏳ รอกำหนดสิทธิ์</span>' : `<span class="badge badge-secondary" style="font-size:0.62rem">${r.icon||''} ${r.label||u.role}</span>`}
                      ${exp ? `<div style="margin-top:3px"><span class="badge ${exp.expired?'badge-danger':'badge-warning'}" style="font-size:0.58rem">${exp.expired?'❗ หมดอายุแล้ว':'⏳ เหลือ '+exp.daysLeft+' วัน'}</span></div>` : ''}
                    </td>
                    <td style="padding:8px 10px;text-align:center">
                      ${isPending ? '<span class="badge badge-warning" style="font-size:0.6rem">⏳ สมัครใหม่</span>' : active ? '<span class="badge badge-success" style="font-size:0.6rem">✅ ใช้งาน</span>' : '<span class="badge badge-danger" style="font-size:0.6rem">⛔ ระงับ</span>'}
                    </td>
                    <td style="padding:8px 14px;text-align:right;white-space:nowrap">
                      ${iManage ? `
                        <button class="btn btn-xs btn-primary setrole-btn" data-uid="${u.id}" data-name="${esc(u.displayName || u.email)}">✏️ ${isPending ? 'กำหนดสิทธิ์' : 'แก้ไขบัญชี'}</button>
                        ${!isPending ? `<button class="btn btn-xs btn-secondary renew-btn" data-uid="${u.id}" data-name="${esc(u.displayName || u.email)}">🔄 ${exp?'ต่ออายุ':'ตั้งวันหมดอายุ'}</button>` : ''}
                        <button class="btn btn-xs btn-warning resetpw-btn" data-uid="${u.id}" data-email="${esc(u.email)}">🔑 รีเซ็ตรหัส</button>
                        ${!isPending ? `<button class="btn btn-xs ${active?'btn-danger':'btn-success'} toggle-btn" data-uid="${u.id}" data-active="${active}">${active?'⛔ ระงับ':'✅ เปิด'}</button>` : ''}
                        ${isProgramOwner() && u.id !== me.uid ? `<button class="btn btn-xs btn-danger delete-user-btn" data-uid="${u.id}" data-name="${esc(u.displayName || u.email)}">🗑️ ลบบัญชี</button>` : ''}
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
            · "รีเซ็ตรหัส" จะส่งอีเมลลิงก์ตั้งรหัสผ่านใหม่ไปที่อีเมลผู้ใช้จริง (Firebase Auth)<br>
            · สิทธิ์แบบจำกัดเวลา: หมดอายุแล้วจะเข้าใช้งานไม่ได้ตั้งแต่ระดับฐานข้อมูลจริง (Firestore Rules) ไม่ใช่แค่ซ่อนปุ่มบนหน้าจอ — บังคับตอน login ครั้งถัดไป กด "🔄 ต่ออายุ" เพื่อขยายเวลาได้ทุกเมื่อ
          </p>
        </div>
      </div>
    `

    document.getElementById('add-user-btn')?.addEventListener('click', openCreateForm)
    document.getElementById('goto-staff-btn')?.addEventListener('click', () => navigate('/hr/staff'))
    document.getElementById('backfill-companyids-btn')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget
      btn.disabled = true; btn.innerHTML = '<span class="spinner spinner-sm"></span> กำลังเติม...'
      try {
        const result = await backfillUserCompanyIds()
        showToast(`✅ เติม companyIds สำเร็จ ${result.migrated} คน (ข้าม ${result.skipped} คนที่มีอยู่แล้ว)${result.errors.length ? ` — พลาด ${result.errors.length} คน` : ''}`, result.errors.length ? 'warning' : 'success', 8000)
        await loadData()
      } catch {
        showToast('เติมข้อมูลไม่สำเร็จ', 'error')
      } finally {
        btn.disabled = false; btn.innerHTML = '🔧 เติม companyIds บัญชีเก่า'
      }
    })
    container.querySelectorAll('.staff-link-btn').forEach(b => b.addEventListener('click', () => navigate('/hr/staff')))
    container.querySelectorAll('.setrole-btn').forEach(b => b.addEventListener('click', () => openAssignRoleForm(b.dataset.uid, b.dataset.name)))
    container.querySelectorAll('.renew-btn').forEach(b => b.addEventListener('click', () => openRenewForm(b.dataset.uid, b.dataset.name)))
    container.querySelectorAll('.resetpw-btn').forEach(b => b.addEventListener('click', () => confirmResetPw(b.dataset.email)))
    container.querySelectorAll('.toggle-btn').forEach(b => b.addEventListener('click', async () => {
      const nowActive = b.dataset.active !== 'true'
      try {
        await updateDocData('users', b.dataset.uid, { active: nowActive })
        showToast(nowActive ? '✅ เปิดใช้งานบัญชีแล้ว' : '⛔ ระงับบัญชีแล้ว — จะบล็อกการ login ครั้งถัดไป', nowActive ? 'success' : 'warning')
        await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ: ' + (e?.message || 'เกิดข้อผิดพลาดไม่ทราบสาเหตุ'), 'error', 8000) }
    }))
    container.querySelectorAll('.delete-user-btn').forEach(b => b.addEventListener('click', async () => {
      const uid = b.dataset.uid, name = b.dataset.name
      const ok = await confirmDialog({
        title: '🗑️ ลบบัญชีผู้ใช้',
        message: `ลบบัญชีของ "${name}" ถาวร — ผู้ใช้จะเข้าระบบไม่ได้อีกต่อไปทันที (ข้อมูลพนักงาน/HR ที่เชื่อมกันไว้ ถ้ามี จะไม่ถูกลบ แค่หลุดการเชื่อมโยงกับบัญชี login เท่านั้น) การลบนี้ย้อนกลับไม่ได้ ต้องการดำเนินการหรือไม่?`,
        confirmText: 'ลบถาวร', danger: true,
      })
      if (!ok) return
      try {
        await hardDeleteDoc('users', uid)
        showToast(`✅ ลบบัญชี ${name} แล้ว`, 'success')
        await loadData()
      } catch (e) { showToast('ลบไม่สำเร็จ: ' + (e?.message || 'เกิดข้อผิดพลาดไม่ทราบสาเหตุ'), 'error', 8000) }
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
        <div class="input-group" style="grid-column:1/-1"><label class="input-label">ระยะเวลาสิทธิ์ <span style="font-size:0.65rem;color:var(--text-muted)">(เผื่อพนักงานชั่วคราว/ผู้รับเหมา — เลือก "ไม่จำกัดเวลา" สำหรับพนักงานประจำ)</span></label>
          <select class="input" id="nu-expiry">${EXPIRY_OPTIONS.map(o=>`<option value="${o.days??''}">${o.label}</option>`).join('')}</select>
        </div>
        <div class="input-group"><label class="input-label">บริษัท <span style="font-size:0.65rem;color:var(--text-muted)">(ถ้าดูแลหลายบริษัท เพิ่มทีหลังได้จากหน้า "กำหนดสิทธิ์")</span></label>
          <select class="input" id="nu-company"><option value="">— ไม่ระบุ —</option>${companiesList.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select>
        </div>
        <div class="input-group"><label class="input-label">แผนก</label>
          <input class="input" id="nu-department" placeholder="เช่น ขาย, บัญชี, HR"></div>
        <div class="input-group" style="grid-column:1/-1"><label class="input-label">ตำแหน่ง <span style="font-size:0.65rem;color:var(--text-muted)">(เลือกจากรายชื่อมาตรฐาน หรือพิมพ์เองได้ — แก้รายชื่อมาตรฐานได้ที่ Settings > Master Data)</span></label>
          <input class="input" id="nu-position" list="position-options" placeholder="เช่น เซลส์">
          <datalist id="position-options">${getPositions().map(p => `<option value="${esc(p)}">`).join('')}</datalist>
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
        const expiryDays = document.getElementById('nu-expiry')?.value
        const password = document.getElementById('nu-password')?.value
        const companyId = document.getElementById('nu-company')?.value || null
        const department = document.getElementById('nu-department')?.value?.trim() || ''
        const position = document.getElementById('nu-position')?.value?.trim() || ''
        if (!name || !email || !password) { showToast('❗ กรอกข้อมูลให้ครบ', 'error'); return false }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showToast('❗ รูปแบบอีเมลไม่ถูกต้อง', 'error'); return false }
        if (password.length < 8) { showToast('❗ รหัสผ่านอย่างน้อย 8 ตัว', 'error'); return false }
        if (!canCreate(myRole, role)) { showToast('❗ คุณไม่มีสิทธิ์สร้างระดับนี้', 'error'); return false }
        try {
          const result = await createStaffAccount({ name, email, password, role, accessExpiresAt: computeExpiry(expiryDays), companyId, department, position })
          if (!result.ok) { showToast('❗ ' + result.error, 'error'); return false }
          showToast(`✅ สร้าง ${name} (${ROLES[role]?.label}) แล้ว`, 'success')
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ: ' + (e?.message || 'เกิดข้อผิดพลาดไม่ทราบสาเหตุ'), 'error', 8000) }
      }
    })
    setTimeout(() => {
      document.getElementById('nu-gen')?.addEventListener('click', () => {
        const el = document.getElementById('nu-password'); if (el) el.value = genPassword()
      })
    }, 100)
  }

  const KEEP_EXPIRY = '__keep__'

  function openAssignRoleForm(uid, name) {
    const creatable = Object.entries(ROLES).filter(([k]) => canCreate(myRole, k))
    const u = users.find(x => x.id === uid) || {}
    const isPendingUser = u.role === 'pending'
    const currentMemberships = u.companyMemberships || []
    const currentCompanyIds = currentMemberships.map(m => m.companyId)
    const currentDept = currentMemberships[0]?.department || ''
    const currentPos = currentMemberships[0]?.position || ''
    openModal({
      title: `✏️ แก้ไขบัญชี — ${esc(name)}`,
      size: 'sm',
      body: `<div class="input-group">
        <label class="input-label">ชื่อ-นามสกุล (แสดงในระบบ)</label>
        <input class="input" id="ar-name" value="${esc(u.displayName || '')}">
      </div>
      <div class="input-group" style="margin-top:8px">
        <label class="input-label">อีเมล (ใช้ login)</label>
        <input class="input" value="${esc(u.email || '')}" disabled style="opacity:0.6">
        <span style="font-size:0.62rem;color:var(--text-muted)">🔒 แก้อีเมลจากหน้านี้ไม่ได้ (ข้อจำกัดของ Firebase Auth — เปลี่ยนได้เฉพาะเจ้าของบัญชีเองตอน login) ถ้าอีเมลผิดจริง ต้องลบบัญชีนี้แล้วสร้างใหม่</span>
      </div>
      <div class="input-group" style="margin-top:10px">
        <label class="input-label">ระดับสิทธิ์ *</label>
        <select class="input" id="ar-role">${creatable.map(([k,v])=>`<option value="${k}" ${u.role===k?'selected':''}>${v.icon} ${v.label}</option>`).join('')}</select>
      </div>
      <div class="input-group" style="margin-top:10px">
        <label class="input-label">ระยะเวลาสิทธิ์ <span style="font-size:0.65rem;color:var(--text-muted)">(เผื่อพนักงานชั่วคราว/ผู้รับเหมา)</span></label>
        <select class="input" id="ar-expiry">
          <option value="${KEEP_EXPIRY}" selected>— คงเดิมไม่เปลี่ยนแปลง —</option>
          ${EXPIRY_OPTIONS.map(o=>`<option value="${o.days??''}">${o.label}</option>`).join('')}
        </select>
        <p style="font-size:0.68rem;color:var(--text-muted);margin-top:6px">${isPendingUser ? 'อนุมัติแล้วผู้ใช้จะเข้าใช้งานระบบได้ทันทีตามสิทธิ์ที่เลือก' : 'ค่าเริ่มต้น "คงเดิม" จะไม่แตะวันหมดอายุที่ตั้งไว้อยู่แล้ว — เลือกเปลี่ยนเฉพาะตอนต้องการแก้จริงๆ'}</p>
      </div>
      ${companiesList.length ? `
      <div class="input-group" style="margin-top:10px">
        <label class="input-label">บริษัทที่ดูแล + หัวหน้างานต่อบริษัท <span style="font-size:0.65rem;color:var(--text-muted)">(1 คนทำงานหลายบริษัทได้ และมีหัวหน้าต่างกันในแต่ละบริษัทได้ — เผื่อพนักงาน shared-service เช่น HR/บัญชี)</span></label>
        <div style="display:flex;flex-direction:column;gap:6px;max-height:220px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--radius-sm);padding:8px">
          ${companiesList.map(c => {
            const membership = currentMemberships.find(m => m.companyId === c.id)
            return `<div style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid var(--border)">
              <label style="display:flex;align-items:center;gap:6px;font-size:0.8rem;flex:1"><input type="checkbox" class="ar-company-cb" value="${c.id}" ${membership?'checked':''}> ${esc(c.name)}</label>
              <select class="input ar-company-manager" data-company="${c.id}" style="width:150px;font-size:0.7rem">
                <option value="">— ไม่มีหัวหน้า —</option>
                ${users.filter(u => u.id !== uid).map(x => `<option value="${x.id}" ${membership?.managerId===x.id?'selected':''}>${esc(x.displayName||x.email)}</option>`).join('')}
              </select>
            </div>`
          }).join('')}
        </div>
      </div>
      <div class="input-group" style="margin-top:10px;display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div><label class="input-label">แผนก</label><input class="input" id="ar-department" value="${esc(currentDept)}" placeholder="เช่น ขาย, บัญชี, HR"></div>
        <div><label class="input-label">ตำแหน่ง</label><input class="input" id="ar-position" list="ar-position-options" value="${esc(currentPos)}" placeholder="เช่น เซลส์"><datalist id="ar-position-options">${getPositions().map(p => `<option value="${esc(p)}">`).join('')}</datalist></div>
      </div>
      ${(u.role !== 'owner' && u.role !== 'admin') ? `
      <div class="input-group" style="margin-top:10px">
        <label style="display:flex;align-items:center;gap:6px;font-size:0.8rem">
          <input type="checkbox" id="ar-groupwide" ${u.groupWide ? 'checked' : ''}>
          เห็นข้อมูลทุกบริษัท (Group-wide)
        </label>
        <span style="font-size:0.65rem;color:var(--text-muted)">สำหรับ HR/การตลาด/PDI/ตรวจสอบ/หัวหน้าฝ่ายบัญชีที่ต้องดูแลทุกบริษัทจริงตามผังองค์กร — ปกติแล้วพนักงานเห็นแค่ข้อมูลบริษัทที่สังกัดเท่านั้น</span>
      </div>` : ''}` : ''}`,
      confirmText: isPendingUser ? '✅ อนุมัติสิทธิ์' : '✅ บันทึก',
      async onConfirm() {
        const role = document.getElementById('ar-role')?.value
        const expiryDays = document.getElementById('ar-expiry')?.value
        const newName = document.getElementById('ar-name')?.value?.trim()
        if (!newName) { showToast('❗ กรุณาใส่ชื่อ-นามสกุล', 'error'); return false }
        if (!canCreate(myRole, role)) { showToast('❗ คุณไม่มีสิทธิ์กำหนดระดับนี้', 'error'); return false }
        try {
          // (v1.0.451) ค่าเริ่มต้น "คงเดิม" ไม่ส่ง accessExpiresAt ไปใน payload เลย (ไม่ใช่ส่งเป็น null) —
          // updateDocData ใช้ Firestore updateDoc() ที่แก้เฉพาะ field ที่ระบุมาเท่านั้น ไม่แตะ field ที่ไม่ได้
          // ระบุ เดิมถ้าไม่ทำแบบนี้ เปิดหน้านี้มาแก้แค่ชื่อคนที่มีวันหมดอายุจำกัดอยู่แล้ว จะไปรีเซ็ตวันหมดอายุ
          // เป็น "ไม่จำกัดเวลา" โดยไม่ตั้งใจทุกครั้ง (ค่า default เดิมของ dropdown คือช่องแรกซึ่งคือไม่จำกัดเวลา)
          const payload = { role, active: true, displayName: newName }
          if (expiryDays !== KEEP_EXPIRY) payload.accessExpiresAt = computeExpiry(expiryDays)
          if (role !== 'owner' && role !== 'admin') payload.groupWide = document.getElementById('ar-groupwide')?.checked === true
          await updateDocData('users', uid, payload)
          if (companiesList.length) {
            const department = document.getElementById('ar-department')?.value?.trim() || ''
            const position = document.getElementById('ar-position')?.value?.trim() || ''
            const checkedIds = [...document.querySelectorAll('.ar-company-cb:checked')].map(cb => cb.value)
            const companyMemberships = checkedIds.map(companyId => ({
              companyId, role, department, position,
              managerId: document.querySelector(`.ar-company-manager[data-company="${companyId}"]`)?.value || null,
            }))
            // (v1.0.444) บั๊กจริงที่พบ — updateCompanyMemberships() ไม่เคย throw เอง (internal try/catch คืนค่า
            // {ok:false,error} แทน) แต่โค้ดเดิมไม่เคยเช็คผลลัพธ์เลย ถ้าล้มเหลว (เช่น permission-denied) หน้าจอ
            // จะยังขึ้น "✅ กำหนดสิทธิ์แล้ว" ทั้งที่บริษัท/แผนก/ตำแหน่ง/หัวหน้างานที่เพิ่งตั้งไม่ได้ถูกบันทึกจริง
            // เลย — ผู้ใช้เห็นว่า "สำเร็จ" ตลอดแม้ตั้งค่าไม่ได้จริงตามที่รายงาน
            const cmResult = await updateCompanyMemberships(uid, companyMemberships)
            if (!cmResult.ok) { showToast('❗ กำหนดสิทธิ์ระดับสำเร็จ แต่บันทึกบริษัท/แผนก/ตำแหน่งไม่สำเร็จ: ' + cmResult.error, 'error', 8000); await loadData(); return }
          }
          showToast(isPendingUser ? `✅ กำหนดสิทธิ์ ${ROLES[role]?.label} ให้ ${newName} แล้ว` : `✅ บันทึกข้อมูลบัญชี ${newName} แล้ว`, 'success')
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ: ' + (e?.message || 'เกิดข้อผิดพลาดไม่ทราบสาเหตุ'), 'error', 8000) }
      }
    })
  }

  function openRenewForm(uid, name) {
    openModal({
      title: `🔄 ต่ออายุสิทธิ์ — ${esc(name)}`,
      size: 'sm',
      body: `<div class="input-group">
        <label class="input-label">ระยะเวลาสิทธิ์ใหม่ *</label>
        <select class="input" id="rn-expiry">${EXPIRY_OPTIONS.map(o=>`<option value="${o.days??''}">${o.label}</option>`).join('')}</select>
        <p style="font-size:0.68rem;color:var(--text-muted);margin-top:6px">นับเวลาใหม่จากตอนนี้ (ไม่ใช่ต่อจากวันหมดอายุเดิม) — เลือก "ไม่จำกัดเวลา" เพื่อยกเลิกวันหมดอายุถาวร</p>
      </div>`,
      confirmText: '✅ บันทึก',
      async onConfirm() {
        const expiryDays = document.getElementById('rn-expiry')?.value
        try {
          await updateDocData('users', uid, { accessExpiresAt: computeExpiry(expiryDays) })
          showToast(expiryDays ? `✅ ต่ออายุสิทธิ์ ${name} แล้ว` : `✅ ยกเลิกวันหมดอายุของ ${name} แล้ว (ใช้งานได้ตลอด)`, 'success')
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ: ' + (e?.message || 'เกิดข้อผิดพลาดไม่ทราบสาเหตุ'), 'error', 8000) }
      }
    })
  }

  async function confirmResetPw(email) {
    const r = await sendStaffPasswordReset(email)
    if (r.ok) showToast('📧 ส่งอีเมลลิงก์ตั้งรหัสผ่านใหม่ไปที่ ' + email + ' แล้ว', 'success')
    else showToast('❗ ' + r.error, 'error')
  }

  await loadData()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
