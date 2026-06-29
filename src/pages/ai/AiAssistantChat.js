import { showToast } from '../../core/store.js'

const CANNED = [
  { kw:['ยอดขาย','ขายได้','เดือนนี้','ยอด'], ans:'📊 ยอดขายเดือนนี้: <strong>41 คัน</strong> รายได้ ฿51.96M — เกินเป้า 5% 🎉<br>Top model: BYD Dolphin (12 คัน) · Top เซลส์: วิชัย (9 คัน)' },
  { kw:['สต็อก','รถเหลือ','คงเหลือ','สต็อคเหลือ'], ans:'📦 สต็อกปัจจุบัน: <strong>45 คัน</strong> (จองแล้ว 8)<br>⚠️ ต่ำกว่าเป้า: BYD Seal (3/6), BYD Han (2/4) — แนะนำสั่งเพิ่ม' },
  { kw:['lead','ลีด','hot','ลูกค้า hot'], ans:'🧲 Lead ทั้งหมด 48 ราย — <strong>🔥 Hot 5 ราย</strong> รวมมูลค่า ฿6.2M<br>เร่งด่วน: ประพันธ์ มั่งมี (score 92) สนใจ Seal AWD — ควรโทรวันนี้!' },
  { kw:['ค้างชำระ','หนี้','เก็บเงิน','ar'], ans:'💳 ค้างชำระรวม <strong>฿585,800</strong> จาก 5 ราย<br>🚨 เกิน 60 วัน: ร้านเช่ารถ XYZ (฿86,000) — แนะนำผู้จัดการติดตามเอง' },
  { kw:['csat','ความพอใจ','รีวิว','ลูกค้าพอใจ'], ans:'⭐ CSAT เดือนนี้ <strong>4.7/5</strong> (↑ จาก 4.6)<br>รีวิวรอตอบ 2 รายการ — มี 1 ดาว 1 รายการเรื่องรอนาน ควรตอบภายในวันนี้' },
  { kw:['ช่าง','เทคนิค','บริการ','งานซ่อม','ศูนย์'], ans:'🔧 ศูนย์บริการวันนี้: งาน 12/15 เป้า · ช่างเข้า 5/5 คน<br>Bay ด่วนใช้งาน 91% — ใกล้เต็ม · วิทยา ช่างใหญ่ ผลงานดีสุด (Eff 94%)' },
  { kw:['กำไร','margin','การเงิน','รายได้'], ans:'💰 กำไรสุทธิเดือนนี้ (ประมาณการ): <strong>฿1.99M</strong> margin 14.6%<br>ค่าใช้จ่ายรอปิด: เงินเดือน + คอมมิชชั่น — ปิดงบได้หลังอนุมัติ OT' },
  { kw:['พนักงาน','hr','เงินเดือน','staff'], ans:'👥 พนักงานปัจจุบัน 23 คน · ลา 2 คนวันนี้<br>เงินเดือนรอบนี้รวม ฿860,000 — OT เพิ่ม ฿42,000 · รอ approval HR Manager' },
  { kw:['ประกัน','insurance','ต่อประกัน'], ans:'🛡 ประกันรถลูกค้าครบกำหนด <strong>8 คัน</strong> ใน 30 วันนี้<br>แนะนำ: โทรหา 3 รายสูงสุด คาดเบี้ย ฿240,000 · CARI ราคาดีสุดสำหรับ EV' },
  { kw:['การตลาด','campaign','โปรโมชั่น','ads'], ans:'📣 Campaign เดือนนี้: <strong>3 campaign</strong> ใช้งาน<br>Facebook Ads ยอด CTR 3.2% — ดีกว่าเดือนก่อน · Line OA ส่ง 1,200 คน open rate 48%' },
  { kw:['เป้า','target','quota'], ans:'🎯 เป้าเดือนนี้: 39 คัน — ทำได้แล้ว 41 คัน (105%) ✅<br>Carry-over สู่เดือนหน้า: เป้า 42 คัน · ทีม A นำ 18 คัน / ทีม B 23 คัน' },
  { kw:['ราคา','price','ราคารถ','byd','mg','deepal','neta'], ans:'💴 ราคาโดยประมาณ (ราคาป้ายจากศูนย์):<br>BYD Seal 4WD ฿1.299M · BYD Dolphin ฿749K · MG4 X ฿949K<br>DEEPAL S7 Pro ฿1.479M · NETA V II ฿649K' },
  { kw:['ขอบคุณ','thank','ดีมาก','เยี่ยม'], ans:'😊 ยินดีค่ะ! LAMI พร้อมช่วยเสมอ — มีอะไรให้ช่วยอีกไหมคะ?' },
  { kw:['สวัสดี','hello','หวัดดี','ดีจ้า'], ans:'👋 สวัสดีค่ะ! LAMI AI พร้อมตอบทุกคำถามเรื่องธุรกิจค่ะ ถามได้เลย!' },
]

