// Training Hub — สรุปภาพรวมโมดูล Training จากข้อมูลจริงทุกหน้า + ทางลัดไปหน้าเนื้อหาจริง
// เดิมไฟล์นี้มี Courses/Quiz/SOP ของตัวเองเป็น hardcoded const + localStorage ซ้ำซ้อนกับ
// TrainingCourse.js/TrainingQuiz.js/quality/SopManagement.js ที่เป็น Firestore จริงอยู่แล้ว
// แก้ให้เป็นหน้ารวมที่ดึงตัวเลขจริงมาสรุป แล้วพาไปหน้าเนื้อหาจริงแทน ไม่ซ้ำงาน
import { listDocs } from '../../core/db.js'
import { navigate } from '../../core/router.js'

const LINKS = [
  { icon: '📚', title: 'หลักสูตรอบรม', path: '/training/courses', desc: 'คอร์สเรียน ลงทะเบียน ติดตามความคืบหน้า' },
  { icon: '🧠', title: 'Quiz & ประวัติทำแบบทดสอบ', path: '/training/quiz', desc: 'ทำแบบทดสอบ ดูคะแนนย้อนหลัง' },
  { icon: '📖', title: 'คลังความรู้', path: '/training/knowledge', desc: 'บทความ/คู่มือความรู้ทั่วไป' },
  { icon: '🚗', title: 'ความรู้ผลิตภัณฑ์', path: '/training/product-knowledge', desc: 'สเปครถ จุดขาย เปรียบเทียบรุ่น' },
  { icon: '🏆', title: 'ใบรับรอง (Certification)', path: '/training/certification', desc: 'ใบรับรองพนักงาน วันหมดอายุ' },
  { icon: '📋', title: 'SOP มาตรฐานการทำงาน', path: '/quality/sop', desc: 'ขั้นตอนมาตรฐานทุกแผนก' },
  { icon: '📈', title: 'ความคืบหน้าการเรียนรู้', path: '/training/progress', desc: 'ภาพรวมความคืบหน้ารายบุคคล/ทีม' },
  { icon: '🔍', title: 'ข้อมูลคู่แข่ง', path: '/training/competitor', desc: 'วิเคราะห์คู่แข่งสำหรับทีมขาย' },
  { icon: '🤖', title: 'AI Training Bot', path: '/training/bot', desc: 'ถาม-ตอบระหว่างอบรมด้วย AI' },
]

export default async function TrainingDashboard(container) {
  let courses = [], quizResults = [], certs = [], sops = []
  try {
    [courses, quizResults, certs, sops] = await Promise.all([
      listDocs('training_courses', [], 'createdAt', 'desc', 300).catch(() => []),
      listDocs('quiz_results', [], 'passedAt', 'desc', 500).catch(() => []),
      listDocs('staff_certifications', [], 'expDate', 'asc', 300).catch(() => []),
      listDocs('sop_documents', [], 'updatedDate', 'desc', 300).catch(() => []),
    ])
  } catch (e) {}

  const passedQuizzes = quizResults.filter(q => q.passed).length
  const passRate = quizResults.length ? Math.round(passedQuizzes / quizResults.length * 100) : 0
  const expiringCerts = certs.filter(c => {
    if (!c.expDate) return false
    const days = (new Date(c.expDate) - new Date()) / 86400000
    return days >= 0 && days <= 60
  }).length

  function renderPage() {
    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🎓 Training & Knowledge Hub</div>
            <div class="page-subtitle">ภาพรวมการอบรม-พัฒนาศักยภาพพนักงานจากข้อมูลจริง — เลือกไปยังเนื้อหาที่ต้องการด้านล่าง</div>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:20px">
          ${kpi('📚 หลักสูตรทั้งหมด', courses.length, 'primary')}
          ${kpi('🧠 อัตราผ่าน Quiz', passRate + '%', passRate >= 70 ? 'success' : 'warning')}
          ${kpi('📋 เอกสาร SOP', sops.length, 'accent')}
          ${kpi('⚠️ ใบรับรองใกล้หมดอายุ', expiringCerts, expiringCerts > 0 ? 'danger' : 'secondary')}
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px">
          ${LINKS.map(l => `
            <div class="card hub-link-card" data-path="${l.path}" style="padding:18px;cursor:pointer;transition:transform .15s">
              <div style="font-size:1.8rem;margin-bottom:8px">${l.icon}</div>
              <div style="font-weight:700;margin-bottom:4px">${l.title}</div>
              <div style="font-size:0.78rem;color:var(--text-muted)">${l.desc}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `
    container.querySelectorAll('.hub-link-card').forEach(card => {
      card.addEventListener('click', () => navigate(card.dataset.path))
      card.addEventListener('mouseenter', () => { card.style.transform = 'translateY(-2px)' })
      card.addEventListener('mouseleave', () => { card.style.transform = '' })
    })
  }

  renderPage()
}

function kpi(title, value, color) {
  return `<div class="kpi-card"><div class="kpi-title">${title}</div><div class="kpi-value" style="color:var(--${color})">${value}</div></div>`
}
