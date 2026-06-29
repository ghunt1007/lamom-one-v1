import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'

const ROLES = [
  {
    key: 'owner', name: '🏆 เจ้าของ', color: 'warning',
    perms: ['ทุกอย่าง รวม config system', 'ดูข้อมูลทางการเงินทั้งหมด', 'จัดการผู้ใช้และ roles', 'ตั้งค่าบริษัท', 'ดูรายงาน Executive', 'ลบข้อมูล'],
  },
  {
    key: 'admin', name: '🔑 แอดมิน', color: 'primary',
    perms: ['CRM ทั้งหมด', 'DMS ทั้งหมด', 'Service ทั้งหมด', 'Finance ทั้งหมด', 'HR ทั้งหมด', 'ตั้งค่าระบบ (ยกเว้น billing)'],
  },
  {
    key: 'manager', name: '🎯 ผู้จัดการ', color: 'accent',
    perms: ['CRM — ดู/แก้ไขทั้งหมด', 'รายงาน Margin', 'Commission ทีม', 'HR — ดูพนักงาน', 'Analytics — ทุกรายงาน', 'ไม่ได้ลบข้อมูล'],
  },
  {
    key: 'sales', name: '💼 เซลส์', color: 'success',
    perms: ['CRM — ลูกค้าของตัวเอง', 'Lead & Pipeline', 'สร้างใบจอง', 'Document Studio', 'Commission ของตัวเอง', 'ดูสต็อกรถ'],
  },
  {
    key: 'service', name: '🔧 ช่าง/บริการ', color: 'accent',
    perms: ['Job Card', 'PDI', 'คลังอะไหล่', 'ดูสต็อกรถ', 'Service Appointment', 'ไม่ได้ดูการเงิน'],
  },
  {
    key: 'staff', name: '👤 พนักงาน', color: 'primary',
    perms: ['Dashboard', 'ดู CRM (read only)', 'ดู Job Card ของตัวเอง', 'ข้อมูลตัวเอง (HR)'],
  },
]

const PERM_MATRIX = [
  { module: '📊 Analytics & Reports', owner: true, admin: true, manager: true, sales: false, service: false, staff: false },
  { module: '👥 CRM — ลูกค้า/Lead', owner: true, admin: true, manager: true, sales: true, service: false, staff: false },
  { module: '🚗 DMS — สต็อก', owner: true, admin: true, manager: true, sales: true, service: true, staff: false },
  { module: '🔧 Service — Job Card', owner: true, admin: true, manager: true, sales: false, service: true, staff: false },
  { module: '💰 Finance — ดูรายงาน', owner: true, admin: true, manager: true, sales: false, service: false, staff: false },
  { module: '💰 Finance — แก้ไข', owner: true, admin: true, manager: false, sales: false, service: false, staff: false },
  { module: '👨‍💼 HR — ดูพนักงาน', owner: true, admin: true, manager: true, sales: false, service: false, staff: false },
  { module: '👨‍💼 HR — แก้ไข', owner: true, admin: true, manager: false, sales: false, service: false, staff: false },
  { module: '🎓 Training', owner: true, admin: true, manager: true, sales: true, service: true, staff: true },
  { module: '🏷 Marketing', owner: true, admin: true, manager: true, sales: true, service: false, staff: false },
  { module: '📋 Document Studio', owner: true, admin: true, manager: true, sales: true, service: false, staff: false },
  { module: '⚙️ Settings — ระบบ', owner: true, admin: true, manager: false, sales: false, service: false, staff: false },
  { module: '⚙️ Settings — Company', owner: true, admin: false, manager: false, sales: false, service: false, staff: false },
  { module: '🗑 ลบข้อมูล', owner: true, admin: false, manager: false, sales: false, service: false, staff: false },
]

