/**
 * Training Course Management
 * Route: /training/courses
 */
import { formatDate } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'

const COURSE_TYPES = {
  product:   { label: 'ความรู้รถ EV', color: 'primary', icon: '🚗' },
  sales:     { label: 'เทคนิคการขาย', color: 'success', icon: '🎯' },
  service:   { label: 'ช่างเทคนิค', color: 'warning', icon: '🔧' },
  soft:      { label: 'Soft Skills', color: 'secondary', icon: '🤝' },
  compliance:{ label: 'กฎหมาย/PDPA', color: 'danger', icon: '📋' },
  system:    { label: 'ระบบ IT', color: 'primary', icon: '💻' },
}

const ENROLL_STATUS = {
  enrolled:  { label: 'ลงทะเบียน', color: 'primary' },
  in_progress:{ label: 'กำลังเรียน', color: 'warning' },
  completed: { label: 'ผ่านแล้ว', color: 'success' },
  failed:    { label: 'ไม่ผ่าน', color: 'danger' },
}

function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }

const DEMO_COURSES = [
  { id: 'C001', title: 'BYD EV Technology Deep Dive', type: 'product', instructor: 'BYD Thailand',
    duration: '8 ชั่วโมง', format: 'Classroom', maxEnroll: 20,
    startDate: addDays(7), endDate: addDays(7), passScore: 80,
    enrolled: [
      { name: 'อรนุช สายใจ', dept: 'ฝ่ายขาย', score: null, status: 'enrolled' },
      { name: 'วิชาญ มีโชค', dept: 'ฝ่ายขาย', score: null, status: 'enrolled' },
    ],
    description: 'เรียนรู้เทคโนโลยี BYD Blade Battery, EV Powertrain, OTA Update' },
  { id: 'C002', title: 'Sales Technique & Negotiation', type: 'sales', instructor: 'อ.ธีรศักดิ์',
    duration: '6 ชั่วโมง', format: 'Workshop', maxEnroll: 15,
    startDate: addDays(-7), endDate: addDays(-7), passScore: 75,
    enrolled: [
      { name: 'อรนุช สายใจ', dept: 'ฝ่ายขาย', score: 88, status: 'completed' },
      { name: 'วิชาญ มีโชค', dept: 'ฝ่ายขาย', score: 72, status: 'failed' },
      { name: 'สมใจ รักรถ', dept: 'ฝ่ายขาย', score: 91, status: 'completed' },
    ],
    description: 'เทคนิคปิดการขาย การต่อรอง การจัดการ Objection' },
  { id: 'C003', title: 'EV Battery Diagnostics', type: 'service', instructor: 'ทีมช่าง BYD',
    duration: '16 ชั่วโมง', format: 'Hands-on Lab', maxEnroll: 8,
    startDate: addDays(14), endDate: addDays(15), passScore: 85,
    enrolled: [
      { name: 'วิชาญ ช่างซ่อม', dept: 'ศูนย์บริการ', score: null, status: 'enrolled' },
      { name: 'วิทยา ช่างไฟ', dept: 'ศูนย์บริการ', score: null, status: 'enrolled' },
    ],
    description: 'วิเคราะห์ปัญหาแบตเตอรี่ EV, ใช้ BYD Diagnostic Tool' },
  { id: 'C004', title: 'PDPA สำหรับธุรกิจรถยนต์', type: 'compliance', instructor: 'ที่ปรึกษากฎหมาย',
    duration: '3 ชั่วโมง', format: 'Online', maxEnroll: 50,
    startDate: addDays(-14), endDate: addDays(-14), passScore: 70,
    enrolled: [
      { name: 'ทุกคน', dept: 'All', score: 85, status: 'completed' },
    ],
    description: 'กฎหมาย PDPA, การจัดเก็บข้อมูลลูกค้า, สิทธิ์ข้อมูลส่วนบุคคล' },
]

