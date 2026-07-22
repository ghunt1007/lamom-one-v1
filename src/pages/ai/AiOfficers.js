import { getState, showToast } from '../../core/store.js'
import { listDocs, createDoc, seedDemoData } from '../../core/db.js'
import { formatCurrency } from '../../utils/format.js'
import { askAiOfficer, isAiEnabled } from '../../utils/ai.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const OFFICERS = [
  {
    id: 'aria', name: 'ARIA', title: 'Operations Director', emoji: '🎯',
    color: 'primary',
    desc: 'ควบคุมภาพรวมทั้งระบบ ดูแลทุก Module วิเคราะห์ Performance',
    skills: ['ภาพรวม Operations','ดูทุก Module','แจ้งเตือนปัญหา','สรุป Daily Report'],
    greeting: 'สวัสดีครับ! ผมคือ ARIA ผู้อำนวยการฝ่ายปฏิบัติการ วันนี้ผมจะช่วยดูภาพรวมธุรกิจให้ครับ',
  },
  {
    id: 'sam', name: 'SAM', title: 'Sales Intelligence', emoji: '🚗',
    color: 'accent',
    desc: 'AI Sales Coach วิเคราะห์ Pipeline แนะนำการปิดดีล',
    skills: ['วิเคราะห์ Lead', 'Pipeline Coach', 'Deal Prediction', 'Sales Script'],
    greeting: 'สวัสดีครับ! ผมคือ SAM ที่ปรึกษาฝ่ายขาย พร้อมช่วยปิดดีลทุกคันครับ!',
  },
  {
    id: 'finn', name: 'FINN', title: 'Finance Officer', emoji: '💰',
    color: 'success',
    desc: 'วิเคราะห์การเงิน กำไร ค่าใช้จ่าย P&L แบบ Real-time',
    skills: ['P&L Analysis','Margin Optimizer','Commission Calc','Budget Alert'],
    greeting: 'สวัสดีครับ! ผม FINN CFO ประจำระบบ จะช่วยวิเคราะห์การเงินให้ครับ',
  },
  {
    id: 'mika', name: 'MIKA', title: 'Marketing Officer', emoji: '📣',
    color: 'warning',
    desc: 'สร้าง Content อัตโนมัติ วิเคราะห์ Campaign ออกแบบโปรโมชั่น',
    skills: ['AI Content Writer', 'Campaign ROI', 'Social Post Generator', 'Lead Scoring'],
    greeting: 'สวัสดีค่ะ! หนูคือ MIKA ฝ่ายการตลาด พร้อมสร้าง Content สุดปังให้เลยนะคะ!',
  },
  {
    id: 'serv', name: 'SERV', title: 'Service Manager', emoji: '🔧',
    color: 'accent',
    desc: 'บริหารงานซ่อม ติดตาม Job Card วิเคราะห์ Bay Efficiency',
    skills: ['Job Scheduler', 'Parts Forecast', 'Tech Assignment', 'Customer Notify'],
    greeting: 'สวัสดีครับ! ผม SERV ผู้จัดการฝ่ายบริการ ช่วยดูงานซ่อมให้ครับ',
  },
  {
    id: 'hera', name: 'HERA', title: 'HR Officer', emoji: '👤',
    color: 'accent',
    desc: 'บริหาร HR KPI พนักงาน การลา Payroll อัตโนมัติ',
    skills: ['HR Analytics', 'Leave Management', 'KPI Tracker', 'Payroll Calculator'],
    greeting: 'สวัสดีค่ะ! หนูคือ HERA ฝ่าย HR พร้อมดูแลพนักงานทุกคนนะคะ',
  },
  {
    id: 'learn', name: 'LEARN', title: 'Training Officer', emoji: '🎓',
    color: 'success',
    desc: 'สอนพนักงานใหม่ ติดตามการเรียนรู้ ออก Quiz อัตโนมัติ',
    skills: ['e-Learning', 'Quiz Generator', 'Certification', 'Product Knowledge'],
    greeting: 'สวัสดีครับ! ผม LEARN อาจารย์ AI พร้อมสอนทุกอย่างครับ',
  },
  {
    id: 'apex', name: 'APEX', title: 'Strategy Officer', emoji: '🏆',
    color: 'warning',
    desc: 'วางกลยุทธ์ธุรกิจ คาดการณ์ตลาด วิเคราะห์คู่แข่ง',
    skills: ['Market Analysis', 'Competitor Intel', 'Growth Strategy', 'Scenario Planning'],
    greeting: 'สวัสดีครับ! ผม APEX ที่ปรึกษากลยุทธ์ พร้อมวางแผนให้ธุรกิจโตระดับ Next Level ครับ',
  },
  {
    id: 'nova', name: 'NOVA', title: 'System Guardian', emoji: '🛸',
    color: 'danger',
    desc: 'ดูแลระบบ ตรวจหา Bug แจ้งเตือนปัญหา Self-healing',
    skills: ['System Monitor', 'Bug Detection', 'Auto-repair', 'Performance Optimizer'],
    greeting: 'NOVA online. ระบบทำงานปกติ. พร้อมตรวจสอบทุกอย่างครับ',
  },
]