export default function RolesPage(container) {
  let view = 'cards'

  function renderPage() {
    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🔐 Role & Permissions</div>
            <div class="page-subtitle">สิทธิ์การใช้งานในแต่ละระดับ</div>
          </div>
          <div class="page-actions" style="display:flex;gap:6px">
            <button class="btn btn-sm ${view==='cards'?'btn-primary':'btn-secondary'}" id="v-cards">📋 Cards</button>
            <button class="btn btn-sm ${view==='matrix'?'btn-primary':'btn-secondary'}" id="v-matrix">📊 Matrix</button>
          </div>
        </div>

        ${view === 'cards' ? renderCards() : renderMatrix()}

        <div class="card" style="padding:12px 16px;margin-top:14px;font-size:0.78rem;color:var(--text-muted)">
          ℹ️ ระบบ Role-Based Access Control (RBAC) จะ enforce จริงหลัง Firebase Auth ตั้งค่าเสร็จ — ปัจจุบันอยู่ใน Demo mode
        </div>
      </div>
    `
    document.getElementById('v-cards')?.addEventListener('click', () => { view = 'cards'; renderPage() })
    document.getElementById('v-matrix')?.addEventListener('click', () => { view = 'matrix'; renderPage() })
    container.querySelectorAll('.edit-role-btn').forEach(btn => btn.addEventListener('click', () => openRoleDetail(btn.dataset.key)))
  }

  function renderCards() {
    return `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px">
        ${ROLES.map(r => `
          <div class="card card-lift" style="padding:16px;border-top:3px solid var(--${r.color})">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
              <span class="badge badge-${r.color}" style="font-size:0.82rem">${r.name}</span>
              <button class="btn btn-xs btn-secondary edit-role-btn" data-key="${r.key}">✏️ รายละเอียด</button>
            </div>
            <ul style="margin:0;padding:0 0 0 16px;display:flex;flex-direction:column;gap:4px">
              ${r.perms.map(p => `<li style="font-size:0.81rem;color:var(--text-2)">${p}</li>`).join('')}
            </ul>
          </div>
        `).join('')}
      </div>
    `
  }

  function renderMatrix() {
    const cols = ['owner','admin','manager','sales','service','staff']
    const headers = { owner:'🏆 เจ้าของ', admin:'🔑 Admin', manager:'🎯 จัดการ', sales:'💼 เซลส์', service:'🔧 ช่าง', staff:'👤 Staff' }
    const colors = { owner:'warning', admin:'primary', manager:'accent', sales:'success', service:'accent', staff:'primary' }
    return `
      <div class="card" style="overflow:auto">
        <table style="width:100%;border-collapse:collapse;min-width:700px">
          <thead>
            <tr style="background:var(--surface-2)">
              <th style="padding:10px 14px;text-align:left;font-size:0.8rem;border-bottom:2px solid var(--border);min-width:200px">โมดูล / สิทธิ์</th>
              ${cols.map(c => `<th style="padding:10px 8px;text-align:center;border-bottom:2px solid var(--border)"><span class="badge badge-${colors[c]}" style="font-size:0.7rem">${headers[c]}</span></th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${PERM_MATRIX.map((row, i) => `
              <tr style="${i%2===0?'background:var(--surface)':'background:var(--surface-2)'}">
                <td style="padding:9px 14px;font-size:0.8rem;border-bottom:1px solid var(--border-subtle)">${row.module}</td>
                ${cols.map(c => `<td style="padding:9px 8px;text-align:center;border-bottom:1px solid var(--border-subtle)">
                  <span style="font-size:1rem">${row[c] ? '✅' : '—'}</span>
                </td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `
  }

  function openRoleDetail(key) {
    const r = ROLES.find(x => x.key === key)
    if (!r) return
    const { close } = openModal({
      title: `${r.name} — สิทธิ์การใช้งาน`, size: 'sm',
      body: `
        <div style="display:flex;flex-direction:column;gap:8px">
          <div class="badge badge-${r.color}" style="width:fit-content;margin-bottom:8px">${r.name}</div>
          ${r.perms.map(p => `
            <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--surface-2);border-radius:8px;font-size:0.83rem">
              <span style="color:var(--success)">✅</span>${p}
            </div>
          `).join('')}
          <div style="margin-top:6px;padding:10px;background:var(--warning-dim,var(--surface-2));border-radius:8px;font-size:0.76rem;color:var(--text-muted)">
            💡 แก้ไข permissions จริงได้ใน Firebase Console หลัง Auth ตั้งค่าเสร็จ
          </div>
        </div>
      `,
      footer: `<button class="btn btn-primary" id="modal-close">ปิด</button>`
    })
    document.getElementById('modal-close')?.addEventListener('click', close)
  }

  renderPage()
}
