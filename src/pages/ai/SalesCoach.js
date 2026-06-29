/**
 * AI Sales Coach — โค้ชขายอัจฉริยะ
 * Route: /ai/sales-coach
 */
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'

const COACHING_TOPICS = [
  { id: 'objection', title: 'รับมือข้อโต้แย้ง', icon: '🛡', desc: 'เทคนิคตอบข้อโต้แย้งจากลูกค้า' },
  { id: 'closing', title: 'ปิดการขาย', icon: '🎯', desc: 'กลยุทธ์ปิดดีล อย่างมีประสิทธิภาพ' },
  { id: 'presentation', title: 'นำเสนอรถ', icon: '🚗', desc: 'วิธีนำเสนอจุดเด่นรถอย่างน่าประทับใจ' },
  { id: 'negotiation', title: 'เจรจาราคา', icon: '💬', desc: 'เทคนิคเจรจาโดยไม่เสียมาร์จิ้น' },
  { id: 'followup', title: 'Follow-up ลูกค้า', icon: '📞', desc: 'กลยุทธ์ติดตามลูกค้าอย่างมืออาชีพ' },
  { id: 'ev_knowledge', title: 'ความรู้ EV', icon: '⚡', desc: 'ข้อมูลเทคนิค EV ที่ลูกค้ามักถาม' },
]

const ROLEPLAY_SCENARIOS = [
  { id: 'S01', title: 'ลูกค้าต่อราคา 50,000 บาท', difficulty: 'ง่าย', icon: '💰' },
  { id: 'S02', title: 'ลูกค้ากังวลเรื่องระยะทาง EV', difficulty: 'ปานกลาง', icon: '🔋' },
  { id: 'S03', title: 'ลูกค้าเปรียบเทียบกับคู่แข่ง', difficulty: 'ยาก', icon: '⚖️' },
  { id: 'S04', title: 'ลูกค้าขอผ่อน 0% แต่ไม่มี', difficulty: 'ปานกลาง', icon: '🏦' },
]

const QUIZ_QUESTIONS = [
  { q: 'BYD Dolphin มีระยะทางวิ่งสูงสุดเท่าไหร่?', opts: ['280 km','340 km','420 km','500 km'], ans: 1 },
  { q: 'เทคนิค FABE ย่อมาจากอะไร?', opts: ['Feature-Advantage-Benefit-Evidence','Fast-Action-Big-Easy','Focus-Area-Build-End','First-Always-Best-Excellent'], ans: 0 },
  { q: 'ข้อโต้แย้ง "แพงเกินไป" ควรตอบด้วยวิธีใดก่อน?', opts: ['ลดราคาทันที','ถามว่าแพงเมื่อเทียบกับอะไร','เสนอรุ่นถูกกว่า','โทษแบรนด์'], ans: 1 },
]