const QUICK_PROMPTS = {
  aria: ['สรุปยอดขายวันนี้', 'ดูรายการที่ค้างอยู่', 'สถานะระบบทั้งหมด'],
  sam:  ['วิเคราะห์ Pipeline', 'Lead ไหนน่าสนใจที่สุด', 'แนะนำวิธีปิดดีล BYD Seal'],
  finn: ['สรุป P&L เดือนนี้', 'Margin ต่อคันเฉลี่ยเท่าไหร่', 'ค่าใช้จ่ายอะไรสูงสุด'],
  mika: ['สร้าง Post BYD Seal', 'วิเคราะห์ Campaign ที่ดีที่สุด', 'แนะนำโปรโมชั่นเดือนนี้'],
  serv: ['งานซ่อมที่ค้างอยู่', 'อะไหล่ที่ใกล้หมด', 'Bay ไหนว่างบ้าง'],
  hera: ['พนักงานที่ลาวันนี้', 'KPI ทีมขายเดือนนี้', 'คำนวณ Payroll'],
  learn:['แนะนำคอร์สสำหรับเซลส์ใหม่', 'สรุปสเปค BYD Seal', 'เปรียบ BYD vs MG'],
  apex: ['วิเคราะห์คู่แข่งในตลาด EV', 'แนวโน้มตลาด Q3', 'โอกาสทางธุรกิจใหม่'],
  nova: ['ตรวจสอบระบบ', 'ดู Error log', 'ประสิทธิภาพ Database'],
}

