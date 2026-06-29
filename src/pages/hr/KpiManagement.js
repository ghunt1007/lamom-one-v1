import { formatCurrency } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { exportToExcel } from '../../utils/importExport.js'
import { listDocs, getCommissionData } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const KPI_PERIODS = ['2025-Q1', '2025-Q2', '2025-Q3', '2025-Q4']

const DEMO_STAFF = [
  { id:'S001', name:'วิชาญ มีโชค', dept:'sales', role:'Sales Executive' },
  { id:'S002', name:'อรนุช สายใจ', dept:'sales', role:'Sales Executive' },
  { id:'S003', name:'ธีรยุทธ เก่งกาจ', dept:'service', role:'Service Advisor' },
  { id:'S004', name:'พิมพ์ใจ ตั้งมั่น', dept:'service', role:'Technician' },
  { id:'S005', name:'นภา จิตดี', dept:'admin', role:'Admin' },
]

const KPI_TEMPLATES = {
  sales: [
    { id:'kpi_units', name:'ยอดขาย (คัน)', weight:40, unit:'คัน', target:5 },
    { id:'kpi_revenue', name:'ยอดรายได้', weight:30, unit:'บาท', target:5000000 },
    { id:'kpi_leads', name:'Lead ที่ดูแล', weight:15, unit:'ราย', target:30 },
    { id:'kpi_csat', name:'ความพึงพอใจลูกค้า', weight:15, unit:'คะแนน', target:4.5 },
  ],
  service: [
    { id:'kpi_jobs', name:'จำนวนงานที่ทำ', weight:35, unit:'งาน', target:40 },
    { id:'kpi_rework', name:'อัตรา Rework (ต่ำกว่า)', weight:25, unit:'%', target:5, lowerIsBetter: true },
    { id:'kpi_csat', name:'ความพึงพอใจลูกค้า', weight:25, unit:'คะแนน', target:4.5 },
    { id:'kpi_revenue', name:'รายได้งานซ่อม', weight:15, unit:'บาท', target:200000 },
  ],
  admin: [
    { id:'kpi_tasks', name:'งานที่เสร็จ', weight:40, unit:'งาน', target:30 },
    { id:'kpi_accuracy', name:'ความถูกต้อง', weight:35, unit:'%', target:99 },
    { id:'kpi_attend', name:'การมาทำงาน', weight:25, unit:'วัน', target:22 },
  ],
}

function generateActuals(template) {
  return template.map(k => ({
    ...k, actual: k.unit === 'คะแนน' ? +(Math.random() * 1.5 + 3.5).toFixed(1)
      : k.unit === '%' ? +(Math.random() * k.target * 1.5).toFixed(1)
      : Math.floor(Math.random() * k.target * 1.3),
  }))
}

function calcScore(kpis) {
  let total = 0
  kpis.forEach(k => {
    let pct
    if (k.lowerIsBetter) pct = k.actual === 0 ? 100 : Math.min(100, (k.target / k.actual) * 100)
    else pct = Math.min(100, (k.actual / k.target) * 100)
    total += pct * (k.weight / 100)
  })
  return Math.round(total)
}

function scoreLabel(score) {
  if (score >= 90) return { label: 'ยอดเยี่ยม ⭐', color: 'success' }
  if (score >= 75) return { label: 'ดีมาก', color: 'primary' }
  if (score >= 60) return { label: 'ผ่าน', color: 'warning' }
  return { label: 'ต้องปรับปรุง', color: 'danger' }
}

