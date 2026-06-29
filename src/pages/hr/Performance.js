import { formatDate } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { exportToExcel } from '../../utils/importExport.js'
import { getCommissionData, listDocs } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const PERF_RATING = {
  5: { label: 'ดีเยี่ยม', color: 'success', icon: '⭐⭐⭐⭐⭐' },
  4: { label: 'ดีมาก', color: 'primary', icon: '⭐⭐⭐⭐' },
  3: { label: 'ดี', color: 'warning', icon: '⭐⭐⭐' },
  2: { label: 'พอใช้', color: 'secondary', icon: '⭐⭐' },
  1: { label: 'ต้องปรับปรุง', color: 'danger', icon: '⭐' },
}

const DEPARTMENTS_LIST = ['ฝ่ายขาย', 'ศูนย์บริการ', 'การเงิน', 'การตลาด', 'คลังสินค้า', 'HR', 'ผู้บริหาร']

const REVIEW_PERIODS = ['Q1/2025', 'Q2/2025', 'Q3/2025', 'Q4/2025', 'ประจำปี 2025']

const DEMO_EMPLOYEES = [
  { id: 'E001', name: 'อรนุช สายใจ', dept: 'ฝ่ายขาย', role: 'เซลส์', period: 'Q2/2025',
    kpiScore: 92, behaviorScore: 88, attendanceScore: 95, overallScore: 91.7, rating: 5,
    reviewer: 'ผู้จัดการขาย', reviewDate: '2025-06-01', goals: 'ปิดยอด 15 คัน/เดือน', nextGoals: 'เป้า 18 คัน/เดือน Q3',
    strengths: 'ทักษะการนำเสนอดีเยี่ยม ลูกค้าชอบมาก', improvements: 'ต้องพัฒนาการติดตามลูกค้าหลังการขาย',
    salary_adjustment: 8, bonus_multiplier: 1.5 },
  { id: 'E002', name: 'วิชาญ ช่างซ่อม', dept: 'ศูนย์บริการ', role: 'ช่างอาวุโส', period: 'Q2/2025',
    kpiScore: 85, behaviorScore: 90, attendanceScore: 100, overallScore: 87.5, rating: 4,
    reviewer: 'หัวหน้าช่าง', reviewDate: '2025-06-02', goals: 'จำนวนงาน 120 job/เดือน',
    nextGoals: 'เป้า 140 job/เดือน', strengths: 'แม่นยำ รวดเร็ว', improvements: 'ทักษะ EV Battery ต้องพัฒนา',
    salary_adjustment: 5, bonus_multiplier: 1.2 },
  { id: 'E003', name: 'นิภา บัญชีดี', dept: 'การเงิน', role: 'นักบัญชี', period: 'Q2/2025',
    kpiScore: 78, behaviorScore: 82, attendanceScore: 90, overallScore: 80.5, rating: 3,
    reviewer: 'CFO', reviewDate: '2025-06-03', goals: 'ปิดงบเดือนภายใน 5 วัน',
    nextGoals: 'ระบบ automated report', strengths: 'ละเอียดรอบคอบ', improvements: 'ความเร็วการทำงาน',
    salary_adjustment: 3, bonus_multiplier: 1.0 },
  { id: 'E004', name: 'สมชาย คลังสินค้า', dept: 'คลังสินค้า', role: 'คลังสินค้า', period: 'Q2/2025',
    kpiScore: 70, behaviorScore: 75, attendanceScore: 85, overallScore: 73.3, rating: 2,
    reviewer: 'ผู้จัดการ', reviewDate: '2025-06-04', goals: 'stock accuracy 99%',
    nextGoals: 'ใช้ระบบ Barcode scan ครบ', strengths: 'ขยันทำงาน', improvements: 'ความถูกต้องในการนับสต็อก',
    salary_adjustment: 2, bonus_multiplier: 0.8 },
]

