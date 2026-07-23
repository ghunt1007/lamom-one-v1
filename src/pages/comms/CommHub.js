import { watchDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'
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

const AVATAR_COLORS = ['primary', 'accent', 'success', 'warning', 'danger']
function avatarColor(name) {
  let sum = 0; for (const c of name) sum += c.charCodeAt(0)
  return AVATAR_COLORS[sum % AVATAR_COLORS.length]
}

export default async function CommHubPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let activeChannel = CHANNELS[0]
  const messages = {} // channel id -> real messages, populated as each channel is subscribed to
  const user = getState('user')
  const myName = user?.displayName || 'ผู้ใช้'

  function getMessages(chId) {
    return messages[chId] || []
  }

  container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`

  // Real-time: สลับ channel ต้อง unsubscribe ตัวเก่าก่อนเสมอ ไม่งั้น listener จะค้างเพิ่มขึ้นทุกครั้งที่สลับ
  // แชทเป็น use-case ตัวอย่างของ real-time ที่สุด — ข้อความคนอื่นต้องขึ้นทันทีโดยไม่รีเฟรช
  let unsubChannel = null
  let firstSnapshotOfChannel = true
  function subscribeChannel(chId) {
    if (unsubChannel) unsubChannel()
    firstSnapshotOfChannel = true
    unsubChannel = watchDocs('comm_messages', [['channel', '==', chId]], 'createdAt', 'asc', 300, rows => {
      if (container.__routerGen !== myGen) { unsubChannel(); return }
      messages[chId] = rows
      if (firstSnapshotOfChannel) { firstSnapshotOfChannel = false; renderPage() }
      // กันเคสหายาก: unsubscribe เดิมไปแล้วแต่ snapshot ค้างท่อมาทีหลัง — chId จะไม่ตรง activeChannel แล้ว ข้ามการ render ทิ้ง
      else if (chId === activeChannel.id) { refreshMessages() }
    })
  }
  subscribeChannel(activeChannel.id)

  // อัปเดตแค่กล่องข้อความ (ไม่ full re-render หน้า) กันไม่ให้ตัดข้อความที่กำลังพิมพ์อยู่ในกล่องคุยขาดหาย
  function refreshMessages() {
    const msgsEl = document.getElementById('chat-messages')
    if (!msgsEl) return
    msgsEl.innerHTML = renderMessages()
    bindReactions()
    scrollToBottom()
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
        subscribeChannel(activeChannel.id)
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
      el.querySelector('#ans').addEventListener('click', async () => {
        const txt = el.querySelector('#ann-text').value.trim()
        if (!txt) return
        try {
          await createDoc('comm_messages', { channel: 'announcements', author: myName || 'Owner', role: 'Owner', content: txt, reactions: [] })
          showToast('📢 ประกาศแล้ว', 'success'); close()
        } catch { showToast('ประกาศไม่สำเร็จ', 'error') }
      })
    })

    bindReactions()
  }

  function bindReactions() {
    document.querySelectorAll('.reaction-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const msgId = btn.dataset.mid; const r = btn.dataset.r
        const m = getMessages(activeChannel.id).find(x => x.id === msgId)
        if (!m) return
        try { await updateDocData('comm_messages', msgId, { reactions: [...(m.reactions || []), r] }) } catch { /* เพิ่ม reaction พลาดได้ ไม่ใช่การกระทำสำคัญ */ }
      })
    })
  }

  function sendMsg() {
    const input = document.getElementById('msg-input')
    const text = input?.value.trim()
    if (!text) return
    if (input) input.value = ''
    createDoc('comm_messages', { channel: activeChannel.id, author: myName, role: getState('user')?.role || 'Staff', content: text, reactions: [] })
      .catch(() => showToast('ส่งข้อความไม่สำเร็จ', 'error'))
  }

  return function cleanupCommHub() { if (unsubChannel) unsubChannel() }
}
