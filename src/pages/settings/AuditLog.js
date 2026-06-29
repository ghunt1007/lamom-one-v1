/**
 * Audit Log — บันทึกการใช้งานระบบ
 * Route: /settings/audit
 */
import { formatDate, timeAgo } from '../../utils/format.js'
import { exportToExcel } from '../../utils/importExport.js'
import { showToast } from '../../core/store.js'

const ACTION_TYPES = {
  login:    { label: 'Login', color: 'primary', icon: '🔐' },
  logout:   { label: 'Logout', color: 'secondary', icon: '🚪' },
  create:   { label: 'สร้าง', color: 'success', icon: '➕' },
  update:   { label: 'แก้ไข', color: 'warning', icon: '✏️' },
  delete:   { label: 'ลบ', color: 'danger', icon: '🗑' },
  export:   { label: 'Export', color: 'primary', icon: '📥' },
  view:     { label: 'ดู', color: 'secondary', icon: '👁' },
  approve:  { label: 'อนุมัติ', color: 'success', icon: '✅' },
  reject:   { label: 'ปฏิเสธ', color: 'danger', icon: '❌' },
}

const MODULES = ['CRM', 'DMS', 'Service', 'Finance', 'HR', 'Marketing', 'Analytics', 'Settings', 'System']

function addMins(n) {
  const d = new Date(); d.setMinutes(d.getMinutes() - n)
  return d.toISOString()
}
function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }

const DEMO_LOGS = [
  { id: 'L001', user: 'ทวีศักดิ์ สุขสมบัติ', role: 'owner', action: 'login', module: 'System', resource: '-', detail: 'Login สำเร็จ', ip: '192.168.1.1', ts: addMins(5) },
  { id: 'L002', user: 'อรนุช สายใจ', role: 'sales', action: 'create', module: 'CRM', resource: 'Lead #L045', detail: 'สร้าง Lead ใหม่: ประยุทธ ดีใจ', ip: '192.168.1.2', ts: addMins(12) },
  { id: 'L003', user: 'อรนุช สายใจ', role: 'sales', action: 'update', module: 'CRM', resource: 'Booking #BK008', detail: 'เปลี่ยนสถานะ: pending → confirmed', ip: '192.168.1.2', ts: addMins(20) },
  { id: 'L004', user: 'วิชาญ ช่างซ่อม', role: 'service', action: 'create', module: 'Service', resource: 'Job #JC012', detail: 'เปิด Job Card: BYD Seal AWD กก 1234', ip: '192.168.1.3', ts: addMins(35) },
  { id: 'L005', user: 'นิภา บัญชีดี', role: 'finance', action: 'export', module: 'Finance', resource: 'P&L Report', detail: 'Export P&L เดือนพฤษภาคม', ip: '192.168.1.4', ts: addMins(60) },
  { id: 'L006', user: 'ทวีศักดิ์ สุขสมบัติ', role: 'owner', action: 'approve', module: 'Finance', resource: 'PO #PO003', detail: 'อนุมัติ Purchase Order มูลค่า 62,000 บาท', ip: '192.168.1.1', ts: addMins(90) },
  { id: 'L007', user: 'อรนุช สายใจ', role: 'sales', action: 'delete', module: 'CRM', resource: 'Lead #L041', detail: 'ลบ Lead ที่ซ้ำซ้อน', ip: '192.168.1.2', ts: addMins(120) },
  { id: 'L008', user: 'ผู้จัดการ ธีระ', role: 'manager', action: 'update', module: 'HR', resource: 'Staff #E005', detail: 'แก้ไขข้อมูลพนักงาน: เปลี่ยนแผนก', ip: '192.168.1.5', ts: addMins(180) },
  { id: 'L009', user: 'นิภา บัญชีดี', role: 'finance', action: 'create', module: 'Finance', resource: 'Invoice #INV042', detail: 'สร้างใบแจ้งหนี้ลูกค้า', ip: '192.168.1.4', ts: addMins(240) },
  { id: 'L010', user: 'วิชาญ ช่างซ่อม', role: 'service', action: 'approve', module: 'Service', resource: 'Warranty #W003', detail: 'อนุมัติคำร้องรับประกัน', ip: '192.168.1.3', ts: addMins(360) },
]

