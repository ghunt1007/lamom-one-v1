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
  let sendCount = 0   // tracks messages sent; extractMemories runs every 3rd

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
  background:#000;
  display:flex;flex-direction:column;overflow:hidden;
  font-family:'Segoe UI',system-ui,sans-serif;color:#e0e4ff;
  user-select:none;
}
/* subtle animated background */
#aos-ov::before {
  content:'';position:absolute;inset:0;pointer-events:none;z-index:0;
  background:radial-gradient(ellipse 80% 60% at 50% 50%, rgba(0,20,60,.85) 0%, #000 70%);
}
/* starfield layer */
#aos-ov::after {
  content:'';position:absolute;inset:0;pointer-events:none;z-index:0;
  background-image:
    radial-gradient(1px 1px at 8%  12%, rgba(255,255,255,.35) 0%,transparent 100%),
    radial-gradient(1px 1px at 22% 58%, rgba(255,255,255,.2)  0%,transparent 100%),
    radial-gradient(1px 1px at 37% 28%, rgba(255,255,255,.3)  0%,transparent 100%),
    radial-gradient(1px 1px at 53% 72%, rgba(255,255,255,.25) 0%,transparent 100%),
    radial-gradient(1px 1px at 68% 18%, rgba(255,255,255,.3)  0%,transparent 100%),
    radial-gradient(1px 1px at 79% 85%, rgba(255,255,255,.2)  0%,transparent 100%),
    radial-gradient(1px 1px at 91% 45%, rgba(255,255,255,.28) 0%,transparent 100%),
    radial-gradient(1.5px 1.5px at 14% 82%, rgba(255,255,255,.22) 0%,transparent 100%),
    radial-gradient(1px 1px at 45% 95%, rgba(255,255,255,.18) 0%,transparent 100%),
    radial-gradient(1.5px 1.5px at 60% 40%, rgba(255,255,255,.15) 0%,transparent 100%),
    radial-gradient(1px 1px at 82% 62%, rgba(255,255,255,.2)  0%,transparent 100%),
    radial-gradient(1px 1px at 3%  47%, rgba(255,255,255,.18) 0%,transparent 100%);
}

