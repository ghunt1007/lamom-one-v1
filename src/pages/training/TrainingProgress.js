/**
 * Training Progress — ติดตามความก้าวหน้าการฝึกอบรม
 * Route: /training/progress
 * ข้อมูลจริงมาจาก collection เดียวกับ /training/courses (TrainingCourse.js) — หน้านี้แค่พลิกมุมมอง
 * จาก "รายวิชา → ใครเรียน" เป็น "รายคน → เรียนอะไรไปแล้วบ้าง"
 */
import { formatDate } from '../../utils/format.js'
import { watchDocs } from '../../core/db.js'

function escHtml(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') }

const ENROLL_STATUS = {
  enrolled:    { label: 'ลงทะเบียน', color: 'secondary' },
  in_progress: { label: 'กำลังเรียน', color: 'primary' },
  completed:   { label: 'ผ่านแล้ว', color: 'success' },
  failed:      { label: 'ไม่ผ่าน', color: 'danger' },
}

export default async function TrainingProgressPage(container) {
  const myGen = container.__routerGen
  let courses = []

  container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`

  // Real-time: หน้านี้ไม่มีช่องค้นหา อัปเดตสดได้ทันทีไม่ต้องกันโฟกัส
  const unsubCourses = watchDocs('training_courses', [], 'startDate', 'asc', 200, rows => {
    if (container.__routerGen !== myGen) { unsubCourses(); return }
    courses = rows
    renderPage()
  })

  // พลิกมุมมองจาก "หลักสูตร → ผู้เรียน" เป็น "พนักงาน → หลักสูตรที่เรียน"
  function pivotByStaff() {
    const byStaff = {}
    courses.forEach(c => {
      (c.enrolled || []).forEach(e => {
        const key = `${e.name}|${e.dept || ''}`
        if (!byStaff[key]) byStaff[key] = { staffName: e.name, dept: e.dept || '-', courses: [] }
        byStaff[key].courses.push({
          name: c.title, status: e.status, score: e.score,
          passScore: c.passScore, startDate: c.startDate,
        })
      })
    })
    return Object.values(byStaff)
  }

  function renderPage() {
    const staffProgress = pivotByStaff()
    const allEnrollments = staffProgress.flatMap(s => s.courses)
    const completed = allEnrollments.filter(c => c.status === 'completed').length
    const failed = allEnrollments.filter(c => c.status === 'failed').length
    const scored = allEnrollments.filter(c => c.score != null)
    const avgScore = scored.length ? Math.round(scored.reduce((a, c) => a + c.score, 0) / scored.length) : null

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">📚 Training Progress</div>
            <div class="page-subtitle">ติดตามความก้าวหน้าการอบรมรายบุคคล — ข้อมูลจากการลงทะเบียนจริง</div>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('📋 การลงทะเบียนทั้งหมด', allEnrollments.length, 'primary')}
          ${kpi('✅ สำเร็จแล้ว', completed, 'success')}
          ${kpi('❌ ไม่ผ่าน', failed, failed > 0 ? 'danger' : 'secondary')}
          ${kpi('📊 คะแนนเฉลี่ย', avgScore != null ? avgScore + '%' : 'N/A', avgScore != null && avgScore >= 80 ? 'success' : 'warning')}
        </div>

        ${!staffProgress.length ? `<div class="empty-state" style="padding:48px"><div class="empty-icon">📚</div><div class="empty-title">ยังไม่มีการลงทะเบียนอบรม</div><div class="empty-desc">ลงทะเบียนพนักงานเข้าหลักสูตรได้ที่หน้า "หลักสูตรอบรม"</div></div>` : ''}

        <div style="display:flex;flex-direction:column;gap:14px">
          ${staffProgress.map(s => {
            const completedCount = s.courses.filter(c => c.status === 'completed').length
            const compPct = Math.round(completedCount / s.courses.length * 100)
            return `<div class="card" style="padding:14px">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
                <div>
                  <div style="font-weight:700">${escHtml(s.staffName)}</div>
                  <div style="font-size:0.75rem;color:var(--text-muted)">${escHtml(s.dept)}</div>
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
                  const cs = ENROLL_STATUS[c.status] || ENROLL_STATUS.enrolled
                  return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:var(--surface-2);border-radius:var(--radius-sm);font-size:0.82rem">
                    <div style="flex:1">
                      <div style="font-weight:500">${escHtml(c.name)}</div>
                      <div style="font-size:0.7rem;color:var(--text-muted)">วันที่จัด ${formatDate(c.startDate)}</div>
                    </div>
                    <div style="display:flex;gap:6px;align-items:center">
                      ${c.score != null ? `<span style="font-weight:700;color:${c.score >= (c.passScore || 80) ? 'var(--success)' : 'var(--danger)'}">${c.score}%</span>` : ''}
                      <span class="badge badge-${cs.color}" style="font-size:0.62rem">${cs.label}</span>
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

  return function cleanupTrainingProgress() { unsubCourses() }
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
