import { openModal, confirmDialog } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'

const ROLE_LABELS = { owner:'เจ้าของ', admin:'แอดมิน', manager:'ผู้จัดการ', sales:'เซลส์', service:'ช่าง', staff:'พนักงาน' }
const ROLE_COLORS = { owner:'warning', admin:'primary', manager:'accent', sales:'success', service:'accent', staff:'primary' }

export default async function UsersPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let filterRole = 'all'
  let filterStatus = 'all'
  let DEMO_USERS = []
  let loading = true

  async function loadData() {
    loading = true
    try { DEMO_USERS = await listDocs('settings_users_demo', [], 'displayName', 'asc', 500) } catch (e) { DEMO_USERS = [] }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function getFiltered() {
    return DEMO_USERS.filter(u =>
      (filterRole === 'all' || u.role === filterRole) &&
      (filterStatus === 'all' || u.status === filterStatus)
    )
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const filtered = getFiltered()
    const activeCount = DEMO_USERS.filter(u => u.status === 'active').length
    const roleBreakdown = Object.entries(ROLE_LABELS).map(([k, v]) => {
      const count = DEMO_USERS.filter(u => u.role === k).length
      return count > 0 ? `<span class="badge badge-${ROLE_COLORS[k]}" style="font-size:0.7rem">${v} ${count}</span>` : ''
    }).filter(Boolean).join('')

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">👥 จัดการผู้ใช้</div>
            <div class="page-subtitle">ผู้ใช้งานระบบ LAMOM ONE</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="invite-btn">✉️ เชิญผู้ใช้</button>
          </div>
        </div>

        <!-- Stats -->
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;margin-bottom:14px">
          <div class="card" style="padding:14px 16px">
            <div style="font-size:0.72rem;color:var(--text-muted)">ผู้ใช้ทั้งหมด</div>
            <div style="font-size:1.8rem;font-weight:900;color:var(--primary)">${DEMO_USERS.length}</div>
          </div>
          <div class="card" style="padding:14px 16px">
            <div style="font-size:0.72rem;color:var(--text-muted)">✅ Active</div>
            <div style="font-size:1.8rem;font-weight:900;color:var(--success)">${activeCount}</div>
          </div>
          <div class="card" style="padding:14px 16px">
            <div style="font-size:0.72rem;color:var(--text-muted)">❌ Inactive</div>
            <div style="font-size:1.8rem;font-weight:900;color:var(--danger)">${DEMO_USERS.length - activeCount}</div>
          </div>
        </div>

        <!-- Role summary -->
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">${roleBreakdown}</div>

        <!-- Filters -->
        <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
          <select class="input" id="filter-role" style="width:160px;padding:7px 10px;font-size:0.82rem">
            <option value="all">ทุก Role</option>
            ${Object.entries(ROLE_LABELS).map(([k,v]) => `<option value="${k}" ${filterRole===k?'selected':''}>${v}</option>`).join('')}
          </select>
          <select class="input" id="filter-status" style="width:140px;padding:7px 10px;font-size:0.82rem">
            <option value="all">ทุกสถานะ</option>
            <option value="active" ${filterStatus==='active'?'selected':''}>✅ Active</option>
            <option value="inactive" ${filterStatus==='inactive'?'selected':''}>❌ Inactive</option>
          </select>
          <span style="font-size:0.8rem;color:var(--text-muted);align-self:center">แสดง ${filtered.length} จาก ${DEMO_USERS.length} คน</span>
        </div>

        <div class="card">
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ผู้ใช้</th>
                  <th>อีเมล</th>
                  <th>ตำแหน่ง</th>
                  <th>สาขา</th>
                  <th>สถานะ</th>
                  <th>เข้าใช้ล่าสุด</th>
                  <th style="text-align:center">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                ${filtered.map(u => {
                  const roleLabel = ROLE_LABELS[u.role] || u.role
                  const roleColor = ROLE_COLORS[u.role] || 'primary'
                  return `
                    <tr>
                      <td style="font-weight:600">${u.displayName}</td>
                      <td style="font-size:0.82rem;color:var(--text-muted)">${u.email}</td>
                      <td><span class="badge badge-${roleColor}">${roleLabel}</span></td>
                      <td style="font-size:0.8rem;color:var(--text-muted)">${u.branch||'-'}</td>
                      <td><span class="badge badge-${u.status==='active'?'success':'danger'}">${u.status==='active'?'✅ Active':'❌ Inactive'}</span></td>
                      <td style="font-size:0.78rem;color:var(--text-muted)">${u.lastLogin}</td>
                      <td style="text-align:center">
                        ${u.id === 'owner-001' ? `<span style="font-size:0.72rem;color:var(--warning)">🔒 เจ้าของ</span>` : `
                          <div style="display:flex;gap:4px;justify-content:center">
                            <button class="btn btn-xs btn-secondary edit-user-btn" data-id="${u.id}">✏️</button>
                            <button class="btn btn-xs ${u.status==='active'?'btn-warning':'btn-success'} toggle-status-btn" data-id="${u.id}">${u.status==='active'?'🚫':'✅'}</button>
                          </div>
                        `}
                      </td>
                    </tr>
                  `
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="card" style="padding:12px 16px;margin-top:12px;font-size:0.77rem;color:var(--text-muted)">
          🔑 ระบบ invite จริงจะส่ง email ผ่าน Firebase Auth — ปัจจุบันอยู่ใน Demo mode
        </div>
      </div>
    `

    document.getElementById('invite-btn').addEventListener('click', openInviteModal)
    document.getElementById('filter-role').addEventListener('change', e => { filterRole = e.target.value; renderPage() })
    document.getElementById('filter-status').addEventListener('change', e => { filterStatus = e.target.value; renderPage() })

    container.querySelectorAll('.edit-user-btn').forEach(btn => btn.addEventListener('click', () => {
      const u = DEMO_USERS.find(x => x.id === btn.dataset.id)
      if (u) openEditModal(u)
    }))

    container.querySelectorAll('.toggle-status-btn').forEach(btn => btn.addEventListener('click', async () => {
      const u = DEMO_USERS.find(x => x.id === btn.dataset.id)
      if (!u) return
      const action = u.status === 'active' ? 'ระงับ' : 'เปิดใช้งาน'
      const ok = await confirmDialog({ title: `${action}ผู้ใช้?`, message: `${action} "${u.displayName}" ใช่ไหม?`, confirmText: action, danger: u.status === 'active' })
      if (!ok) return
      const status = u.status === 'active' ? 'inactive' : 'active'
      try { await updateDocData('settings_users_demo', u.id, { status }) } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error'); return }
      showToast(`${status==='active'?'✅ เปิดใช้':'🚫 ระงับ'}ผู้ใช้ ${u.displayName} แล้ว`, status==='active'?'success':'warning')
      await loadData()
    }))
  }

  function openInviteModal() {
    const { el, close } = openModal({
      title: '✉️ เชิญผู้ใช้ใหม่', size: 'sm',
      body: `
        <div style="display:flex;flex-direction:column;gap:12px">
          <div class="input-group"><label class="input-label">ชื่อ-นามสกุล *</label><input class="input" id="inv-name" placeholder="ชื่อผู้ใช้"></div>
          <div class="input-group"><label class="input-label">อีเมล *</label><input class="input" type="email" id="inv-email" placeholder="email@example.com"></div>
          <div class="input-group"><label class="input-label">Role</label>
            <select class="input" id="inv-role">
              ${Object.entries(ROLE_LABELS).map(([k,v]) => `<option value="${k}">${v}</option>`).join('')}
            </select>
          </div>
          <div class="input-group"><label class="input-label">สาขา</label>
            <select class="input" id="inv-branch">
              <option>สาขาหลัก</option><option>สาขาชลบุรี</option><option>สาขาเชียงใหม่</option>
            </select>
          </div>
        </div>
      `,
      footer: `<button class="btn btn-secondary" id="inv-c">ยกเลิก</button><button class="btn btn-primary" id="inv-s">✉️ ส่งคำเชิญ</button>`
    })
    el.querySelector('#inv-c').addEventListener('click', close)
    el.querySelector('#inv-s').addEventListener('click', async () => {
      const name = el.querySelector('#inv-name').value.trim()
      const email = el.querySelector('#inv-email').value.trim()
      if (!name || !email) return showToast('⚠️ กรุณากรอกชื่อและอีเมล', 'warning')
      const role = el.querySelector('#inv-role').value
      const branch = el.querySelector('#inv-branch').value
      try {
        await createDoc('settings_users_demo', { email, displayName: name, role, status: 'active', lastLogin: '-', branch })
        showToast(`✉️ ส่งคำเชิญให้ ${email} แล้ว (Demo mode)`, 'success')
        close(); await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    })
  }

  function openEditModal(u) {
    const { el, close } = openModal({
      title: `✏️ แก้ไข — ${u.displayName}`, size: 'sm',
      body: `
        <div style="display:flex;flex-direction:column;gap:12px">
          <div class="input-group"><label class="input-label">ชื่อ-นามสกุล</label><input class="input" id="ed-name" value="${u.displayName}"></div>
          <div class="input-group"><label class="input-label">Role</label>
            <select class="input" id="ed-role">
              ${Object.entries(ROLE_LABELS).map(([k,v]) => `<option value="${k}" ${u.role===k?'selected':''}>${v}</option>`).join('')}
            </select>
          </div>
          <div class="input-group"><label class="input-label">สาขา</label>
            <select class="input" id="ed-branch">
              ${['สาขาหลัก','สาขาชลบุรี','สาขาเชียงใหม่'].map(b => `<option ${u.branch===b?'selected':''}>${b}</option>`).join('')}
            </select>
          </div>
        </div>
      `,
      footer: `<button class="btn btn-secondary" id="ed-c">ยกเลิก</button><button class="btn btn-primary" id="ed-s">💾 บันทึก</button>`
    })
    el.querySelector('#ed-c').addEventListener('click', close)
    el.querySelector('#ed-s').addEventListener('click', async () => {
      const data = {
        displayName: el.querySelector('#ed-name').value.trim() || u.displayName,
        role: el.querySelector('#ed-role').value,
        branch: el.querySelector('#ed-branch').value,
      }
      try {
        await updateDocData('settings_users_demo', u.id, data)
        showToast('💾 บันทึกแล้ว', 'success')
        close(); await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    })
  }

  await loadData()
}
