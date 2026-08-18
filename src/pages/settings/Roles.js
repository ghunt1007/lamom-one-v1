/**
 * Role & Permissions — กำหนดสิทธิ์การเข้าถึงแต่ละโมดูลตามบทบาท (Role)
 * Route: /settings/roles
 */
import { openModal, confirmDialog } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, updateDocData, setDocData, seedDemoData, seedDefaultRolePermissions } from '../../core/db.js'
import { MODULES, invalidateRolePermissionsCache } from '../../core/permissions.js'
import { isProgramOwner } from '../../core/hierarchy.js'

function esc(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }

const ROLE_COLORS = { owner:'warning', admin:'primary', manager:'accent', finance:'success', hr:'accent', sales:'success', service:'accent', staff:'primary', pending:'secondary' }

// v1.0.315: ต้องเป็นเจ้าของเท่านั้น (Firestore Rules ของ collection 'roles' บังคับ write: isOwner()
// เท่านั้นอยู่แล้ว — ไม่ใช่ isOwner()||isAdmin() แม้แต่แอดมินก็แก้ไม่ได้จริง ปุ่มในหน้านี้ต้องซ่อนให้ตรงกัน
// ไม่งั้นแอดมินจะกดแล้วเจอ permission-denied ที่ Firestore Rules อยู่ดี — รวมถึงปุ่ม "แก้ไข" เดิมที่เคย
// เปิดให้ทุกคนเห็นโดยไม่มีการซ่อนเลย (พึ่ง Firestore Rules บล็อกฝั่งเดียว) แก้ให้ซ่อนตรงกันทั้งหมดด้วย)
// อัปเดตภายหลัง: Firestore Rules เปลี่ยนจาก isOwner() (ของแต่ละบริษัท) เป็น isProgramOwner() (เจ้าของ
// โปรแกรมคนเดียวเท่านั้น) — ฝั่งหน้านี้ต้องตามให้ตรง ไม่งั้น owner ของบริษัทอื่นจะเห็นปุ่มเปิดใช้งานได้แต่
// กดแล้วเจอ permission-denied
export default async function RolesPage(container) {
  const myGen = container.__routerGen
  seedDemoData()
  const canManage = isProgramOwner()

  let roles = []
  let loading = true

  async function loadData() {
    loading = true
    try { roles = await listDocs('roles', [], 'id', 'asc', 100) } catch (e) { roles = [] }
    loading = false
    if (container.__routerGen === myGen) render()
  }

  function render() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🔐 Role & Permissions</div>
            <div class="page-subtitle">กำหนดว่าแต่ละ Role เข้าถึงโมดูลใดได้บ้าง — มีผลกับเมนู Sidebar และการเข้าหน้าจริง</div>
          </div>
          ${canManage ? `<div class="page-actions">
            <button class="btn btn-secondary" id="seed-defaults-btn">🔧 ตั้งค่าสิทธิ์เริ่มต้น</button>
            <button class="btn btn-primary" id="add-role-btn">+ เพิ่มตำแหน่งใหม่</button>
          </div>` : ''}
        </div>

        ${!roles.length ? `<div class="card" style="padding:14px 16px;margin-bottom:14px;border-left:3px solid var(--warning);font-size:0.82rem">
          ⚠️ ยังไม่มีการกำหนดสิทธิ์เข้าถึงโมดูลสำหรับตำแหน่งงานใดเลย — ทุกตำแหน่งงานเข้าถึงได้ทุกหน้าจอผ่านการพิมพ์ URL ตรง (ไม่กระทบข้อมูลจริงที่ Firestore Rules ป้องกันอยู่แล้ว)${canManage ? ' กด "🔧 ตั้งค่าสิทธิ์เริ่มต้น" ด้านบนเพื่อเริ่มจำกัดสิทธิ์ตามแผนก' : ' — ติดต่อเจ้าของระบบให้ตั้งค่าสิทธิ์เริ่มต้น'}
        </div>` : ''}

        <div class="card" style="overflow:auto">
          <table style="width:100%;border-collapse:collapse;min-width:900px">
            <thead>
              <tr style="background:var(--surface-2)">
                <th style="padding:10px 14px;text-align:left;font-size:0.8rem;border-bottom:2px solid var(--border);min-width:150px">Role</th>
                ${MODULES.map(m => `<th style="padding:10px 6px;text-align:center;font-size:0.7rem;border-bottom:2px solid var(--border)">${m.label}</th>`).join('')}
                <th style="padding:10px 6px;border-bottom:2px solid var(--border)"></th>
              </tr>
            </thead>
            <tbody>
              ${roles.map((r,i) => {
                const isFull = (r.modules||[]).includes('*')
                return `<tr style="${i%2===0?'background:var(--surface)':'background:var(--surface-2)'}">
                  <td style="padding:9px 14px;border-bottom:1px solid var(--border-subtle)"><span class="badge badge-${ROLE_COLORS[r.id]||'secondary'}" style="font-size:0.72rem">${esc(r.roleName)}</span></td>
                  ${MODULES.map(m => `<td style="padding:9px 6px;text-align:center;border-bottom:1px solid var(--border-subtle)">
                    <span style="font-size:0.95rem">${isFull || (r.modules||[]).includes(m.key) ? '✅' : '—'}</span>
                  </td>`).join('')}
                  <td style="padding:9px 6px;text-align:center;border-bottom:1px solid var(--border-subtle)">
                    ${canManage ? `<button class="btn btn-xs btn-secondary edit-role-btn" data-id="${r.id}">✏️ แก้ไข</button>` : ''}
                  </td>
                </tr>`
              }).join('')}
            </tbody>
          </table>
        </div>

        <div class="card" style="padding:12px 16px;margin-top:14px;font-size:0.78rem;color:var(--text-muted)">
          ℹ️ การเปลี่ยนแปลงที่นี่มีผลทันทีกับผู้ใช้ที่มี Role นั้นๆ — เมนู Sidebar จะถูกซ่อนสำหรับโมดูลที่ไม่มีสิทธิ์ และการเข้าหน้าโดยตรงจะถูกบล็อก
        </div>
      </div>
    `

    container.querySelectorAll('.edit-role-btn').forEach(btn => btn.addEventListener('click', () => openRoleEditor(btn.dataset.id)))
    document.getElementById('add-role-btn')?.addEventListener('click', openAddRoleForm)
    document.getElementById('seed-defaults-btn')?.addEventListener('click', async () => {
      const ok = await confirmDialog({
        title: '🔧 ตั้งค่าสิทธิ์เริ่มต้น',
        message: 'จะสร้างสิทธิ์เข้าถึงโมดูลเริ่มต้นตามแผนกให้ตำแหน่งงานมาตรฐาน (owner/admin/manager เห็นทุกอย่าง, เซลส์/บริการ/การเงิน/HR/พนักงาน เห็นเฉพาะโมดูลที่เกี่ยวข้อง) — ข้ามตำแหน่งที่มีการกำหนดไว้แล้ว ไม่ทับของเดิม ปลอดภัยกดซ้ำได้ แก้ไขเพิ่ม/ลดทีหลังได้จากตารางด้านบน ดำเนินการต่อ?',
        confirmText: 'ตั้งค่าเลย',
      })
      if (!ok) return
      try {
        const { seeded, skipped } = await seedDefaultRolePermissions()
        invalidateRolePermissionsCache()
        showToast(`✅ ตั้งค่าสิทธิ์เริ่มต้นแล้ว ${seeded} ตำแหน่ง (ข้าม ${skipped} ตำแหน่งที่มีอยู่แล้ว)`, 'success')
        await loadData()
      } catch (e) { showToast('ตั้งค่าไม่สำเร็จ', 'error') }
    })
  }

  // v1.0.315: เดิมหน้านี้แก้ไขได้แค่ตำแหน่งที่มีเอกสารอยู่แล้ว ไม่มีทางสร้างตำแหน่งใหม่เองได้เลย (ต้องไปสร้าง
  // ผ่าน Firebase Console ตรงๆ) เพิ่มฟอร์มสร้างใหม่ให้เจ้าของทำเองได้จากหน้านี้
  function openAddRoleForm() {
    openModal({
      title: '+ เพิ่มตำแหน่งใหม่',
      size: 'md',
      body: `
        <div class="input-group" style="margin-bottom:12px"><label class="input-label">รหัสตำแหน่ง (ภาษาอังกฤษ ไม่มีเว้นวรรค เช่น "warehouse")</label>
          <input class="input" id="ar-id" placeholder="warehouse">
          <span class="input-error" id="ar-id-e"></span>
        </div>
        <div class="input-group" style="margin-bottom:12px"><label class="input-label">ชื่อที่แสดง</label><input class="input" id="ar-name" placeholder="คลังสินค้า"></div>
        <label style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:var(--surface-2);border-radius:var(--radius-sm);margin-bottom:12px;cursor:pointer">
          <input type="checkbox" id="ar-full"> <strong>เข้าถึงได้ทุกโมดูล (Full Access)</strong>
        </label>
        <div id="ar-modules" style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          ${MODULES.map(m => `
            <label style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:var(--surface-2);border-radius:6px;cursor:pointer;font-size:0.82rem">
              <input type="checkbox" class="ar-mod-check" value="${m.key}"> ${m.label}
            </label>
          `).join('')}
        </div>
      `,
      confirmText: '💾 สร้าง',
      async onConfirm() {
        const roleId = document.getElementById('ar-id')?.value?.trim().toLowerCase()
        const roleName = document.getElementById('ar-name')?.value?.trim()
        if (!roleId || !/^[a-z0-9_]+$/.test(roleId)) { document.getElementById('ar-id-e').textContent = 'ใช้ตัวอักษรอังกฤษพิมพ์เล็ก ตัวเลข หรือ _ เท่านั้น'; return false }
        if (roles.some(r => r.id === roleId)) { document.getElementById('ar-id-e').textContent = 'มีตำแหน่งนี้อยู่แล้ว'; return false }
        if (!roleName) { showToast('❗ กรุณาระบุชื่อที่แสดง', 'error'); return false }
        const full = document.getElementById('ar-full')?.checked
        const modules = full ? ['*'] : [...document.querySelectorAll('.ar-mod-check:checked')].map(c => c.value)
        try {
          await setDocData('roles', roleId, { roleName, modules })
          invalidateRolePermissionsCache()
          showToast(`✅ เพิ่มตำแหน่ง ${roleName} แล้ว`, 'success')
          await loadData()
        } catch (e) { showToast('สร้างไม่สำเร็จ', 'error') }
      }
    })
    setTimeout(() => {
      document.getElementById('ar-full')?.addEventListener('change', e => {
        document.getElementById('ar-modules').style.display = e.target.checked ? 'none' : 'grid'
      })
    }, 50)
  }

  function openRoleEditor(roleId) {
    const r = roles.find(x => x.id === roleId)
    if (!r) return
    const isFull = (r.modules||[]).includes('*')
    openModal({
      title: `${esc(r.roleName)} — กำหนดสิทธิ์การเข้าถึง`,
      size: 'md',
      body: `
        <label style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:var(--surface-2);border-radius:var(--radius-sm);margin-bottom:12px;cursor:pointer">
          <input type="checkbox" id="re-full" ${isFull?'checked':''}> <strong>เข้าถึงได้ทุกโมดูล (Full Access)</strong>
        </label>
        <div id="re-modules" style="display:${isFull?'none':'grid'};grid-template-columns:1fr 1fr;gap:8px">
          ${MODULES.map(m => `
            <label style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:var(--surface-2);border-radius:6px;cursor:pointer;font-size:0.82rem">
              <input type="checkbox" class="re-mod-check" value="${m.key}" ${(r.modules||[]).includes(m.key)?'checked':''}> ${m.label}
            </label>
          `).join('')}
        </div>
      `,
      confirmText: '💾 บันทึก',
      async onConfirm() {
        const full = document.getElementById('re-full')?.checked
        const modules = full ? ['*'] : [...document.querySelectorAll('.re-mod-check:checked')].map(c => c.value)
        try {
          await updateDocData('roles', r.id, { modules })
          invalidateRolePermissionsCache()
          showToast(`✅ อัปเดตสิทธิ์ ${r.roleName} แล้ว`, 'success')
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      }
    })
    setTimeout(() => {
      document.getElementById('re-full')?.addEventListener('change', e => {
        document.getElementById('re-modules').style.display = e.target.checked ? 'none' : 'grid'
      })
    }, 50)
  }

  await loadData()
}
