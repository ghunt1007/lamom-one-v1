/**
 * User Activity Log — ล็อกกิจกรรมผู้ใช้
 * Route: /settings/activity
 */
import { timeAgo, formatDate } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'

const ACTION_TYPES = {
  login:     { label: 'เข้าสู่ระบบ', icon: '🔐', color: 'primary' },
  logout:    { label: 'ออกจากระบบ', icon: '🚪', color: 'secondary' },
  create:    { label: 'สร้างข้อมูล', icon: '➕', color: 'success' },
  update:    { label: 'แก้ไขข้อมูล', icon: '✏️', color: 'warning' },
  delete:    { label: 'ลบข้อมูล', icon: '🗑', color: 'danger' },
  export:    { label: 'Export', icon: '📤', color: 'primary' },
  import:    { label: 'Import', icon: '📥', color: 'primary' },
  approve:   { label: 'อนุมัติ', icon: '✅', color: 'success' },
  view:      { label: 'ดูข้อมูล', icon: '👁', color: 'secondary' },
}

const MODULES = {
  crm: 'CRM', finance: 'การเงิน', hr: 'HR', service: 'บริการ',
  dms: 'DMS', settings: 'ตั้งค่า', analytics: 'Analytics'
}

function addMins(n) { const d = new Date(); d.setMinutes(d.getMinutes() - n); return d.toISOString() }

const DEMO_LOGS = [
  { id: 'L001', user: 'วิชัย ยอดขาย', role: 'sales', action: 'create', module: 'crm', detail: 'สร้าง Lead ใหม่: สมหมาย ดีใจ', ip: '192.168.1.10', date: addMins(5) },
  { id: 'L002', user: 'สมชาย ผู้จัดการ', role: 'manager', action: 'approve', module: 'finance', detail: 'อนุมัติ Quotation QUO-0045 มูลค่า ฿1,499,000', ip: '192.168.1.5', date: addMins(15) },
  { id: 'L003', user: 'มานี HR', role: 'staff', action: 'update', module: 'hr', detail: 'แก้ไขข้อมูลพนักงาน: ธนา เก่ง', ip: '192.168.1.22', date: addMins(30) },
  { id: 'L004', user: 'สุดา มาดี', role: 'sales', action: 'view', module: 'crm', detail: 'ดูรายละเอียดลูกค้า: อรวรรณ ขยัน', ip: '192.168.1.11', date: addMins(45) },
  { id: 'L005', user: 'Admin', role: 'admin', action: 'export', module: 'analytics', detail: 'Export รายงานยอดขาย เดือนมิถุนายน 2568', ip: '192.168.1.2', date: addMins(60) },
  { id: 'L006', user: 'วิทยา ช่าง', role: 'service', action: 'create', module: 'service', detail: 'สร้าง Job Card: รถ 1กข-9999', ip: '192.168.1.30', date: addMins(90) },
  { id: 'L007', user: 'สมชาย ผู้จัดการ', role: 'manager', action: 'delete', module: 'crm', detail: 'ลบ Lead ซ้ำ: ชัย ลูกค้าเก่า', ip: '192.168.1.5', date: addMins(120) },
  { id: 'L008', user: 'Admin', role: 'admin', action: 'update', module: 'settings', detail: 'แก้ไขสิทธิ์ Role: sales — เพิ่ม discount permission', ip: '192.168.1.2', date: addMins(180) },
  { id: 'L009', user: 'วิชัย ยอดขาย', role: 'sales', action: 'login', module: 'settings', detail: 'เข้าสู่ระบบจาก Chrome/Windows', ip: '192.168.1.10', date: addMins(200) },
  { id: 'L010', user: 'ปทิตา Marketing', role: 'staff', action: 'create', module: 'crm', detail: 'สร้าง Campaign: BYD Dolphin June Deal', ip: '192.168.1.15', date: addMins(240) },
]

