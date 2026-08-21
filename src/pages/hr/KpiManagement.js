import { formatCurrency } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { exportToExcel } from '../../utils/importExport.js'
import { listDocs, getCommissionData } from '../../core/db.js'
import { companyScopeFilters } from '../../core/companyScope.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// สร้างรายชื่อไตรมาสจากวันที่จริงปัจจุบัน (4 ไตรมาสล่าสุดจนถึงไตรมาสนี้) — เดิม hardcode ไว้แค่ปี 2025
// ทำให้เลือกไตรมาสปัจจุบันไม่ได้เลยเมื่อข้ามปี
function buildKpiPeriods() {
  const now = new Date()
  const q0 = Math.floor(now.getMonth() / 3)
  const periods = []
  for (let i = 3; i >= 0; i--) {
    const total = now.getFullYear() * 4 + q0 - i
    periods.push(`${Math.floor(total / 4)}-Q${(total % 4) + 1}`)
  }
  return periods
}
const KPI_PERIODS = buildKpiPeriods()

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

// ยังไม่มีแหล่งข้อมูลจริงสำหรับ KPI เหล่านี้ (นอกจากยอดขาย/รายได้ฝ่ายขายที่ดึงจากค่าคอมมิชชั่นจริงด้านล่าง)
// เดิมสุ่มตัวเลขด้วย Math.random() ทุกครั้งที่เปิดหน้า ทำให้คะแนนประเมินเปลี่ยนไปทุกครั้งที่ดู ไม่ใช่ของจริงเลย
// ตอนนี้ปล่อยเป็น null (ยังไม่มีข้อมูล) แทนการปลอมตัวเลขที่ดูสมจริง
function generateActuals(template) {
  return template.map(k => ({ ...k, actual: null }))
}

function kpiPct(k) {
  if (k.actual == null) return null
  if (k.lowerIsBetter) return k.actual === 0 ? 100 : Math.min(100, (k.target / k.actual) * 100)
  return Math.min(100, (k.actual / k.target) * 100)
}

function calcScore(kpis) {
  let total = 0, weightCovered = 0
  kpis.forEach(k => {
    const pct = kpiPct(k)
    if (pct == null) return
    total += pct * (k.weight / 100)
    weightCovered += k.weight
  })
  if (weightCovered === 0) return null
  return Math.round(total * (100 / weightCovered))
}

function scoreLabel(score) {
  if (score == null) return { label: 'ยังไม่มีข้อมูล', color: 'secondary' }
  if (score >= 90) return { label: 'ยอดเยี่ยม ⭐', color: 'success' }
  if (score >= 75) return { label: 'ดีมาก', color: 'primary' }
  if (score >= 60) return { label: 'ผ่าน', color: 'warning' }
  return { label: 'ต้องปรับปรุง', color: 'danger' }
}

export default async function KpiManagementPage(container) {
  const myGen = container.__routerGen
  let period = KPI_PERIODS[KPI_PERIODS.length - 1]
  let deptFilter = 'all'
  let tab = 'overview'

  let staff = []
  let commissionMap = {}

  try {
    const [staffDocs, coms] = await Promise.all([
      listDocs('staff', companyScopeFilters(), 'startDate', 'asc', 200).catch(() => []),
      getCommissionData().catch(() => []),
    ])
    if (container.__routerGen !== myGen) return

    staff = staffDocs.map(s => ({
      id: s.id,
      name: ((s.firstName || '') + ' ' + (s.lastName || '')).trim() || s.name || 'พนักงาน',
      dept: s.dept === 'ฝ่ายขาย' ? 'sales' : s.dept === 'ฝ่ายบริการ' ? 'service' : 'admin',
      role: s.position || s.role || '',
    }))

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
    const scores = filtered.map(s => ({ ...s, kpis: kpiData[s.id][period], score: calcScore(kpiData[s.id][period]) })).sort((a, b) => (b.score ?? -1) - (a.score ?? -1))

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
              <div style="font-size:2rem;font-weight:900;color:var(--${sl.color})">${s.score ?? "-"}</div>
              <div style="font-size:0.75rem;color:var(--text-muted)">คะแนนรวม</div>
              <span class="badge badge-${sl.color}">${sl.label}</span>
            </div>
            <!-- Mini KPI bars -->
            ${s.kpis.map(k => {
              const pct = kpiPct(k)
              return `<div style="margin-bottom:6px">
                <div style="display:flex;justify-content:space-between;font-size:0.68rem;color:var(--text-muted);margin-bottom:2px">
                  <span>${k.name}</span><span>${k.actual ?? 'ยังไม่มีข้อมูล'}${k.actual!=null?'/'+k.target:''}</span>
                </div>
                <div style="height:4px;background:var(--surface-3);border-radius:99px"><div style="height:100%;width:${pct ?? 0}%;background:${pct==null?'var(--surface-3)':pct>=90?'var(--success)':pct>=60?'var(--warning)':'var(--danger)'};border-radius:99px"></div></div>
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
        <div class="table-wrap"><table class="table">
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
                  const pct = kpiPct(k)
                  if (pct == null) return `<td class="text-right" style="font-size:0.83rem;color:var(--text-muted)">ยังไม่มีข้อมูล</td>`
                  return `<td class="text-right" style="font-size:0.83rem;color:${pct>=90?'var(--success)':pct>=60?'inherit':'var(--danger)'}">${k.actual}<small style="color:var(--text-muted)">/${k.target}</small></td>`
                }).join('')}
                <td class="text-right"><span class="badge badge-${sl.color}">${s.score ?? "-"}</span></td>
              </tr>`
            }).join('')}
          </tbody>
        </table></div>
      </div>
    `
  }

  function openKpiDetail(s) {
    const sl = scoreLabel(s.score)
    openModal({
      title: '🎯 KPI: ' + escHtml(s.name) + ' — ' + escHtml(period), size: 'md',
      body: `<div style="display:flex;flex-direction:column;gap:12px">
        <div style="text-align:center;padding:16px;background:var(--surface-2);border-radius:var(--radius-md)">
          <div style="font-size:3rem;font-weight:900;color:var(--${sl.color})">${s.score ?? "-"}</div>
          <span class="badge badge-${sl.color}" style="font-size:0.8rem">${sl.label}</span>
        </div>
        ${s.kpis.map(k => {
          const pct = kpiPct(k)
          return `<div>
            <div style="display:flex;justify-content:space-between;font-size:0.85rem;margin-bottom:4px">
              <span>${k.name} <small style="color:var(--text-muted)">(น้ำหนัก ${k.weight}%)</small></span>
              <span style="font-weight:700">${pct==null?'ยังไม่มีข้อมูล':`${k.actual} ${k.unit} / เป้า ${k.target}`}</span>
            </div>
            <div style="height:8px;background:var(--surface-3);border-radius:99px;overflow:hidden">
              <div style="height:100%;width:${pct ?? 0}%;background:${pct==null?'var(--surface-3)':pct>=90?'var(--success)':pct>=60?'var(--warning)':'var(--danger)'};border-radius:99px"></div>
            </div>
            ${pct!=null ? `<div style="font-size:0.72rem;color:var(--text-muted);margin-top:2px">ทำได้ ${pct.toFixed(1)}% ของเป้า</div>` : ''}
          </div>`
        }).join('')}
      </div>`,
      footer: ''
    })
  }

  renderPage()
}
