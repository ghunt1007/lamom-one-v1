import { askPersonalAI, extractMemories } from '../../utils/ai.js'
import { createSTT, speak, stopSpeaking, canSTT, canTTS } from '../../utils/voice.js'
import { loadMemories, addMemory, deleteMemory, saveMessage, loadRecentMessages, memoriesToContext } from '../../utils/memory.js'
import { getState } from '../../core/store.js'

function esc(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') }

export default async function PersonalAIPage(container) {
  const user = getState('user')
  const displayName = user?.displayName?.split(' ')[0] || user?.email?.split('@')[0] || 'คุณ'

  // ── State ─────────────────────────────────────────────────────────────────
  let messages      = []
  let memories      = []
  let history       = []
  let cameraStream  = null
  let recognition   = null
  let isListening   = false
  let isThinking    = false
  let isSpeaking    = false
  let convMode      = false   // continuous conversation mode
  let autoSpeak     = canTTS
  let showMem       = false
  let capturedB64   = null    // manual capture (text mode)

  // ── Load ──────────────────────────────────────────────────────────────────
  memories = await loadMemories()
  history  = await loadRecentMessages(16)

  // ── Styles ────────────────────────────────────────────────────────────────
  if (!document.getElementById('pai-style')) {
    const s = document.createElement('style')
    s.id = 'pai-style'
    s.textContent = `
.pai-wrap{display:flex;flex-direction:column;height:calc(100vh - 56px);overflow:hidden}
.pai-head{display:flex;align-items:center;justify-content:space-between;padding:10px 16px;border-bottom:1px solid var(--border);flex-shrink:0;gap:8px}
.pai-avatar{width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,var(--primary),var(--accent));display:flex;align-items:center;justify-content:center;font-size:1.2rem;flex-shrink:0;box-shadow:0 0 12px var(--primary-glow)}

/* Conversation Mode Banner */
.conv-banner{display:flex;align-items:center;gap:10px;padding:7px 16px;background:var(--primary-dim);border-bottom:1px solid var(--primary);flex-shrink:0;font-size:0.82rem;color:var(--primary)}
.conv-dot{width:8px;height:8px;border-radius:50%;background:var(--danger);animation:blink 1s infinite}
@keyframes blink{0%,100%{opacity:1}50%{opacity:0.2}}

/* Camera PIP */
.cam-pip{position:absolute;top:12px;right:12px;z-index:10;border-radius:12px;overflow:hidden;border:2px solid var(--primary);box-shadow:0 4px 20px rgba(0,0,0,0.5);background:#000}
.cam-pip video{display:block;width:140px;height:100px;object-fit:cover}
.cam-pip-ctrl{display:flex;gap:4px;padding:4px;background:rgba(0,0,0,0.6)}
.cam-pip-ctrl button{flex:1;font-size:0.7rem;padding:3px 6px;border:none;border-radius:6px;cursor:pointer;background:rgba(255,255,255,0.15);color:#fff}

/* State indicator (conversation mode) */
.conv-state{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px;flex-shrink:0;gap:6px}
.state-ring{width:64px;height:64px;border-radius:50%;border:3px solid transparent;display:flex;align-items:center;justify-content:center;font-size:1.8rem;transition:all 0.3s}
.state-ring.listening{border-color:var(--danger);box-shadow:0 0 0 0 rgba(239,68,68,.5);animation:ring-pulse 1.2s infinite}
.state-ring.thinking{border-color:var(--warning);animation:ring-spin 1.5s linear infinite}
.state-ring.speaking{border-color:var(--success);box-shadow:0 0 14px var(--success)}
.state-ring.idle{border-color:var(--border)}
@keyframes ring-pulse{0%{box-shadow:0 0 0 0 rgba(239,68,68,.5)}70%{box-shadow:0 0 0 14px rgba(239,68,68,0)}100%{box-shadow:0 0 0 0 rgba(239,68,68,0)}}
@keyframes ring-spin{to{transform:rotate(360deg)}}
.state-label{font-size:0.8rem;color:var(--text-muted)}
.interim-text{font-size:0.85rem;color:var(--primary);font-style:italic;text-align:center;min-height:20px;max-width:320px;padding:0 12px}

/* Chat */
.chat-msgs{flex:1;overflow-y:auto;padding:12px 16px;display:flex;flex-direction:column;gap:10px;position:relative}
.msg-row{display:flex;align-items:flex-end;gap:8px}
.msg-row.user{flex-direction:row-reverse}
.msg-bubble{max-width:74%;padding:9px 14px;border-radius:18px;font-size:0.875rem;line-height:1.55;word-break:break-word;white-space:pre-wrap}
.msg-bubble.lami{background:var(--surface-2);color:var(--text);border-bottom-left-radius:4px}
.msg-bubble.user{background:var(--primary);color:#fff;border-bottom-right-radius:4px}
.msg-img{max-width:200px;border-radius:10px;margin-bottom:6px;display:block}
.msg-av{width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,var(--primary),var(--accent));display:flex;align-items:center;justify-content:center;font-size:0.85rem;flex-shrink:0}
.typing-dots span{display:inline-block;width:5px;height:5px;border-radius:50%;background:var(--text-muted);animation:tdot 1.2s infinite;margin:0 2px}
.typing-dots span:nth-child(2){animation-delay:.2s}.typing-dots span:nth-child(3){animation-delay:.4s}
@keyframes tdot{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-5px)}}

/* Memory panel */
.mem-panel{background:var(--surface-2);border-bottom:1px solid var(--border);padding:10px 14px;flex-shrink:0;max-height:160px;overflow-y:auto}
.mem-chip{display:inline-flex;align-items:center;gap:5px;background:var(--surface);border:1px solid var(--border);border-radius:20px;padding:3px 9px;font-size:0.73rem;margin:2px;color:var(--text-2)}
.mem-del{cursor:pointer;color:var(--text-muted);font-size:0.85rem}.mem-del:hover{color:var(--danger)}

/* Input bar */
.chat-input-bar{display:flex;align-items:center;gap:7px;padding:9px 14px;border-top:1px solid var(--border);flex-shrink:0;background:var(--surface)}
.chat-text-in{flex:1;background:var(--surface-2);border:1px solid var(--border);border-radius:22px;padding:8px 14px;font-size:0.875rem;color:var(--text);outline:none;resize:none;font-family:inherit;max-height:100px;overflow-y:auto}
.chat-text-in:focus{border-color:var(--primary)}
.icon-btn{width:36px;height:36px;border-radius:50%;border:none;cursor:pointer;font-size:1rem;background:var(--surface-2);color:var(--text);display:flex;align-items:center;justify-content:center;transition:all .2s;flex-shrink:0}
.icon-btn:hover{background:var(--border)}.icon-btn.on{background:var(--primary-dim);color:var(--primary)}
.mic-btn-big{padding:8px 20px;border-radius:22px;border:none;cursor:pointer;font-size:0.875rem;background:var(--danger);color:#fff;display:flex;align-items:center;gap:6px;transition:all .2s;flex-shrink:0}
.mic-btn-big.off{background:var(--surface-2);color:var(--text)}
.captured-thumb{height:34px;width:34px;border-radius:8px;object-fit:cover;border:2px solid var(--primary);cursor:pointer;flex-shrink:0}
    `
    document.head.appendChild(s)
  }

  // ── HTML ──────────────────────────────────────────────────────────────────
  container.innerHTML = `
<div class="pai-wrap">
  <div class="pai-head">
    <div style="display:flex;align-items:center;gap:10px">
      <div class="pai-avatar">🤖</div>
      <div>
        <div style="font-weight:700;font-size:0.93rem">LAMI — ผู้ช่วยส่วนตัว</div>
        <div style="font-size:0.72rem;color:var(--text-muted)" id="head-status">จำได้ ${memories.length} เรื่อง</div>
      </div>
    </div>
    <div style="display:flex;gap:6px;align-items:center">
      <button class="icon-btn ${autoSpeak?'on':''}" id="tts-btn" title="เสียงตอบ">🔊</button>
      <button class="icon-btn" id="mem-btn" title="ความจำ">🧠</button>
      <button class="btn btn-primary btn-sm" id="conv-btn" style="border-radius:20px;padding:6px 14px;white-space:nowrap">
        🎙 เริ่มสนทนา
      </button>
    </div>
  </div>

  <div class="conv-banner" id="conv-banner" style="display:none">
    <div class="conv-dot"></div>
    <span id="conv-banner-text">สนทนาต่อเนื่อง — พูดได้เลย</span>
    <span style="margin-left:auto;font-size:0.75rem;opacity:.7">กด "หยุด" เพื่อสิ้นสุด</span>
  </div>

  <div class="mem-panel" id="mem-panel" style="display:none">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
      <span style="font-size:0.78rem;font-weight:600;color:var(--text-muted)">🧠 สิ่งที่ LAMI จำไว้</span>
      <button class="btn btn-secondary btn-sm" id="add-mem-btn">+ เพิ่ม</button>
    </div>
    <div id="mem-chips"></div>
  </div>

  <div class="chat-msgs" id="chat-msgs">
    <!-- camera PIP injected here dynamically -->
  </div>

  <!-- Conversation mode: state indicator + interim -->
  <div class="conv-state" id="conv-state" style="display:none">
    <div class="state-ring idle" id="state-ring">🤖</div>
    <div class="state-label" id="state-label">พร้อมฟัง</div>
    <div class="interim-text" id="interim-text"></div>
  </div>

  <div class="chat-input-bar">
    <img id="cap-thumb" class="captured-thumb" style="display:none" title="ยกเลิกรูป">
    <textarea class="chat-text-in" id="chat-in" rows="1" placeholder="พิมพ์ หรือกด 🎙 เริ่มสนทนา..."></textarea>
    <button class="icon-btn" id="cam-btn" title="กล้อง">📷</button>
    <button class="icon-btn" id="mic-once-btn" title="${canSTT?'พูดครั้งเดียว':'ไม่รองรับเสียง'}">🎤</button>
    <button class="btn btn-primary" id="send-btn" style="border-radius:20px;padding:7px 16px">ส่ง</button>
  </div>
</div>`

  // ── Refs ──────────────────────────────────────────────────────────────────
  const chatMsgs    = container.querySelector('#chat-msgs')
  const chatIn      = container.querySelector('#chat-in')
  const sendBtn     = container.querySelector('#send-btn')
  const convBtn     = container.querySelector('#conv-btn')
  const convBanner  = container.querySelector('#conv-banner')
  const convBannerT = container.querySelector('#conv-banner-text')
  const convState   = container.querySelector('#conv-state')
  const stateRing   = container.querySelector('#state-ring')
  const stateLabel  = container.querySelector('#state-label')
  const interimText = container.querySelector('#interim-text')
  const headStatus  = container.querySelector('#head-status')
  const memPanel    = container.querySelector('#mem-panel')
  const memChips    = container.querySelector('#mem-chips')
  const capThumb    = container.querySelector('#cap-thumb')
  const micOnceBtn  = container.querySelector('#mic-once-btn')

  // ── UI helpers ────────────────────────────────────────────────────────────
  function setConvState(s) {
    // s: 'idle' | 'listening' | 'thinking' | 'speaking'
    const icons  = { idle:'🤖', listening:'👂', thinking:'💭', speaking:'🔊' }
    const labels = { idle:'พร้อมฟัง', listening:'กำลังฟัง...', thinking:'กำลังคิด...', speaking:'กำลังพูด...' }
    stateRing.className = 'state-ring ' + s
    stateRing.textContent = icons[s] || '🤖'
    stateLabel.textContent = labels[s] || ''
    convBannerT.textContent = labels[s] || 'สนทนาต่อเนื่อง'
    headStatus.textContent = labels[s] || `จำได้ ${memories.length} เรื่อง`
  }

  function scrollBottom() { requestAnimationFrame(() => { chatMsgs.scrollTop = chatMsgs.scrollHeight }) }

  function appendBubble(role, text, imgUrl = null) {
    const div = document.createElement('div')
    div.className = `msg-row ${role}`
    const img = imgUrl ? `<img class="msg-img" src="${imgUrl}">` : ''
    div.innerHTML = role === 'lami'
      ? `<div class="msg-av">🤖</div><div class="msg-bubble lami">${img}${esc(text)}</div>`
      : `<div class="msg-bubble user">${img}${esc(text)}</div>`
    chatMsgs.appendChild(div)
    scrollBottom()
    return div
  }

  function showTyping() {
    if (document.getElementById('typing-ind')) return
    const div = document.createElement('div')
    div.id = 'typing-ind'; div.className = 'msg-row lami'
    div.innerHTML = `<div class="msg-av">🤖</div><div class="msg-bubble lami"><div class="typing-dots"><span></span><span></span><span></span></div></div>`
    chatMsgs.appendChild(div); scrollBottom()
  }
  function removeTyping() { document.getElementById('typing-ind')?.remove() }

  function renderMem() {
    memChips.innerHTML = memories.length
      ? memories.map(m => `<span class="mem-chip">${esc(m.content)}<span class="mem-del" data-id="${m.id}">✕</span></span>`).join('')
      : '<span style="font-size:.75rem;color:var(--text-muted)">ยังไม่มีความจำ</span>'
    memChips.querySelectorAll('.mem-del').forEach(b => b.addEventListener('click', async () => {
      await deleteMemory(b.dataset.id)
      memories = memories.filter(x => x.id !== b.dataset.id)
      renderMem()
    }))
  }
  renderMem()

  // ── Camera (PIP) ──────────────────────────────────────────────────────────
  let pip = null

  async function openCamera() {
    if (cameraStream) return
    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width:320, height:240 } })
      pip = document.createElement('div')
      pip.className = 'cam-pip'
      pip.innerHTML = `
        <video id="pip-vid" autoplay muted playsinline></video>
        <div class="cam-pip-ctrl">
          <button id="pip-snap">📸 แนบ</button>
          <button id="pip-close">✕</button>
        </div>`
      chatMsgs.appendChild(pip)
      const vid = pip.querySelector('#pip-vid')
      vid.srcObject = cameraStream
      pip.querySelector('#pip-close').addEventListener('click', closeCamera)
      pip.querySelector('#pip-snap').addEventListener('click', () => snapCamera(vid))
      container.querySelector('#cam-btn').classList.add('on')
    } catch {
      appendBubble('lami', 'ไม่สามารถเข้าถึงกล้องได้ครับ — กรุณาอนุญาตในเบราว์เซอร์')
    }
  }

  function closeCamera() {
    cameraStream?.getTracks().forEach(t => t.stop())
    cameraStream = null
    pip?.remove(); pip = null
    container.querySelector('#cam-btn').classList.remove('on')
    if (!convMode) { capturedB64 = null; capThumb.style.display = 'none' }
  }

  function grabFrame() {
    const vid = pip?.querySelector('#pip-vid')
    if (!vid || !cameraStream) return null
    const c = document.createElement('canvas')
    c.width = vid.videoWidth || 320; c.height = vid.videoHeight || 240
    c.getContext('2d').drawImage(vid, 0, 0)
    return c.toDataURL('image/jpeg', 0.75).split(',')[1]
  }

  function snapCamera(vid) {
    const c = document.createElement('canvas')
    c.width = vid.videoWidth; c.height = vid.videoHeight
    c.getContext('2d').drawImage(vid, 0, 0)
    capturedB64 = c.toDataURL('image/jpeg', 0.75).split(',')[1]
    capThumb.src = 'data:image/jpeg;base64,' + capturedB64
    capThumb.style.display = 'block'
    chatIn.focus()
    chatIn.placeholder = 'บอก LAMI ว่าต้องการรู้อะไรจากรูปนี้...'
  }

  // ── Core: send message ────────────────────────────────────────────────────
  async function send(text, imageB64 = null) {
    text = text?.trim()
    if (!text && !imageB64) return
    if (isThinking) return

    stopSpeaking()
    const imgUrl = imageB64 ? `data:image/jpeg;base64,${imageB64}` : null
    appendBubble('user', text || '📸 รูปภาพ', imgUrl)
    saveMessage('user', text || '[รูปภาพ]')
    chatIn.value = ''; chatIn.style.height = 'auto'
    capturedB64 = null; capThumb.style.display = 'none'
    chatIn.placeholder = 'พิมพ์ หรือกด 🎙 เริ่มสนทนา...'

    isThinking = true
    sendBtn.disabled = true
    if (convMode) setConvState('thinking')
    showTyping()

    try {
      const memCtx = memoriesToContext(memories)
      const reply  = await askPersonalAI(text || 'อธิบายรูปภาพนี้', history, memCtx, imageB64)
      removeTyping()
      appendBubble('lami', reply)
      saveMessage('lami', reply)
      history.push({ role:'user', content: text || '[รูป]' }, { role:'lami', content: reply })
      if (history.length > 24) history = history.slice(-24)

      if (autoSpeak) {
        if (convMode) setConvState('speaking')
        speak(reply, {
          onEnd: () => {
            isSpeaking = false
            if (convMode) {
              setConvState('idle')
              setTimeout(startListening, 600)   // ← วนลูปต่อ
            }
          }
        })
        isSpeaking = true
      } else if (convMode) {
        setConvState('idle')
        setTimeout(startListening, 400)
      }

      // Extract memories silently
      if (text) {
        extractMemories(text, reply).then(async facts => {
          for (const f of facts) await addMemory(f, 5)
          if (facts.length) { memories = await loadMemories(); renderMem() }
        })
      }
    } catch (e) {
      removeTyping()
      appendBubble('lami', `เกิดข้อผิดพลาด: ${e.message}`)
      if (convMode) { setConvState('idle'); setTimeout(startListening, 1000) }
    } finally {
      isThinking = false
      sendBtn.disabled = false
    }
  }

  // ── STT helpers ───────────────────────────────────────────────────────────
  function startListening() {
    if (!canSTT || isThinking || isSpeaking || isListening) return
    recognition = createSTT({
      onInterim: t => { if (convMode) interimText.textContent = t },
      onFinal:   t => {
        isListening = false
        interimText.textContent = ''
        if (convMode) setConvState('thinking')
        const imgB64 = convMode && cameraStream ? grabFrame() : null
        send(t, imgB64)
      },
      onEnd: () => {
        isListening = false
        interimText.textContent = ''
        micOnceBtn.classList.remove('on')
        // In conv mode: restart if not busy
        if (convMode && !isThinking && !isSpeaking) {
          setConvState('idle')
          setTimeout(startListening, 400)
        }
      },
      onError: () => {
        isListening = false
        interimText.textContent = ''
        micOnceBtn.classList.remove('on')
        if (convMode && !isThinking && !isSpeaking) setTimeout(startListening, 1000)
      }
    })
    try {
      recognition.start()
      isListening = true
      if (convMode) setConvState('listening')
    } catch {}
  }

  function stopListening() {
    recognition?.stop()
    isListening = false
    interimText.textContent = ''
  }

  // ── Conversation mode toggle ──────────────────────────────────────────────
  async function enterConvMode() {
    convMode = true
    convBtn.textContent = '⏹ หยุดสนทนา'
    convBtn.classList.remove('btn-primary')
    convBtn.classList.add('btn-danger')
    convBanner.style.display = 'flex'
    convState.style.display  = 'flex'
    setConvState('idle')

    // Auto-open camera
    if (!cameraStream) await openCamera()

    // Start the loop
    startListening()
  }

  function exitConvMode() {
    convMode = false
    stopListening()
    stopSpeaking()
    isSpeaking = false
    convBtn.textContent = '🎙 เริ่มสนทนา'
    convBtn.classList.add('btn-primary')
    convBtn.classList.remove('btn-danger')
    convBanner.style.display = 'none'
    convState.style.display  = 'none'
    headStatus.textContent = `จำได้ ${memories.length} เรื่อง`
  }

  // ── Events ────────────────────────────────────────────────────────────────
  convBtn.addEventListener('click', () => convMode ? exitConvMode() : enterConvMode())

  sendBtn.addEventListener('click', () => send(chatIn.value, capturedB64))
  chatIn.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(chatIn.value, capturedB64) }
  })
  chatIn.addEventListener('input', () => {
    chatIn.style.height = 'auto'
    chatIn.style.height = Math.min(chatIn.scrollHeight, 110) + 'px'
  })

  // One-shot mic (text mode)
  micOnceBtn.addEventListener('click', () => {
    if (!canSTT) return
    if (isListening && !convMode) { recognition?.stop(); return }
    stopSpeaking()
    recognition = createSTT({
      onInterim: t => { interimText.textContent = '🎤 ' + t },
      onFinal:   t => { interimText.textContent = ''; chatIn.value = t; micOnceBtn.classList.remove('on') },
      onEnd:     ()  => { interimText.textContent = ''; micOnceBtn.classList.remove('on') },
    })
    try { recognition.start(); micOnceBtn.classList.add('on') } catch {}
  })

  container.querySelector('#cam-btn').addEventListener('click', () => cameraStream ? closeCamera() : openCamera())

  container.querySelector('#tts-btn').addEventListener('click', e => {
    autoSpeak = !autoSpeak
    e.currentTarget.classList.toggle('on', autoSpeak)
    if (!autoSpeak) stopSpeaking()
  })

  container.querySelector('#mem-btn').addEventListener('click', e => {
    showMem = !showMem
    memPanel.style.display = showMem ? 'block' : 'none'
    e.currentTarget.classList.toggle('on', showMem)
  })

  container.querySelector('#add-mem-btn').addEventListener('click', () => {
    const t = prompt('ระบุสิ่งที่อยากให้ LAMI จำ:')
    if (!t?.trim()) return
    addMemory(t.trim(), 7).then(async () => { memories = await loadMemories(); renderMem() })
  })

  capThumb.addEventListener('click', () => { capturedB64 = null; capThumb.style.display = 'none'; chatIn.placeholder = 'พิมพ์ หรือกด 🎙 เริ่มสนทนา...' })

  // ── Welcome ───────────────────────────────────────────────────────────────
  const isNew = !history.length
  const msg = isNew
    ? `สวัสดี ${displayName} ครับ! 👋\n\nผมคือ LAMI ผู้ช่วยส่วนตัวของคุณ\n\nกด 🎙 เริ่มสนทนา เพื่อคุยด้วยเสียงต่อเนื่องได้เลยครับ — กล้องจะเปิดอัตโนมัติ LAMI จะเห็นและได้ยินคุณตลอด\nหรือจะพิมพ์ก็ได้เช่นกัน`
    : `สวัสดีอีกครั้ง ${displayName} 👋 มีอะไรให้ช่วยไหมครับ?`
  appendBubble('lami', msg)

  if (history.length) history.slice(-6).forEach(m => appendBubble(m.role, m.content))

  // ── Cleanup ───────────────────────────────────────────────────────────────
  container.__cleanup = () => { exitConvMode(); closeCamera() }
}
