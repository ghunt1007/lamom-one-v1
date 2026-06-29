import { showToast } from '../../core/store.js'
import { openModal } from '../../utils/modal.js'

const COURSES = [
  {
    id:'C1', title:'Product Knowledge — BYD 2025', category:'ผลิตภัณฑ์',
    duration:'3 ชม.', enrolled:8, completed:5, required:true,
    desc:'สเปค ราคา จุดขาย BYD Seal/Atto 3/Dolphin/Atto3/Han',
    quiz: [
      { q:'BYD Seal AWD มีระยะทาง CLTC เท่าไหร่?', opts:['480 กม.','580 กม.','620 กม.','520 กม.'], ans:1 },
      { q:'ประกันแบตเตอรี่ BYD นานกี่ปี?', opts:['5 ปี','6 ปี','8 ปี','10 ปี'], ans:2 },
      { q:'BYD Seal มาจาก Platform อะไร?', opts:['e-Platform 2.0','e-Platform 3.0','EV3','MEB'], ans:1 },
    ]
  },
  {
    id:'C2', title:'Sales Technique Advanced', category:'การขาย',
    duration:'5 ชม.', enrolled:6, completed:3, required:true,
    desc:'เทคนิคปิดดีล EV การ Handle Objection ไฟแนนซ์',
    quiz: [
      { q:'ขั้นตอนแรกในการปิดดีลคืออะไร?', opts:['เสนอราคา','สร้างความต้องการ','Test Drive','ยื่นไฟแนนซ์'], ans:1 },
      { q:'เมื่อลูกค้าบอก "แพงไป" ควรทำอย่างไร?', opts:['ลดราคา','เสนอ Trade-in','แสดง Value','โปรโมชั่น'], ans:2 },
    ]
  },
  {
    id:'C3', title:'EV Technology Fundamentals', category:'เทคนิค',
    duration:'4 ชม.', enrolled:4, completed:4, required:false,
    desc:'หลักการ EV แบตเตอรี่ Motor การชาร์จ HV Safety',
    quiz: [
      { q:'แบตเตอรี่ LFP มีข้อดีหลักอะไร?', opts:['Energy Density สูง','อายุยาว/ปลอดภัย','ราคาถูกที่สุด','ชาร์จเร็ว'], ans:1 },
      { q:'ช่วงแรงดันไฟ HV ของ EV ส่วนใหญ่คือเท่าไหร่?', opts:['12-24V','48V','200-800V','1000V+'], ans:2 },
    ]
  },
  {
    id:'C4', title:'Customer Service Excellence', category:'บริการ',
    duration:'2 ชม.', enrolled:10, completed:8, required:true,
    desc:'การต้อนรับลูกค้า Communication Skills After-Service',
    quiz: [
      { q:'NPS (Net Promoter Score) วัดอะไร?', opts:['ความพอใจ','ความภักดี','การแนะนำต่อ','ทั้ง ข และ ค'], ans:3 },
    ]
  },
  {
    id:'C5', title:'LAMOM ONE System Usage', category:'ระบบ',
    duration:'1 ชม.', enrolled:12, completed:11, required:true,
    desc:'การใช้งานระบบ LAMOM ONE ทุก Module',
    quiz: [
      { q:'Demo Mode ใช้ Database แบบไหน?', opts:['Firebase','LocalStorage','In-Memory demoStore','IndexedDB'], ans:2 },
    ]
  },
]

const SOP_LIST = [
  { id:'S1', title:'SOP-001: กระบวนการรับลูกค้าเข้าโชว์รูม', dept:'ขาย', version:'1.2', updated:'2025-05-01' },
  { id:'S2', title:'SOP-002: การจอง-ส่งมอบรถ', dept:'ขาย', version:'2.0', updated:'2025-05-15' },
  { id:'S3', title:'SOP-003: PDI Checklist ก่อนส่งมอบ', dept:'โชว์รูม', version:'1.5', updated:'2025-04-20' },
  { id:'S4', title:'SOP-004: รับรถซ่อมเข้า Workshop', dept:'บริการ', version:'1.1', updated:'2025-03-10' },
  { id:'S5', title:'SOP-005: EV High Voltage Safety', dept:'บริการ', version:'3.0', updated:'2025-06-01' },
  { id:'S6', title:'SOP-006: คืนรถลูกค้าหลังซ่อม', dept:'บริการ', version:'1.0', updated:'2025-02-28' },
]

