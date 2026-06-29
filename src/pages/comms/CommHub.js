import { listDocs, createDoc, seedDemoData } from '../../core/db.js'
import { showToast, getState } from '../../core/store.js'
import { formatDate, timeAgo, initials } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const CHANNELS = [
  { id: 'general', name: '# ทั่วไป', emoji: '💬', desc: 'ประกาศและสนทนาทั่วไป' },
  { id: 'sales', name: '# ทีมขาย', emoji: '🚗', desc: 'เฉพาะทีมขาย' },
  { id: 'service', name: '# ทีมบริการ', emoji: '🔧', desc: 'เฉพาะทีมบริการ' },
  { id: 'management', name: '# บริหาร', emoji: '🏆', desc: 'ผู้บริหารและผู้จัดการ' },
  { id: 'announcements', name: '📢 ประกาศ', emoji: '📢', desc: 'ประกาศสำคัญจากบริหาร' },
]

const DEMO_MESSAGES = {
  general: [
    { id:'m1', author:'อรนุช สายใจ', role:'Sales Manager', content:'สวัสดีทีมงานทุกคน! ขอต้อนรับเดือนใหม่ ช่วยกัน push ยอดให้ถึง target นะครับ 🚀', createdAt:'2025-06-09T08:00:00Z', reactions:['👍','❤️'] },
    { id:'m2', author:'วิชาญ มีโชค', role:'Sales Executive', content:'วันนี้มีลูกค้านัด Test Drive BYD Seal 2 คัน น่าจะปิดได้เลย! 💪', createdAt:'2025-06-09T09:15:00Z', reactions:['🔥'] },
    { id:'m3', author:'ธีรยุทธ เก่งกาจ', role:'Service Advisor', content:'แจ้งทีมว่าอะไหล่ Filter น้ำมันมาแล้ว งานค้างสามารถนัดลูกค้าได้เลยครับ', createdAt:'2025-06-09T10:30:00Z', reactions:[] },
    { id:'m4', author:'นภา จันทร์งาม', role:'Finance Officer', content:'เตือนทีมขายส่ง Invoice เดือนนี้ภายในพรุ่งนี้ด้วยนะคะ', createdAt:'2025-06-09T11:00:00Z', reactions:['👍','👍'] },
  ],
  announcements: [
    { id:'a1', author:'ทวีศักดิ์ สุขสมบัติเสถียร', role:'Owner', content:'🎉 ยินดีกับทีมขายที่ทำยอดได้ 125% ของ Target เดือนที่ผ่านมา! ขอบคุณทุกคนครับ\n\n📢 เดือนนี้มีโปรโมชั่นพิเศษ BYD Atto 3 ลดเพิ่ม 30,000 บาท สำหรับลูกค้าที่ Trade-in เท่านั้น', createdAt:'2025-06-01T09:00:00Z', reactions:['🎉','👍','❤️'] },
    { id:'a2', author:'ทวีศักดิ์ สุขสมบัติเสถียร', role:'Owner', content:'📋 นโยบายใหม่: พนักงานทุกคนต้องเข้า Training EV Technology ภายใน Q3 นี้ ติดต่อ LEARN สำหรับตารางเรียนครับ', createdAt:'2025-06-05T14:00:00Z', reactions:['👍'] },
  ],
  sales: [
    { id:'s1', author:'อรนุช สายใจ', role:'Sales Manager', content:'Meeting ทีมขายทุกวันจันทร์ 9:00 น. ห้อง Training ครับ\n\nAgenda:\n• Review Pipeline\n• New Leads\n• Target Week', createdAt:'2025-06-09T07:30:00Z', reactions:['👍','👍','👍'] },
  ],
  service: [
    { id:'sv1', author:'ธีรยุทธ เก่งกาจ', role:'Service Advisor', content:'ช่างทุกคนรบกวน Update สถานะ Job Card ก่อนกลับบ้านทุกวันด้วยนะครับ ขอบคุณ', createdAt:'2025-06-08T17:00:00Z', reactions:['👍'] },
  ],
  management: [
    { id:'mg1', author:'ทวีศักดิ์ สุขสมบัติเสถียร', role:'Owner', content:'📊 Board Meeting วันศุกร์ 15:00 น.\nหัวข้อ: Q2 Review + Q3 Planning\nนำข้อมูลยอดขายและ P&L มาด้วยครับ', createdAt:'2025-06-07T10:00:00Z', reactions:[] },
  ],
}

const AVATAR_COLORS = ['primary', 'accent', 'success', 'warning', 'danger']
function avatarColor(name) {
  let sum = 0; for (const c of name) sum += c.charCodeAt(0)
  return AVATAR_COLORS[sum % AVATAR_COLORS.length]
}