export default async function SalesCoachPage(container) {
  let quizIdx = 0
  let quizScore = 0
  let activeTab = 'topics'

  function renderPage() {
    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🤖 AI Sales Coach</div>
            <div class="page-subtitle">โค้ชขายอัจฉริยะ — ฝึกทักษะ, Roleplay, Quiz</div>
          </div>
        </div>

        <!-- Tabs -->
        <div style="display:flex;gap:2px;margin-bottom:14px;border-bottom:1px solid var(--border)">
          ${[['topics','📚 บทเรียน'],['roleplay','🎭 Roleplay'],['quiz','🧠 Quiz']].map(([tab, label]) =>
            `<button class="btn btn-xs ${activeTab===tab?'btn-primary':'btn-ghost'} tab-btn" data-tab="${tab}" style="border-radius:var(--radius) var(--radius) 0 0">${label}</button>`
          ).join('')}
        </div>

        ${activeTab === 'topics' ? renderTopics() : activeTab === 'roleplay' ? renderRoleplay() : renderQuiz()}
      </div>
    `

    container.querySelectorAll('.tab-btn').forEach(b => b.addEventListener('click', () => { activeTab = b.dataset.tab; quizIdx = 0; quizScore = 0; renderPage() }))

    if (activeTab === 'topics') {
      container.querySelectorAll('.topic-card').forEach(el => el.addEventListener('click', () => {
        const topic = COACHING_TOPICS.find(t => t.id === el.dataset.id); if (topic) openTopicModal(topic)
      }))
    }
    if (activeTab === 'roleplay') {
      container.querySelectorAll('.scenario-btn').forEach(b => b.addEventListener('click', () => {
        const s = ROLEPLAY_SCENARIOS.find(x => x.id === b.dataset.id); if (s) openRoleplay(s)
      }))
    }
    if (activeTab === 'quiz') {
      container.querySelectorAll('.quiz-opt').forEach(btn => btn.addEventListener('click', () => {
        const selected = +btn.dataset.opt
        const correct = QUIZ_QUESTIONS[quizIdx]?.ans
        if (selected === correct) {
          quizScore++
          showToast('✅ ถูกต้อง!', 'success')
        } else {
          showToast(`❌ ไม่ถูก — คำตอบคือ: ${QUIZ_QUESTIONS[quizIdx]?.opts[correct]}`, 'error')
        }
        if (quizIdx < QUIZ_QUESTIONS.length - 1) {
          quizIdx++
        } else {
          showToast(`🏆 จบ Quiz! ได้ ${quizScore}/${QUIZ_QUESTIONS.length} คะแนน`, 'success')
          setTimeout(() => { quizIdx = 0; quizScore = 0; renderPage() }, 2000)
          return
        }
        renderPage()
      }))
    }
  }

  function renderTopics() {
    return `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px">
        ${COACHING_TOPICS.map(t => `
          <div class="card topic-card" data-id="${t.id}" style="padding:16px;cursor:pointer;transition:transform 0.2s" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform=''">
            <div style="font-size:2rem;margin-bottom:8px">${t.icon}</div>
            <div style="font-weight:700;font-size:0.9rem;margin-bottom:4px">${t.title}</div>
            <div style="font-size:0.75rem;color:var(--text-muted)">${t.desc}</div>
          </div>
        `).join('')}
      </div>
    `
  }

  function renderRoleplay() {
    return `
      <div>
        <div style="margin-bottom:14px;padding:12px;background:var(--surface-2);border-radius:var(--radius-sm);font-size:0.83rem">
          🎭 เลือกสถานการณ์ฝึก Roleplay กับ AI — ซ้อมก่อนเจอลูกค้าจริง
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px">
          ${ROLEPLAY_SCENARIOS.map(s => {
            const dc = s.difficulty === 'ง่าย' ? 'success' : s.difficulty === 'ยาก' ? 'danger' : 'warning'
            return `<div class="card" style="padding:14px">
              <div style="font-size:1.8rem;margin-bottom:8px">${s.icon}</div>
              <div style="font-weight:700;font-size:0.88rem;margin-bottom:4px">${s.title}</div>
              <div style="margin-bottom:10px"><span class="badge badge-${dc}" style="font-size:0.62rem">${s.difficulty}</span></div>
              <button class="btn btn-primary btn-xs scenario-btn" data-id="${s.id}" style="width:100%">🎭 เริ่ม Roleplay</button>
            </div>`
          }).join('')}
        </div>
      </div>
    `
  }

  function renderQuiz() {
    const q = QUIZ_QUESTIONS[quizIdx]
    return `
      <div class="card" style="padding:20px;max-width:600px;margin:0 auto">
        <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:14px">ข้อ ${quizIdx+1}/${QUIZ_QUESTIONS.length} · คะแนน ${quizScore}</div>
        <div style="font-weight:700;font-size:0.95rem;margin-bottom:16px;line-height:1.5">${q.q}</div>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${q.opts.map((opt, i) => `
            <button class="btn btn-secondary quiz-opt" data-opt="${i}" style="text-align:left;padding:12px 14px;font-size:0.85rem">${String.fromCharCode(65+i)}. ${opt}</button>
          `).join('')}
        </div>
      </div>
    `
  }

  function openTopicModal(topic) {
    const CONTENT = {
      objection: `<b>5 เทคนิครับมือข้อโต้แย้ง:</b><br><br>1. <b>Feel-Felt-Found</b> — "ผมเข้าใจที่คุณรู้สึก... ลูกค้าหลายท่านก็รู้สึกแบบนั้น... แต่พอได้ใช้แล้วพบว่า..."<br><br>2. <b>Boomerang</b> — เปลี่ยนข้อโต้แย้งเป็นเหตุผลซื้อ<br><br>3. <b>ถามกลับ</b> — "แพงเมื่อเทียบกับอะไรครับ?"<br><br>4. <b>ให้ข้อมูลเพิ่ม</b> — คำนวณต้นทุนรวม ไม่ใช่แค่ราคา<br><br>5. <b>เงียบ</b> — บางครั้งการเงียบหลังปิดดีลดีที่สุด`,
      closing: `<b>เทคนิคปิดการขาย:</b><br><br>1. <b>Alternative Close</b> — "คุณสนใจสีขาวหรือดำครับ?"<br><br>2. <b>Urgency Close</b> — "สต็อกเหลือแค่ 2 คันครับ"<br><br>3. <b>Summary Close</b> — สรุปประโยชน์ทั้งหมดก่อนปิด<br><br>4. <b>Trial Close</b> — "ถ้าราคาตรงใจ ตัดสินใจได้วันนี้เลยไหมครับ?"`,
      presentation: `<b>กรอบ FABE สำหรับนำเสนอรถ:</b><br><br><b>F — Feature:</b> ระบุฟีเจอร์ที่โดดเด่น เช่น "Blade Battery ความจุ 60.5 kWh"<br><br><b>A — Advantage:</b> อธิบายข้อดี "ชาร์จเร็ว DC Fast 80 kW เต็มใน 45 นาที"<br><br><b>B — Benefit:</b> เชื่อมกับชีวิตลูกค้า "ออกเดินทางไกลได้สบาย ไม่กังวล"<br><br><b>E — Evidence:</b> ยืนยันด้วยข้อมูล "ลูกค้า 1,200+ คนในไทยใช้อยู่"<br><br><b>💡 เทคนิคเพิ่มเติม:</b><br>• เริ่มจากความต้องการลูกค้า ไม่ใช่สเปครถ<br>• ให้ลูกค้าสัมผัส-ทดลองนั่งจริงก่อนนำเสนอ<br>• ใช้ภาพ/VDO ประกอบ ดีกว่าพูดอย่างเดียว`,
      negotiation: `<b>เจรจาราคาโดยไม่เสียมาร์จิ้น:</b><br><br>1. <b>ห้ามลดราคาก่อนถาม</b> — "คุณต้องการราคาเท่าไหร่ครับ?" ก่อนเสมอ<br><br>2. <b>Trade Value แทน Cash Discount</b> — เสนอของแถมแทนลดเงินสด เช่น ฟิล์มกันรอย ประกันภัย พรม<br><br>3. <b>Bundle ราคา</b> — รวมของแถมในราคา "ผมจัดแพ็กเกจพิเศษมูลค่า 30,000 ให้ครับ"<br><br>4. <b>Two-step Concession</b> — ลดครั้งแรกน้อย แล้วค่อยๆ ให้เพิ่ม แต่ขอตอบแทนทุกครั้ง<br><br>5. <b>Anchor สูง</b> — เริ่มนำเสนอรุ่นแพงกว่าก่อน แล้วลงมาที่รุ่นที่ต้องการ`,
      followup: `<b>กลยุทธ์ Follow-up ที่ได้ผล:</b><br><br><b>⏱ Timeline ที่ควรทำ:</b><br>• ภายใน 2 ชม. หลัง Test Drive — ส่งขอบคุณ + สรุปจุดเด่น<br>• วันที่ 3 — ส่งรีวิวจากลูกค้าจริงที่ใช้รุ่นเดียวกัน<br>• วันที่ 7 — โทรถามความรู้สึก ไม่ถามว่า "ตัดสินใจแล้วยัง?"<br>• วันที่ 14 — แจ้งโปรโมชั่นหรือสต็อกใหม่<br><br><b>📱 ช่องทางที่ดีที่สุด:</b><br>LINE > โทร > Email ตามลำดับ<br><br><b>❌ สิ่งที่ต้องหลีกเลี่ยง:</b><br>• ส่งข้อความซ้ำๆ ภายใน 24 ชม.<br>• ถามตรงๆ ว่า "ซื้อหรือเปล่า?"<br>• Follow-up ช่วงเย็น-ดึก`,
      ev_knowledge: `<b>คำถามที่ลูกค้าถามบ่อย:</b><br><br>Q: ชาร์จนานแค่ไหน? A: DC Fast Charge ~30 นาที, AC Home 4-8 ชม.<br><br>Q: แบตเสื่อมเร็วไหม? A: ค้ำประกัน 8 ปี หรือ 150,000 km<br><br>Q: ค่าไฟเดือนละเท่าไหร่? A: ~500-1,500 บาท/เดือน แทนน้ำมัน 3,000-5,000<br><br>Q: ซ่อมที่ไหน? A: เครือข่าย authorized dealer ทั่วประเทศ`,
    }
    openModal({
      title: `${topic.icon} ${topic.title}`,
      size: 'md',
      body: `<div style="line-height:1.8;font-size:0.85rem">${CONTENT[topic.id] || 'เนื้อหากำลังพัฒนา...'}</div>`
    })
  }

  function openRoleplay(scenario) {
    const RESPONSES = {
      S01: ['ผมเข้าใจว่าราคาสำคัญมากครับ ขอถามว่าคุณเปรียบเทียบกับรุ่นไหนอยู่ครับ?', 'เราคำนวณต้นทุนทั้งหมด รวมค่าน้ำมัน/ค่าไฟ 5 ปี รถ EV ถูกกว่ามากครับ', 'ผมดูว่าจะช่วยอะไรได้บ้าง เช่น ของแถมหรือแพ็กเกจประกัน'],
      S02: ['BYD Atto 3 วิ่งได้ 420 km ต่อชาร์จหนึ่งครั้งครับ ปกติขับวันละเท่าไหร่ครับ?', 'มีสถานีชาร์จตามห้างใหญ่ๆ มากกว่า 1,000 แห่งทั่วไทยแล้วครับ', 'ที่บ้านชาร์จได้เลยครับ ค่าไฟถูกกว่าน้ำมัน 3-4 เท่า'],
    }
    const replies = RESPONSES[scenario.id] || ['ขอบคุณสำหรับคำถามครับ ผมจะช่วยแนะนำ...']
    let chatHistory = [{ role: 'customer', text: scenario.title }]

    openModal({
      title: `🎭 Roleplay: ${scenario.title}`,
      size: 'md',
      body: `
        <div id="chat-area" style="height:200px;overflow-y:auto;background:var(--surface-2);border-radius:var(--radius-sm);padding:10px;margin-bottom:10px;font-size:0.82rem">
          <div style="color:var(--danger);margin-bottom:8px">👤 ลูกค้า: "${scenario.title}"</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px">
          ${replies.map((r, i) => `<button class="btn btn-secondary reply-opt" data-idx="${i}" style="text-align:left;font-size:0.8rem">💬 ${r}</button>`).join('')}
        </div>
      `,
    })

    setTimeout(() => {
      document.querySelectorAll('.reply-opt').forEach(b => b.addEventListener('click', () => {
        const area = document.getElementById('chat-area')
        if (area) {
          area.innerHTML += `<div style="color:var(--success);margin-bottom:8px">🧑‍💼 เซลส์: "${replies[+b.dataset.idx]}"</div>`
          area.innerHTML += `<div style="color:var(--primary);margin-top:8px">🤖 AI: ดีมาก! นี่คือเทคนิคที่ถูกต้อง ลองใช้กับลูกค้าจริงได้เลย</div>`
          area.scrollTop = area.scrollHeight
        }
      }))
    }, 100)
  }

  renderPage()
}