export default async function TrainingDashboard(container) {
  let activeTab = 'courses' // courses | sop | quiz
  let userProgress; try { userProgress = JSON.parse(localStorage.getItem('lamom-training') || '{}') } catch { userProgress = {} }
  let activeQuiz = null
  let quizState = { answers: {}, submitted: false }

  function saveProgress() { try { localStorage.setItem('lamom-training', JSON.stringify(userProgress)) } catch {} }

  function renderPage() {
    const completedCount = COURSES.filter(c => userProgress[c.id]?.completed).length
    const totalCourses = COURSES.length

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🎓 Training & Knowledge</div>
            <div class="page-subtitle">E-Learning · Quiz · SOP · Certification</div>
          </div>
          <div class="page-actions">
            <span class="badge badge-${completedCount===totalCourses?'success':'primary'}">✅ ผ่านแล้ว ${completedCount}/${totalCourses}</span>
          </div>
        </div>

        <!-- KPI -->
        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:20px">
          ${kpi('📚 คอร์สทั้งหมด', totalCourses, 'primary')}
          ${kpi('✅ ผ่านแล้ว', completedCount, 'success')}
          ${kpi('📋 SOP Documents', SOP_LIST.length, 'accent')}
          ${kpi('🏆 Certifications', completedCount, completedCount > 0 ? 'warning' : 'secondary')}
        </div>

        <!-- Tabs -->
        <div style="display:flex;gap:4px;margin-bottom:16px">
          ${[['courses','📚 คอร์สเรียน'],['sop','📋 SOP'],['quiz','🧠 Quiz ล่าสุด']].map(([t,l]) =>
            `<button class="btn btn-sm ${activeTab===t?'btn-primary':'btn-secondary'} tr-tab" data-t="${t}">${l}</button>`
          ).join('')}
        </div>

        <div id="tr-content">${renderTab()}</div>
      </div>
    `

    document.querySelectorAll('.tr-tab').forEach(btn => { btn.addEventListener('click', () => { activeTab = btn.dataset.t; renderPage() }) })
    bindTabEvents()
  }

  function renderTab() {
    if (activeTab === 'courses') return renderCourses()
    if (activeTab === 'sop') return renderSOP()
    if (activeTab === 'quiz') return renderQuizList()
    return ''
  }

  function renderCourses() {
    return `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px">
        ${COURSES.map(c => {
          const prog = userProgress[c.id] || {}
          const pct = Math.round(c.completed / c.enrolled * 100)
          const myDone = prog.completed
          return `<div class="card" style="padding:16px;${myDone?'border:1px solid var(--success)':''}">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
              <div>
                <div style="font-weight:700;margin-bottom:3px">${c.title}</div>
                <div style="font-size:0.75rem;color:var(--text-muted)">${c.category} · ${c.duration}</div>
              </div>
              <div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px">
                ${c.required ? `<span class="badge badge-danger" style="font-size:0.65rem">บังคับ</span>` : ''}
                ${myDone ? `<span class="badge badge-success" style="font-size:0.65rem">✅ ผ่าน</span>` : ''}
              </div>
            </div>
            <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:12px">${c.desc}</div>
            <div style="margin-bottom:12px">
              <div style="display:flex;justify-content:space-between;font-size:0.75rem;margin-bottom:4px">
                <span>ผ่านแล้ว ${c.completed}/${c.enrolled} คน</span><span>${pct}%</span>
              </div>
              <div style="background:var(--surface-3);border-radius:99px;height:6px;overflow:hidden">
                <div style="height:100%;width:${pct}%;background:var(--${myDone?'success':'primary'});border-radius:99px"></div>
              </div>
            </div>
            <div style="display:flex;gap:6px">
              <button class="btn btn-${myDone?'secondary':'primary'} btn-sm take-quiz-btn" data-id="${c.id}" style="flex:1">
                ${myDone ? '🔄 ทำซ้ำ' : '▶ เริ่มเรียน/ทำ Quiz'}
              </button>
              ${myDone ? `<button class="btn btn-success btn-sm get-cert-btn" data-id="${c.id}">🎓 Certificate</button>` : ''}
            </div>
          </div>`
        }).join('')}
      </div>
    `
  }

  function renderSOP() {
    return `
      <div class="card" style="padding:0;overflow:hidden">
        <table class="table">
          <thead><tr><th>Document</th><th>แผนก</th><th>Version</th><th>อัพเดต</th><th></th></tr></thead>
          <tbody>
            ${SOP_LIST.map(s => `<tr>
              <td style="font-weight:600">${s.title}</td>
              <td><span class="badge badge-primary">${s.dept}</span></td>
              <td style="font-size:0.8rem;color:var(--text-muted)">v${s.version}</td>
              <td style="font-size:0.8rem;color:var(--text-muted)">${s.updated}</td>
              <td>
                <button class="btn btn-secondary btn-sm view-sop-btn" data-id="${s.id}">📖 ดู</button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    `
  }

  function renderQuizList() {
    return `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px">
        ${COURSES.filter(c => c.quiz?.length).map(c => {
          const prog = userProgress[c.id] || {}
          const score = prog.score
          return `<div class="card" style="padding:16px">
            <div style="font-weight:700;margin-bottom:4px">${c.title}</div>
            <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:12px">${c.quiz.length} ข้อ · ${c.category}</div>
            ${score != null ? `<div style="font-size:0.88rem;margin-bottom:12px">คะแนนล่าสุด: <strong style="color:var(--${score>=70?'success':'warning'})">${score}%</strong></div>` : ''}
            <button class="btn btn-primary btn-sm take-quiz-btn" data-id="${c.id}" style="width:100%">🧠 ทำ Quiz</button>
          </div>`
        }).join('')}
      </div>
    `
  }

  function bindTabEvents() {
    document.querySelectorAll('.take-quiz-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const course = COURSES.find(c => c.id === btn.dataset.id)
        if (course?.quiz?.length) openQuizModal(course)
      })
    })
    document.querySelectorAll('.get-cert-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const course = COURSES.find(c => c.id === btn.dataset.id)
        openCertModal(course)
      })
    })
    document.querySelectorAll('.view-sop-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const sop = SOP_LIST.find(s => s.id === btn.dataset.id)
        openSOPModal(sop)
      })
    })
  }

  function openQuizModal(course) {
    let answers = {}
    let submitted = false
    const { el, close } = openModal({
      title: `🧠 Quiz — ${course.title}`, size: 'lg',
      body: renderQuizBody(course, answers, submitted),
      footer: `<button class="btn btn-secondary" id="qz-close">ปิด</button><button class="btn btn-primary" id="qz-submit">✅ ส่งคำตอบ</button>`
    })

    function renderQuizBody(course, ans, sub) {
      return `<div style="display:flex;flex-direction:column;gap:20px">
        ${course.quiz.map((q, qi) => `
          <div>
            <div style="font-weight:600;margin-bottom:10px">${qi + 1}. ${q.q}</div>
            <div style="display:flex;flex-direction:column;gap:6px">
              ${q.opts.map((o, oi) => {
                let color = 'var(--surface-2)'
                let icon = ''
                if (sub) {
                  if (oi === q.ans) { color = 'var(--success-dim)'; icon = ' ✅' }
                  else if (ans[qi] === oi && oi !== q.ans) { color = 'var(--danger-dim)'; icon = ' ❌' }
                }
                return `<label style="display:flex;align-items:center;gap:8px;padding:10px;background:${sub&&oi===q.ans?color:ans[qi]===oi&&!sub?'var(--primary-dim)':'var(--surface-2)'};border-radius:var(--radius-md);cursor:${sub?'default':'pointer'}">
                  <input type="radio" name="q${qi}" value="${oi}" ${ans[qi]===oi?'checked':''} ${sub?'disabled':''} style="accent-color:var(--primary)">
                  <span>${o}${icon}</span>
                </label>`
              }).join('')}
            </div>
          </div>
        `).join('')}
      </div>`
    }

    el.querySelector('#qz-close').addEventListener('click', close)
    el.addEventListener('change', e => {
      const match = e.target.name?.match(/^q(\d+)$/)
      if (match) answers[parseInt(match[1])] = parseInt(e.target.value)
    })
    el.querySelector('#qz-submit').addEventListener('click', () => {
      if (submitted) { close(); return }
      const answered = Object.keys(answers).length
      if (answered < course.quiz.length) { showToast(`กรุณาตอบให้ครบ (${answered}/${course.quiz.length})`, 'warning'); return }
      submitted = true
      let correct = 0
      course.quiz.forEach((q, i) => { if (answers[i] === q.ans) correct++ })
      const score = Math.round(correct / course.quiz.length * 100)
      const passed = score >= 70
      if (passed) {
        userProgress[course.id] = { completed: true, score, date: new Date().toISOString().slice(0, 10) }
        saveProgress()
        showToast(`🎉 ผ่าน! คะแนน ${score}%`, 'success')
      } else {
        userProgress[course.id] = { ...userProgress[course.id], score }
        saveProgress()
        showToast(`คะแนน ${score}% — ต้องการ 70% เพื่อผ่าน`, 'warning')
      }
      // Re-render body
      const body = el.querySelector('.modal-body')
      if (body) body.innerHTML = renderQuizBody(course, answers, true) + `
        <div style="margin-top:16px;text-align:center;padding:16px;background:var(--${passed?'success':'warning'}-dim);border-radius:var(--radius-lg)">
          <div style="font-size:2rem">${passed?'🎉':'😅'}</div>
          <div style="font-weight:700;color:var(--${passed?'success':'warning'})">${passed?'ผ่าน!':'ยังไม่ผ่าน'} — คะแนน ${score}% (${correct}/${course.quiz.length})</div>
          ${passed ? '<div style="font-size:0.85rem;margin-top:4px">สามารถดาวน์โหลด Certificate ได้แล้ว 🏆</div>' : '<div style="font-size:0.85rem;margin-top:4px">ต้องการ 70% ขึ้นไป ลองใหม่ได้เลย</div>'}
        </div>
      `
      const submitBtn = el.querySelector('#qz-submit')
      if (submitBtn) { submitBtn.textContent = 'ปิด'; submitBtn.onclick = () => { close(); renderPage() } }
    })
  }

  function openCertModal(course) {
    const prog = userProgress[course.id] || {}
    const today = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
    openModal({
      title: '🎓 Certificate of Completion', size: 'md',
      body: `
        <div style="text-align:center;padding:20px;border:3px solid var(--warning);border-radius:var(--radius-lg);background:linear-gradient(135deg,var(--surface),var(--surface-2))">
          <div style="font-size:3rem;margin-bottom:8px">🏆</div>
          <div style="font-size:0.75rem;color:var(--text-muted);letter-spacing:2px;text-transform:uppercase;margin-bottom:4px">Certificate of Completion</div>
          <div style="font-size:1rem;color:var(--text-muted);margin-bottom:16px">This is to certify that</div>
          <div style="font-size:1.5rem;font-weight:700;color:var(--primary);margin-bottom:8px">ผู้ใช้งาน LAMOM ONE</div>
          <div style="font-size:0.9rem;color:var(--text-muted);margin-bottom:16px">has successfully completed</div>
          <div style="font-size:1.1rem;font-weight:700;margin-bottom:8px">${course.title}</div>
          <div style="font-size:0.8rem;color:var(--success);margin-bottom:16px">คะแนน: ${prog.score || 100}% | ${prog.date || today}</div>
          <div style="font-size:0.75rem;color:var(--text-muted)">LAMOM ONE Training System</div>
          <div style="font-size:0.7rem;color:var(--text-muted);margin-top:4px">© ทวีศักดิ์ สุขสมบัติเสถียร</div>
        </div>
      `,
      footer: `<button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">ปิด</button>
               <button class="btn btn-primary" onclick="window.print()">🖨️ Print Certificate</button>`
    })
  }

  function openSOPModal(sop) {
    openModal({
      title: `📋 ${sop.title}`, size: 'lg',
      body: `
        <div style="display:flex;flex-direction:column;gap:12px">
          <div style="display:flex;gap:8px">
            <span class="badge badge-primary">${sop.dept}</span>
            <span class="badge badge-primary">v${sop.version}</span>
          </div>
          <div style="background:var(--surface-2);padding:16px;border-radius:var(--radius-md);font-size:0.85rem;line-height:1.8">
            <strong>วัตถุประสงค์:</strong> กำหนดขั้นตอนมาตรฐานสำหรับ ${sop.title.replace(/^SOP-\d+: /,'')}
            <br><br>
            <strong>ขอบเขต:</strong> ใช้สำหรับแผนก ${sop.dept} ทุกคน
            <br><br>
            <strong>ขั้นตอน:</strong><br>
            1. รับ Request/ลูกค้า → บันทึกใน System<br>
            2. ตรวจสอบความครบถ้วนของข้อมูล<br>
            3. ดำเนินการตามมาตรฐาน<br>
            4. ตรวจสอบคุณภาพก่อน Sign-off<br>
            5. บันทึกผลและแจ้งลูกค้า<br>
            <br>
            <strong>เอกสารอ้างอิง:</strong> LAMOM ONE System Guide v${sop.version}
          </div>
          <div style="font-size:0.75rem;color:var(--text-muted)">อัพเดตล่าสุด: ${sop.updated}</div>
        </div>
      `,
      footer: `<button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">ปิด</button>`
    })
  }

  renderPage()
}

function kpi(title, value, color) {
  return `<div class="kpi-card"><div class="kpi-title">${title}</div><div class="kpi-value" style="color:var(--${color})">${value}</div></div>`
}
