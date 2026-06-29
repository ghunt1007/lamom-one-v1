/**
 * Training Progress — ติดตามความก้าวหน้าการฝึกอบรม
 * Route: /training/progress
 */
import { formatDate, formatCurrency } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'

const PROGRESS_STATUS = {
  not_started:{ label: 'ยังไม่เริ่ม', color: 'secondary' },
  in_progress:{ label: 'กำลังเรียน', color: 'primary' },
  completed:  { label: 'สำเร็จ', color: 'success' },
  failed:     { label: 'ไม่ผ่าน', color: 'danger' },
  overdue:    { label: 'เลยกำหนด', color: 'danger' },
}

function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }

const DEMO_PROGRESS = [
  {
    staffId: 'STF001', staffName: 'วิชัย ยอดขาย', avatar: '👨', dept: 'ฝ่ายขาย',
    courses: [
      { id: 'C001', name: 'BYD Product Knowledge 2025', status: 'completed', score: 92, dueDate: addDays(-30), completedDate: addDays(-45) },
      { id: 'C002', name: 'EV Sales Techniques', status: 'completed', score: 88, dueDate: addDays(-60), completedDate: addDays(-70) },
      { id: 'C003', name: 'PDPA for Sales Team', status: 'in_progress', score: null, dueDate: addDays(14), completedDate: null, progress: 65 },
    ]
  },
  {
    staffId: 'STF002', staffName: 'สุดา มาดี', avatar: '👩', dept: 'ฝ่ายขาย',
    courses: [
      { id: 'C001', name: 'BYD Product Knowledge 2025', status: 'completed', score: 85, dueDate: addDays(-30), completedDate: addDays(-35) },
      { id: 'C003', name: 'PDPA for Sales Team', status: 'not_started', score: null, dueDate: addDays(14), completedDate: null, progress: 0 },
      { id: 'C004', name: 'Customer Service Excellence', status: 'overdue', score: null, dueDate: addDays(-7), completedDate: null, progress: 20 },
    ]
  },
  {
    staffId: 'STF003', staffName: 'วิทยา ช่างดี', avatar: '🧑', dept: 'ศูนย์บริการ',
    courses: [
      { id: 'C005', name: 'BYD EV Certified Technician', status: 'completed', score: 95, dueDate: addDays(-90), completedDate: addDays(-100) },
      { id: 'C006', name: 'EV Battery Safety', status: 'completed', score: 91, dueDate: addDays(-60), completedDate: addDays(-65) },
      { id: 'C007', name: 'Advanced EV Diagnostic', status: 'in_progress', score: null, dueDate: addDays(30), completedDate: null, progress: 45 },
    ]
  },
]

export default async function TrainingProgressPage(container) {
  let staffProgress = DEMO_PROGRESS

  function renderPage() {
    const allCourses = staffProgress.flatMap(s => s.courses)
    const completed = allCourses.filter(c => c.status === 'completed').length
    const overdue = allCourses.filter(c => c.status === 'overdue').length
    const avgScore = Math.round(allCourses.filter(c => c.score !== null).reduce((a, c) => a + c.score, 0) / allCourses.filter(c => c.score !== null).length)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">📚 Training Progress</div>
            <div class="page-subtitle">ติดตามความก้าวหน้าการอบรมรายบุคคล</div>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('📋 Course ทั้งหมด', allCourses.length, 'primary')}
          ${kpi('✅ สำเร็จแล้ว', completed, 'success')}
          ${kpi('⚠️ เลยกำหนด', overdue, overdue > 0 ? 'danger' : 'secondary')}
          ${kpi('📊 คะแนนเฉลี่ย', avgScore + '%', avgScore >= 80 ? 'success' : 'warning')}
        </div>

        <div style="display:flex;flex-direction:column;gap:14px">
          ${staffProgress.map(s => {
            const completedCount = s.courses.filter(c => c.status === 'completed').length
            const compPct = Math.round(completedCount / s.courses.length * 100)
            const avgSc = s.courses.filter(c => c.score !== null).length
              ? Math.round(s.courses.filter(c => c.score !== null).reduce((a, c) => a + c.score, 0) / s.courses.filter(c => c.score !== null).length)
              : null
            return `<div class="card" style="padding:14px">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
                <div style="display:flex;gap:12px;align-items:center">
                  <div style="font-size:1.8rem">${s.avatar}</div>
                  <div>
                    <div style="font-weight:700">${s.staffName}</div>
                    <div style="font-size:0.75rem;color:var(--text-muted)">${s.dept}</div>
                  </div>
                </div>
                <div style="text-align:right">
                  <div style="font-weight:800;font-size:1.1rem;color:${compPct===100?'var(--success)':compPct>=50?'var(--primary)':'var(--warning)'}">${compPct}%</div>
                  <div style="font-size:0.72rem;color:var(--text-muted)">${completedCount}/${s.courses.length} Courses</div>
                </div>
              </div>
              <div style="background:var(--surface-2);border-radius:3px;height:6px;margin-bottom:12px">
                <div style="width:${compPct}%;background:${compPct===100?'var(--success)':compPct>=50?'var(--primary)':'var(--warning)'};height:6px;border-radius:3px"></div>
              </div>
              <div style="display:flex;flex-direction:column;gap:6px">
                ${s.courses.map(c => {
                  const cs = PROGRESS_STATUS[c.status]
                  return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:var(--surface-2);border-radius:var(--radius-sm);font-size:0.82rem">
                    <div style="flex:1">
                      <div style="font-weight:500">${c.name}</div>
                      <div style="font-size:0.7rem;color:var(--text-muted)">
                        กำหนด ${formatDate(c.dueDate)}
                        ${c.completedDate ? ' · สำเร็จ ' + formatDate(c.completedDate) : ''}
                        ${c.progress !== undefined && c.status === 'in_progress' ? ` · ${c.progress}%` : ''}
                      </div>
                    </div>
                    <div style="display:flex;gap:6px;align-items:center">
                      ${c.score !== null ? `<span style="font-weight:700;color:${c.score>=80?'var(--success)':'var(--warning)'}">${c.score}%</span>` : ''}
                      <span class="badge badge-${cs?.color}" style="font-size:0.62rem">${cs?.label}</span>
                    </div>
                  </div>`
                }).join('')}
              </div>
            </div>`
          }).join('')}
        </div>
      </div>
    `
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
