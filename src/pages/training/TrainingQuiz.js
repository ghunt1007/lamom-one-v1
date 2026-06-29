/**
 * Training Quiz — แบบทดสอบความรู้
 * Route: /training/quiz
 */
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'

const QUIZ_SETS = [
  {
    id: 'Q001', name: 'ความรู้พื้นฐาน EV', icon: '⚡', questions: [
      { q: 'แบตเตอรี่ EV ส่วนใหญ่ใช้เทคโนโลยีใด?', choices: ['Lead-acid', 'Lithium-ion / LFP', 'NiMH', 'Alkaline'], answer: 1 },
      { q: 'SOH ย่อมาจากอะไร?', choices: ['State of Heat', 'State of Health', 'Speed of Handling', 'Standard of HV'], answer: 1 },
      { q: 'DC Fast Charge ต่างจาก AC อย่างไร?', choices: ['ช้ากว่า', 'ชาร์จตรงเข้าแบตไม่ผ่าน On-board charger ทำให้เร็วกว่า', 'ใช้ได้แค่ที่บ้าน', 'ไม่ต่างกัน'], answer: 1 },
      { q: 'BYD Blade Battery ใช้เคมีแบบใด?', choices: ['NMC', 'LFP (Lithium Iron Phosphate)', 'NCA', 'Solid-state'], answer: 1 },
    ]
  },
  {
    id: 'Q002', name: 'เทคนิคการขาย', icon: '💼', questions: [
      { q: 'Feel-Felt-Found ใช้เมื่อไหร่?', choices: ['ปิดการขาย', 'จัดการข้อโต้แย้งของลูกค้า', 'ทักทายลูกค้า', 'ติดตามหลังขาย'], answer: 1 },
      { q: 'คำถามแบบไหนช่วยค้นหาความต้องการลูกค้าได้ดีที่สุด?', choices: ['คำถามปิด (ใช่/ไม่)', 'คำถามเปิด (อะไร/อย่างไร/ทำไม)', 'คำถามนำ', 'ไม่ต้องถาม'], answer: 1 },
      { q: 'เมื่อลูกค้าบอกว่า "ขอคิดดูก่อน" ควรทำอย่างไร?', choices: ['ปล่อยไปเลย', 'ถามหาข้อกังวลที่แท้จริงอย่างสุภาพ', 'ลดราคาทันที', 'กดดันให้ตัดสินใจ'], answer: 1 },
    ]
  },
  {
    id: 'Q003', name: 'SOP บริการหลังการขาย', icon: '🔧', questions: [
      { q: 'เมื่อรับรถลูกค้าเข้าศูนย์ ขั้นตอนแรกคือ?', choices: ['เริ่มซ่อมทันที', 'ตรวจสภาพรอบคันพร้อมถ่ายรูป + บันทึกเลขไมล์', 'ล้างรถ', 'โทรหาผู้จัดการ'], answer: 1 },
      { q: 'ก่อนซ่อมเพิ่มนอกเหนือใบแจ้งซ่อม ต้องทำอะไร?', choices: ['ซ่อมเลย', 'แจ้งลูกค้าและรอการอนุมัติก่อน', 'ถามช่างคนอื่น', 'บันทึกไว้เฉยๆ'], answer: 1 },
      { q: 'งานเกี่ยวกับระบบไฟแรงสูง (HV) ใครทำได้?', choices: ['ช่างทุกคน', 'เฉพาะช่างที่ผ่านการอบรม EV/HV เท่านั้น', 'ผู้จัดการ', 'ใครก็ได้ถ้ามีคู่มือ'], answer: 1 },
    ]
  },
]

const LEADERBOARD = [
  { name: 'วิชัย ยอดขาย', score: 95, quizzes: 8 },
  { name: 'สุดา มาดี', score: 92, quizzes: 7 },
  { name: 'วิทยา ช่างใหญ่', score: 88, quizzes: 9 },
  { name: 'ธนา เก่ง', score: 81, quizzes: 5 },
]