/* ── HEADER ── */
.aos-hdr {
  position:relative;z-index:2;
  display:flex;align-items:center;justify-content:space-between;
  padding:14px 20px 8px;flex-shrink:0;
}
.aos-brand { display:flex;flex-direction:column;gap:2px; }
.aos-title {
  font-size:1.1rem;font-weight:900;letter-spacing:.22em;
  background:linear-gradient(90deg,#ffd700 0%,#ffaa33 40%,#ffd700 100%);
  background-size:200%;-webkit-background-clip:text;-webkit-text-fill-color:transparent;
  animation:aos-shine 3s linear infinite;
}
@keyframes aos-shine{to{background-position:200% 0}}
.aos-sub { font-size:.62rem;color:rgba(180,200,255,.55);letter-spacing:.2em; }
.aos-hdr-btns { display:flex;gap:8px;align-items:center; }
.aos-hbtn {
  width:32px;height:32px;border-radius:50%;border:1px solid rgba(255,255,255,.1);
  background:rgba(255,255,255,.04);color:rgba(200,215,255,.7);cursor:pointer;
  font-size:.88rem;display:flex;align-items:center;justify-content:center;transition:.2s;
}
.aos-hbtn:hover{background:rgba(255,255,255,.1);color:#fff;}
.aos-hbtn.on{background:rgba(255,215,0,.15);border-color:rgba(255,215,0,.45);color:#ffd700;}

/* ── CANVAS ZONE — main visual ── */
.aos-zone {
  flex:1;display:flex;align-items:center;justify-content:center;
  position:relative;z-index:1;min-height:0;
}
#aos-cv { display:block;cursor:pointer; }

/* camera PIP — top-right inside zone */
.aos-pip {
  position:absolute;top:10px;right:14px;
  border-radius:14px;overflow:hidden;
  border:2px solid rgba(255,215,0,.45);
  box-shadow:0 4px 28px rgba(0,0,0,.7);background:#000;
  z-index:3;
}
.aos-pip video{display:block;width:120px;height:90px;object-fit:cover;}
.aos-pip-bar{display:flex;gap:3px;padding:4px 5px;background:rgba(0,0,0,.75);}
.aos-pip-bar button{flex:1;font-size:.6rem;padding:3px 4px;border:none;border-radius:5px;
  cursor:pointer;background:rgba(255,255,255,.12);color:#e0e4ff;}

/* ── RESPONSE TEXT — floats below the orb ── */
.aos-reply {
  position:absolute;bottom:14px;left:50%;transform:translateX(-50%);
  width:min(640px, 90vw);
  background:rgba(8,8,30,.82);backdrop-filter:blur(14px);
  border:1px solid rgba(255,255,255,.1);border-radius:18px;
  padding:14px 18px;z-index:3;
  font-size:.88rem;line-height:1.65;color:#dde3ff;
  max-height:28vh;overflow-y:auto;
  box-shadow:0 8px 40px rgba(0,0,0,.5);
}
.aos-reply::-webkit-scrollbar{width:3px;}
.aos-reply::-webkit-scrollbar-thumb{background:rgba(255,255,255,.15);border-radius:3px;}
.aos-reply-who{font-size:.65rem;font-weight:700;letter-spacing:.12em;
  color:rgba(255,215,0,.75);margin-bottom:5px;}
.aos-reply.user .aos-reply-who{color:rgba(100,180,255,.75);}

/* ── STATUS + INTERIM ── */
.aos-status {
  position:absolute;bottom:calc(28vh + 24px);left:50%;transform:translateX(-50%);
  display:flex;flex-direction:column;align-items:center;gap:4px;z-index:2;
}
.aos-st {
  font-size:.82rem;letter-spacing:.14em;color:rgba(200,215,255,.7);
  text-align:center;min-height:18px;transition:color .3s;padding:0 20px;
}
.aos-st.listening{color:#60a5fa;} .aos-st.thinking{color:#fbbf24;} .aos-st.speaking{color:#34d399;}
.aos-interim{
  font-size:.8rem;color:rgba(150,190,255,.9);font-style:italic;
  text-align:center;min-height:16px;max-width:300px;padding:0 16px;
}

/* ── CONTROLS ── */
.aos-ctrl {
  flex-shrink:0;position:relative;z-index:2;
  display:flex;align-items:center;justify-content:center;
  gap:12px;padding:10px 16px 22px;
}
.aos-btn {
  width:50px;height:50px;border-radius:50%;
  border:1.5px solid rgba(255,255,255,.15);background:rgba(255,255,255,.05);
  color:rgba(200,215,255,.8);cursor:pointer;font-size:1.25rem;
  display:flex;align-items:center;justify-content:center;transition:.2s;
}
.aos-btn:hover{background:rgba(255,255,255,.12);border-color:rgba(255,255,255,.3);transform:scale(1.07);}
.aos-btn.on{background:rgba(59,130,246,.22);border-color:#3b82f6;color:#93c5fd;}
/* main center button */
.aos-main {
  width:80px;height:80px;border-radius:50%;
  border:2.5px solid #ffd700;background:rgba(255,215,0,.07);
  color:#ffd700;cursor:pointer;
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;
  transition:.25s;box-shadow:0 0 24px rgba(255,215,0,.2);
}
.aos-main:hover{background:rgba(255,215,0,.16);box-shadow:0 0 40px rgba(255,215,0,.4);transform:scale(1.06);}
.aos-main.listening{border-color:#ef4444;background:rgba(239,68,68,.16);color:#fca5a5;
  box-shadow:0 0 32px rgba(239,68,68,.45);animation:aos-mblink 1s infinite;}
.aos-main.thinking{border-color:#f59e0b;background:rgba(245,158,11,.13);color:#fcd34d;
  box-shadow:0 0 32px rgba(245,158,11,.38);}
.aos-main.speaking{border-color:#34d399;background:rgba(52,211,153,.1);color:#6ee7b7;
  box-shadow:0 0 32px rgba(52,211,153,.35);}
@keyframes aos-mblink{0%,100%{box-shadow:0 0 30px rgba(239,68,68,.45)}50%{box-shadow:0 0 55px rgba(239,68,68,.75)}}
.aos-main-ico{font-size:1.7rem;}
.aos-main-lbl{font-size:.5rem;letter-spacing:.07em;opacity:.8;}

/* ── TYPE PAD ── */
.aos-typepad {
  position:absolute;bottom:108px;left:14px;right:14px;z-index:10;
  background:rgba(6,6,28,.97);border:1px solid rgba(255,215,0,.25);
  border-radius:15px;padding:10px;display:flex;gap:8px;align-items:center;
  box-shadow:0 -4px 32px rgba(0,0,0,.55);
}
.aos-tin {
  flex:1;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);
  border-radius:9px;padding:8px 11px;color:#dde3ff;font-size:.85rem;
  outline:none;font-family:inherit;resize:none;max-height:80px;
}
.aos-tin:focus{border-color:rgba(255,215,0,.45);}
.aos-tsend {
  padding:8px 15px;border-radius:9px;border:none;
  background:linear-gradient(135deg,#ffd700,#ff9500);
  color:#0a0a18;font-weight:700;font-size:.82rem;cursor:pointer;white-space:nowrap;
}

/* ── MEMORY PANEL ── */
.aos-mem {
  flex-shrink:0;padding:10px 18px;position:relative;z-index:2;
  background:rgba(4,4,20,.96);border-bottom:1px solid rgba(255,215,0,.18);
  max-height:150px;overflow-y:auto;
}
.aos-mem-hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:7px;}
.aos-mem-lbl{font-size:.7rem;font-weight:700;color:rgba(255,215,0,.75);letter-spacing:.1em;}
.aos-mem-add{background:rgba(255,215,0,.1);border:1px solid rgba(255,215,0,.28);color:#ffd700;
  border-radius:8px;padding:2px 10px;font-size:.68rem;cursor:pointer;}
.aos-mem-chip{display:inline-flex;align-items:center;gap:4px;background:rgba(255,255,255,.05);
  border:1px solid rgba(255,255,255,.09);border-radius:20px;padding:3px 9px;
  font-size:.7rem;margin:2px;color:rgba(210,220,255,.75);}
.aos-mem-del{cursor:pointer;opacity:.5;font-size:.8rem;}
.aos-mem-del:hover{opacity:1;color:#f87171;}
    `
    document.head.appendChild(s)
  }

  // ── HTML ───────────────────────────────────────────────────────────────────
  overlay.innerHTML = `
<div class="aos-hdr">
  <div class="aos-brand">
    <div class="aos-title">◈ LAMI AGENTIC OS</div>
    <div class="aos-sub" id="aos-sub">PERSONAL AI · ${esc(displayName.toUpperCase())} · MEM:${memories.length}</div>
  </div>
  <div class="aos-hdr-btns">
    <button class="aos-hbtn" id="aos-mb" title="ความจำ">🧠</button>
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

  <div class="aos-status" id="aos-status">
    <div class="aos-st" id="aos-st">แตะวงกลม หรือกดปุ่มด้านล่าง เพื่อเริ่มสนทนา</div>
    <div class="aos-interim" id="aos-it"></div>
  </div>
</div>

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

  // ── Canvas sizing ──────────────────────────────────────────────────────────
  const canvas = overlay.querySelector('#aos-cv')
  const ctx    = canvas.getContext('2d')
  const zone   = overlay.querySelector('#aos-zone')

  function sizeCanvas() {
    const dpr  = window.devicePixelRatio || 1
    const zw   = zone.clientWidth
    const zh   = zone.clientHeight
    const sz   = Math.min(zw * 0.82, zh * 0.82, 500)
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
    idle:      { core:'#ffd700', ring:'255,165,50',  elec:'#ffd700', glow:'255,215,0'   },
    listening: { core:'#93c5fd', ring:'59,130,246',  elec:'#60a5fa', glow:'96,165,250'  },
    thinking:  { core:'#fcd34d', ring:'245,158,11',  elec:'#fbbf24', glow:'251,191,36'  },
    speaking:  { core:'#6ee7b7', ring:'52,211,153',  elec:'#34d399', glow:'52,211,153'  },
  }
  const SSPD = { idle:.38, listening:2.0, thinking:4.2, speaking:.9 }

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

    // 3 orbit rings at different angles and speeds
    const orbs = [
      { a: R * 1.0,  b: R * .33, rot: .30, s: spd * 1.0,  ph: 0 },
      { a: R * .87,  b: R * .29, rot: 1.1, s: spd * .73,  ph: 2.1 },
      { a: R * .75,  b: R * .23, rot: .65, s: spd * 1.45, ph: 4.2 },
    ]

    orbs.forEach(o => {
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(o.rot)
      ctx.beginPath()
      ctx.ellipse(0, 0, o.a, o.b, 0, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(${col.ring},${o.a > R * .9 ? '.45' : '.32'})`
      ctx.lineWidth = 1.8 * dpr
      ctx.stroke()
      ctx.restore()

      const a  = animT * o.s + o.ph
      const ex = cx + Math.cos(o.rot) * o.a * Math.cos(a) - Math.sin(o.rot) * o.b * Math.sin(a)
      const ey = cy + Math.sin(o.rot) * o.a * Math.cos(a) + Math.cos(o.rot) * o.b * Math.sin(a)
      const er = 5.5 * dpr

      const eg = ctx.createRadialGradient(ex, ey, 0, ex, ey, er * 3.5)
      eg.addColorStop(0, `rgba(${col.glow},.88)`)
      eg.addColorStop(.5, `rgba(${col.glow},.28)`)
      eg.addColorStop(1,  `rgba(${col.glow},0)`)
      ctx.fillStyle = eg
      ctx.beginPath(); ctx.arc(ex, ey, er * 3.5, 0, Math.PI * 2); ctx.fill()

      ctx.fillStyle = col.elec
      ctx.beginPath(); ctx.arc(ex, ey, er, 0, Math.PI * 2); ctx.fill()
    })

    // nucleus
    const pulse = aiState === 'listening' ? .14 * Math.sin(animT * 7.5)
                : aiState === 'speaking'  ? .09 * Math.sin(animT * 4.5)
                : aiState === 'thinking'  ? .06 * Math.sin(animT * 12) : 0
    const nr = R * (.18 + pulse)

    const og = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * .68)
    og.addColorStop(0, `rgba(${col.glow},.15)`)
    og.addColorStop(1, `rgba(${col.glow},0)`)
    ctx.fillStyle = og
    ctx.beginPath(); ctx.arc(cx, cy, R * .68, 0, Math.PI * 2); ctx.fill()

    const ng = ctx.createRadialGradient(cx, cy, 0, cx, cy, nr)
    ng.addColorStop(0,   '#ffffff')
    ng.addColorStop(.25, '#fffdf0')
    ng.addColorStop(.55, col.core)
    ng.addColorStop(.88, `rgba(${col.ring},.55)`)
    ng.addColorStop(1,   `rgba(${col.ring},0)`)
    ctx.fillStyle = ng
    ctx.beginPath(); ctx.arc(cx, cy, nr, 0, Math.PI * 2); ctx.fill()

    // speaking: wave rings
    if (aiState === 'speaking') {
      for (let i = 0; i < 5; i++) {
        const wt = ((animT * 1.8 - i * .22) % 1 + 1) % 1
        const wr = R * (.22 + wt * 1.0)
        const wa = (1 - wt) * .3
        ctx.strokeStyle = `rgba(${col.ring},${wa})`
        ctx.lineWidth = 2 * dpr
        ctx.beginPath(); ctx.arc(cx, cy, wr, 0, Math.PI * 2); ctx.stroke()
      }
    }

    // thinking: spark particles
    if (aiState === 'thinking') {
      for (let p = 0; p < 12; p++) {
        const pa = animT * spd * 2.5 + p * Math.PI / 6
        const pr = R * (.42 + .4 * Math.abs(Math.sin(animT * 1.8 + p)))
        const px = cx + pr * Math.cos(pa)
        const py = cy + pr * Math.sin(pa) * .55
        ctx.fillStyle = `rgba(${col.glow},.65)`
        ctx.beginPath(); ctx.arc(px, py, 2.8 * dpr, 0, Math.PI * 2); ctx.fill()
      }
    }

    // listening: mic waveform bars
    if (aiState === 'listening') {
      const bars = 28
      for (let b = 0; b < bars; b++) {
        const ang  = (b / bars) * Math.PI * 2
        const wave = .07 + .13 * Math.abs(Math.sin(animT * 5.5 + b * .75))
        const r1   = nr * 1.55
        const r2   = r1 + R * wave
        ctx.strokeStyle = `rgba(${col.ring},.52)`
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
  const stEl    = overlay.querySelector('#aos-st')
  const itEl    = overlay.querySelector('#aos-it')
  const statusEl = overlay.querySelector('#aos-status')
  const mnBtn   = overlay.querySelector('#aos-mn')
  const mnIco   = overlay.querySelector('#aos-mni')
  const mnLbl   = overlay.querySelector('#aos-mnl')

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

  // ── Reply bubble — float inside zone ──────────────────────────────────────
  let replyEl = null
  function showReply(role, text) {
    if (!replyEl) {
      replyEl = document.createElement('div')
      replyEl.className = 'aos-reply'
      zone.appendChild(replyEl)
    }
    replyEl.className = 'aos-reply ' + role
    const who = role === 'lami' ? 'LAMI' : displayName
    replyEl.innerHTML = `<div class="aos-reply-who">${esc(who)}</div><div>${esc(text)}</div>`
    replyEl.scrollTop = 0
  }

  // show last AI message from history on load
  const lastAI = [...history].reverse().find(m => m.role === 'lami')
  if (lastAI) showReply('lami', lastAI.content)

  // ── Memory ─────────────────────────────────────────────────────────────────
  const mchips = overlay.querySelector('#aos-mchips')
  function renderMem() {
    mchips.innerHTML = memories.length
      ? memories.map(m => `<span class="aos-mem-chip">${esc(m.content)}<span class="aos-mem-del" data-id="${m.id}">✕</span></span>`).join('')
      : '<span style="font-size:.7rem;color:rgba(200,200,255,.35)">ยังไม่มีความจำ</span>'
    mchips.querySelectorAll('.aos-mem-del').forEach(b => b.addEventListener('click', async () => {
      await deleteMemory(b.dataset.id)
      memories = memories.filter(x => x.id !== b.dataset.id)
      renderMem()
      overlay.querySelector('#aos-sub').textContent = `PERSONAL AI · ${displayName.toUpperCase()} · MEM:${memories.length}`
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
      pip.innerHTML = `<video id="aos-pv" autoplay muted playsinline></video><div class="aos-pip-bar"><button id="aos-pc">✕ ปิดกล้อง</button></div>`
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

  // ── Send message ───────────────────────────────────────────────────────────
  async function send(text, imageB64 = null) {
    text = text?.trim()
    if (!text && !imageB64) return
    if (isThinking) return
    stopSpeaking()
    showReply('user', text || '[รูปภาพ]')
    saveMessage('user', text || '[รูปภาพ]')
    isThinking = true; setAIState('thinking')

    try {
      const memCtx = memoriesToContext(memories)
      // onChunk updates the bubble progressively — feels instant
      // null chunk = 429 retry waiting signal
      const reply = await askPersonalAI(
        text || 'อธิบายรูปภาพนี้', history, memCtx, imageB64,
        (_chunk, full) => {
          if (full === null) { stEl.textContent = 'โควต้าเกิน รอสักครู่...'; return }
          showReply('lami', full + '▌')
        }
      )
      showReply('lami', reply)
      saveMessage('lami', reply)
      history.push({ role:'user', content:text||'[รูป]' }, { role:'lami', content:reply })
      if (history.length > 24) history = history.slice(-24)

      if (autoSpeak) {
        setAIState('speaking'); isSpeaking = true
        speak(reply, {
          onEnd: () => {
            isSpeaking = false
            if (convMode) { setAIState('listening'); setTimeout(startListening, 500) }
            else setAIState('idle')
          }
        })
      } else {
        if (convMode) { setAIState('listening'); setTimeout(startListening, 400) }
        else setAIState('idle')
      }

      sendCount++
      if (text && sendCount % 3 === 0) extractMemories(text, reply).then(async facts => {
        for (const f of facts) await addMemory(f, 5)
        if (facts.length) {
          memories = await loadMemories()
          renderMem()
          overlay.querySelector('#aos-sub').textContent = `PERSONAL AI · ${displayName.toUpperCase()} · MEM:${memories.length}`
        }
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
    sizeCanvas()
    const greet = `สวัสดีครับ ${displayName}! ผมคือ LAMI พร้อมรับใช้แล้วครับ จะถามอะไรก็ได้เลยครับ`
    showReply('lami', greet)
    // Open camera WITHOUT await — camera permission must not delay speaking
    // (browser autoplay requires direct user gesture; await breaks that chain)
    if (!cameraStream) openCamera().catch(() => {})
    if (autoSpeak) {
      isSpeaking = true; setAIState('speaking')
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
  const toggleConv = () => convMode ? exitConvMode() : enterConvMode()
  overlay.querySelector('#aos-mn').addEventListener('click', toggleConv)
  canvas.addEventListener('click', toggleConv)

  overlay.querySelector('#aos-cb').addEventListener('click', () => cameraStream ? closeCamera() : openCamera())

  // one-shot mic
  overlay.querySelector('#aos-ob').addEventListener('click', e => {
    if (!canSTT) return
    const btn = e.currentTarget
    stopSpeaking()
    const rec = createSTT({
      onInterim: t => { itEl.textContent = '🎤 ' + t },
      onFinal: t => {
        itEl.textContent = ''
        btn.classList.remove('on')
        typePanel.style.display = 'flex'
        overlay.querySelector('#aos-tb').classList.add('on')
        typeIn.value = t
      },
      onEnd: () => { itEl.textContent = ''; btn.classList.remove('on') },
      onError: () => { itEl.textContent = ''; btn.classList.remove('on') },
    })
    try { rec.start(); btn.classList.add('on') } catch {}
  })

  overlay.querySelector('#aos-mb2').addEventListener('click', () => overlay.querySelector('#aos-mb').click())

  const typePanel = overlay.querySelector('#aos-tp')
  const typeIn    = overlay.querySelector('#aos-tin')
  overlay.querySelector('#aos-tb').addEventListener('click', e => {
    const show = typePanel.style.display !== 'flex'
    typePanel.style.display = show ? 'flex' : 'none'
    e.currentTarget.classList.toggle('on', show)
    if (show) typeIn.focus()
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

  overlay.querySelector('#aos-xb').addEventListener('click', () => {
    exitConvMode(); closeCamera(); overlay.remove()
    if (window.navigate) window.navigate('/')
  })

  overlay.querySelector('#aos-sb').addEventListener('click', e => {
    autoSpeak = !autoSpeak
    e.currentTarget.classList.toggle('on', autoSpeak)
    if (!autoSpeak) stopSpeaking()
  })

  overlay.querySelector('#aos-mb').addEventListener('click', e => {
    const mem = overlay.querySelector('#aos-mem')
    const show = mem.style.display === 'none'
    mem.style.display = show ? 'block' : 'none'
    e.currentTarget.classList.toggle('on', show)
    sizeCanvas()
  })

  overlay.querySelector('#aos-madd').addEventListener('click', () => {
    const t = prompt('ระบุสิ่งที่อยากให้ LAMI จำ:')
    if (!t?.trim()) return
    addMemory(t.trim(), 7).then(async () => {
      memories = await loadMemories()
      renderMem()
      overlay.querySelector('#aos-sub').textContent = `PERSONAL AI · ${displayName.toUpperCase()} · MEM:${memories.length}`
    })
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
  container.__cleanup = cleanup
  return cleanup
}