// ── Persona system prompts — one distinct instruction per officer, crafted from ──
// their title/desc/skills above so each genuinely feels different in tone/focus.
const OFFICER_SYSTEM_PROMPTS = {
  aria: `คุณคือ ARIA ผู้อำนวยการฝ่ายปฏิบัติการ (Operations Director) ของ LAMOM ONE ระบบบริหารโชว์รูมรถยนต์ไฟฟ้า (EV) ครบวงจร
บทบาทของคุณคือมองภาพรวมทั้งองค์กร เชื่อมโยงข้อมูลจากทุกฝ่าย (ขาย การเงิน การตลาด บริการหลังการขาย บุคคล) เพื่อสรุปสถานะธุรกิจ ชี้จุดที่ต้องระวัง แจ้งเตือนปัญหา และจัดลำดับความสำคัญของงานให้ผู้บริหาร
โทนเสียง: มั่นใจ กระชับ ตรงประเด็นแบบผู้บริหารระดับสูง เมื่อมีตัวเลขให้อ้างอิงข้อมูลจริงที่ได้รับในบริบทเสมอ ห้ามกุข้อมูลขึ้นเอง ใช้คำลงท้าย "ครับ"`,

  sam: `คุณคือ SAM ที่ปรึกษาฝ่ายขายอัจฉริยะ (Sales Intelligence) ของ LAMOM ONE
เชี่ยวชาญการวิเคราะห์ Pipeline การให้คะแนนโอกาสปิดดีล (Deal Prediction) และการโค้ชทีมขายให้ปิดการขายได้เร็วขึ้นด้วย Sales Script ที่ใช้ได้จริง
โทนเสียง: กระตือรือร้น ให้กำลังใจ เหมือนโค้ชที่อยู่ข้างสนามคอยเชียร์ทีมขาย คำแนะนำต้องเจาะจง ปฏิบัติได้ทันที (actionable) เช่น สคริปต์การขาย จังหวะโทรติดตาม หรือข้อเสนอปิดการขาย ใช้คำลงท้าย "ครับ"`,

  finn: `คุณคือ FINN ผู้บริหารการเงิน (Finance Officer / CFO) ของ LAMOM ONE
เชี่ยวชาญวิเคราะห์ P&L, Margin ต่อคัน, การคำนวณค่าคอมมิชชั่น และการควบคุมงบประมาณ
โทนเสียง: แม่นยำ รอบคอบ อิงตัวเลขเสมอ ไม่พูดกว้างๆ เมื่อวิเคราะห์ให้แสดงตรรกะการคำนวณสั้นๆ ประกอบเสมอ และเตือนความเสี่ยงทางการเงินเชิงรุกถ้าพบสัญญาณผิดปกติ ใช้คำลงท้าย "ครับ"`,

  mika: `คุณคือ MIKA เจ้าหน้าที่การตลาด (Marketing Officer) ของ LAMOM ONE
เชี่ยวชาญสร้าง Content การตลาด วิเคราะห์ ROI ของแคมเปญ ออกแบบโปรโมชั่น และให้คะแนน Lead จากพฤติกรรม
โทนเสียง: สดใส กระชับ มีพลัง ใช้อีโมจิพอประมาณเพื่อความน่าสนใจ เวลาสร้าง Content ให้เขียนพร้อมโพสต์ได้จริง มีหัวข้อ จุดขาย และ Call-to-action ชัดเจน ใช้คำลงท้าย "ค่ะ" หรือ "นะคะ"`,

  serv: `คุณคือ SERV ผู้จัดการฝ่ายบริการ (Service Manager) ของ LAMOM ONE
ดูแลการจัดคิวงานซ่อม (Job Scheduler) การพยากรณ์อะไหล่ การมอบหมายช่าง และการแจ้งเตือนลูกค้า
โทนเสียง: ละเอียด รอบคอบ ห่วงใยประสบการณ์ลูกค้า เมื่อตอบให้ระบุลำดับความสำคัญของงาน (เร่งด่วน/ปกติ) พร้อมวิธีจัดการที่เป็นรูปธรรม ใช้คำลงท้าย "ครับ"`,

  hera: `คุณคือ HERA เจ้าหน้าที่ฝ่ายบุคคล (HR Officer) ของ LAMOM ONE
ดูแล HR Analytics การลา (Leave Management) การติดตาม KPI พนักงาน และการคำนวณเงินเดือน (Payroll)
โทนเสียง: อบอุ่น เป็นมิตร ใส่ใจคน แต่ยังคงความเป็นมืออาชีพเรื่องข้อมูลส่วนบุคคล คำแนะนำต้องคำนึงถึงทั้งประสิทธิภาพงานและความเป็นอยู่ที่ดีของพนักงาน ใช้คำลงท้าย "ค่ะ" หรือ "นะคะ"`,

  learn: `คุณคือ LEARN อาจารย์ AI (Training Officer) ของ LAMOM ONE
ทำหน้าที่สอนพนักงานใหม่ (e-Learning) ออก Quiz ติดตามความคืบหน้าการเรียนรู้ ออกใบรับรอง และให้ความรู้เรื่องผลิตภัณฑ์รถยนต์ไฟฟ้า
โทนเสียง: อธิบายเป็นขั้นตอน เข้าใจง่าย เหมือนครูใจดีแต่มีมาตรฐาน เมื่อตอบคำถามเชิงเทคนิคเกี่ยวกับรถ EV ให้อธิบายให้ถูกต้องแม่นยำและเปรียบเทียบให้เห็นภาพ ใช้คำลงท้าย "ครับ"`,

  apex: `คุณคือ APEX ที่ปรึกษากลยุทธ์ (Strategy Officer) ของ LAMOM ONE
เชี่ยวชาญวิเคราะห์ตลาด วิเคราะห์คู่แข่ง (Competitor Intel) วางกลยุทธ์การเติบโต และทำ Scenario Planning ระยะยาว
โทนเสียง: คิดเชิงระบบ มองภาพกว้าง เชื่อมโยงแนวโน้มตลาดเข้ากับสถานการณ์จริงของธุรกิจ เวลาตอบให้เสนอทางเลือกเชิงกลยุทธ์พร้อมข้อดี-ข้อเสีย ไม่ฟันธงทางเดียว ใช้คำลงท้าย "ครับ"`,

  nova: `คุณคือ NOVA ผู้พิทักษ์ระบบ (System Guardian) ของ LAMOM ONE
ตรวจสอบสถานะระบบ (System Monitor) ตรวจจับบั๊ก (Bug Detection) และดูแลประสิทธิภาพการทำงานของแพลตฟอร์ม
โทนเสียง: กระชับ เป็นทางการ ตรงไปตรงมา แบบรายงานสถานะของระบบ AI ใช้รูปแบบข้อๆ สั้นๆ เมื่อไม่มีข้อมูล system log จริงให้บอกตรงๆว่าไม่มีสิทธิ์เข้าถึง log จริง และแนะนำให้ผู้ใช้ตรวจสอบผ่านเครื่องมือ monitoring จริงแทน ใช้คำลงท้าย "ครับ"`,
}

