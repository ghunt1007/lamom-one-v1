import { askPersonalAI, extractMemories } from '../../utils/ai.js'
import { createSTT, speak, stopSpeaking, canSTT } from '../../utils/voice.js'
import { loadMemories, addMemory, deleteMemory, saveMessage, loadRecentMessages, memoriesToContext } from '../../utils/memory.js'
import { getState } from '../../core/store.js'

function esc(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') }

export default async function PersonalAIPage(container) {
  const user = getState('user')
  const displayName = user?.displayName?.split(' ')[0] || user?.email?.split('@')[0] || 'คุณ'

  let memories = [], history = []
  let cameraStream = null, recognition = null
  let isListening = false, isThinking = false, isSpeaking = false
  let convMode = false, autoSpeak = true
  let aiState = 'idle'
  let animReq = null, animT = 0, lastTS = 0
  let showLog = true, showMem = false, showType = false

  memories = await loadMemories()
  history  = await loadRecentMessages(16)

  // ── Full-screen overlay ────────────────────────────────────────────────────
  const overlay = document.createElement('div')
  overlay.id = 'aos-ov'
  document.body.appendChild(overlay)

  // ── Styles ─────────────────────────────────────────────────────────────────
  if (!document.getElementById('aos-css')) {
    const s = document.createElement('style')
    s.id = 'aos-css'
    s.textContent = `
#aos-ov {
  position:fixed;inset:0;z-index:9999;
  background:radial-gradient(ellipse at 50% 40%,#0d0d2b 0%,#04040f 100%);
  display:flex;flex-direction:column;overflow:hidden;
  font-family:'Segoe UI',system-ui,sans-serif;color:#e0e4ff;
  user-select:none;
}
/* starfield */
#aos-ov::before {
  content:'';position:absolute;inset:0;pointer-events:none;
  background-image:
    radial-gradient(1px 1px at 10% 15%,rgba(255,255,255,.3) 0%,transparent 100%),
    radial-gradient(1px 1px at 30% 55%,rgba(255,255,255,.2) 0%,transparent 100%),
    radial-gradient(1px 1px at 55% 20%,rgba(255,255,255,.25) 0%,transparent 100%),
    radial-gradient(1px 1px at 75% 70%,rgba(255,255,255,.2) 0%,transparent 100%),
    radial-gradient(1px 1px at 90% 40%,rgba(255,255,255,.3) 0%,transparent 100%),
    radial-gradient(1px 1px at 20% 80%,rgba(255,255,255,.15) 0%,transparent 100%),
    radial-gradient(1px 1px at 65% 90%,rgba(255,255,255,.2) 0%,transparent 100%),
    radial-gradient(1.5px 1.5px at 45% 45%,rgba(255,255,255,.18) 0%,transparent 100%);
}

/* ── Header ── */
.aos-hdr {
  display:flex;align-items:center;justify-content:space-between;
  padding:12px 18px 6px;flex-shrink:0;position:relative;z-index:2;
}
.aos-brand { display:flex;flex-direction:column;gap:1px; }
.aos-title {
  font-size:1.05rem;font-weight:800;letter-spacing:.18em;
  background:linear-gradient(90deg,#ffd700,#ffaa44,#ffd700);
  background-size:200%;-webkit-background-clip:text;-webkit-text-fill-color:transparent;
  animation:aos-shine 4s linear infinite;
}
@keyframes aos-shine{to{background-position:200% 0}}
.aos-sub { font-size:.65rem;color:rgba(180,190,255,.6);letter-spacing:.2em; }
.aos-hdr-btns { display:flex;gap:7px;align-items:center; }
.aos-hbtn {
  width:30px;height:30px;border-radius:50%;border:1px solid rgba(255,255,255,.12);
  background:rgba(255,255,255,.05);color:rgba(200,210,255,.75);cursor:pointer;
  font-size:.85rem;display:flex;align-items:center;justify-content:center;transition:.2s;
}
.aos-hbtn:hover{background:rgba(255,255,255,.12);color:#fff;}
.aos-hbtn.on{background:rgba(255,215,0,.18);border-color:rgba(255,215,0,.5);color:#ffd700;}

/* ── Memory panel ── */
.aos-mem {
  flex-shrink:0;padding:10px 18px;
  background:rgba(5,5,25,.95);border-bottom:1px solid rgba(255,215,0,.2);
  position:relative;z-index:2;max-height:160px;overflow-y:auto;
}
.aos-mem-hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:7px;}
.aos-mem-lbl{font-size:.72rem;font-weight:700;color:rgba(255,215,0,.8);letter-spacing:.1em;}
.aos-mem-add{background:rgba(255,215,0,.12);border:1px solid rgba(255,215,0,.3);color:#ffd700;
  border-radius:8px;padding:2px 10px;font-size:.7rem;cursor:pointer;}
.aos-mem-chip{display:inline-flex;align-items:center;gap:4px;background:rgba(255,255,255,.06);
  border:1px solid rgba(255,255,255,.1);border-radius:20px;padding:3px 9px;
  font-size:.71rem;margin:2px;color:rgba(210,215,255,.8);}
.aos-mem-del{cursor:pointer;opacity:.55;font-size:.8rem;}
.aos-mem-del:hover{opacity:1;color:#f87171;}

/* ── Orbital canvas zone ── */
.aos-zone {
  flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;
  position:relative;min-height:0;
}
#aos-cv { cursor:pointer;display:block; }
.aos-st {
  margin-top:14px;font-size:.88rem;letter-spacing:.12em;
  color:rgba(200,210,255,.75);text-align:center;min-height:22px;transition:color .3s;
}
.aos-st.listening{color:#60a5fa;} .aos-st.thinking{color:#fbbf24;} .aos-st.speaking{color:#34d399;}
.aos-interim{
  margin-top:5px;font-size:.8rem;color:rgba(150,180,255,.85);
  font-style:italic;text-align:center;min-height:18px;max-width:320px;padding:0 12px;
}

/* Camera PIP */
.aos-pip{
  position:absolute;top:12px;right:12px;
  border-radius:12px;overflow:hidden;border:2px solid rgba(255,215,0,.5);
  box-shadow:0 4px 24px rgba(0,0,0,.6);background:#000;
}
.aos-pip video{display:block;width:130px;height:96px;object-fit:cover;}
.aos-pip-bar{display:flex;gap:3px;padding:4px;background:rgba(0,0,0,.7);}
.aos-pip-bar button{flex:1;font-size:.63rem;padding:3px;border:none;border-radius:5px;
  cursor:pointer;background:rgba(255,255,255,.15);color:#fff;}

/* ── Chat log ── */
.aos-log {
  flex-shrink:0;max-height:min(160px,25vh);overflow-y:auto;
  padding:0 16px 8px;display:flex;flex-direction:column;gap:5px;
}
.aos-log::-webkit-scrollbar{width:3px;}
.aos-log::-webkit-scrollbar-thumb{background:rgba(255,255,255,.15);border-radius:3px;}
.aos-lmsg{
  font-size:.78rem;line-height:1.5;padding:6px 12px;border-radius:12px;
  max-width:88%;word-break:break-word;
}
.aos-lmsg.user{background:rgba(59,130,246,.22);align-self:flex-end;color:#bfdbfe;
  border:1px solid rgba(59,130,246,.3);}
.aos-lmsg.lami{background:rgba(255,255,255,.06);align-self:flex-start;color:#dde1ff;
  border:1px solid rgba(255,255,255,.1);}

/* ── Bottom controls ── */
.aos-ctrl {
  flex-shrink:0;display:flex;align-items:center;justify-content:center;
  gap:10px;padding:12px 16px 20px;position:relative;z-index:2;
}
.aos-btn {
  width:50px;height:50px;border-radius:50%;
  border:1.5px solid rgba(255,255,255,.18);background:rgba(255,255,255,.06);
  color:rgba(200,210,255,.85);cursor:pointer;font-size:1.2rem;
  display:flex;align-items:center;justify-content:center;transition:.2s;
}
.aos-btn:hover{background:rgba(255,255,255,.14);border-color:rgba(255,255,255,.35);transform:scale(1.06);}
.aos-btn.on{background:rgba(59,130,246,.25);border-color:#3b82f6;color:#93c5fd;}
/* Main center button */
.aos-main {
  width:76px;height:76px;border-radius:50%;
  border:2.5px solid #ffd700;background:rgba(255,215,0,.08);
  color:#ffd700;cursor:pointer;
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;
  transition:.25s;box-shadow:0 0 20px rgba(255,215,0,.18);
}
.aos-main:hover{background:rgba(255,215,0,.18);box-shadow:0 0 36px rgba(255,215,0,.38);transform:scale(1.06);}
.aos-main.listening{border-color:#ef4444;background:rgba(239,68,68,.18);color:#fca5a5;
  box-shadow:0 0 28px rgba(239,68,68,.4);animation:aos-mblink 1s infinite;}
.aos-main.thinking{border-color:#f59e0b;background:rgba(245,158,11,.15);color:#fcd34d;
  box-shadow:0 0 28px rgba(245,158,11,.35);}
.aos-main.speaking{border-color:#34d399;background:rgba(52,211,153,.12);color:#6ee7b7;
  box-shadow:0 0 28px rgba(52,211,153,.3);}
@keyframes aos-mblink{0%,100%{box-shadow:0 0 28px rgba(239,68,68,.4)}50%{box-shadow:0 0 50px rgba(239,68,68,.7)}}
.aos-main-ico{font-size:1.6rem;}
.aos-main-lbl{font-size:.52rem;letter-spacing:.06em;opacity:.85;}

/* ── Text input overlay ── */
.aos-typepad {
  position:absolute;bottom:96px;left:14px;right:14px;z-index:10;
  background:rgba(10,10,35,.97);border:1px solid rgba(255,215,0,.28);
  border-radius:14px;padding:10px;display:flex;gap:8px;align-items:center;
  box-shadow:0 -4px 30px rgba(0,0,0,.55);
}
.aos-tin {
  flex:1;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.14);
  border-radius:9px;padding:8px 11px;color:#dde1ff;font-size:.84rem;
  outline:none;font-family:inherit;resize:none;max-height:80px;
}
.aos-tin:focus{border-color:rgba(255,215,0,.5);}
.aos-tsend {
  padding:8px 14px;border-radius:9px;border:none;
  background:linear-gradient(135deg,#ffd700,#ff9500);
  color:#0a0a14;font-weight:700;font-size:.82rem;cursor:pointer;white-space:nowrap;
}
    `
    document.head.appendChild(s)
  }

  // ── HTML ───────────────────────────────────────────────────────────────────
  overlay.innerHTML = `
<div class="aos-hdr">
  <div class="aos-brand">
    <div class="aos-title">◈ LAMI AGENTIC OS</div>
    <div class="aos-sub">PERSONAL AI · ${esc(displayName.toUpperCase())} · MEM:${memories.length}</div>
  </div>
  <div class="aos-hdr-btns">
    <button class="aos-hbtn" id="aos-mb" title="ความจำ">🧠</button>
    <button class="aos-hbtn on" id="aos-lb" title="บทสนทนา">💬</button>
    <button class="aos-hbtn on" id="aos-sb" title="เสียง">🔊</button>
    <button class="aos-hbtn" id="aos-xb" title="ปิด">✕</button>
  </div>
</div>

<div class="aos-mem" id="aos-mem" style="display:none">
  <div class="aos-mem-hdr">
    <span class="aos-mem-lbl">🧠 MEMORY (${memories.length})</span>
    <button class="aos-mem-add" id="aos-madd">+ เพิ่ม</button>
  </div>
  <div id="aos-mchips"></div>
</div>

<div class="aos-zone" id="aos-zone">
  <canvas id="aos-cv"></canvas>
  <div class="aos-st" id="aos-st">แตะวงกลม หรือกดปุ่มด้านล่าง เพื่อเริ่มสนทนา</div>
  <div class="aos-interim" id="aos-it"></div>
</div>

<div class="aos-log" id="aos-log"></div>

<div class="aos-ctrl">
  <button class="aos-btn" id="aos-cb" title="กล้อง">📷</button>
  <button class="aos-btn" id="aos-ob" title="พูดครั้งเดียว">🎤</button>
  <button class="aos-main" id="aos-mn">
    <span class="aos-main-ico" id="aos-mni">🎙</span>
    <span class="aos-main-lbl" id="aos-mnl">เริ่มสนทนา</span>
  </button>
  <button class="aos-btn" id="aos-tb" title="พิมพ์">⌨️</button>
  <button class="aos-btn" id="aos-mb2" title="ความจำ">🧠</button>
</div>

<div class="aos-typepad" id="aos-tp" style="display:none">
  <textarea class="aos-tin" id="aos-tin" rows="1" placeholder="พิมพ์ข้อความถึง LAMI..."></textarea>
  <button class="aos-tsend" id="aos-tsd">ส่ง</button>
</div>
  `

  // ── Canvas init ────────────────────────────────────────────────────────────
  const canvas = overlay.querySelector('#aos-cv')
  const ctx    = canvas.getContext('2d')
  const zone   = overlay.querySelector('#aos-zone')

  function sizeCanvas() {
    const logH = showLog ? Math.min(160, window.innerHeight * 0.25) : 0
    const avail = zone.clientHeight
    const sz    = Math.min(zone.clientWidth * 0.72, avail * 0.72, 300)
    const dpr   = window.devicePixelRatio || 1
    canvas.width  = sz * dpr
    canvas.height = sz * dpr
    canvas.style.width  = sz + 'px'
    canvas.style.height = sz + 'px'
  }
  sizeCanvas()
  const onResize = () => sizeCanvas()
  window.addEventListener('resize', onResize)

  // ── Orbital Animation ──────────────────────────────────────────────────────
  const SCOL = {
    idle:      { core:'#ffd700', ring:'255,165,50',  elec:'#ffd700', glow:'255,215,0'  },
    listening: { core:'#93c5fd', ring:'59,130,246',  elec:'#60a5fa', glow:'96,165,250' },
    thinking:  { core:'#fcd34d', ring:'245,158,11',  elec:'#fbbf24', glow:'251,191,36' },
    speaking:  { core:'#6ee7b7', ring:'52,211,153',  elec:'#34d399', glow:'52,211,153' },
  }
  const SSPD = { idle:.38, listening:1.9, thinking:4.0, speaking:.85 }

  function drawOrbital(ts) {
    if (!lastTS) lastTS = ts
    const dt = Math.min((ts - lastTS) / 1000, 0.05)
    lastTS = ts
    animT += dt

    const w = canvas.width, h = canvas.height
    const cx = w / 2, cy = h / 2
    const dpr = window.devicePixelRatio || 1
    const R   = Math.min(w, h) * 0.38
    const col = SCOL[aiState] || SCOL.idle
    const spd = SSPD[aiState] || 0.38

    ctx.clearRect(0, 0, w, h)

    // 3 orbit rings (different tilt / speed / phase)
    const orbs = [
      { a: R * .98, b: R * .32, rot: .3,  s: spd * 1.0, ph: 0 },
      { a: R * .85, b: R * .28, rot: 1.1, s: spd * .72, ph: 2.1 },
      { a: R * .75, b: R * .22, rot: .65, s: spd * 1.4, ph: 4.2 },
    ]

    orbs.forEach(o => {
      // draw ellipse ring
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(o.rot)
      ctx.beginPath()
      ctx.ellipse(0, 0, o.a, o.b, 0, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(${o.a > R * .9 ? col.ring + ',.42)' : col.ring + ',.32)'}`
      ctx.lineWidth = 1.6 * dpr
      ctx.stroke()
      ctx.restore()

      // electron position
      const a = animT * o.s + o.ph
      const ex = cx + Math.cos(o.rot) * o.a * Math.cos(a) - Math.sin(o.rot) * o.b * Math.sin(a)
      const ey = cy + Math.sin(o.rot) * o.a * Math.cos(a) + Math.cos(o.rot) * o.b * Math.sin(a)
      const er = 5.5 * dpr

      // electron glow
      const eg = ctx.createRadialGradient(ex, ey, 0, ex, ey, er * 3.5)
      eg.addColorStop(0, `rgba(${col.glow},.85)`)
      eg.addColorStop(.5, `rgba(${col.glow},.25)`)
      eg.addColorStop(1, `rgba(${col.glow},0)`)
      ctx.fillStyle = eg
      ctx.beginPath(); ctx.arc(ex, ey, er * 3.5, 0, Math.PI * 2); ctx.fill()

      // electron dot
      ctx.fillStyle = col.elec
      ctx.beginPath(); ctx.arc(ex, ey, er, 0, Math.PI * 2); ctx.fill()
    })

    // nucleus pulse
    const pulse = aiState === 'listening' ? .14 * Math.sin(animT * 7.5)
                : aiState === 'speaking'  ? .08 * Math.sin(animT * 4.5)
                : aiState === 'thinking'  ? .06 * Math.sin(animT * 12) : 0
    const nr = R * (.18 + pulse)

    // outer ambient glow
    const og = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * .65)
    og.addColorStop(0, `rgba(${col.glow},.13)`)
    og.addColorStop(1, `rgba(${col.glow},0)`)
    ctx.fillStyle = og
    ctx.beginPath(); ctx.arc(cx, cy, R * .65, 0, Math.PI * 2); ctx.fill()

    // nucleus gradient
    const ng = ctx.createRadialGradient(cx, cy, 0, cx, cy, nr)
    ng.addColorStop(0, '#ffffff')
    ng.addColorStop(.25, '#fffdf0')
    ng.addColorStop(.55, col.core)
    ng.addColorStop(.88, `rgba(${col.ring},.55)`)
    ng.addColorStop(1,   `rgba(${col.ring},0)`)
    ctx.fillStyle = ng
    ctx.beginPath(); ctx.arc(cx, cy, nr, 0, Math.PI * 2); ctx.fill()

    // speaking: expanding wave rings
    if (aiState === 'speaking') {
      for (let i = 0; i < 4; i++) {
        const wt = ((animT * 1.8 - i * .25) % 1 + 1) % 1
        const wr = R * (.22 + wt * .95)
        const wa = (1 - wt) * .32
        ctx.strokeStyle = `rgba(${col.ring},${wa})`
        ctx.lineWidth = 2 * dpr
        ctx.beginPath(); ctx.arc(cx, cy, wr, 0, Math.PI * 2); ctx.stroke()
      }
    }

    // thinking: spark particles
    if (aiState === 'thinking') {
      for (let p = 0; p < 10; p++) {
        const pa = animT * spd * 2.5 + p * Math.PI / 5
        const pr = R * (.45 + .38 * Math.abs(Math.sin(animT * 1.8 + p)))
        const px = cx + pr * Math.cos(pa)
        const py = cy + pr * Math.sin(pa) * .55
        ctx.fillStyle = `rgba(${col.glow},.65)`
        ctx.beginPath(); ctx.arc(px, py, 2.8 * dpr, 0, Math.PI * 2); ctx.fill()
      }
    }

    // listening: mic waveform arc
    if (aiState === 'listening') {
      const bars = 24
      for (let b = 0; b < bars; b++) {
        const ang = (b / bars) * Math.PI * 2
        const wave = .08 + .12 * Math.abs(Math.sin(animT * 5 + b * .8))
        const r1 = nr * 1.5
        const r2 = r1 + R * wave
        ctx.strokeStyle = `rgba(${col.ring},.5)`
        ctx.lineWidth = 2 * dpr
        ctx.beginPath()
        ctx.moveTo(cx + r1 * Math.cos(ang), cy + r1 * Math.sin(ang))
        ctx.lineTo(cx + r2 * Math.cos(ang), cy + r2 * Math.sin(ang))
        ctx.stroke()
      }
    }

    animReq = requestAnimationFrame(drawOrbital)
  }
  animReq = requestAnimationFrame(drawOrbital)

  // ── UI helpers ─────────────────────────────────────────────────────────────
  const stEl   = overlay.querySelector('#aos-st')
  const itEl   = overlay.querySelector('#aos-it')
  const logEl  = overlay.querySelector('#aos-log')
  const mnBtn  = overlay.querySelector('#aos-mn')
  const mnIco  = overlay.querySelector('#aos-mni')
  const mnLbl  = overlay.querySelector('#aos-mnl')

  const ST_TEXT = {
    idle:'พร้อมรับคำสั่ง...', listening:'กำลังฟัง...',
    thinking:'กำลังประมวลผล...', speaking:'กำลังพูด...'
  }

  function setAIState(s) {
    aiState = s
    stEl.className = 'aos-st ' + s
    stEl.textContent = ST_TEXT[s] || ''
    mnBtn.className = 'aos-main ' + (s !== 'idle' ? s : '')
    if (!convMode) {
      mnIco.textContent = '🎙'; mnLbl.textContent = 'เริ่มสนทนา'
    } else if (s === 'listening') {
      mnIco.textContent = '🔴'; mnLbl.textContent = 'กำลังฟัง'
    } else if (s === 'thinking') {
      mnIco.textContent = '⚡'; mnLbl.textContent = 'กำลังคิด'
    } else if (s === 'speaking') {
      mnIco.textContent = '🔊'; mnLbl.textContent = 'กำลังพูด'
    } else {
      mnIco.textContent = '⏹'; mnLbl.textContent = 'หยุด'
    }
  }

  function addLog(role, text) {
    const d = document.createElement('div')
    d.className = 'aos-lmsg ' + role
    d.textContent = (role === 'lami' ? 'LAMI: ' : 'คุณ: ') + text
    logEl.appendChild(d)
    logEl.scrollTop = logEl.scrollHeight
  }

  // render recent history
  if (history.length) history.slice(-6).forEach(m => addLog(m.role, m.content))

  // ── Memory ─────────────────────────────────────────────────────────────────
  const mchips = overlay.querySelector('#aos-mchips')
  function renderMem() {
    mchips.innerHTML = memories.length
      ? memories.map(m => `<span class="aos-mem-chip">${esc(m.content)}<span class="aos-mem-del" data-id="${m.id}">✕</span></span>`).join('')
      : '<span style="font-size:.7rem;color:rgba(200,200,255,.4)">ยังไม่มีความจำ</span>'
    mchips.querySelectorAll('.aos-mem-del').forEach(b => b.addEventListener('click', async () => {
      await deleteMemory(b.dataset.id)
      memories = memories.filter(x => x.id !== b.dataset.id)
      renderMem()
    }))
  }
  renderMem()

  // ── Camera PIP ─────────────────────────────────────────────────────────────
  let pip = null
  async function openCamera() {
    if (cameraStream) return
    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:'user', width:320, height:240 } })
      pip = document.createElement('div')
      pip.className = 'aos-pip'
      pip.innerHTML = `<video id="aos-pv" autoplay muted playsinline></video><div class="aos-pip-bar"><button id="aos-pc">✕ ปิด</button></div>`
      zone.appendChild(pip)
      pip.querySelector('#aos-pv').srcObject = cameraStream
      pip.querySelector('#aos-pc').addEventListener('click', closeCamera)
      overlay.querySelector('#aos-cb').classList.add('on')
    } catch {
      stEl.textContent = 'ไม่สามารถเข้าถึงกล้องได้'
    }
  }
  function closeCamera() {
    cameraStream?.getTracks().forEach(t => t.stop())
    cameraStream = null; pip?.remove(); pip = null
    overlay.querySelector('#aos-cb').classList.remove('on')
  }
  function grabFrame() {
    const vid = pip?.querySelector('#aos-pv')
    if (!vid || !cameraStream) return null
    const c = document.createElement('canvas')
    c.width = vid.videoWidth || 320; c.height = vid.videoHeight || 240
    c.getContext('2d').drawImage(vid, 0, 0)
    return c.toDataURL('image/jpeg', .75).split(',')[1]
  }

  // ── Send ───────────────────────────────────────────────────────────────────
  async function send(text, imageB64 = null) {
    text = text?.trim()
    if (!text && !imageB64) return
    if (isThinking) return

    stopSpeaking()
    addLog('user', text || '[รูปภาพ]')
    saveMessage('user', text || '[รูปภาพ]')
    isThinking = true; setAIState('thinking')

    try {
      const memCtx = memoriesToContext(memories)
      const reply  = await askPersonalAI(text || 'อธิบายรูปภาพนี้', history, memCtx, imageB64)
      addLog('lami', reply)
      saveMessage('lami', reply)
      history.push({ role:'user', content:text||'[รูป]' }, { role:'lami', content:reply })
      if (history.length > 24) history = history.slice(-24)

      if (autoSpeak) {
        setAIState('speaking')
        speak(reply, {
          onEnd: () => {
            isSpeaking = false
            if (convMode) { setAIState('listening'); setTimeout(startListening, 500) }
            else setAIState('idle')
          }
        })
        isSpeaking = true
      } else {
        if (convMode) { setAIState('listening'); setTimeout(startListening, 400) }
        else setAIState('idle')
      }

      if (text) extractMemories(text, reply).then(async facts => {
        for (const f of facts) await addMemory(f, 5)
        if (facts.length) { memories = await loadMemories(); renderMem() }
      })
    } catch (e) {
      stEl.textContent = `ข้อผิดพลาด: ${e.message}`
      if (convMode) { setAIState('listening'); setTimeout(startListening, 1200) }
      else setAIState('idle')
    } finally {
      isThinking = false
    }
  }

  // ── STT ────────────────────────────────────────────────────────────────────
  function startListening() {
    if (!canSTT || isThinking || isSpeaking || isListening) return
    setAIState('listening')
    recognition = createSTT({
      onInterim: t => { itEl.textContent = t },
      onFinal: t => {
        isListening = false; itEl.textContent = ''
        send(t, convMode && cameraStream ? grabFrame() : null)
      },
      onEnd: () => {
        isListening = false; itEl.textContent = ''
        if (convMode && !isThinking && !isSpeaking) {
          setAIState('idle'); setTimeout(startListening, 400)
        } else if (!convMode) setAIState('idle')
      },
      onError: () => {
        isListening = false; itEl.textContent = ''
        if (convMode && !isThinking && !isSpeaking) setTimeout(startListening, 1200)
        else setAIState('idle')
      }
    })
    try { recognition.start(); isListening = true } catch { setAIState('idle') }
  }
  function stopListening() { recognition?.stop(); isListening = false; itEl.textContent = '' }

  // ── Conv mode ──────────────────────────────────────────────────────────────
  async function enterConvMode() {
    convMode = true
    if (!cameraStream) await openCamera()
    logEl.style.display = 'flex'
    sizeCanvas()

    const greet = `สวัสดีครับ ${displayName}! LAMI พร้อมรับใช้แล้ว จะถามอะไรก็ได้เลยครับ`
    addLog('lami', greet)
    if (autoSpeak) {
      // speak welcome FIRST, then start listening after done
      isSpeaking = true
      setAIState('speaking')
      speak(greet, {
        onEnd: () => {
          isSpeaking = false
          if (convMode) { setAIState('listening'); setTimeout(startListening, 500) }
        }
      })
    } else {
      startListening()
    }
  }
  function exitConvMode() {
    convMode = false
    stopListening(); stopSpeaking()
    isSpeaking = false; setAIState('idle')
  }

  // ── Events ─────────────────────────────────────────────────────────────────
  // main button / canvas click
  const toggleConv = () => convMode ? exitConvMode() : enterConvMode()
  overlay.querySelector('#aos-mn').addEventListener('click', toggleConv)
  canvas.addEventListener('click', toggleConv)

  // camera
  overlay.querySelector('#aos-cb').addEventListener('click', () => cameraStream ? closeCamera() : openCamera())

  // one-shot mic (fills type box)
  overlay.querySelector('#aos-ob').addEventListener('click', e => {
    if (!canSTT) return
    if (isListening && !convMode) { recognition?.stop(); return }
    const btn = e.currentTarget
    stopSpeaking()
    const rec = createSTT({
      onInterim: t => { itEl.textContent = '🎤 ' + t },
      onFinal: t => {
        itEl.textContent = ''
        btn.classList.remove('on')
        typePanel.style.display = 'flex'
        overlay.querySelector('#aos-tb').classList.add('on')
        showType = true
        typeIn.value = t
        sizeCanvas()
      },
      onEnd: () => { itEl.textContent = ''; btn.classList.remove('on') },
      onError: () => { itEl.textContent = ''; btn.classList.remove('on') },
    })
    try { rec.start(); btn.classList.add('on') } catch {}
  })

  // bottom memory shortcut
  overlay.querySelector('#aos-mb2').addEventListener('click', () => {
    overlay.querySelector('#aos-mb').click()
  })

  // type toggle
  const typePanel = overlay.querySelector('#aos-tp')
  const typeIn    = overlay.querySelector('#aos-tin')
  overlay.querySelector('#aos-tb').addEventListener('click', e => {
    showType = !showType
    typePanel.style.display = showType ? 'flex' : 'none'
    e.currentTarget.classList.toggle('on', showType)
    if (showType) { typeIn.focus(); sizeCanvas() }
  })
  overlay.querySelector('#aos-tsd').addEventListener('click', () => {
    const t = typeIn.value.trim()
    if (t) { send(t); typeIn.value = ''; typeIn.style.height = 'auto' }
  })
  typeIn.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); overlay.querySelector('#aos-tsd').click() }
  })
  typeIn.addEventListener('input', () => {
    typeIn.style.height = 'auto'
    typeIn.style.height = Math.min(typeIn.scrollHeight, 80) + 'px'
  })

  // header buttons
  overlay.querySelector('#aos-xb').addEventListener('click', () => {
    if (window.navigate) window.navigate('/')
    else { exitConvMode(); closeCamera(); overlay.remove() }
  })

  overlay.querySelector('#aos-lb').addEventListener('click', e => {
    showLog = !showLog
    logEl.style.display = showLog ? 'flex' : 'none'
    e.currentTarget.classList.toggle('on', showLog)
    sizeCanvas()
  })

  overlay.querySelector('#aos-sb').addEventListener('click', e => {
    autoSpeak = !autoSpeak
    e.currentTarget.classList.toggle('on', autoSpeak)
    if (!autoSpeak) stopSpeaking()
  })

  overlay.querySelector('#aos-mb').addEventListener('click', e => {
    showMem = !showMem
    overlay.querySelector('#aos-mem').style.display = showMem ? 'block' : 'none'
    e.currentTarget.classList.toggle('on', showMem)
    sizeCanvas()
  })

  overlay.querySelector('#aos-madd').addEventListener('click', () => {
    const t = prompt('ระบุสิ่งที่อยากให้ LAMI จำ:')
    if (!t?.trim()) return
    addMemory(t.trim(), 7).then(async () => { memories = await loadMemories(); renderMem() })
  })

  // ── Cleanup ────────────────────────────────────────────────────────────────
  container.innerHTML = ''
  const cleanup = () => {
    exitConvMode()
    closeCamera()
    cancelAnimationFrame(animReq)
    window.removeEventListener('resize', onResize)
    document.getElementById('aos-css')?.remove()
    overlay.remove()
  }
  container.__cleanup = cleanup  // sidebar/app-shell compat
  return cleanup                 // router currentCleanup
}
