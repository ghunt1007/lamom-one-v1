import { listDocs, seedDemoData } from '../../core/db.js'
import { companyScopeFilters } from '../../core/companyScope.js'
import { navigate } from '../../core/router.js'
import { formatCurrency, todayBangkok } from '../../utils/format.js'
import { getState } from '../../core/store.js'

function escHtml(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }

const SALARY_VIEW_ROLES = ['owner', 'admin', 'manager', 'hr']

const QUICK_LINKS = [
  { icon:'👥', label:'พนักงาน', sub:'ข้อมูลพนักงานทั้งหมด', path:'/hr/staff', color:'primary' },
  { icon:'🏖', label:'ลาพนักงาน', sub:'อนุมัติ & ประวัติ', path:'/hr/leave', color:'warning' },
  { icon:'🕐', label:'Attendance', sub:'เวลาเข้า-ออก', path:'/hr/attendance', color:'accent' },
  { icon:'💳', label:'Payroll', sub:'เงินเดือนและโบนัส', path:'/finance/payroll', color:'success' },
  { icon:'🎯', label:'KPI', sub:'เป้าหมายพนักงาน', path:'/hr/kpi', color:'primary' },
  { icon:'👔', label:'Recruitment', sub:'สมัครงาน & สัมภาษณ์', path:'/hr/recruitment', color:'accent' },
  { icon:'📊', label:'Performance', sub:'ประเมินผลงาน', path:'/hr/performance', color:'warning' },
  { icon:'⏱', label:'Overtime', sub:'OT พนักงาน', path:'/hr/overtime', color:'danger' },
  { icon:'💸', label:'Expense Claims', sub:'เบิกค่าใช้จ่าย', path:'/hr/expense', color:'success' },
  { icon:'🎓', label:'Training', sub:'หลักสูตรและอบรม', path:'/training', color:'primary' },
  { icon:'📆', label:'Shift & Schedule', sub:'ตารางกะ', path:'/hr/shift', color:'accent' },
  { icon:'🏢', label:'Org Chart', sub:'โครงสร้างองค์กร', path:'/hr/orgchart', color:'primary' },
  { icon:'📝', label:'Performance Review', sub:'รีวิวประจำปี', path:'/hr/performance-review', color:'warning' },
  { icon:'🎉', label:'Onboarding', sub:'พนักงานใหม่', path:'/hr/onboarding', color:'success' },
  { icon:'💼', label:'Salary Scale', sub:'โครงสร้างเงินเดือน', path:'/hr/salary-scale', color:'accent' },
  { icon:'🧩', label:'Skill Matrix', sub:'ทักษะพนักงาน', path:'/hr/skills', color:'primary' },
]