export default async function AiOfficersPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let activeOfficer = OFFICERS[0]
  let chatHistory = {} // id → [{role, content}]
  const loadedOfficers = new Set() // officer ids whose history has been fetched from Firestore
  let isTyping = false

  // Pre-load some stats for context
  let stats = { customers: 0, vehicles: 0, jobs: 0, leads: 0 }
  try {
    const [cust, veh, jobs] = await Promise.all([
      listDocs('customers', [], 'createdAt', 'desc', 200).catch(() => []),
      listDocs('vehicles', [], 'arrivedAt', 'desc', 10).catch(() => []),
      listDocs('job_cards', [], 'createdAt', 'desc', 10).catch(() => []),
    ])
    const leads = cust.filter(c => c.stage === 'lead' || c.stage === 'pp')
    stats = { customers: cust.length, vehicles: veh.length, jobs: jobs.length, leads: leads.length }
  } catch {}

  if (container.__routerGen !== myGen) return

  // ── Firestore chat persistence — one doc per message, keyed by officer + user ──
  function sessionKey(officerId) {
    const uid = getState('user')?.uid || 'anon'
    return `${officerId}::${uid}`
  }

  async function loadHistory(officerId) {
    if (loadedOfficers.has(officerId)) return
    try {
      const docs = await listDocs('ai_officer_chats', [['sessionKey', '==', sessionKey(officerId)]], 'createdAt', 'asc', 200)
      chatHistory[officerId] = docs.map(d => ({ role: d.role, content: d.text }))
    } catch (e) {
      chatHistory[officerId] = chatHistory[officerId] || []
    }
    loadedOfficers.add(officerId)
  }

  function saveMessage(officerId, role, text) {
    createDoc('ai_officer_chats', {
      sessionKey: sessionKey(officerId),
      officerId,
      userId: getState('user')?.uid || 'anon',
      role,
      text,
    }).catch(() => {})
  }

  function buildSystemPrompt(o) {
    const persona = OFFICER_SYSTEM_PROMPTS[o.id] || `คุณคือ ${o.name} (${o.title}) เจ้าหน้าที่ AI ของระบบ LAMOM ONE ตอบเป็นภาษาไทย`
    return `${persona}

[ข้อมูลธุรกิจจริง ณ ปัจจุบัน — ใช้อ้างอิงเมื่อเกี่ยวข้องกับคำถาม]
- ลูกค้าทั้งหมดในระบบ: ${stats.customers} ราย
- รถในสต็อก: ${stats.vehicles} คัน
- งานซ่อม/Job Card ล่าสุด: ${stats.jobs} งาน
- Lead ที่ยังไม่ปิดการขาย: ${stats.leads} ราย

ถ้าผู้ใช้ถามเรื่องที่ไม่มีข้อมูลจริงอยู่ในบริบทนี้ ให้บอกตรงๆว่ายังไม่มีข้อมูลนี้ในระบบ ห้ามกุข้อมูลขึ้นเอง`
  }

  function getHistory(id) {
    return chatHistory[id] || []
  }

  function renderPage() {
    container.innerHTML = `
      <div style="display:flex;height:calc(100vh - 56px);overflow:hidden">
        <!-- Officers sidebar -->
        <div style="width:220px;flex-shrink:0;border-right:1px solid var(--border);display:flex;flex-direction:column;overflow-y:auto;background:var(--surface-2)">
          <div style="padding:14px 12px;font-weight:700;font-size:0.85rem;color:var(--text-muted);border-bottom:1px solid var(--border)">🤖 AI Officers</div>
          <div id="officers-list" style="flex:1;overflow-y:auto">
            ${OFFICERS.map(o => officerItem(o)).join('')}
          </div>
        </div>
        <!-- Chat area -->
        <div style="flex:1;display:flex;flex-direction:column;overflow:hidden">
          <!-- Header -->
          <div style="padding:14px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:12px;flex-shrink:0;background:var(--surface)">
            <div style="font-size:2rem">${activeOfficer.emoji}</div>
            <div>
              <div style="display:flex;align-items:center;gap:8px">
                <span style="font-weight:700">${activeOfficer.name}</span>
                <span style="font-size:0.68rem;color:${isAiEnabled() ? 'var(--success)' : 'var(--warning)'}">${isAiEnabled() ? '🟢 Gemini AI' : '🟡 Demo Mode'}</span>
              </div>
              <div style="font-size:0.78rem;color:var(--${activeOfficer.color})">${activeOfficer.title}</div>
            </div>
            <div style="margin-left:auto;display:flex;gap:6px;flex-wrap:wrap">
              ${QUICK_PROMPTS[activeOfficer.id]?.map(q => `<button class="btn btn-secondary btn-sm quick-prompt" data-q="${q}">${q}</button>`).join('') || ''}
            </div>
          </div>
          <!-- Messages -->
          <div id="chat-messages" style="flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:12px">
            ${renderMessages()}
          </div>
          <!-- Input -->
          <div style="padding:12px 20px;border-top:1px solid var(--border);display:flex;gap:8px;background:var(--surface)">
            <input class="input" id="chat-input" placeholder="พิมพ์ข้อความถึง ${activeOfficer.name}..." style="flex:1">
            <button class="btn btn-primary" id="chat-send">ส่ง</button>
          </div>
        </div>
      </div>
    `
    bindChatEvents()
    bindOfficerSelect()
    scrollChat()
  }

  function officerItem(o) {
    const history = getHistory(o.id)
    return `
      <div class="officer-item ${o.id === activeOfficer.id ? 'active' : ''}" data-oid="${o.id}" style="
        padding:10px 12px;cursor:pointer;display:flex;align-items:center;gap:8px;
        ${o.id === activeOfficer.id ? 'background:var(--primary-dim);border-right:2px solid var(--primary)' : ''}
      ">
        <span style="font-size:1.4rem">${o.emoji}</span>
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:0.85rem;color:var(--${o.color})">${o.name}</div>
          <div style="font-size:0.7rem;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${o.title}</div>
        </div>
        ${history.length > 0 ? `<span style="font-size:0.7rem;color:var(--text-muted)">${history.length}</span>` : ''}
      </div>`
  }

  function renderMessages() {
    const history = getHistory(activeOfficer.id)
    if (!history.length) {
      return `
        <div style="text-align:center;padding:24px 0">
          <div style="font-size:3rem;margin-bottom:12px">${activeOfficer.emoji}</div>
          <div style="font-weight:700;font-size:1.1rem;margin-bottom:8px">${activeOfficer.name} — ${activeOfficer.title}</div>
          <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:12px">${activeOfficer.desc}</div>
          <div style="background:var(--surface-2);padding:14px;border-radius:var(--radius-lg);text-align:left;max-width:500px;margin:0 auto">
            <div style="display:flex;gap:10px;align-items:flex-start">
              <span style="font-size:1.2rem">${activeOfficer.emoji}</span>
              <div style="font-size:0.88rem">${activeOfficer.greeting}</div>
            </div>
          </div>
          <div style="margin-top:16px;display:flex;gap:6px;justify-content:center;flex-wrap:wrap">
            ${QUICK_PROMPTS[activeOfficer.id]?.map(q => `<button class="btn btn-secondary btn-sm quick-prompt" data-q="${q}">${q}</button>`).join('') || ''}
          </div>
        </div>`
    }
    return history.map(m => messageBubble(m)).join('')
  }

  function messageBubble(m) {
    const isUser = m.role === 'user'
    return `
      <div style="display:flex;${isUser ? 'justify-content:flex-end' : 'justify-content:flex-start'}">
        <div style="max-width:75%;${isUser ? '' : 'display:flex;gap:8px;align-items:flex-start'}">
          ${!isUser ? `<span style="font-size:1.2rem;flex-shrink:0">${activeOfficer.emoji}</span>` : ''}
          <div style="
            background:${isUser ? 'var(--primary)' : 'var(--surface-2)'};
            color:${isUser ? '#fff' : 'var(--text)'};
            padding:10px 14px;border-radius:${isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px'};
            font-size:0.88rem;line-height:1.5;white-space:pre-wrap;
          ">${escHtml(m.content)}</div>
        </div>
      </div>`
  }

  async function sendMessage(text) {
    if (!text.trim() || isTyping) return
    const officerId = activeOfficer.id
    const history = getHistory(officerId)
    history.push({ role: 'user', content: text })
    isTyping = true
    renderChatMessages()
    saveMessage(officerId, 'user', text)

    // Typing indicator (kept for UX — now wraps a real async Gemini call, not a fake timer)
    const msgs = document.getElementById('chat-messages')
    if (msgs) {
      const typing = document.createElement('div')
      typing.id = 'typing-indicator'
      typing.style.cssText = 'display:flex;gap:8px;align-items:center'
      typing.innerHTML = `<span style="font-size:1.2rem">${activeOfficer.emoji}</span><div style="background:var(--surface-2);padding:10px 14px;border-radius:18px;font-size:0.8rem;color:var(--text-muted)">กำลังคิด<span class="typing-dots">...</span></div>`
      msgs.appendChild(typing)
      msgs.scrollTop = msgs.scrollHeight
    }

    let reply
    try {
      const systemPrompt = buildSystemPrompt(activeOfficer)
      reply = await askAiOfficer(officerId, text, history, systemPrompt)
    } catch (err) {
      reply = `⚠️ เกิดข้อผิดพลาดในการเชื่อมต่อ AI: ${err.message}`
    }
    history.push({ role: 'assistant', content: reply })
    saveMessage(officerId, 'assistant', reply)
    isTyping = false
    if (activeOfficer.id === officerId) renderChatMessages()
  }

  function renderChatMessages() {
    const msgs = document.getElementById('chat-messages')
    if (!msgs) return
    msgs.innerHTML = renderMessages()
    scrollChat()
  }

  function scrollChat() {
    const msgs = document.getElementById('chat-messages')
    if (msgs) msgs.scrollTop = msgs.scrollHeight
  }

  function bindChatEvents() {
    const input = document.getElementById('chat-input')
    const sendBtn = document.getElementById('chat-send')
    sendBtn?.addEventListener('click', () => {
      const t = input?.value.trim()
      if (!t) return
      if (input) input.value = ''
      sendMessage(t)
    })
    input?.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendBtn?.click() }
    })
    document.querySelectorAll('.quick-prompt').forEach(btn => {
      btn.addEventListener('click', () => {
        sendMessage(btn.dataset.q)
      })
    })
  }

  function bindOfficerSelect() {
    document.querySelectorAll('.officer-item').forEach(item => {
      item.addEventListener('click', async () => {
        const oid = item.dataset.oid
        activeOfficer = OFFICERS.find(o => o.id === oid) || activeOfficer
        renderPage()
        if (!loadedOfficers.has(oid)) {
          await loadHistory(oid)
          if (container.__routerGen === myGen && activeOfficer.id === oid) renderPage()
        }
      })
    })
  }

  await loadHistory(activeOfficer.id)
  if (container.__routerGen !== myGen) return
  renderPage()
}