export default async function CommHubPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let activeChannel = CHANNELS[0]
  const messages = JSON.parse(JSON.stringify(DEMO_MESSAGES))
  const user = getState('user')
  const myName = user?.displayName || 'ผู้ใช้'

  if (container.__routerGen !== myGen) return

  function getMessages(chId) {
    return messages[chId] || []
  }

  function renderPage() {
    container.innerHTML = `
      <div style="display:flex;height:calc(100vh - 56px);overflow:hidden">
        <!-- Channel list -->
        <div style="width:220px;flex-shrink:0;border-right:1px solid var(--border);display:flex;flex-direction:column;background:var(--surface-2)">
          <div style="padding:14px 12px;font-weight:700;font-size:0.85rem;color:var(--text-muted);border-bottom:1px solid var(--border)">💬 Communication Hub</div>
          <div style="flex:1;overflow-y:auto;padding:8px 0">
            <div style="padding:6px 12px;font-size:0.7rem;color:var(--text-muted);font-weight:600">CHANNELS</div>
            ${CHANNELS.map(ch => `
              <div class="channel-item ${ch.id === activeChannel.id ? 'active' : ''}" data-ch="${ch.id}" style="
                padding:8px 14px;cursor:pointer;display:flex;align-items:center;gap:8px;font-size:0.88rem;
                ${ch.id === activeChannel.id ? 'background:var(--primary-dim);color:var(--primary);font-weight:600' : ''}
                border-radius:0;
              ">
                <span>${ch.emoji}</span>
                <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${ch.name}</span>
                ${getMessages(ch.id).length ? `<span style="font-size:0.7rem;color:var(--text-muted)">${getMessages(ch.id).length}</span>` : ''}
              </div>
            `).join('')}
          </div>

          <!-- Online users -->
          <div style="padding:12px;border-top:1px solid var(--border)">
            <div style="font-size:0.7rem;color:var(--text-muted);font-weight:600;margin-bottom:8px">ออนไลน์</div>
            ${['อรนุช สายใจ','วิชาญ มีโชค','ธีรยุทธ เก่งกาจ'].map(name => `
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
                <div style="position:relative">
                  <div style="width:26px;height:26px;border-radius:50%;background:var(--${avatarColor(name)}-dim);display:flex;align-items:center;justify-content:center;font-size:0.65rem;font-weight:700;color:var(--${avatarColor(name)})">${initials(name)}</div>
                  <div style="position:absolute;bottom:0;right:0;width:8px;height:8px;border-radius:50%;background:var(--success);border:1px solid var(--surface-2)"></div>
                </div>
                <span style="font-size:0.78rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${name.split(' ')[0]}</span>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Chat -->
        <div style="flex:1;display:flex;flex-direction:column;overflow:hidden">
          <!-- Channel header -->
          <div style="padding:12px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;flex-shrink:0">
            <span style="font-size:1.3rem">${activeChannel.emoji}</span>
            <div>
              <div style="font-weight:700">${activeChannel.name}</div>
              <div style="font-size:0.75rem;color:var(--text-muted)">${activeChannel.desc}</div>
            </div>
            <div style="margin-left:auto">
              ${activeChannel.id === 'announcements'
                ? `<button class="btn btn-primary btn-sm" id="new-announce-btn">📢 ประกาศใหม่</button>`
                : `<button class="btn btn-secondary btn-sm" id="pin-msg-btn">📌 Pinned</button>`
              }
            </div>
          </div>

          <!-- Messages -->
          <div id="chat-messages" style="flex:1;overflow-y:auto;padding:16px 20px;display:flex;flex-direction:column;gap:2px">
            ${renderMessages()}
          </div>

          <!-- Input area -->
          ${activeChannel.id !== 'announcements' ? `
            <div style="padding:12px 20px;border-top:1px solid var(--border);background:var(--surface)">
              <div style="display:flex;gap:8px;align-items:flex-end">
                <textarea class="input" id="msg-input" rows="2" placeholder="ส่งข้อความไปที่ ${activeChannel.name}..." style="flex:1;resize:none;line-height:1.4"></textarea>
                <button class="btn btn-primary" id="msg-send" style="flex-shrink:0">ส่ง</button>
              </div>
              <div style="font-size:0.7rem;color:var(--text-muted);margin-top:4px">Enter ส่ง • Shift+Enter ขึ้นบรรทัดใหม่</div>
            </div>
          ` : `
            <div style="padding:12px 20px;border-top:1px solid var(--border);font-size:0.8rem;color:var(--text-muted);text-align:center">
              📢 Channel นี้สำหรับประกาศจากบริหารเท่านั้น
            </div>
          `}
        </div>
      </div>
    `

    bindEvents()
    scrollToBottom()
  }

  function renderMessages() {
    const msgs = getMessages(activeChannel.id)
    if (!msgs.length) {
      return `<div style="text-align:center;padding:48px;color:var(--text-muted)">
        <div style="font-size:2.5rem;margin-bottom:8px">${activeChannel.emoji}</div>
        <div>ยังไม่มีข้อความใน ${activeChannel.name}</div>
        <div style="font-size:0.78rem;margin-top:4px">เริ่มสนทนาแรกได้เลย!</div>
      </div>`
    }

    let lastDate = ''
    return msgs.map(m => {
      const msgDate = m.createdAt ? formatDate(m.createdAt) : ''
      let divider = ''
      if (msgDate !== lastDate) {
        lastDate = msgDate
        divider = `<div style="text-align:center;margin:12px 0;font-size:0.72rem;color:var(--text-muted);display:flex;align-items:center;gap:8px">
          <div style="flex:1;height:1px;background:var(--border)"></div>
          <span>${msgDate}</span>
          <div style="flex:1;height:1px;background:var(--border)"></div>
        </div>`
      }
      const isMe = m.author === myName
      const ac = avatarColor(m.author)
      return divider + `
        <div style="display:flex;gap:10px;align-items:flex-start;padding:4px 0;${isMe?'flex-direction:row-reverse':''}" class="msg-row" data-mid="${m.id}">
          <div style="width:32px;height:32px;border-radius:50%;background:var(--${ac}-dim);display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:700;color:var(--${ac});flex-shrink:0">
            ${initials(m.author)}
          </div>
          <div style="max-width:70%;${isMe?'align-items:flex-end':''}">
            <div style="display:flex;gap:8px;align-items:baseline;margin-bottom:3px;${isMe?'flex-direction:row-reverse':''}">
              <span style="font-weight:600;font-size:0.83rem;color:var(--${ac})">${escHtml(m.author)}</span>
              <span style="font-size:0.7rem;color:var(--text-muted)">${timeAgo(m.createdAt)}</span>
              <span style="font-size:0.7rem;color:var(--text-muted)">• ${escHtml(m.role || '')}</span>
            </div>
            <div style="background:${isMe?'var(--primary)':'var(--surface-2)'};color:${isMe?'#fff':'var(--text)'};padding:10px 14px;border-radius:${isMe?'16px 16px 4px 16px':'16px 16px 16px 4px'};font-size:0.88rem;line-height:1.55;white-space:pre-wrap">
              ${escHtml(m.content)}
            </div>
            ${m.reactions?.length ? `<div style="margin-top:4px;display:flex;gap:3px;${isMe?'justify-content:flex-end':''}">
              ${[...new Set(m.reactions)].map(r => `<span style="background:var(--surface-3);border-radius:99px;padding:2px 7px;font-size:0.75rem;cursor:pointer" class="reaction-btn" data-mid="${m.id}" data-r="${r}">${r} ${m.reactions.filter(x=>x===r).length}</span>`).join('')}
            </div>` : ''}
          </div>
        </div>`
    }).join('')
  }

  function scrollToBottom() {
    const msgs = document.getElementById('chat-messages')
    if (msgs) msgs.scrollTop = msgs.scrollHeight
  }

  function bindEvents() {
    document.querySelectorAll('.channel-item').forEach(item => {
      item.addEventListener('click', () => {
        activeChannel = CHANNELS.find(c => c.id === item.dataset.ch) || activeChannel
        renderPage()
      })
    })

    const input = document.getElementById('msg-input')
    const sendBtn = document.getElementById('msg-send')
    sendBtn?.addEventListener('click', sendMsg)
    input?.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg() }
    })

    document.getElementById('new-announce-btn')?.addEventListener('click', () => {
      const { el, close } = openModal({
        title: '📢 ประกาศใหม่', size: 'md',
        body: `<div style="display:flex;flex-direction:column;gap:12px">
          <div class="input-group"><label class="input-label">ข้อความประกาศ</label><textarea class="input" id="ann-text" rows="5" placeholder="พิมพ์ข้อความประกาศ..."></textarea></div>
        </div>`,
        footer: `<button class="btn btn-secondary" id="anc">ยกเลิก</button><button class="btn btn-primary" id="ans">📢 ประกาศ</button>`
      })
      el.querySelector('#anc').addEventListener('click', close)
      el.querySelector('#ans').addEventListener('click', () => {
        const txt = el.querySelector('#ann-text').value.trim()
        if (!txt) return
        const msg = { id: 'a' + Date.now(), author: myName || 'Owner', role: 'Owner', content: txt, createdAt: new Date().toISOString(), reactions: [] }
        if (!messages.announcements) messages.announcements = []
        messages.announcements.push(msg)
        showToast('📢 ประกาศแล้ว', 'success'); close(); renderPage()
      })
    })

    document.querySelectorAll('.reaction-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const msgId = btn.dataset.mid; const r = btn.dataset.r
        const ch = messages[activeChannel.id]
        const m = ch?.find(x => x.id === msgId)
        if (!m) return
        if (!m.reactions) m.reactions = []
        m.reactions.push(r)
        // Re-render messages only
        const container2 = document.getElementById('chat-messages')
        if (container2) { container2.innerHTML = renderMessages(); bindEvents() }
      })
    })
  }

  function sendMsg() {
    const input = document.getElementById('msg-input')
    const text = input?.value.trim()
    if (!text) return
    if (input) input.value = ''
    const msg = {
      id: 'm' + Date.now(), author: myName, role: getState('user')?.role || 'Staff',
      content: text, createdAt: new Date().toISOString(), reactions: []
    }
    if (!messages[activeChannel.id]) messages[activeChannel.id] = []
    messages[activeChannel.id].push(msg)
    const msgsEl = document.getElementById('chat-messages')
    if (msgsEl) { msgsEl.innerHTML = renderMessages(); bindEvents() }
    scrollToBottom()
  }

  renderPage()
}
