import { askPersonalAI, extractMemories } from '../../utils/ai.js'
import { createSTT, speak, stopSpeaking, canSTT, canTTS } from '../../utils/voice.js'
import { loadMemories, addMemory, deleteMemory, saveMessage, loadRecentMessages, memoriesToContext } from '../../utils/memory.js'
import { getState } from '../../core/store.js'

function esc(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') }

export default async function PersonalAIPage(container) {
  const user = getState('user')
  const displayName = user?.displayName?.split(' ')[0] || user?.email?.split('@')[0] || 'คุณ'

  // ── State ────────────────────────────────────────────────────────────────
  let messages = []          // { role:'user'|'lami', text, imageUrl }
  let memories = []
  let history = []           // for AI context window
  let capturedImageB64 = null
  let cameraStream = null
  let recognition = null
  let isListening = false
  let isThinking = false
  let autoSpeak = canTTS
  let showMemPanel = false

  // ── Load data ─────────────────────────────────────────────────────────────
  memories = await loadMemories()
  const recentMsgs = await loadRecentMessages(16)
  history = recentMsgs

  // ── Inject styles (once) ─────────────────────────────────────────────────
  if (!document.getElementById('pai-style')) {
    const s = document.createElement('style')
    s.id = 'pai-style'
    s.textContent = `
      .pai-wrap { display:flex;flex-direction:column;height:calc(100vh - 56px);max-height:calc(100vh - 56px);overflow:hidden; }
      .pai-header { display:flex;align-items:center;justify-content:space-between;padding:12px 20px;border-bottom:1px solid var(--border);flex-shrink:0; }
      .pai-avatar { width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,var(--primary),var(--accent));display:flex;align-items:center;justify-content:center;font-size:1.3rem;box-shadow:0 0 14px var(--primary-glow); }
      .pai-status-dot { width:8px;height:8px;border-radius:50%;background:var(--success);display:inline-block;margin-right:5px; }
      .pai-status-dot.thinking { background:var(--warning);animation:blink 0.7s infinite; }
      .pai-status-dot.listening { background:var(--danger);animation:pulse-ring 1s infinite; }
      @keyframes blink { 0%,100%{opacity:1}50%{opacity:0.3} }

      .cam-bar { background:var(--surface-2);border-bottom:1px solid var(--border);padding:8px 16px;display:flex;align-items:center;gap:10px;flex-shrink:0; }
      .cam-bar video { height:100px;border-radius:var(--radius);object-fit:cover;border:2px solid var(--primary); }

      .mem-panel { background:var(--surface-2);border-bottom:1px solid var(--border);padding:12px 16px;flex-shrink:0;max-height:200px;overflow-y:auto; }
      .mem-chip { display:inline-flex;align-items:center;gap:6px;background:var(--surface);border:1px solid var(--border);border-radius:20px;padding:4px 10px;font-size:0.75rem;margin:3px;color:var(--text-2); }
      .mem-del { cursor:pointer;color:var(--text-muted);font-size:0.9rem;line-height:1; }
      .mem-del:hover { color:var(--danger); }

      .chat-msgs { flex:1;overflow-y:auto;padding:16px 20px;display:flex;flex-direction:column;gap:12px; }
      .msg-row { display:flex;align-items:flex-end;gap:8px; }
      .msg-row.user { flex-direction:row-reverse; }
      .msg-bubble { max-width:72%;padding:10px 14px;border-radius:18px;font-size:0.875rem;line-height:1.55;word-break:break-word;white-space:pre-wrap; }
      .msg-bubble.lami { background:var(--surface-2);color:var(--text);border-bottom-left-radius:4px; }
      .msg-bubble.user { background:var(--primary);color:#fff;border-bottom-right-radius:4px; }
      .msg-img { max-width:200px;border-radius:10px;margin-bottom:6px;display:block; }
      .msg-avatar { width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,var(--primary),var(--accent));display:flex;align-items:center;justify-content:center;font-size:0.9rem;flex-shrink:0; }
      .typing-dots span { display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--text-muted);animation:bounce 1.2s infinite;margin:0 2px; }
      .typing-dots span:nth-child(2){animation-delay:0.2s}
      .typing-dots span:nth-child(3){animation-delay:0.4s}
      @keyframes bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-6px)}}

      .interim-bar { padding:6px 20px;font-size:0.8rem;color:var(--primary);font-style:italic;flex-shrink:0;min-height:24px; }

      .chat-input-bar { display:flex;align-items:center;gap:8px;padding:10px 16px;border-top:1px solid var(--border);flex-shrink:0;background:var(--surface); }
      .chat-text-in { flex:1;background:var(--surface-2);border:1px solid var(--border);border-radius:24px;padding:9px 16px;font-size:0.875rem;color:var(--text);outline:none;resize:none;font-family:inherit; }
      .chat-text-in:focus { border-color:var(--primary); }
      .mic-btn { width:40px;height:40px;border-radius:50%;border:none;cursor:pointer;font-size:1.1rem;display:flex;align-items:center;justify-content:center;transition:all 0.2s;background:var(--surface-2);color:var(--text); }
      .mic-btn.active { background:var(--danger);color:#fff;box-shadow:0 0 0 0 rgba(239,68,68,0.4);animation:mic-pulse 1.2s infinite; }
      @keyframes mic-pulse{0%{box-shadow:0 0 0 0 rgba(239,68,68,0.4)}70%{box-shadow:0 0 0 10px rgba(239,68,68,0)}100%{box-shadow:0 0 0 0 rgba(239,68,68,0)}}
      .icon-btn { width:36px;height:36px;border-radius:50%;border:none;cursor:pointer;font-size:1rem;background:var(--surface-2);color:var(--text);display:flex;align-items:center;justify-content:center;transition:background 0.2s; }
      .icon-btn:hover { background:var(--surface-3,var(--border)); }
      .icon-btn.on { background:var(--primary-dim);color:var(--primary); }
      .captured-thumb { height:36px;width:36px;border-radius:8px;object-fit:cover;border:2px solid var(--primary);cursor:pointer;flex-shrink:0; }
    `
    document.head.appendChild(s)
  }

  // ── Render shell ──────────────────────────────────────────────────────────
  container.innerHTML = `
    <div class="pai-wrap">
      <div class="pai-header">
        <div style="display:flex;align-items:center;gap:12px">
          <div class="pai-avatar">🤖</div>
          <div>
            <div style="font-weight:700;font-size:0.95rem">LAMI — ผู้ช่วยส่วนตัว</div>
            <div style="font-size:0.75rem;color:var(--text-muted)">
              <span class="pai-status-dot" id="status-dot"></span>
              <span id="status-text">พร้อมคุย • จำได้ ${memories.length} เรื่อง</span>
            </div>
          </div>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <button class="icon-btn ${autoSpeak?'on':''}" id="tts-btn" title="เสียงตอบกลับ">🔊</button>
          <button class="icon-btn" id="cam-toggle-btn" title="กล้อง">📷</button>
          <button class="icon-btn" id="mem-toggle-btn" title="ความจำ (${memories.length})">🧠</button>
        </div>
      </div>

      <div class="cam-bar" id="cam-bar" style="display:none">
        <video id="cam-video" autoplay muted playsinline style="height:100px"></video>
        <div style="display:flex;flex-direction:column;gap:6px">
          <button class="btn btn-primary btn-sm" id="cam-capture-btn">📸 ถ่ายและแนบ</button>
          <button class="btn btn-secondary btn-sm" id="cam-close-btn">✕ ปิดกล้อง</button>
        </div>
      </div>

      <div class="mem-panel" id="mem-panel" style="display:none">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <span style="font-size:0.8rem;font-weight:600;color:var(--text-muted)">🧠 สิ่งที่ LAMI จำไว้</span>
          <button class="btn btn-secondary btn-sm" id="add-mem-btn">+ เพิ่ม</button>
        </div>
        <div id="mem-chips"></div>
      </div>

      <div class="chat-msgs" id="chat-msgs"></div>
      <div class="interim-bar" id="interim-bar"></div>

      <div class="chat-input-bar">
        <img id="captured-thumb" class="captured-thumb" style="display:none" title="คลิกเพื่อยกเลิกรูป">
        <textarea class="chat-text-in" id="chat-in" rows="1" placeholder="คุยกับ LAMI ได้เลย..."></textarea>
        <button class="mic-btn" id="mic-btn" title="${canSTT?'กดพูด':'เบราว์เซอร์นี้ไม่รองรับเสียง'}">🎤</button>
        <button class="btn btn-primary" id="send-btn" style="border-radius:20px;padding:8px 16px">ส่ง</button>
      </div>
    </div>
  `

  // ── Element refs ──────────────────────────────────────────────────────────
  const chatMsgs    = container.querySelector('#chat-msgs')
  const chatIn      = container.querySelector('#chat-in')
  const sendBtn     = container.querySelector('#send-btn')
  const micBtn      = container.querySelector('#mic-btn')
  const interimBar  = container.querySelector('#interim-bar')
  const statusDot   = container.querySelector('#status-dot')
  const statusText  = container.querySelector('#status-text')
  const camBar      = container.querySelector('#cam-bar')
  const camVideo    = container.querySelector('#cam-video')
  const memPanel    = container.querySelector('#mem-panel')
  const memChips    = container.querySelector('#mem-chips')
  const capturedThumb = container.querySelector('#captured-thumb')

  // ── Helpers ───────────────────────────────────────────────────────────────
  function setStatus(state) {
    const dot = statusDot
    dot.className = 'pai-status-dot ' + (state === 'thinking' ? 'thinking' : state === 'listening' ? 'listening' : '')
    const labels = { idle: `พร้อมคุย • จำได้ ${memories.length} เรื่อง`, thinking: 'กำลังคิด...', listening: 'กำลังฟัง...', speaking: 'กำลังพูด...' }
    statusText.textContent = labels[state] || labels.idle
  }

  function scrollBottom() {
    requestAnimationFrame(() => { chatMsgs.scrollTop = chatMsgs.scrollHeight })
  }

  function appendBubble(role, text, imageUrl = null) {
    const div = document.createElement('div')
    div.className = `msg-row ${role}`
    const imgHtml = imageUrl ? `<img class="msg-img" src="${imageUrl}" alt="รูปภาพ">` : ''
    if (role === 'lami') {
      div.innerHTML = `
        <div class="msg-avatar">🤖</div>
        <div class="msg-bubble lami">${imgHtml}${esc(text)}</div>`
    } else {
      div.innerHTML = `
        <div class="msg-bubble user">${imgHtml}${esc(text)}</div>`
    }
    chatMsgs.appendChild(div)
    scrollBottom()
    return div
  }

  function showTyping() {
    const div = document.createElement('div')
    div.className = 'msg-row lami'
    div.id = 'typing-indicator'
    div.innerHTML = `<div class="msg-avatar">🤖</div><div class="msg-bubble lami"><div class="typing-dots"><span></span><span></span><span></span></div></div>`
    chatMsgs.appendChild(div)
    scrollBottom()
  }

  function removeTyping() {
    document.getElementById('typing-indicator')?.remove()
  }

  function renderMemChips() {
    if (!memories.length) {
      memChips.innerHTML = '<span style="font-size:0.78rem;color:var(--text-muted)">ยังไม่มีความจำ — จะเรียนรู้จากการคุย</span>'
      return
    }
    memChips.innerHTML = memories.map(m => `
      <span class="mem-chip">
        ${esc(m.content)}
        <span class="mem-del" data-id="${m.id}">✕</span>
      </span>`).join('')
    memChips.querySelectorAll('.mem-del').forEach(btn => {
      btn.addEventListener('click', async () => {
        await deleteMemory(btn.dataset.id)
        memories = memories.filter(x => x.id !== btn.dataset.id)
        renderMemChips()
        setStatus('idle')
      })
    })
  }

  // ── Welcome message ───────────────────────────────────────────────────────
  const welcomeText = recentMsgs.length
    ? `สวัสดีอีกครั้ง ${displayName} 👋 มีอะไรให้ช่วยไหมครับ?`
    : `สวัสดี ${displayName} ครับ! 👋\n\nผมคือ LAMI ผู้ช่วยส่วนตัวของคุณ พร้อมช่วยทุกเรื่อง — สุขภาพ กฎหมาย การเงิน ธุรกิจ ปัญหาชีวิต หรืออะไรก็ตาม\n\nคุยได้เลยครับ ทั้งพิมพ์และพูด 🎤`
  appendBubble('lami', welcomeText)

  // Restore recent messages visually
  if (recentMsgs.length) {
    const recent = recentMsgs.slice(-6)
    recent.forEach(m => appendBubble(m.role, m.content))
  }

  renderMemChips()

  // ── Send message ──────────────────────────────────────────────────────────
  async function sendMessage(text) {
    text = text?.trim()
    if (!text && !capturedImageB64) return
    if (isThinking) return

    stopSpeaking()
    const imgUrl = capturedImageB64 ? `data:image/jpeg;base64,${capturedImageB64}` : null
    appendBubble('user', text || '📸 รูปภาพ', imgUrl)
    saveMessage('user', text || '[รูปภาพ]')

    const imgB64 = capturedImageB64
    capturedImageB64 = null
    capturedThumb.style.display = 'none'
    chatIn.value = ''
    chatIn.style.height = 'auto'

    isThinking = true
    setStatus('thinking')
    showTyping()
    sendBtn.disabled = true

    try {
      const memCtx = memoriesToContext(memories)
      const reply = await askPersonalAI(text || 'วิเคราะห์รูปภาพนี้', history, memCtx, imgB64)
      removeTyping()
      appendBubble('lami', reply)
      saveMessage('lami', reply)
      history.push({ role: 'user', content: text || '[รูปภาพ]' }, { role: 'lami', content: reply })
      if (history.length > 24) history = history.slice(-24)

      if (autoSpeak) {
        setStatus('speaking')
        speak(reply, { onEnd: () => setStatus('idle') })
      } else {
        setStatus('idle')
      }

      // Extract + save new memories silently
      if (text) {
        extractMemories(text, reply).then(async newFacts => {
          for (const fact of newFacts) {
            await addMemory(fact, 5)
          }
          if (newFacts.length) {
            memories = await loadMemories()
            renderMemChips()
          }
        })
      }
    } catch (e) {
      removeTyping()
      appendBubble('lami', `เกิดข้อผิดพลาด: ${e.message}`)
      setStatus('idle')
    } finally {
      isThinking = false
      sendBtn.disabled = false
    }
  }

  // ── Event listeners ───────────────────────────────────────────────────────
  sendBtn.addEventListener('click', () => sendMessage(chatIn.value))
  chatIn.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(chatIn.value) }
  })
  chatIn.addEventListener('input', () => {
    chatIn.style.height = 'auto'
    chatIn.style.height = Math.min(chatIn.scrollHeight, 120) + 'px'
  })

  // Mic button
  if (!canSTT) {
    micBtn.style.opacity = '0.4'
    micBtn.title = 'เบราว์เซอร์นี้ไม่รองรับการรับเสียง (ใช้ Chrome)'
  } else {
    micBtn.addEventListener('click', () => {
      if (isListening) {
        recognition?.stop()
        isListening = false
        micBtn.classList.remove('active')
        setStatus('idle')
        return
      }
      stopSpeaking()
      recognition = createSTT({
        onInterim: t => { interimBar.textContent = '🎤 ' + t },
        onFinal: t => {
          interimBar.textContent = ''
          isListening = false
          micBtn.classList.remove('active')
          sendMessage(t)
        },
        onEnd: () => {
          interimBar.textContent = ''
          isListening = false
          micBtn.classList.remove('active')
          if (!isThinking) setStatus('idle')
        },
        onError: err => {
          interimBar.textContent = ''
          isListening = false
          micBtn.classList.remove('active')
          setStatus('idle')
        }
      })
      try {
        recognition.start()
        isListening = true
        micBtn.classList.add('active')
        setStatus('listening')
      } catch {}
    })
  }

  // TTS toggle
  container.querySelector('#tts-btn').addEventListener('click', e => {
    autoSpeak = !autoSpeak
    e.currentTarget.classList.toggle('on', autoSpeak)
    if (!autoSpeak) stopSpeaking()
  })

  // Camera
  container.querySelector('#cam-toggle-btn').addEventListener('click', async () => {
    if (cameraStream) { closeCam(); return }
    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      camVideo.srcObject = cameraStream
      camBar.style.display = 'flex'
      container.querySelector('#cam-toggle-btn').classList.add('on')
    } catch { appendBubble('lami', 'ไม่สามารถเข้าถึงกล้องได้ครับ — กรุณาอนุญาตการใช้กล้องในเบราว์เซอร์') }
  })

  function closeCam() {
    cameraStream?.getTracks().forEach(t => t.stop())
    cameraStream = null
    camVideo.srcObject = null
    camBar.style.display = 'none'
    container.querySelector('#cam-toggle-btn').classList.remove('on')
  }

  container.querySelector('#cam-capture-btn').addEventListener('click', () => {
    const canvas = document.createElement('canvas')
    canvas.width = camVideo.videoWidth
    canvas.height = camVideo.videoHeight
    canvas.getContext('2d').drawImage(camVideo, 0, 0)
    capturedImageB64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1]
    capturedThumb.src = 'data:image/jpeg;base64,' + capturedImageB64
    capturedThumb.style.display = 'block'
    closeCam()
    chatIn.focus()
    chatIn.placeholder = 'อธิบายสิ่งที่ต้องการรู้จากรูปนี้...'
  })

  container.querySelector('#cam-close-btn').addEventListener('click', closeCam)

  capturedThumb.addEventListener('click', () => {
    capturedImageB64 = null
    capturedThumb.style.display = 'none'
    chatIn.placeholder = 'คุยกับ LAMI ได้เลย...'
  })

  // Memory panel
  container.querySelector('#mem-toggle-btn').addEventListener('click', e => {
    showMemPanel = !showMemPanel
    memPanel.style.display = showMemPanel ? 'block' : 'none'
    e.currentTarget.classList.toggle('on', showMemPanel)
  })

  container.querySelector('#add-mem-btn').addEventListener('click', () => {
    const text = prompt('ระบุสิ่งที่อยากให้ LAMI จำ:')
    if (!text?.trim()) return
    addMemory(text.trim(), 7).then(async () => {
      memories = await loadMemories()
      renderMemChips()
      setStatus('idle')
    })
  })

  // Cleanup on page leave
  container.__cleanup = () => {
    closeCam()
    recognition?.stop()
    stopSpeaking()
  }
}