const CATEGORIES = [
  { label:'📊 ยอดขาย', q:'ยอดขายเดือนนี้เท่าไหร่?' },
  { label:'📦 สต็อก', q:'สต็อกรถเหลือกี่คัน?' },
  { label:'🔥 Hot Lead', q:'มี Hot Lead ไหม?' },
  { label:'💳 ค้างชำระ', q:'ใครค้างชำระบ้าง?' },
  { label:'⭐ CSAT', q:'CSAT เป็นยังไง?' },
  { label:'🔧 ช่าง', q:'ศูนย์บริการวันนี้เป็นยังไง?' },
  { label:'💰 กำไร', q:'กำไรเดือนนี้เท่าไหร่?' },
  { label:'👥 HR', q:'ข้อมูลพนักงานวันนี้?' },
]

function findAnswer(q) {
  const lower = q.toLowerCase()
  const m = CANNED.find(c => c.kw.some(k => lower.includes(k)))
  return m?.ans || '🤔 ขอโทษค่ะ ยังไม่เข้าใจคำถามนี้<br>ลองถามเรื่อง: <strong>ยอดขาย / สต็อก / Lead / หนี้ค้าง / CSAT / ช่าง / กำไร / ประกัน</strong> หรือเลือกหัวข้อด้านล่างได้เลยค่ะ'
}

function now() {
  return new Date().toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'})
}