export default async function PerformancePage(container) {
  const myGen = container.__routerGen
  let period = 'Q2/2025'
  let deptFilter = 'all'
  let employees = DEMO_EMPLOYEES.map(e => ({ ...e }))
  let dataSource = 'demo'

  try {
    const [coms, staff] = await Promise.all([
      getCommissionData().catch(() => []),
      listDocs('staff', [], 'name', 'asc', 200).catch(() => []),
    ])
    if (container.__routerGen !== myGen) return
    if (coms.length) {
      coms.forEach(com => {
        const emp = employees.find(e => e.name === com.salesName)
        if (emp) {
          emp.actual = com.carsSold
          emp.revenue = com.incomeTotal
          emp.kpiScore = Math.min(100, Math.round(com.carsSold / (emp.target || 8) * 100))
          emp.overallScore = Math.min(100, Math.round(
            emp.kpiScore * 0.5 +
            Math.min(100, Math.round(com.incomeTotal / (emp.revenueTarget || 8000000) * 100)) * 0.5
          ))
          emp._live = true
        }
      })
      dataSource = 'live'
    }
  } catch {}

  function filtered() {
    return employees.filter(e => {
      if (deptFilter !== 'all' && e.dept !== deptFilter) return false
      if (e.period !== period) return false
      return true
    })
  }

  function renderPage() {
    const list = filtered()
    const avgScore = list.length ? (list.reduce((a, e) => a + e.overallScore, 0) / list.length).toFixed(1) : 0
    const topPerformer = list.sort((a, b) => b.overallScore - a.overallScore)[0]

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🎯 Performance Review</div>
            <div class="page-subtitle">ประเมินผลการปฏิบัติงาน — ${period}${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ข้อมูลจริง</span>' : ''}</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="export-btn">📥 Export</button>
            <button class="btn btn-primary" id="add-review-btn">+ เพิ่มการประเมิน</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('👥 ประเมินแล้ว', list.length + ' คน', 'primary')}
          ${kpi('📊 คะแนนเฉลี่ย', avgScore + '/100', +avgScore >= 85 ? 'success' : +avgScore >= 70 ? 'warning' : 'danger')}
          ${kpi('⭐ Top Performer', escHtml(topPerformer?.name || '-'), 'success')}
          ${kpi('📅 งวด', period, 'secondary')}
        </div>

        <!-- Filters -->
        <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;align-items:center">
          <select class="input" id="period-sel" style="max-width:160px">
            ${REVIEW_PERIODS.map(p => `<option ${p===period?'selected':''}>${p}</option>`).join('')}
          </select>
          <select class="input" id="dept-sel" style="max-width:160px">
            <option value="all">ทุกแผนก</option>
            ${DEPARTMENTS_LIST.map(d => `<option value="${d}" ${deptFilter===d?'selected':''}>${d}</option>`).join('')}
          </select>
        </div>

        <!-- Employee Cards -->
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px;margin-bottom:16px">
          ${list.map(e => {
            const pr = PERF_RATING[e.rating]
            return `<div class="card" style="padding:14px;cursor:pointer;border-left:3px solid var(--${pr?.color})" data-id="${e.id}" onclick="document.querySelector('[data-id=\'${e.id}\']')?.dispatchEvent(new CustomEvent('open-detail', {bubbles:true}))">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
                <div>
                  <div style="font-weight:700;font-size:0.9rem">${escHtml(e.name)}</div>
                  <div style="font-size:0.75rem;color:var(--text-muted)">${escHtml(e.dept)} · ${escHtml(e.role)}</div>
                </div>
                <span class="badge badge-${pr?.color}">${pr?.label}</span>
              </div>
              <!-- Score bars -->
              ${[['KPI', e.kpiScore, 'primary'],['พฤติกรรม', e.behaviorScore, 'success'],['การเข้างาน', e.attendanceScore, 'warning']].map(([l,s,c]) => `
                <div style="margin-bottom:5px">
                  <div style="display:flex;justify-content:space-between;font-size:0.73rem;margin-bottom:2px">
                    <span style="color:var(--text-muted)">${l}</span><span style="font-weight:700">${s}</span>
                  </div>
                  <div style="background:var(--surface-2);border-radius:3px;height:5px">
                    <div style="width:${s}%;background:var(--${c});height:5px;border-radius:3px"></div>
                  </div>
                </div>
              `).join('')}
              <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px">
                <div style="font-size:1.1rem;font-weight:800;color:var(--${pr?.color})">${e.overallScore.toFixed(1)}<span style="font-size:0.7rem;font-weight:400;color:var(--text-muted)">/100</span></div>
                <div style="font-size:0.75rem">${pr?.icon}</div>
              </div>
            </div>`
          }).join('')}
          ${!list.length ? `<div class="empty-state" style="grid-column:1/-1"><div class="empty-state-icon">📊</div><div>ไม่พบข้อมูลการประเมิน</div></div>` : ''}
        </div>

        <!-- Summary table -->
        <div class="card" style="padding:0;overflow:hidden">
          <table class="table">
            <thead><tr><th>พนักงาน</th><th>แผนก</th><th>KPI</th><th>พฤติกรรม</th><th>เข้างาน</th><th>รวม</th><th>ระดับ</th><th>ปรับเงินเดือน</th><th></th></tr></thead>
            <tbody>
              ${list.map(e => {
                const pr = PERF_RATING[e.rating]
                return `<tr>
                  <td style="font-weight:600;font-size:0.85rem">${escHtml(e.name)}</td>
                  <td style="font-size:0.82rem">${escHtml(e.dept)}</td>
                  <td class="text-right"><span style="color:${e.kpiScore>=90?'var(--success)':e.kpiScore>=70?'var(--warning)':'var(--danger)'}">${e.kpiScore}</span></td>
                  <td class="text-right">${e.behaviorScore}</td>
                  <td class="text-right">${e.attendanceScore}</td>
                  <td class="text-right" style="font-weight:800;color:var(--${pr?.color})">${e.overallScore.toFixed(1)}</td>
                  <td><span class="badge badge-${pr?.color}">${pr?.label}</span></td>
                  <td class="text-right" style="color:var(--success);font-weight:700">+${e.salary_adjustment}%</td>
                  <td><button class="btn btn-xs btn-secondary open-review-btn" data-id="${e.id}">ดู</button></td>
                </tr>`
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `

    document.getElementById('period-sel')?.addEventListener('change', e => { period = e.target.value; renderPage() })
    document.getElementById('dept-sel')?.addEventListener('change', e => { deptFilter = e.target.value; renderPage() })
    document.getElementById('add-review-btn')?.addEventListener('click', openAddForm)
    document.getElementById('export-btn')?.addEventListener('click', () => {
      exportToExcel(list.map(e => ({ ชื่อ: e.name, แผนก: e.dept, KPI: e.kpiScore, พฤติกรรม: e.behaviorScore, เข้างาน: e.attendanceScore, รวม: e.overallScore, ระดับ: PERF_RATING[e.rating]?.label, ปรับเงินเดือน: e.salary_adjustment + '%' })), 'performance_review')
      showToast('📥 Export แล้ว!', 'success')
    })
    container.querySelectorAll('.open-review-btn').forEach(b => b.addEventListener('click', () => {
      const e = employees.find(x => x.id === b.dataset.id); if (e) openDetail(e)
    }))
  }

  function openDetail(e) {
    const pr = PERF_RATING[e.rating]
    openModal({
      title: '📊 ' + escHtml(e.name) + ' — ' + escHtml(e.period),
      size: 'lg',
      body: `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <div>
            <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);margin-bottom:8px">ข้อมูลทั่วไป</div>
            ${row('แผนก', escHtml(e.dept))}${row('ตำแหน่ง', escHtml(e.role))}${row('งวด', escHtml(e.period))}${row('ผู้ประเมิน', escHtml(e.reviewer))}${row('วันที่ประเมิน', formatDate(e.reviewDate))}
          </div>
          <div style="text-align:center;padding:16px;background:var(--surface-2);border-radius:var(--radius)">
            <div style="font-size:3rem;font-weight:900;color:var(--${pr?.color})">${e.overallScore.toFixed(1)}</div>
            <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:4px">คะแนนรวม / 100</div>
            <span class="badge badge-${pr?.color}" style="font-size:0.8rem">${pr?.label}</span>
            <div style="margin-top:8px;font-size:1.2rem">${pr?.icon}</div>
          </div>
        </div>

        <div style="margin-top:14px;display:grid;grid-template-columns:repeat(3,1fr);gap:12px">
          ${kpi('🎯 KPI', e.kpiScore, e.kpiScore >= 90 ? 'success' : 'warning')}
          ${kpi('🤝 พฤติกรรม', e.behaviorScore, 'primary')}
          ${kpi('⏰ เข้างาน', e.attendanceScore, 'success')}
        </div>

        <div style="margin-top:14px;display:grid;grid-template-columns:1fr 1fr;gap:14px">
          <div>
            <div style="font-size:0.78rem;font-weight:700;margin-bottom:6px">💪 จุดแข็ง</div>
            <div style="font-size:0.83rem;padding:10px;background:rgba(34,197,94,.1);border-radius:var(--radius-sm);color:var(--success)">${escHtml(e.strengths)}</div>
          </div>
          <div>
            <div style="font-size:0.78rem;font-weight:700;margin-bottom:6px">📈 จุดที่ต้องพัฒนา</div>
            <div style="font-size:0.83rem;padding:10px;background:rgba(245,158,11,.1);border-radius:var(--radius-sm);color:var(--warning)">${escHtml(e.improvements)}</div>
          </div>
        </div>

        <div style="margin-top:14px;display:grid;grid-template-columns:1fr 1fr;gap:14px">
          <div>
            <div style="font-size:0.78rem;font-weight:700;margin-bottom:6px">🎯 เป้าหมายงวดนี้</div>
            <div style="font-size:0.83rem;color:var(--text-muted)">${escHtml(e.goals)}</div>
          </div>
          <div>
            <div style="font-size:0.78rem;font-weight:700;margin-bottom:6px">🚀 เป้าหมายงวดหน้า</div>
            <div style="font-size:0.83rem;color:var(--text-muted)">${escHtml(e.nextGoals)}</div>
          </div>
        </div>

        <div style="margin-top:14px;padding:12px;background:var(--surface-2);border-radius:var(--radius-sm);display:flex;justify-content:space-between">
          <span style="font-size:0.83rem">💰 ปรับเงินเดือน</span>
          <strong style="color:var(--success)">+${e.salary_adjustment}%</strong>
          <span style="font-size:0.83rem;margin-left:16px">🎁 Bonus Multiplier</span>
          <strong style="color:var(--primary)">${e.bonus_multiplier}x</strong>
        </div>
      `
    })
  }

  function openAddForm() {
    openModal({
      title: '+ เพิ่มการประเมิน',
      size: 'md',
      body: `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="input-group"><label class="input-label">ชื่อพนักงาน *</label><input class="input" id="prf-name" placeholder="ชื่อ-นามสกุล"></div>
          <div class="input-group"><label class="input-label">แผนก</label><select class="input" id="prf-dept">${DEPARTMENTS_LIST.map(d => `<option>${d}</option>`).join('')}</select></div>
          <div class="input-group"><label class="input-label">ตำแหน่ง</label><input class="input" id="prf-role" placeholder="เซลส์ / ช่าง / บัญชี..."></div>
          <div class="input-group"><label class="input-label">งวดการประเมิน</label><select class="input" id="prf-period">${REVIEW_PERIODS.map(p => `<option ${p===period?'selected':''}>${p}</option>`).join('')}</select></div>
          ${[['prf-kpi','🎯 คะแนน KPI (0-100)'],['prf-beh','🤝 คะแนนพฤติกรรม (0-100)'],['prf-att','⏰ คะแนนเข้างาน (0-100)']].map(([id,l]) => `<div class="input-group"><label class="input-label">${l}</label><input type="number" class="input" id="${id}" min="0" max="100" value="80"></div>`).join('')}
        </div>
      `,
      onConfirm() {
        const name = document.getElementById('prf-name')?.value?.trim()
        if (!name) { showToast('❗ กรุณากรอกชื่อพนักงาน', 'error'); return }
        const kpi = +document.getElementById('prf-kpi')?.value || 80
        const beh = +document.getElementById('prf-beh')?.value || 80
        const att = +document.getElementById('prf-att')?.value || 80
        const overall = (kpi * 0.5 + beh * 0.3 + att * 0.2)
        const rating = overall >= 90 ? 5 : overall >= 80 ? 4 : overall >= 70 ? 3 : overall >= 60 ? 2 : 1
        employees.push({
          id: `E${String(employees.length+1).padStart(3,'0')}`, name,
          dept: document.getElementById('prf-dept')?.value||'ฝ่ายขาย',
          role: document.getElementById('prf-role')?.value||'',
          period: document.getElementById('prf-period')?.value||period,
          kpiScore: kpi, behaviorScore: beh, attendanceScore: att, overallScore: overall, rating,
          reviewer: 'ผู้จัดการ', reviewDate: new Date().toISOString().slice(0,10),
          goals: '', nextGoals: '', strengths: '', improvements: '',
          salary_adjustment: Math.round(overall / 20), bonus_multiplier: 1.0
        })
        showToast('✅ บันทึกการประเมินแล้ว!', 'success')
        renderPage()
      }
    })
  }

  renderPage()
  container.addEventListener('open-detail', e => {
    const card = e.target.closest('[data-id]')
    if (card) { const emp = employees.find(x => x.id === card.dataset.id); if (emp) openDetail(emp) }
  })
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
function row(l, v) { return `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);font-size:0.82rem"><span style="color:var(--text-muted)">${l}</span><span>${v}</span></div>` }