export default async function AuditLogPage(container) {
  let actionFilter = 'all'
  let moduleFilter = 'all'
  let userFilter = ''
  let logs = [...DEMO_LOGS]

  function filtered() {
    return logs.filter(l => {
      if (actionFilter !== 'all' && l.action !== actionFilter) return false
      if (moduleFilter !== 'all' && l.module !== moduleFilter) return false
      if (userFilter && !l.user.toLowerCase().includes(userFilter.toLowerCase())) return false
      return true
    })
  }

  const users = [...new Set(DEMO_LOGS.map(l => l.user))]

  function renderPage() {
    const list = filtered()
    const today = logs.filter(l => l.ts.startsWith(addDays(0))).length
    const highRisk = logs.filter(l => ['delete','reject'].includes(l.action)).length

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">📋 Audit Log</div>
            <div class="page-subtitle">บันทึกการใช้งานระบบ — ตรวจสอบย้อนหลัง</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="export-btn">📥 Export</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('📋 ทั้งหมด', logs.length, 'primary')}
          ${kpi('📅 วันนี้', today, 'success')}
          ${kpi('👥 ผู้ใช้', users.length, 'secondary')}
          ${kpi('⚠️ High Risk', highRisk, highRisk > 0 ? 'danger' : 'secondary')}
        </div>

        <!-- Filters -->
        <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;align-items:center">
          <input class="input" id="user-search" placeholder="🔍 ค้นหาผู้ใช้..." style="max-width:180px" value="${userFilter}">
          <select class="input" id="action-sel" style="max-width:150px">
            <option value="all">ทุก Action</option>
            ${Object.entries(ACTION_TYPES).map(([k,v]) => `<option value="${k}" ${actionFilter===k?'selected':''}>${v.icon} ${v.label}</option>`).join('')}
          </select>
          <select class="input" id="module-sel" style="max-width:150px">
            <option value="all">ทุก Module</option>
            ${MODULES.map(m => `<option ${moduleFilter===m?'selected':''}>${m}</option>`).join('')}
          </select>
        </div>

        <div class="card" style="padding:0;overflow:hidden">
          <table class="table">
            <thead><tr><th>เวลา</th><th>ผู้ใช้</th><th>Action</th><th>Module</th><th>Resource</th><th>รายละเอียด</th><th>IP</th></tr></thead>
            <tbody>
              ${list.map(l => {
                const at = ACTION_TYPES[l.action]
                return `<tr style="${['delete','reject'].includes(l.action) ? 'background:rgba(239,68,68,.04)' : ''}">
                  <td>
                    <div style="font-size:0.78rem">${timeAgo(l.ts)}</div>
                    <div style="font-size:0.68rem;color:var(--text-muted)">${new Date(l.ts).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'})}</div>
                  </td>
                  <td>
                    <div style="font-size:0.82rem;font-weight:600">${l.user}</div>
                    <div style="font-size:0.7rem;color:var(--text-muted)">${l.role}</div>
                  </td>
                  <td><span class="badge badge-${at?.color}">${at?.icon} ${at?.label}</span></td>
                  <td><span class="badge badge-secondary" style="font-size:0.68rem">${l.module}</span></td>
                  <td style="font-size:0.8rem;color:var(--text-muted)">${l.resource}</td>
                  <td style="font-size:0.82rem">${l.detail}</td>
                  <td style="font-family:monospace;font-size:0.75rem;color:var(--text-muted)">${l.ip}</td>
                </tr>`
              }).join('')}
              ${!list.length ? `<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--text-muted)">ไม่พบ Log</td></tr>` : ''}
            </tbody>
          </table>
        </div>
        <div style="font-size:0.75rem;color:var(--text-muted);margin-top:8px;text-align:right">แสดง ${list.length} จาก ${logs.length} รายการ</div>
      </div>
    `

    document.getElementById('user-search')?.addEventListener('input', e => { userFilter = e.target.value; renderPage() })
    document.getElementById('action-sel')?.addEventListener('change', e => { actionFilter = e.target.value; renderPage() })
    document.getElementById('module-sel')?.addEventListener('change', e => { moduleFilter = e.target.value; renderPage() })
    document.getElementById('export-btn')?.addEventListener('click', () => {
      exportToExcel(list.map(l => ({ เวลา: l.ts, ผู้ใช้: l.user, Role: l.role, Action: l.action, Module: l.module, Resource: l.resource, รายละเอียด: l.detail, IP: l.ip })), 'audit_log')
      showToast('📥 Export Audit Log แล้ว!', 'success')
    })
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