export default function AiAssistantChatPage(container) {
  let messages = [
    { role:'ai', text:'สวัสดีค่ะ! 🤖 ฉัน <strong>LAMI</strong> — ผู้ช่วย AI ของ LAMOM ONE<br>ถามได้ทุกอย่างเรื่องธุรกิจ: ยอดขาย สต็อก Lead กำไร ช่าง HR ประกัน ฯลฯ', time:now() },
  ]
  let waiting = false

  function msgHtml(m) {
    const isUser = m.role === 'user'
    return `<div style="display:flex;${isUser?'justify-content:flex-end':'align-items:flex-start;gap:8px'}">
      ${!isUser ? `<div style="width:30px;height:30px;border-radius:50%;background:var(--primary);display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0">🤖</div>` : ''}
      <div>
        <div style="max-width:74vw;padding:10px 14px;border-radius:${isUser?'16px 16px 4px 16px':'4px 16px 16px 16px'};background:${isUser?'var(--primary)':'var(--surface-2)'};color:${isUser?'white':'var(--text)'};font-size:0.84rem;line-height:1.65">${m.text}</div>
        <div style="font-size:0.66rem;color:var(--text-muted);margin-top:3px;${isUser?'text-align:right':''}">${m.time}</div>
      </div>
    </div>`
  }

  function typingHtml() {
    return `<div style="display:flex;align-items:flex-start;gap:8px" id="typing-bubble">
      <div style="width:30px;height:30px;border-radius:50%;background:var(--primary);display:flex;align-items:center;justify-content:center;font-size:1rem">🤖</div>
      <div style="padding:12px 16px;border-radius:4px 16px 16px 16px;background:var(--surface-2)">
        <span style="display:inline-flex;gap:4px">
          <span style="width:7px;height:7px;border-radius:50%;background:var(--text-muted);animation:pulse 1s ease-in-out 0s infinite"></span>
          <span style="width:7px;height:7px;border-radius:50%;background:var(--text-muted);animation:pulse 1s ease-in-out 0.2s infinite"></span>
          <span style="width:7px;height:7px;border-radius:50%;background:var(--text-muted);animation:pulse 1s ease-in-out 0.4s infinite"></span>
        </span>
      </div>
    </div>`
  }

  function renderPage() {
    container.innerHTML = `
      <style>@keyframes pulse{0%,80%,100%{opacity:.25}40%{opacity:1}}</style>
      <div class="page-content animate-slide" style="display:flex;flex-direction:column;height:calc(100vh - 56px);padding-bottom:0">
        <div class="page-header" style="padding-bottom:8px;margin-bottom:0">
          <div style="display:flex;align-items:center;gap:10px">
            <div style="width:36px;height:36px;border-radius:50%;background:var(--primary);display:flex;align-items:center;justify-content:center;font-size:1.3rem">🤖</div>
            <div>
              <div class="page-title" style="margin:0">LAMI — AI Business Assistant</div>
              <div style="font-size:0.72rem;color:var(--success);font-weight:600">● พร้อมใช้งาน · ตอบจากข้อมูลจริงในระบบ</div>
            </div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary btn-sm" id="clear-chat">🗑 ล้างแชท</button>
          </div>
        </div>

        <!-- Category chips -->
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin:8px 0;padding-bottom:8px;border-bottom:1px solid var(--border)">
          ${CATEGORIES.map(c => `<button class="btn btn-xs btn-secondary cat-btn" data-q="${c.q}">${c.label}</button>`).join('')}
        </div>

        <!-- Chat messages -->
        <div style="flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:12px;padding:12px 0" id="chat-area">
          ${messages.map(msgHtml).join('')}
          ${waiting ? typingHtml() : ''}
        </div>

        <!-- Input bar -->
        <div style="padding:10px 0;border-top:1px solid var(--border);display:flex;gap:8px">
          <input class="input" id="chat-input" placeholder="พิมพ์คำถาม เช่น ยอดขายวันนี้ / Hot Lead / กำไรเดือนนี้..." style="flex:1" ${waiting?'disabled':''}>
          <button class="btn btn-primary" id="send-btn" ${waiting?'disabled':''} style="white-space:nowrap">📤 ส่ง</button>
        </div>
      </div>
    `

    const chatArea = document.getElementById('chat-area')
    if (chatArea) chatArea.scrollTop = chatArea.scrollHeight

    function send(q) {
      const text = q.trim()
      if (!text || waiting) return
      document.getElementById('chat-input').value = ''
      messages.push({ role:'user', text, time:now() })
      waiting = true
      renderPage()
      setTimeout(() => {
        messages.push({ role:'ai', text:findAnswer(text), time:now() })
        waiting = false
        renderPage()
      }, 600 + Math.random()*400)
    }

    document.getElementById('send-btn')?.addEventListener('click', () => send(document.getElementById('chat-input')?.value || ''))
    document.getElementById('chat-input')?.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(e.target.value) } })
    container.querySelectorAll('.cat-btn').forEach(b => b.addEventListener('click', () => send(b.dataset.q)))
    document.getElementById('clear-chat')?.addEventListener('click', () => {
      messages = [{ role:'ai', text:'🗑 ล้างแชทแล้วค่ะ — ถามใหม่ได้เลย!', time:now() }]
      waiting = false
      renderPage()
    })
    if (!waiting) document.getElementById('chat-input')?.focus()
  }

  renderPage()
}
