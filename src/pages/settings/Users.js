import { openModal, confirmDialog } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'

const ROLE_LABELS = { owner:'เจ้าของ', admin:'แอดมิน', manager:'ผู้จัดการ', sales:'เซลส์', service:'ช่าง', staff:'พนักงาน' }
const ROLE_COLORS = { owner:'warning', admin:'primary', manager:'accent', sales:'success', service:'accent', staff:'primary' }

let DEMO_USERS = [
  { uid:'owner-001', email:'owner@lamom.co.th', displayName:'ทวีศักดิ์ สุขสมบัติเสถียร', role:'owner', status:'active', lastLogin:'2025-06-09', branch:'สาขาหลัก' },
  { uid:'demo-user', email:'demo@lamom.co.th', displayName:'Demo User', role:'admin', status:'active', lastLogin:'2025-06-09', branch:'สาขาหลัก' },
  { uid:'sales-001', email:'nun@lamom.co.th', displayName:'อรนุช เซลส์ดี', role:'sales', status:'active', lastLogin:'2025-06-08', branch:'สาขาหลัก' },
  { uid:'sales-002', email:'wichai@lamom.co.th', displayName:'วิชัย ขายเก่ง', role:'sales', status:'active', lastLogin:'2025-06-07', branch:'สาขาหลัก' },
  { uid:'sales-003', email:'pim@lamom.co.th', displayName:'พิมพ์ ใจดี', role:'sales', status:'active', lastLogin:'2025-06-06', branch:'สาขาชลบุรี' },
  { uid:'mgr-001', email:'manager@lamom.co.th', displayName:'สมศักดิ์ ผู้จัดการ', role:'manager', status:'active', lastLogin:'2025-06-09', branch:'สาขาหลัก' },
  { uid:'tech-001', email:'somchai@lamom.co.th', displayName:'สมชาย ช่างดี', role:'service', status:'active', lastLogin:'2025-06-09', branch:'สาขาหลัก' },
  { uid:'tech-002', email:'wut@lamom.co.th', displayName:'วุฒิ เทคนิค', role:'service', status:'active', lastLogin:'2025-06-05', branch:'สาขาชลบุรี' },
  { uid:'staff-001', email:'nok@lamom.co.th', displayName:'นก สำนักงาน', role:'staff', status:'inactive', lastLogin:'2025-05-20', branch:'สาขาหลัก' },
]

export default function UsersPage(container) {
  let filterRole = 'all'
  let filterStatus = 'all'

  function getFiltered() {
    return DEMO_USERS.filter(u =>
      (filterRole === 'all' || u.role === filterRole) &&
      (filterStatus === 'all' || u.status === filterStatus)
    )
  }

  function renderPage() {
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
                        ${u.uid === 'owner-001' ? `<span style="font-size:0.72rem;color:var(--warning)">🔒 เจ้าของ</span>` : `
                          <div style="display:flex;gap:4px;justify-content:center">
                            <button class="btn btn-xs btn-secondary edit-user-btn" data-uid="${u.uid}">✏️</button>
                            <button class="btn btn-xs ${u.status==='active'?'btn-warning':'btn-success'} toggle-status-btn" data-uid="${u.uid}">${u.status==='active'?'🚫':'✅'}</button>
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
      const u = DEMO_USERS.find(x => x.uid === btn.dataset.uid)
      if (u) openEditModal(u)
    }))

    container.querySelectorAll('.toggle-status-btn').forEach(btn => btn.addEventListener('click', async () => {
      const u = DEMO_USERS.find(x => x.uid === btn.dataset.uid)
      if (!u) return
      const action = u.status === 'active' ? 'ระงับ' : 'เปิดใช้งาน'
      const ok = await confirmDialog({ title: `${action}ผู้ใช้?`, message: `${action} "${u.displayName}" ใช่ไหม?`, confirmText: action, danger: u.status === 'active' })
      if (!ok) return
      u.status = u.status === 'active' ? 'inactive' : 'active'
      showToast(`${u.status==='active'?'✅ เปิดใช้':'🚫 ระงับ'}ผู้ใช้ ${u.displayName} แล้ว`, u.status==='active'?'success':'warning')
      renderPage()
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
    el.querySelector('#inv-s').addEventListener('click', () => {
      const name = el.querySelector('#inv-name').value.trim()
      const email = el.querySelector('#inv-email').value.trim()
      if (!name || !email) return showToast('⚠️ กรุณากรอกชื่อและอีเมล', 'warning')
      const role = el.querySelector('#inv-role').value
      const branch = el.querySelector('#inv-branch').value
      DEMO_USERS.push({ uid: 'u'+Date.now(), email, displayName: name, role, status: 'active', lastLogin: '-', branch })
      showToast(`✉️ ส่งคำเชิญให้ ${email} แล้ว (Demo mode)`, 'success')
      close(); renderPage()
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
    el.querySelector('#ed-s').addEventListener('click', () => {
      u.displayName = el.querySelector('#ed-name').value.trim() || u.displayName
      u.role = el.querySelector('#ed-role').value
      u.branch = el.querySelector('#ed-branch').value
      showToast('💾 บันทึกแล้ว', 'success')
      close(); renderPage()
    })
  }

  renderPage()
}