export default async function TrainingCoursePage(container) {
  let typeFilter = 'all'
  let courses = DEMO_COURSES.map(c => ({ ...c, enrolled: c.enrolled.map(e => ({ ...e })) }))

  function renderPage() {
    const list = courses.filter(c => typeFilter === 'all' || c.type === typeFilter)
    const totalEnrolled = courses.reduce((a, c) => a + c.enrolled.length, 0)
    const completed = courses.reduce((a, c) => a + c.enrolled.filter(e => e.status === 'completed').length, 0)
    const upcoming = courses.filter(c => c.startDate >= addDays(0)).length

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🎓 หลักสูตรอบรม</div>
            <div class="page-subtitle">Training Course Management</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="add-course-btn">+ เพิ่มหลักสูตร</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('📚 หลักสูตรทั้งหมด', courses.length, 'primary')}
          ${kpi('📅 กำลังจะมา', upcoming, 'warning')}
          ${kpi('👥 ลงทะเบียนรวม', totalEnrolled, 'primary')}
          ${kpi('✅ ผ่านแล้ว', completed, 'success')}
        </div>

        <div style="display:flex;gap:4px;margin-bottom:12px;flex-wrap:wrap">
          <button class="btn btn-xs ${typeFilter==='all'?'btn-primary':'btn-secondary'} tf-btn" data-t="all">ทั้งหมด</button>
          ${Object.entries(COURSE_TYPES).map(([k,v]) => `<button class="btn btn-xs ${typeFilter===k?'btn-'+v.color:'btn-secondary'} tf-btn" data-t="${k}">${v.icon} ${v.label}</button>`).join('')}
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:14px">
          ${list.map(c => {
            const ct = COURSE_TYPES[c.type]
            const passCount = c.enrolled.filter(e => e.status === 'completed').length
            const isUpcoming = c.startDate >= addDays(0)
            return `<div class="card" style="padding:14px;border-top:3px solid var(--${ct?.color})">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
                <div style="font-size:1.2rem">${ct?.icon}</div>
                <span class="badge badge-${ct?.color}">${ct?.label}</span>
              </div>
              <div style="font-weight:700;font-size:0.88rem;margin-bottom:4px">${c.title}</div>
              <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:8px">${c.description}</div>
              <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;font-size:0.75rem">
                <span>👨‍🏫 ${c.instructor}</span>
                <span>⏱ ${c.duration}</span>
                <span>📅 ${formatDate(c.startDate)}</span>
                <span>🏫 ${c.format}</span>
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;font-size:0.78rem">
                <span>ผู้เรียน ${c.enrolled.length}/${c.maxEnroll}</span>
                <span style="color:var(--success)">ผ่าน ${passCount} คน</span>
              </div>
              <div style="background:var(--surface-2);border-radius:3px;height:5px;margin-bottom:10px">
                <div style="width:${Math.round(c.enrolled.length/c.maxEnroll*100)}%;background:var(--${ct?.color});height:5px;border-radius:3px"></div>
              </div>
              <div style="display:flex;gap:6px">
                <button class="btn btn-xs btn-secondary view-course-btn" data-id="${c.id}" style="flex:1">ดูรายละเอียด</button>
                ${isUpcoming ? `<button class="btn btn-xs btn-primary enroll-btn" data-id="${c.id}" style="flex:1">+ ลงทะเบียน</button>` : ''}
              </div>
            </div>`
          }).join('')}
        </div>
      </div>
    `

    container.querySelectorAll('.tf-btn').forEach(b => b.addEventListener('click', () => { typeFilter = b.dataset.t; renderPage() }))
    document.getElementById('add-course-btn')?.addEventListener('click', openAddCourse)
    container.querySelectorAll('.view-course-btn').forEach(b => b.addEventListener('click', () => {
      const c = courses.find(x => x.id === b.dataset.id); if (c) openCourseDetail(c)
    }))
    container.querySelectorAll('.enroll-btn').forEach(b => b.addEventListener('click', () => {
      const c = courses.find(x => x.id === b.dataset.id); if (c) openEnroll(c)
    }))
  }

  function openCourseDetail(c) {
    const ct = COURSE_TYPES[c.type]
    openModal({
      title: `🎓 ${c.title}`,
      size: 'lg',
      body: `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:12px">
          <div>
            ${row('ประเภท', `<span class="badge badge-${ct?.color}">${ct?.icon} ${ct?.label}</span>`)}
            ${row('วิทยากร', c.instructor)}${row('รูปแบบ', c.format)}
            ${row('ระยะเวลา', c.duration)}${row('วันที่', formatDate(c.startDate))}
            ${row('คะแนนผ่าน', c.passScore + '%')}
          </div>
          <div>
            <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);margin-bottom:6px">รายชื่อผู้เรียน</div>
            ${c.enrolled.map(e => {
              const es = ENROLL_STATUS[e.status]
              return `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);font-size:0.8rem">
                <span>${e.name} <span style="color:var(--text-muted);font-size:0.7rem">${e.dept}</span></span>
                <div style="display:flex;gap:6px;align-items:center">
                  ${e.score !== null ? `<span style="font-weight:700;color:var(--${e.score>=c.passScore?'success':'danger'})">${e.score}</span>` : ''}
                  <span class="badge badge-${es?.color}" style="font-size:0.62rem">${es?.label}</span>
                </div>
              </div>`
            }).join('')}
          </div>
        </div>
        <div style="padding:10px;background:var(--surface-2);border-radius:var(--radius-sm);font-size:0.82rem">📖 ${c.description}</div>
      `
    })
  }

  function openEnroll(c) {
    openModal({
      title: `+ ลงทะเบียน — ${c.title}`,
      size: 'sm',
      body: `
        <div class="input-group"><label class="input-label">ชื่อพนักงาน *</label><input class="input" id="enf-name" placeholder="ชื่อ-นามสกุล"></div>
        <div class="input-group" style="margin-top:10px"><label class="input-label">แผนก</label><input class="input" id="enf-dept" placeholder="ฝ่ายขาย / ศูนย์บริการ..."></div>
      `,
      confirmLabel: 'ลงทะเบียน',
      confirmClass: 'btn-primary',
      onConfirm() {
        const name = document.getElementById('enf-name')?.value?.trim()
        if (!name) { showToast('❗ กรุณากรอกชื่อ', 'error'); return }
        if (c.enrolled.length >= c.maxEnroll) { showToast('❗ เต็มจำนวนแล้ว', 'error'); return }
        c.enrolled.push({ name, dept: document.getElementById('enf-dept')?.value||'', score: null, status: 'enrolled' })
        showToast(`✅ ลงทะเบียน ${name} เรียบร้อย!`, 'success')
        renderPage()
      }
    })
  }

  function openAddCourse() {
    openModal({
      title: '+ เพิ่มหลักสูตร',
      size: 'md',
      body: `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="input-group" style="grid-column:1/-1"><label class="input-label">ชื่อหลักสูตร *</label><input class="input" id="cof-title" placeholder="ชื่อหลักสูตร"></div>
          <div class="input-group"><label class="input-label">ประเภท</label>
            <select class="input" id="cof-type">${Object.entries(COURSE_TYPES).map(([k,v]) => `<option value="${k}">${v.icon} ${v.label}</option>`).join('')}</select>
          </div>
          <div class="input-group"><label class="input-label">วิทยากร</label><input class="input" id="cof-inst" placeholder="ชื่อวิทยากร"></div>
          <div class="input-group"><label class="input-label">วันที่</label><input type="date" class="input" id="cof-date" value="${addDays(14)}"></div>
          <div class="input-group"><label class="input-label">ระยะเวลา</label><input class="input" id="cof-dur" placeholder="8 ชั่วโมง"></div>
          <div class="input-group"><label class="input-label">รูปแบบ</label>
            <select class="input" id="cof-format"><option>Classroom</option><option>Online</option><option>Workshop</option><option>Hands-on Lab</option></select>
          </div>
          <div class="input-group"><label class="input-label">จำนวนสูงสุด</label><input type="number" class="input" id="cof-max" value="20"></div>
          <div class="input-group"><label class="input-label">คะแนนผ่าน (%)</label><input type="number" class="input" id="cof-pass" value="80"></div>
        </div>
      `,
      onConfirm() {
        const title = document.getElementById('cof-title')?.value?.trim()
        if (!title) { showToast('❗ กรุณากรอกชื่อหลักสูตร', 'error'); return }
        courses.unshift({
          id: `C${String(courses.length+1).padStart(3,'0')}`, title,
          type: document.getElementById('cof-type')?.value||'product',
          instructor: document.getElementById('cof-inst')?.value||'',
          duration: document.getElementById('cof-dur')?.value||'',
          format: document.getElementById('cof-format')?.value||'Classroom',
          maxEnroll: +document.getElementById('cof-max')?.value||20,
          startDate: document.getElementById('cof-date')?.value||addDays(14),
          endDate: document.getElementById('cof-date')?.value||addDays(14),
          passScore: +document.getElementById('cof-pass')?.value||80,
          enrolled: [], description: ''
        })
        showToast('✅ เพิ่มหลักสูตรแล้ว!', 'success')
        renderPage()
      }
    })
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
function row(l, v) { return `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);font-size:0.82rem"><span style="color:var(--text-muted)">${l}</span><span>${v}</span></div>` }