export default async function KpiManagementPage(container) {
  const myGen = container.__routerGen
  let period = '2025-Q2'
  let deptFilter = 'all'
  let tab = 'overview'

  let staff = DEMO_STAFF.map(s => ({ ...s }))
  let commissionMap = {}
  let dataSource = 'demo'

  try {
    const [staffDocs, coms] = await Promise.all([
      listDocs('staff', [], 'startDate', 'asc', 200).catch(() => []),
      getCommissionData().catch(() => []),
    ])
    if (container.__routerGen !== myGen) return

    if (staffDocs.length) {
      staff = staffDocs.map(s => ({
        id: s.id,
        name: ((s.firstName || '') + ' ' + (s.lastName || '')).trim() || s.name || 'พนักงาน',
        dept: s.dept === 'ฝ่ายขาย' ? 'sales' : s.dept === 'ฝ่ายบริการ' ? 'service' : 'admin',
        role: s.position || s.role || '',
      }))
      dataSource = 'live'
    }

    coms.forEach(c => {
      if (!c.salesName) return
      if (!commissionMap[c.salesName]) commissionMap[c.salesName] = { carsSold: 0, incomeTotal: 0 }
      commissionMap[c.salesName].carsSold += c.carsSold
      commissionMap[c.salesName].incomeTotal += c.incomeTotal
    })
  } catch {}

  // Generate KPI data per staff, overlay real commission data for sales
  const kpiData = {}
  staff.forEach(s => {
    kpiData[s.id] = {}
    KPI_PERIODS.forEach(p => {
      const template = KPI_TEMPLATES[s.dept] || KPI_TEMPLATES.admin
      const actuals = generateActuals(template)
      if (s.dept === 'sales') {
        const com = commissionMap[s.name]
        if (com) {
          actuals.forEach(k => {
            if (k.id === 'kpi_units')   k.actual = com.carsSold
            if (k.id === 'kpi_revenue') k.actual = com.incomeTotal
          })
        }
      }
      kpiData[s.id][p] = actuals
    })
  })

  function getFiltered() {
    let list = staff
    if (deptFilter !== 'all') list = list.filter(s => s.dept === deptFilter)
    return list
  }

  function renderPage() {
    const filtered = getFiltered()
    const scores = filtered.map(s => ({ ...s, kpis: kpiData[s.id][period], score: calcScore(kpiData[s.id][period]) })).sort((a, b) => b.score - a.score)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🎯 KPI Management</div>
            <div class="page-subtitle">การประเมินผลการปฏิบัติงาน</div>
          </div>
          <div class="page-actions">
            <select class="input" id="period-sel" style="width:140px">
              ${KPI_PERIODS.map(p => `<option value="${p}" ${period===p?'selected':''}>${p}</option>`).join('')}
            </select>
            <button class="btn btn-secondary" id="kpi-export">📥 Export</button>
          </div>
        </div>

        <!-- Dept filter -->
        <div style="display:flex;gap:4px;margin-bottom:16px">
          ${['all','sales','service','admin'].map(d => `<button class="btn btn-sm ${deptFilter===d?'btn-primary':'btn-secondary'} dept-btn" data-d="${d}">${{all:'ทั้งหมด',sales:'Sales',service:'Service',admin:'Admin'}[d]}</button>`).join('')}
        </div>

        <!-- Tabs -->
        <div style="display:flex;gap:4px;margin-bottom:16px">
          <button class="btn btn-sm ${tab==='overview'?'btn-primary':'btn-secondary'} tab-btn" data-t="overview">📊 Overview</button>
          <button class="btn btn-sm ${tab==='detail'?'btn-primary':'btn-secondary'} tab-btn" data-t="detail">📋 รายละเอียด</button>
        </div>

        ${tab === 'overview' ? renderOverview(scores) : renderDetail(scores)}
      </div>
    `

    document.getElementById('period-sel')?.addEventListener('change', e => { period = e.target.value; renderPage() })
    document.querySelectorAll('.dept-btn').forEach(b => b.addEventListener('click', () => { deptFilter = b.dataset.d; renderPage() }))
    document.querySelectorAll('.tab-btn').forEach(b => b.addEventListener('click', () => { tab = b.dataset.t; renderPage() }))
    document.getElementById('kpi-export')?.addEventListener('click', () => exportToExcel(scores.map(s => ({ พนักงาน:s.name, แผนก:s.dept, ไตรมาส:period, คะแนน:s.score })), 'KPI'))
    document.querySelectorAll('.staff-kpi-card').forEach(card => {
      card.addEventListener('click', () => {
        const s = scores.find(x => x.id === card.dataset.id)
        if (s) openKpiDetail(s)
      })
    })
  }

  function renderOverview(scores) {
    return `
      <!-- Leaderboard -->
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px">
        ${scores.map((s, i) => {
          const sl = scoreLabel(s.score)
          const medal = ['🥇','🥈','🥉'][i] || ''
          return `<div class="staff-kpi-card card" data-id="${s.id}" style="padding:16px;cursor:pointer">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
              <div style="width:36px;height:36px;border-radius:50%;background:var(--primary-dim);display:flex;align-items:center;justify-content:center;font-weight:700">${escHtml(s.name.charAt(0))}</div>
              <div>
                <div style="font-weight:700;font-size:0.88rem">${medal} ${escHtml(s.name)}</div>
                <div style="font-size:0.73rem;color:var(--text-muted)">${escHtml(s.role)}</div>
              </div>
            </div>
            <div style="text-align:center;margin-bottom:10px">
              <div style="font-size:2rem;font-weight:900;color:var(--${sl.color})">${s.score}</div>
              <div style="font-size:0.75rem;color:var(--text-muted)">คะแนนรวม</div>
              <span class="badge badge-${sl.color}">${sl.label}</span>
            </div>
            <!-- Mini KPI bars -->
            ${s.kpis.map(k => {
              const pct = k.lowerIsBetter ? (k.actual===0?100:Math.min(100,(k.target/k.actual)*100)) : Math.min(100,(k.actual/k.target)*100)
              return `<div style="margin-bottom:6px">
                <div style="display:flex;justify-content:space-between;font-size:0.68rem;color:var(--text-muted);margin-bottom:2px">
                  <span>${k.name}</span><span>${k.actual}/${k.target}</span>
                </div>
                <div style="height:4px;background:var(--surface-3);border-radius:99px"><div style="height:100%;width:${pct}%;background:${pct>=90?'var(--success)':pct>=60?'var(--warning)':'var(--danger)'};border-radius:99px"></div></div>
              </div>`
            }).join('')}
          </div>`
        }).join('')}
      </div>
    `
  }

  function renderDetail(scores) {
    return `
      <div class="card" style="padding:0;overflow:hidden">
        <table class="table">
          <thead>
            <tr>
              <th>พนักงาน</th>
              <th>แผนก</th>
              ${scores[0]?.kpis.map(k => `<th class="text-right" style="font-size:0.75rem">${k.name}<br><span style="color:var(--text-muted)">(${k.weight}%)</span></th>`).join('')||''}
              <th class="text-right">คะแนนรวม</th>
            </tr>
          </thead>
          <tbody>
            ${scores.map(s => {
              const sl = scoreLabel(s.score)
              return `<tr>
                <td style="font-weight:600;font-size:0.85rem">${escHtml(s.name)}</td>
                <td style="font-size:0.78rem">${escHtml(s.dept)}</td>
                ${s.kpis.map(k => {
                  const pct = k.lowerIsBetter ? (k.actual===0?100:Math.min(100,(k.target/k.actual)*100)) : Math.min(100,(k.actual/k.target)*100)
                  return `<td class="text-right" style="font-size:0.83rem;color:${pct>=90?'var(--success)':pct>=60?'inherit':'var(--danger)'}">${k.actual}<small style="color:var(--text-muted)">/${k.target}</small></td>`
                }).join('')}
                <td class="text-right"><span class="badge badge-${sl.color}">${s.score}</span></td>
              </tr>`
            }).join('')}
          </tbody>
        </table>
      </div>
    `
  }

  function openKpiDetail(s) {
    const sl = scoreLabel(s.score)
    openModal({
      title: '🎯 KPI: ' + escHtml(s.name) + ' — ' + escHtml(period), size: 'md',
      body: `<div style="display:flex;flex-direction:column;gap:12px">
        <div style="text-align:center;padding:16px;background:var(--surface-2);border-radius:var(--radius-md)">
          <div style="font-size:3rem;font-weight:900;color:var(--${sl.color})">${s.score}</div>
          <span class="badge badge-${sl.color}" style="font-size:0.8rem">${sl.label}</span>
        </div>
        ${s.kpis.map(k => {
          const pct = k.lowerIsBetter ? (k.actual===0?100:Math.min(100,(k.target/k.actual)*100)) : Math.min(100,(k.actual/k.target)*100)
          return `<div>
            <div style="display:flex;justify-content:space-between;font-size:0.85rem;margin-bottom:4px">
              <span>${k.name} <small style="color:var(--text-muted)">(น้ำหนัก ${k.weight}%)</small></span>
              <span style="font-weight:700">${k.actual} ${k.unit} / เป้า ${k.target}</span>
            </div>
            <div style="height:8px;background:var(--surface-3);border-radius:99px;overflow:hidden">
              <div style="height:100%;width:${pct}%;background:${pct>=90?'var(--success)':pct>=60?'var(--warning)':'var(--danger)'};border-radius:99px"></div>
            </div>
            <div style="font-size:0.72rem;color:var(--text-muted);margin-top:2px">ทำได้ ${pct.toFixed(1)}% ของเป้า</div>
          </div>`
        }).join('')}
      </div>`,
      footer: ''
    })
  }

  renderPage()
}
