import { listDocs, seedDemoData } from '../../core/db.js'
import { navigate } from '../../core/router.js'
import { formatCurrency } from '../../utils/format.js'

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

const DEMO_ALERTS = [
  { type: 'warning', msg: 'รออนุมัติใบลา 3 ใบ — สุดา, วิชัย, มานะ' },
  { type: 'info', msg: 'พนักงานทดลองงาน 2 คน ครบ 3 เดือนสัปดาห์หน้า' },
  { type: 'success', msg: 'จ่ายเงินเดือนเดือนนี้เสร็จแล้ว ✅' },
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
      <div style="display:flex;flex-direction:column;gap:7px;margin-bottom:20px">
        ${DEMO_ALERTS.map(a => `
          <div style="padding:9px 13px;background:var(--surface-2);border-left:3px solid var(--${a.type === 'warning' ? 'warning' : a.type === 'success' ? 'success' : 'primary'});border-radius:var(--radius-sm);font-size:0.8rem">
            ${a.type === 'warning' ? '⚠️' : a.type === 'success' ? '✅' : 'ℹ️'} ${a.msg}
          </div>`).join('')}
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

  let staff = []
  try { staff = await listDocs('staff', [], 'startDate', 'asc', 500) } catch {}

  if (container.__routerGen !== myGen) return

  const active = staff.filter(s => s.status === 'active').length
  const probation = staff.filter(s => s.status === 'probation').length
  const salaryTotal = staff.filter(s => s.status !== 'inactive').reduce((t, s) => t + (s.salary || 0), 0)
  const depts = new Set(staff.map(s => s.dept).filter(Boolean)).size

  const kpiEl = document.getElementById('hr-kpis')
  if (kpiEl) kpiEl.innerHTML = `
    ${kCard('✅', 'พนักงานประจำ', `${active} คน`, 'success', '/hr/staff')}
    ${kCard('⏳', 'ทดลองงาน', `${probation} คน`, 'warning', '/hr/staff')}
    ${kCard('💰', 'เงินเดือนรวม', formatCurrency(salaryTotal), 'accent', '/finance/payroll')}
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
