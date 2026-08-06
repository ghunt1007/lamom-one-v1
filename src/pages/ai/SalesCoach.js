/**
 * AI Sales Coach — โค้ชขายอัจฉริยะ
 * Route: /ai/sales-coach
 */
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { askAiOfficer, isAiEnabled } from '../../utils/ai.js'

function escHtml(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') }

const COACHING_TOPICS = [
  { id: 'objection', title: 'รับมือข้อโต้แย้ง', icon: '🛡', desc: 'เทคนิคตอบข้อโต้แย้งจากลูกค้า' },
  { id: 'closing', title: 'ปิดการขาย', icon: '🎯', desc: 'กลยุทธ์ปิดดีล อย่างมีประสิทธิภาพ' },
  { id: 'presentation', title: 'นำเสนอรถ', icon: '🚗', desc: 'วิธีนำเสนอจุดเด่นรถอย่างน่าประทับใจ' },
  { id: 'negotiation', title: 'เจรจาราคา', icon: '💬', desc: 'เทคนิคเจรจาโดยไม่เสียมาร์จิ้น' },
  { id: 'followup', title: 'Follow-up ลูกค้า', icon: '📞', desc: 'กลยุทธ์ติดตามลูกค้าอย่างมืออาชีพ' },
  { id: 'ev_knowledge', title: 'ความรู้ EV', icon: '⚡', desc: 'ข้อมูลเทคนิค EV ที่ลูกค้ามักถาม' },
]

// เดิม S01/S02 มีคำตอบ "ลูกค้า" แค่ 1 บทตายตัวต่อสถานการณ์ (ไม่ตอบโต้จริง กดปุ่มไหนก็ได้คำชม "ดีมาก!"
// เหมือนกันหมด) ส่วน S03/S04 ไม่มีบทเลยด้วยซ้ำ (fallback เป็นข้อความทั่วไป) — ตอนนี้ทุกสถานการณ์ใช้ Gemini
// เล่นบท "ลูกค้า" จริงผ่าน persona ด้านล่าง ตอบโต้ตามข้อความจริงที่พนักงานพิมพ์ ไม่ใช่ปุ่มตัวเลือกสำเร็จรูป
const ROLEPLAY_SCENARIOS = [
  { id: 'S01', title: 'ลูกค้าต่อราคา 50,000 บาท', difficulty: 'ง่าย', icon: '💰',
    persona: 'คุณคือลูกค้าที่กำลังจะซื้อรถ EV กับเซลส์ (ผู้ใช้) แต่ขอต่อราคาลง 50,000 บาทเสมอ ถ้าเซลส์อธิบายมูลค่า/เสนอของแถมแทนลดเงินสด/ถามกลับอย่างมีเหตุผล ให้เริ่มอ่อนลงแต่ยังไม่ยอมทันที ถ้าเซลส์ยอมลดราคาทันทีแบบไม่มีเงื่อนไข ให้กดดันขอลดเพิ่มอีก' },
  { id: 'S02', title: 'ลูกค้ากังวลเรื่องระยะทาง EV', difficulty: 'ปานกลาง', icon: '🔋',
    persona: 'คุณคือลูกค้าที่สนใจรถ EV แต่กังวลมากเรื่องระยะทางวิ่งไม่พอ กลัวรถหมดแบตกลางทาง ไม่มั่นใจสถานีชาร์จ ถ้าเซลส์ตอบด้วยข้อมูลจริง/มั่นใจ ให้เริ่มคลายกังวล ถ้าตอบไม่ชัดเจนหรือข้อมูลดูไม่น่าเชื่อ ให้ถามซ้ำ/กังวลต่อ' },
  { id: 'S03', title: 'ลูกค้าเปรียบเทียบกับคู่แข่ง', difficulty: 'ยาก', icon: '⚖️',
    persona: 'คุณคือลูกค้าที่กำลังเปรียบเทียบรถรุ่นนี้กับรถแบรนด์คู่แข่งที่ถูกกว่าหรือมีสเปกที่ดูดีกว่าในบางจุด ตั้งคำถามท้าทายเกี่ยวกับจุดต่างและความคุ้มค่า ถ้าเซลส์ตอบได้ตรงจุด/มีเหตุผลน่าเชื่อ ให้เริ่มเอนเอียงมาทางรุ่นนี้ ถ้าตอบไม่ตรงคำถามหรือดูเลี่ยงประเด็น ให้กดดันถามต่อ' },
  { id: 'S04', title: 'ลูกค้าขอผ่อน 0% แต่ไม่มี', difficulty: 'ปานกลาง', icon: '🏦',
    persona: 'คุณคือลูกค้าที่อยากได้โปรผ่อน 0% ที่เคยเห็นโฆษณาจากที่อื่น แต่โปรโมชั่นนี้ไม่มีจริง ไม่พอใจถ้าเซลส์บอกตรงๆว่าไม่มี ให้ลูกค้ากดดัน/ขู่จะไปซื้อที่อื่น ถ้าเซลส์เสนอทางเลือกอื่นที่สมเหตุสมผล (ดอกเบี้ยจริง/โปรอื่นทดแทน) ให้เริ่มพิจารณา' },
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
    // history เก็บบทสนทนาจริง (ไม่ใช่ปุ่มเลือกสำเร็จรูปแบบเดิม) — 'assistant' = ลูกค้า (AI เล่นบท), 'user' =
    // พนักงานขาย (ผู้ใช้พิมพ์เอง) ตรงกับ shape ที่ askAiOfficer() ในหน้า AiOfficers.js ใช้อยู่แล้ว
    let history = [{ role: 'assistant', content: scenario.title }]
    let sending = false
    const systemPrompt = scenario.persona + ' ตอบสั้นๆเป็นธรรมชาติ 1-2 ประโยค ภาษาไทยเท่านั้น ห้ามบอกว่าตัวเองเป็น AI เล่นบทลูกค้าอย่างสมจริงตลอดบทสนทนา'
    const notEnabled = !isAiEnabled()

    const { el, close } = openModal({
      title: `🎭 Roleplay: ${escHtml(scenario.title)}`,
      size: 'md',
      body: `
        ${notEnabled ? `<div style="font-size:0.7rem;color:var(--warning);margin-bottom:8px;padding:6px 10px;background:var(--surface-2);border-radius:6px">⚠️ ต้องล็อกอินด้วยบัญชีจริงเพื่อคุยกับ AI ลูกค้าจำลอง</div>` : ''}
        <div id="chat-area" style="height:220px;overflow-y:auto;background:var(--surface-2);border-radius:var(--radius-sm);padding:10px;margin-bottom:10px;font-size:0.82rem">
          <div style="color:var(--danger);margin-bottom:8px">👤 ลูกค้า: "${escHtml(scenario.title)}"</div>
        </div>
        <div style="display:flex;gap:6px;margin-bottom:8px">
          <input class="input" id="rp-input" placeholder="พิมพ์คำตอบของคุณ (พนักงานขาย)..." style="flex:1" ${notEnabled ? 'disabled' : ''}>
          <button class="btn btn-primary" id="rp-send" ${notEnabled ? 'disabled' : ''}>ส่ง</button>
        </div>
        <div style="display:flex;justify-content:flex-end">
          <button class="btn btn-secondary btn-xs" id="rp-feedback" ${notEnabled ? 'disabled' : ''}>🤖 ขอ Feedback ภาพรวม</button>
        </div>
      `,
      footer: `<button class="btn btn-secondary" id="rp-close">ปิด</button>`,
    })

    async function sendReply() {
      const input = el.querySelector('#rp-input')
      const text = input?.value.trim()
      const sendBtn = el.querySelector('#rp-send')
      const chatArea = el.querySelector('#chat-area')
      if (!text || sending) return
      sending = true; sendBtn.disabled = true
      chatArea.innerHTML += `<div style="color:var(--success);margin-bottom:8px">🧑‍💼 เซลส์: "${escHtml(text)}"</div>`
      chatArea.scrollTop = chatArea.scrollHeight
      input.value = ''
      const historyBefore = [...history]
      history.push({ role: 'user', content: text })
      try {
        const reply = await askAiOfficer('sales-coach-' + scenario.id, text, historyBefore, systemPrompt)
        history.push({ role: 'assistant', content: reply })
        chatArea.innerHTML += `<div style="color:var(--danger);margin-bottom:8px">👤 ลูกค้า: "${escHtml(reply)}"</div>`
        chatArea.scrollTop = chatArea.scrollHeight
      } catch (e) { showToast('AI ตอบไม่สำเร็จ ลองใหม่อีกครั้ง', 'error') }
      sending = false; sendBtn.disabled = false
    }

    setTimeout(() => {
      el.querySelector('#rp-send')?.addEventListener('click', sendReply)
      el.querySelector('#rp-input')?.addEventListener('keydown', e => { if (e.key === 'Enter') sendReply() })
      el.querySelector('#rp-close')?.addEventListener('click', close)
      el.querySelector('#rp-feedback')?.addEventListener('click', async () => {
        const btn = el.querySelector('#rp-feedback')
        if (history.length < 3) { showToast('คุยกับลูกค้าจำลองก่อนสักหน่อยแล้วค่อยขอ Feedback', 'warning'); return }
        btn.disabled = true; btn.textContent = '⏳ กำลังวิเคราะห์...'
        const convo = history.map(h => (h.role === 'user' ? 'เซลส์' : 'ลูกค้า') + ': ' + h.content).join('\n')
        try {
          const feedback = await askAiOfficer('sales-coach-feedback', 'ประเมิน feedback บทสนทนาการขายนี้:\n' + convo, [],
            'คุณคือโค้ชฝึกขายมืออาชีพของโชว์รูมรถ EV ประเมินบทสนทนาที่แนบมา ให้คะแนน 1-10 พร้อมจุดที่ทำได้ดีและจุดที่ควรปรับปรุง 2-3 ข้อ ตอบภาษาไทยกระชับ ไม่ต้องมี markdown')
          openModal({ title: '🤖 Feedback จาก AI Coach', size: 'sm', body: `<div style="font-size:0.85rem;line-height:1.7;white-space:pre-line">${escHtml(feedback)}</div>` })
        } catch { showToast('ขอ Feedback ไม่สำเร็จ', 'error') }
        btn.disabled = false; btn.textContent = '🤖 ขอ Feedback ภาพรวม'
      })
    }, 50)
  }

  renderPage()
}