export default async function UserActivityPage(container) {
  let logs = DEMO_LOGS.map(l => ({ ...l }))
  let actionFilter = 'all'
  let moduleFilter = 'all'
  let userFilter = ''

  function renderPage() {
    const users = [...new Set(logs.map(l => l.user))]
    let list = logs.filter(l => {
      if (actionFilter !== 'all' && l.action !== actionFilter) return false
      if (moduleFilter !== 'all' && l.module !== moduleFilter) return false
      if (userFilter && !l.user.toLowerCase().includes(userFilter.toLowerCase())) return false
      return true
    })

    const dangerousActions = logs.filter(l => ['delete','export','import'].includes(l.action)).length

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🔍 User Activity</div>
            <div class="page-subtitle">ล็อกกิจกรรมผู้ใช้งาน — ติดตามการเปลี่ยนแปลง</div>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('📋 กิจกรรมทั้งหมด', logs.length, 'primary')}
          ${kpi('⚠️ ความเสี่ยง', dangerousActions, dangerousActions > 0 ? 'warning' : 'secondary')}
          ${kpi('👤 ผู้ใช้งาน', users.length + ' คน', 'secondary')}
          ${kpi('🕐 ล่าสุด', timeAgo(logs[0]?.date), 'secondary')}
        </div>

        <!-- Filters -->
        <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;align-items:center">
          <input class="input" id="user-search" placeholder="🔍 ค้นหาผู้ใช้..." style="width:160px;height:28px;font-size:0.78rem" value="${userFilter}">
          <div style="display:flex;gap:4px;flex-wrap:wrap">
            <button class="btn btn-xs ${actionFilter==='all'?'btn-primary':'btn-secondary'} af-btn" data-a="all">ทั้งหมด</button>
            ${Object.entries(ACTION_TYPES).map(([k,v]) => `<button class="btn btn-xs ${actionFilter===k?'btn-'+v.color:'btn-secondary'} af-btn" data-a="${k}">${v.icon}</button>`).join('')}
          </div>
          <div style="display:flex;gap:4px;flex-wrap:wrap">
            <button class="btn btn-xs ${moduleFilter==='all'?'btn-primary':'btn-secondary'} mf-btn" data-m="all">ทุกโมดูล</button>
            ${Object.entries(MODULES).map(([k,v]) => `<button class="btn btn-xs ${moduleFilter===k?'btn-primary':'btn-secondary'} mf-btn" data-m="${k}">${v}</button>`).join('')}
          </div>
        </div>

        <div class="card" style="overflow:hidden">
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="border-bottom:1px solid var(--border);font-size:0.75rem;color:var(--text-muted)">
                <th style="padding:8px 14px;text-align:left">เวลา</th>
                <th style="padding:8px 14px;text-align:left">ผู้ใช้</th>
                <th style="padding:8px 10px;text-align:center">Action</th>
                <th style="padding:8px 10px;text-align:center">Module</th>
                <th style="padding:8px 14px;text-align:left">รายละเอียด</th>
                <th style="padding:8px 14px;text-align:center">IP</th>
              </tr>
            </thead>
            <tbody>
              ${list.map(l => {
                const at = ACTION_TYPES[l.action]
                const isDangerous = ['delete','export','import'].includes(l.action)
                return `<tr style="border-bottom:1px solid var(--border);${isDangerous?'background:rgba(239,68,68,0.03)':''}">
                  <td style="padding:8px 14px;font-size:0.75rem;color:var(--text-muted)">${timeAgo(l.date)}</td>
                  <td style="padding:8px 14px;font-size:0.82rem">
                    <div style="font-weight:600">${l.user}</div>
                    <div style="font-size:0.68rem;color:var(--text-muted)">${l.role}</div>
                  </td>
                  <td style="padding:8px 10px;text-align:center">
                    <span class="badge badge-${at?.color}" style="font-size:0.62rem">${at?.icon} ${at?.label}</span>
                  </td>
                  <td style="padding:8px 10px;text-align:center;font-size:0.75rem;color:var(--text-muted)">${MODULES[l.module]||l.module}</td>
                  <td style="padding:8px 14px;font-size:0.78rem;max-width:300px">${l.detail}</td>
                  <td style="padding:8px 14px;text-align:center;font-size:0.72rem;color:var(--text-muted)">${l.ip}</td>
                </tr>`
              }).join('')}
              ${!list.length ? `<tr><td colspan="6" style="padding:40px;text-align:center;color:var(--text-muted)">ไม่พบรายการ</td></tr>` : ''}
            </tbody>
          </table>
        </div>
      </div>
    `

    container.querySelectorAll('.af-btn').forEach(b => b.addEventListener('click', () => { actionFilter = b.dataset.a; renderPage() }))
    container.querySelectorAll('.mf-btn').forEach(b => b.addEventListener('click', () => { moduleFilter = b.dataset.m; renderPage() }))
    document.getElementById('user-search')?.addEventListener('input', e => { userFilter = e.target.value; renderPage() })
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