export default async function TrainingQuizPage(container) {
  let activeQuiz = null
  let currentQ = 0
  let score = 0
  let answered = false

  function renderPage() {
    if (activeQuiz) { renderQuiz(); return }

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">📝 Training Quiz</div>
            <div class="page-subtitle">แบบทดสอบความรู้ — วัดผลหลังอบรม</div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:2fr 1fr;gap:14px">
          <!-- Quiz sets -->
          <div style="display:flex;flex-direction:column;gap:10px">
            ${QUIZ_SETS.map(qs => `
              <div class="card" style="padding:14px;display:flex;justify-content:space-between;align-items:center">
                <div>
                  <div style="font-weight:700;font-size:0.9rem">${qs.icon} ${qs.name}</div>
                  <div style="font-size:0.72rem;color:var(--text-muted)">${qs.questions.length} ข้อ · ผ่านที่ 70%</div>
                </div>
                <button class="btn btn-primary btn-xs start-quiz-btn" data-id="${qs.id}">▶️ เริ่มทำ</button>
              </div>
            `).join('')}
          </div>

          <!-- Leaderboard -->
          <div class="card" style="padding:14px">
            <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);margin-bottom:10px">🏆 Top Scores</div>
            ${LEADERBOARD.map((l, i) => `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--border)">
                <div style="display:flex;gap:8px;align-items:center">
                  <span>${['🥇','🥈','🥉','4.'][i]}</span>
                  <div>
                    <div style="font-size:0.8rem;font-weight:600">${l.name}</div>
                    <div style="font-size:0.65rem;color:var(--text-muted)">${l.quizzes} ชุด</div>
                  </div>
                </div>
                <span style="font-weight:700;color:var(--${l.score>=90?'success':'warning'})">${l.score}%</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `

    container.querySelectorAll('.start-quiz-btn').forEach(b => b.addEventListener('click', () => {
      activeQuiz = QUIZ_SETS.find(q => q.id === b.dataset.id)
      currentQ = 0; score = 0; answered = false
      renderPage()
    }))
  }

  function renderQuiz() {
    const q = activeQuiz.questions[currentQ]
    const isLast = currentQ === activeQuiz.questions.length - 1
    const progress = Math.round((currentQ) / activeQuiz.questions.length * 100)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">${activeQuiz.icon} ${activeQuiz.name}</div>
            <div class="page-subtitle">ข้อ ${currentQ + 1} / ${activeQuiz.questions.length}</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary btn-xs" id="exit-btn">✕ ออก</button>
          </div>
        </div>

        <div style="background:var(--surface-2);border-radius:4px;height:8px;margin-bottom:20px">
          <div style="width:${progress}%;background:var(--primary);height:8px;border-radius:4px;transition:width .3s"></div>
        </div>

        <div class="card" style="padding:20px;max-width:640px;margin:0 auto">
          <div style="font-weight:700;font-size:1rem;margin-bottom:16px">${q.q}</div>
          <div style="display:flex;flex-direction:column;gap:8px" id="choices">
            ${q.choices.map((c, i) => `
              <button class="btn btn-secondary choice-btn" data-i="${i}" style="text-align:left;justify-content:flex-start;padding:12px 14px;font-size:0.85rem">
                ${String.fromCharCode(65+i)}. ${c}
              </button>
            `).join('')}
          </div>
          <div id="feedback" style="margin-top:14px"></div>
        </div>
      </div>
    `

    document.getElementById('exit-btn')?.addEventListener('click', () => { activeQuiz = null; renderPage() })
    container.querySelectorAll('.choice-btn').forEach(b => b.addEventListener('click', () => {
      if (answered) return
      answered = true
      const picked = parseInt(b.dataset.i)
      const correct = picked === q.answer
      if (correct) score++
      container.querySelectorAll('.choice-btn').forEach(cb => {
        const ci = parseInt(cb.dataset.i)
        if (ci === q.answer) cb.style.cssText += ';border:2px solid var(--success);background:var(--success)18'
        else if (ci === picked) cb.style.cssText += ';border:2px solid var(--danger);background:var(--danger)18'
        cb.disabled = true
      })
      const fb = document.getElementById('feedback')
      if (fb) fb.innerHTML = `
        <div style="font-size:0.85rem;font-weight:700;color:var(--${correct?'success':'danger'});margin-bottom:10px">
          ${correct ? '✅ ถูกต้อง!' : '❌ ผิด — คำตอบที่ถูกคือ ' + String.fromCharCode(65+q.answer)}
        </div>
        <button class="btn btn-primary" id="next-btn" style="width:100%">${isLast ? '🏁 ดูผลคะแนน' : 'ข้อต่อไป ▶️'}</button>
      `
      document.getElementById('next-btn')?.addEventListener('click', () => {
        if (isLast) showResult()
        else { currentQ++; answered = false; renderQuiz() }
      })
    }))
  }

  function showResult() {
    const total = activeQuiz.questions.length
    const pct = Math.round(score / total * 100)
    const passed = pct >= 70
    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="card" style="padding:30px;max-width:480px;margin:40px auto;text-align:center">
          <div style="font-size:3rem;margin-bottom:10px">${passed ? '🎉' : '😅'}</div>
          <div style="font-weight:900;font-size:1.5rem;color:var(--${passed?'success':'danger'});margin-bottom:6px">${pct}%</div>
          <div style="font-size:0.9rem;margin-bottom:4px">ตอบถูก ${score} / ${total} ข้อ</div>
          <div style="font-size:0.85rem;color:var(--${passed?'success':'danger'});font-weight:700;margin-bottom:20px">
            ${passed ? '✅ ผ่านเกณฑ์ (70%)' : '❌ ไม่ผ่าน — ลองใหม่อีกครั้ง'}
          </div>
          <div style="display:flex;gap:8px;justify-content:center">
            <button class="btn btn-secondary" id="retry-btn">🔄 ทำใหม่</button>
            <button class="btn btn-primary" id="back-btn">← กลับหน้าหลัก</button>
          </div>
        </div>
      </div>
    `
    document.getElementById('retry-btn')?.addEventListener('click', () => { currentQ = 0; score = 0; answered = false; renderQuiz() })
    document.getElementById('back-btn')?.addEventListener('click', () => {
      if (passed) showToast('🏆 บันทึกคะแนน ' + pct + '% แล้ว', 'success')
      activeQuiz = null; renderPage()
    })
  }

  renderPage()
}
