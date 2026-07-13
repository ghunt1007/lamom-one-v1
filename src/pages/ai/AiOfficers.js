import { getState, showToast } from '../../core/store.js'
import { listDocs, seedDemoData } from '../../core/db.js'
import { formatCurrency } from '../../utils/format.js'

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

export default async function AiOfficersPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let activeOfficer = OFFICERS[0]
  let chatHistory = {} // id → [{role, content}]
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

  function getHistory(id) {
    if (!chatHistory[id]) chatHistory[id] = []
    return chatHistory[id]
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
              <div style="font-weight:700">${activeOfficer.name}</div>
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

  function generateReply(prompt, officerId) {
    const o = OFFICERS.find(x => x.id === officerId)
    const lp = prompt.toLowerCase()

    // Context-aware responses based on officer + prompt
    const responses = {
      aria: {
        default: () => `ขอบคุณครับ ผมได้รับข้อความแล้ว ขณะนี้ระบบมีข้อมูลดังนี้:\n\n📊 ลูกค้า ${stats.customers} ราย\n🚗 สต็อกรถ ${stats.vehicles} คัน\n🔧 งานซ่อม ${stats.jobs} งาน\n🧲 Leads ${stats.leads} ราย\n\nมีอะไรให้ช่วยวิเคราะห์เพิ่มเติมไหมครับ?`,
        'สรุปยอดขาย': () => `📊 สรุปยอดขายวันนี้:\n\n• รถที่ขายได้: 0 คัน (Demo Mode)\n• ยอดขายรวม: ฿0\n• กำไรสุทธิ: ฿0\n\nระบบกำลัง Real-time เมื่อเชื่อมต่อ Firebase จริงครับ`,
        'ค้างอยู่': () => `📋 รายการที่ค้างอยู่:\n\n⚠️ PDI: ${stats.vehicles > 0 ? '1 คัน' : '0 คัน'}\n🔧 Job Cards: ${stats.jobs} งาน\n🧲 Follow-up Leads: ${stats.leads} ราย\n\nแนะนำให้จัดลำดับ Priority ครับ`,
      },
      sam: {
        default: () => `💼 วิเคราะห์ Sales Pipeline:\n\n🧲 Total Leads: ${stats.leads} ราย\n📈 Pipeline Value: ฿5,700,000 (ประมาณ)\n\nLead ที่น่าสนใจที่สุดคือ Qualified stage ควร Follow-up วันนี้เลยครับ!`,
        'pipeline': () => `📋 Pipeline Analysis:\n\n• New: 2 ราย\n• Contacted: 1 ราย\n• Interested: 1 ราย\n• Qualified: 1 ราย ← โฟกัสตรงนี้!\n\n💡 Tips: Qualified Lead ควรได้รับ Test Drive เพื่อปิดดีลใน 48 ชม.ครับ`,
        'ปิดดีล': () => `🎯 Sales Script สำหรับ BYD Seal:\n\n1. เน้นจุดแข็ง: รับประกันแบตฯ 8 ปี\n2. เปรียบกับรถน้ำมัน: ประหยัด ฿3,000/เดือน\n3. Urgency: "ราคานี้เหลืออีก 2 คัน"\n4. Offer: ฟรีแผ่นพื้นรถ + ฟิล์ม\n\nลองใช้ดูนะครับ! 🚀`,
      },
      finn: {
        default: () => `💰 Finance Summary:\n\nยอดขายรวม: ฿4,496,000\nGross Margin: ~12.5%\nNet Profit: ฿560,000+\n\nMargin ดีกว่าค่าเฉลี่ยอุตสาหกรรมครับ (8-10%) 📈`,
        'margin': () => `📊 Margin Analysis:\n\n• BYD Seal AWD: Margin 15.6% ✅\n• MG4 X: Margin 13.2% ✅\n• DEEPAL S7: Margin 16.5% 🏆\n• NETA V II: Margin 12.5% ⚠️\n\nแนะนำ: เพิ่ม accessory package กับ NETA เพื่อ Margin ขึ้นครับ`,
        'payroll': () => `💳 Payroll Estimate:\n\nพนักงาน 5 คน\nเงินเดือนรวม: ฿85,000/เดือน\nประกันสังคม (5%): ฿4,250\nเบิกจ่ายรวม: ฿89,250/เดือน\n\nข้อมูล Real-time หลัง Firebase ตั้งค่าครับ`,
      },
      mika: {
        default: () => `📣 Marketing Insights:\n\nROI สูงสุด: TikTok (+320%) 🏆\nLeads เดือนนี้: 147 ราย\nConversion Rate: 4.8%\n\nแนะนำเพิ่ม Budget TikTok และ LINE OA ครับ`,
        'post': () => `✍️ Content สำหรับ BYD Seal:\n\n"🚗⚡ BYD SEAL AWD ราคาแค่ 1.299 ล้าน!\n• รับประกันแบตฯ 8 ปี\n• 0-100 ใน 3.8 วินาที\n• ชาร์จ 15 นาที วิ่งได้ 200 กม.\n📲 ทักหาเราได้เลย!"`,
        'campaign': () => `📊 Campaign Performance:\n\n1. TikTok BYD Launch: ROI +320% 🏆\n2. Facebook Test Drive: ROI +180%\n3. LINE OA Trade-in: ROI +150%\n\nแนะนำทำ Retargeting คนที่เคย Engage กับ TikTok ครับ`,
      },
      serv: {
        default: () => `🔧 Service Summary:\n\nงานซ่อมวันนี้: ${stats.jobs} งาน\nเบย์ที่ใช้งาน: 3/6\nอะไหล่ใกล้หมด: 1 รายการ\n\nงานเร่งด่วน: Job JOB-2025-002 วินิจฉัย AC ไม่เย็น ควรเช็คก่อนเลย`,
      },
      hera: {
        default: () => `👥 HR Summary:\n\nพนักงานทั้งหมด: 5 คน\nทำงานปกติ: 4 คน\nทดลองงาน: 1 คน\n\nKPI เดือนนี้: อรนุช เซลส์ดี = Top Performer 🏆\nแนะนำ: Review Performance ทุก 3 เดือนครับ`,
      },
      learn: {
        default: () => `🎓 Training Update:\n\nคอร์สที่เสร็จแล้ว: 67%\nคอร์สบังคับที่ยังไม่ผ่าน: 2 คอร์ส\n\nแนะนำ: "EV Technology Fundamentals" สำหรับช่างใหม่\nและ "Sales Technique Advanced" สำหรับเซลส์ทีม`,
        'สเปค': () => `🚗 BYD Seal Spec:\n\n• Motor: Rear-Wheel Drive / AWD\n• Battery: 82.56 kWh\n• Range: 580 km (CLTC)\n• 0-100: 3.8 sec (AWD)\n• Fast Charge: 150 kW DC\n• ราคา: 1,199,000 - 1,299,000 บาท\n• ประกัน: 5 ปี / แบตฯ 8 ปี`,
      },
      apex: {
        default: () => `🏆 Market Analysis:\n\nตลาด EV ไทย 2025:\n• BYD: Market Share 35%\n• MG: 22%\n• NETA: 8%\n\nโอกาส: Charging Infrastructure + Fleet Sales\n\nกลยุทธ์แนะนำ: B2B Corporate Fleet + Government Bid Q3`,
      },
      nova: {
        default: () => `🛸 System Status:\n\n✅ Database: Online\n✅ Auth: Active\n✅ Storage: 23% used\n✅ Functions: Running\n\n⚠️ Note: Firebase config ยังใช้ Placeholder key\nระบบทำงานใน Demo Mode\n\nไม่พบ Error ที่สำคัญครับ`,
      },
    }

    const officerRes = responses[officerId] || {}
    // Find matching keyword
    for (const [key, fn] of Object.entries(officerRes)) {
      if (key !== 'default' && lp.includes(key.toLowerCase())) return fn()
    }
    return officerRes.default ? officerRes.default() : `ขอบคุณที่ถามครับ! ผม ${o?.name} จะวิเคราะห์ข้อมูลให้นะครับ...\n\nขณะนี้ระบบ AI กำลังเชื่อมต่อกับ Claude API (Phase ถัดไป)\nตอนนี้ผมทำงานด้วย Demo responses ก่อนนะครับ 🚀`
  }

  function sendMessage(text) {
    if (!text.trim() || isTyping) return
    const history = getHistory(activeOfficer.id)
    history.push({ role: 'user', content: text })
    isTyping = true
    renderChatMessages()
    // Typing indicator
    const msgs = document.getElementById('chat-messages')
    if (msgs) {
      const typing = document.createElement('div')
      typing.id = 'typing-indicator'
      typing.style.cssText = 'display:flex;gap:8px;align-items:center'
      typing.innerHTML = `<span style="font-size:1.2rem">${activeOfficer.emoji}</span><div style="background:var(--surface-2);padding:10px 14px;border-radius:18px;font-size:0.8rem;color:var(--text-muted)">กำลังคิด<span class="typing-dots">...</span></div>`
      msgs.appendChild(typing)
      msgs.scrollTop = msgs.scrollHeight
    }
    setTimeout(() => {
      const reply = generateReply(text, activeOfficer.id)
      history.push({ role: 'assistant', content: reply })
      isTyping = false
      renderChatMessages()
    }, 800 + Math.random() * 700)
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
      item.addEventListener('click', () => {
        activeOfficer = OFFICERS.find(o => o.id === item.dataset.oid) || activeOfficer
        renderPage()
      })
    })
  }

  renderPage()
}