export default async function HrDashboard(container) {
  const myGen = container.__routerGen
  seedDemoData()

  container.innerHTML = `
    <div class="page-content animate-slide">
      <div class="page-header">
        <div>
          <div class="page-title">👤 HR Dashboard</div>
          <div class="page-subtitle">บริหารทรัพยากรบุคคล</div>
        </div>
        <div class="page-actions">
          <button class="btn btn-primary btn-sm" data-nav="/hr/recruitment">+ รับสมัครงาน</button>
        </div>
      </div>

      <!-- KPI skeleton -->
      <div class="kpi-grid" id="hr-kpis" style="margin-bottom:20px">
        ${[...Array(4)].map(() => `<div class="skeleton" style="height:88px;border-radius:var(--radius-lg)"></div>`).join('')}
      </div>

      <!-- Alerts -->
      <div id="hr-alerts" style="display:flex;flex-direction:column;gap:7px;margin-bottom:20px">
        ${[...Array(2)].map(() => `<div class="skeleton" style="height:36px;border-radius:var(--radius-sm)"></div>`).join('')}
      </div>

      <!-- Quick links -->
      <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);margin-bottom:10px;text-transform:uppercase;letter-spacing:0.05em">เมนูหลัก HR</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(165px,1fr));gap:12px">
        ${QUICK_LINKS.map(q => `
          <div class="card card-lift" data-nav="${q.path}" style="padding:15px 16px;cursor:pointer;border-top:3px solid var(--${q.color})">
            <div style="font-size:1.6rem;margin-bottom:6px">${q.icon}</div>
            <div style="font-weight:700;font-size:0.86rem">${q.label}</div>
            <div style="font-size:0.71rem;color:var(--text-muted)">${q.sub}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `

  container.addEventListener('click', e => {
    const nav = e.target.closest('[data-nav]')
    if (nav) navigate(nav.dataset.nav)
  })

  if (container.__routerGen !== myGen) return

  let staff = [], leaves = [], payrollRecs = []
  const thisMonth = todayBangkok().slice(0, 7)
  try {
    ;[staff, leaves, payrollRecs] = await Promise.all([
      listDocs('staff', companyScopeFilters(), 'startDate', 'asc', 500).catch(() => []),
      listDocs('leave_requests', companyScopeFilters(), 'createdAt', 'desc', 200).catch(() => []),
      listDocs('payroll_records', [['month', '==', thisMonth]], 'createdAt', 'asc', 500).catch(() => []),
    ])
    // softDelete() ไม่ลบเอกสารจริง แค่ตั้ง deleted:true — กรองออกกันพนักงานที่ลบไปแล้วปนในสถิติ HR
    staff = staff.filter(x => !x.deleted)
  } catch {}

  if (container.__routerGen !== myGen) return

  // (v1.0.340) เดิม DEMO_ALERTS 3 ข้อความปลอมตายตัว (มีชื่อพนักงานสมมติปนอยู่ด้วย) ไม่เคยตรวจข้อมูลจริงเลย
  // แก้ให้ตรวจจริงจากข้อมูลที่โหลดมาแล้ว/เพิ่มโหลด leave_requests, payroll_records จริง — วิธีเดียวกับ
  // renderAlerts() ใน CrmDashboard.js
  const alertsEl = document.getElementById('hr-alerts')
  if (alertsEl) {
    const pendingLeaves = leaves.filter(l => l.status === 'pending')
    const now = new Date()
    const in7Days = new Date(); in7Days.setDate(in7Days.getDate() + 7)
    const endingProbation = staff.filter(s => {
      if (s.status !== 'probation' || !s.startDate) return false
      const endDate = new Date(s.startDate); endDate.setMonth(endDate.getMonth() + 3)
      return endDate >= now && endDate <= in7Days
    })
    const activeStaffCount = staff.filter(s => s.status !== 'inactive').length
    const paidThisMonth = payrollRecs.filter(r => r.status === 'paid').length
    const alerts = []
    if (pendingLeaves.length) {
      const names = escHtml(pendingLeaves.slice(0, 3).map(l => l.staff).join(', '))
      alerts.push({ type: 'warning', icon: '⚠️', nav: '/hr/leave', msg: `รออนุมัติใบลา ${pendingLeaves.length} ใบ — ${names}${pendingLeaves.length > 3 ? ` และอีก ${pendingLeaves.length - 3} คน` : ''}` })
    }
    if (endingProbation.length) alerts.push({ type: 'primary', icon: 'ℹ️', nav: '/hr/staff', msg: `พนักงานทดลองงาน ${endingProbation.length} คน ครบ 3 เดือนภายใน 7 วันนี้` })
    if (activeStaffCount > 0 && paidThisMonth >= activeStaffCount) alerts.push({ type: 'success', icon: '✅', nav: '/finance/payroll', msg: 'จ่ายเงินเดือนเดือนนี้เสร็จแล้ว' })
    alertsEl.innerHTML = alerts.length
      ? alerts.map(a => `<div data-nav="${a.nav}" style="padding:9px 13px;background:var(--surface-2);border-left:3px solid var(--${a.type});border-radius:var(--radius-sm);font-size:0.8rem;cursor:pointer">${a.icon} ${a.msg}</div>`).join('')
      : `<div style="padding:9px 13px;background:var(--surface-2);border-left:3px solid var(--success);border-radius:var(--radius-sm);font-size:0.8rem">✅ ไม่มีเรื่องด่วนตอนนี้</div>`
  }

  const active = staff.filter(s => s.status === 'active').length
  const probation = staff.filter(s => s.status === 'probation').length
  const depts = new Set(staff.map(s => s.dept).filter(Boolean)).size
  // เดิมแสดงยอดเงินเดือนรวมให้ทุกคนเห็นไม่ว่าตำแหน่งอะไร — จำกัดเฉพาะผู้บริหาร/ผู้จัดการ/HR เหมือนหน้า
  // Staff/Payroll ที่แก้ไปแล้ว
  const myRole = getState('role') || getState('user')?.role || 'staff'
  const canViewSalary = SALARY_VIEW_ROLES.includes(myRole)
  let salaryCard = ''
  if (canViewSalary) {
    // เงินเดือนย้ายไปเก็บที่ staff_salaries แยกต่างหากแล้ว (v1.0.303) — เอกสารเก่าที่ยังไม่ได้ย้ายข้อมูลออก
    // จะ fallback ไปใช้ค่าเดิมที่ฝังใน staff doc ต่อไป
    let salaryMap = {}
    try { salaryMap = Object.fromEntries((await listDocs('staff_salaries', [], 'updatedAt', 'desc', 500)).map(d => [d.id, d.salary])) } catch {}
    const salaryTotal = staff.filter(s => s.status !== 'inactive').reduce((t, s) => t + (salaryMap[s.id] != null ? salaryMap[s.id] : (s.salary || 0)), 0)
    salaryCard = kCard('💰', 'เงินเดือนรวม', formatCurrency(salaryTotal), 'accent', '/finance/payroll')
  }

  const kpiEl = document.getElementById('hr-kpis')
  if (kpiEl) kpiEl.innerHTML = `
    ${kCard('✅', 'พนักงานประจำ', `${active} คน`, 'success', '/hr/staff')}
    ${kCard('⏳', 'ทดลองงาน', `${probation} คน`, 'warning', '/hr/staff')}
    ${salaryCard}
    ${kCard('🏢', 'จำนวนแผนก', `${depts || '—'} แผนก`, 'primary', '/hr/orgchart')}
  `
}

function kCard(icon, label, value, color, nav) {
  return `
    <div class="card card-lift" data-nav="${nav}" style="padding:16px 18px;cursor:pointer;border-left:3px solid var(--${color})">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <span style="font-size:1.3rem">${icon}</span>
        <span style="font-size:${value.length > 10 ? '0.85rem' : '1.4rem'};font-weight:800;color:var(--${color})">${value}</span>
      </div>
      <div style="font-size:0.78rem;color:var(--text-muted)">${label}</div>
    </div>
  `
}
