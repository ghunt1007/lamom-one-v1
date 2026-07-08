/**
 * Role & Permissions — กำหนดสิทธิ์การเข้าถึงแต่ละโมดูลตามบทบาท (Role)
 * Route: /settings/roles
 */
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, updateDocData, seedDemoData } from '../../core/db.js'
import { MODULES, invalidateRolePermissionsCache } from '../../core/permissions.js'

function esc(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }

const ROLE_COLORS = { owner:'warning', admin:'primary', manager:'accent', sales:'success', service:'accent', staff:'primary' }

export default async function RolesPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let roles = []
  let loading = true

  async function loadData() {
    loading = true
    try { roles = await listDocs('role_permissions', [], 'id', 'asc', 100) } catch (e) { roles = [] }
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
        </div>

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
                    <button class="btn btn-xs btn-secondary edit-role-btn" data-id="${r.id}">✏️ แก้ไข</button>
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
          await updateDocData('role_permissions', r.id, { modules })
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
