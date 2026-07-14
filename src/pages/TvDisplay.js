/**
 * TV Display — โหมดจอทีวีโชว์รูม (Kiosk Mode)
 * Route: /tv
 *
 * จอ KPI แบบเต็มจอสำหรับติดผนัง/ทีวีโชว์รูม — ตัวเลขใหญ่ อ่านได้จากระยะไกล
 * บูมเมอแรงความน่าเชื่อถือให้ลูกค้า walk-in + สร้างแรงจูงใจให้ทีมขาย
 *
 * เรนเดอร์ทับทั้งจอ (append ตรงเข้า document.body, bypass container/sidebar/topbar)
 * ตามแพทเทิร์นเดียวกับ pages/ai/PersonalAI.js (full-screen overlay)
 */
import { listDocs, getSalesData, getCommissionData, seedDemoData } from '../core/db.js'
import { formatCurrency } from '../utils/format.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const TH_MONTHS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']
const TH_DAYS = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์']

function formatThaiDateFull(d) {
  return `วัน${TH_DAYS[d.getDay()]}ที่ ${d.getDate()} ${TH_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`
}

const REFRESH_MS = 90000   // อัปเดตข้อมูลจริงทุก 90 วิ — กันยิง Firestore ถี่เกิน
const TICKER_MS = 5000     // หมุนข้อความ ticker ทุก 5 วิ
const IDLE_HIDE_MS = 3000  // ซ่อนปุ่มควบคุมหลังไม่ขยับเมาส์ 3 วิ

export default async function TvDisplayPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  // ── Full-screen overlay ต่อตรงเข้า body — คลุมทั้งจอ ไม่ให้เห็น sidebar/topbar ──
  const overlay = document.createElement('div')
  overlay.id = 'tvd-ov'
  document.body.appendChild(overlay)

  if (!document.getElementById('tvd-css')) {
    const s = document.createElement('style')
    s.id = 'tvd-css'
    s.textContent = `
#tvd-ov {
  position:fixed;inset:0;z-index:9999;
  background:radial-gradient(ellipse 100% 80% at 50% -10%, #0d2140 0%, #050810 55%, #020306 100%);
  color:#F4F7FF;font-family:'Inter','Sarabun',sans-serif;
  display:flex;flex-direction:column;overflow:hidden;user-select:none;
}
#tvd-ov * { box-sizing:border-box; }
#tvd-topbar {
  display:flex;align-items:center;gap:18px;padding:clamp(14px,2vh,26px) clamp(20px,3vw,48px) 0;
  flex-shrink:0;
}
#tvd-brand { display:flex;align-items:center;gap:10px;font-weight:900;letter-spacing:0.04em;
  font-size:clamp(1rem,1.6vw,1.5rem);color:#7dd3fc;text-shadow:0 0 18px rgba(56,189,248,0.5); }
#tvd-brand .dot { width:10px;height:10px;border-radius:50%;background:#22c55e;
  box-shadow:0 0 10px #22c55e;animation:tvdPulse 2s infinite; }
@keyframes tvdPulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
#tvd-date { font-size:clamp(0.75rem,1.1vw,1.05rem);color:#94a3b8;flex-shrink:0; }
#tvd-spacer { flex:1; }
#tvd-clock { font-family:'Share Tech Mono','Consolas',monospace;font-weight:800;
  font-size:clamp(1.6rem,3.4vw,3.2rem);color:#fff;letter-spacing:0.03em;
  text-shadow:0 0 24px rgba(125,211,252,0.45); }
#tvd-controls {
  position:fixed;top:18px;right:18px;display:flex;gap:10px;z-index:30;
  opacity:0;transition:opacity .35s ease;pointer-events:none;
}
#tvd-controls.show { opacity:1;pointer-events:auto; }
#tvd-controls button {
  background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.18);color:#fff;
  padding:9px 16px;border-radius:10px;font-size:0.85rem;font-weight:600;cursor:pointer;
  backdrop-filter:blur(6px);transition:background .2s;
}
#tvd-controls button:hover { background:rgba(255,255,255,0.18); }

#tvd-kpis {
  display:grid;grid-template-columns:repeat(3,1fr);gap:clamp(12px,1.6vw,28px);
  padding:clamp(18px,2.6vh,36px) clamp(20px,3vw,48px) 0;flex-shrink:0;
}
.tvd-kpi {
  background:rgba(255,255,255,0.045);border:1px solid rgba(255,255,255,0.09);
  border-radius:20px;padding:clamp(16px,2vw,30px);position:relative;overflow:hidden;
}
.tvd-kpi::before {
  content:'';position:absolute;inset:0;opacity:0.5;pointer-events:none;
  background:linear-gradient(135deg, var(--tvd-c) 0%, transparent 60%);opacity:0.10;
}
.tvd-kpi-label { font-size:clamp(0.8rem,1.15vw,1.15rem);color:#a8b3c7;font-weight:700;
  display:flex;align-items:center;gap:8px;margin-bottom:6px; }
.tvd-kpi-value { font-size:clamp(2.4rem,6vw,6.4rem);font-weight:900;line-height:1;color:var(--tvd-c);
  text-shadow:0 0 30px var(--tvd-c-glow); font-variant-numeric:tabular-nums; }
.tvd-kpi-sub { margin-top:6px;font-size:clamp(0.7rem,0.95vw,0.95rem);color:#7c8aa3; }

#tvd-mid {
  flex:1;display:grid;grid-template-columns:1.05fr 1fr;gap:clamp(14px,1.8vw,28px);
  padding:clamp(16px,2.4vh,30px) clamp(20px,3vw,48px) 0;min-height:0;
}
.tvd-panel {
  background:rgba(255,255,255,0.035);border:1px solid rgba(255,255,255,0.08);
  border-radius:22px;padding:clamp(16px,2vw,28px);display:flex;flex-direction:column;min-height:0;
}
.tvd-panel-title { font-size:clamp(0.95rem,1.5vw,1.5rem);font-weight:800;color:#fff;margin-bottom:clamp(10px,1.6vh,20px);
  display:flex;align-items:center;gap:10px; }
#tvd-board { flex:1;display:flex;flex-direction:column;gap:clamp(8px,1.3vh,16px);justify-content:center;overflow:hidden; }
.tvd-row { display:flex;align-items:center;gap:clamp(10px,1.4vw,18px); }
.tvd-rank { font-size:clamp(1.1rem,2vw,2rem);font-weight:900;width:clamp(36px,3.4vw,56px);text-align:center;flex-shrink:0; }
.tvd-row-name { width:clamp(90px,15vw,220px);flex-shrink:0;font-size:clamp(0.85rem,1.4vw,1.35rem);
  font-weight:700;color:#e7ecf8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
.tvd-bar-wrap { flex:1;background:rgba(255,255,255,0.07);border-radius:8px;height:clamp(18px,2.6vh,34px);overflow:hidden;position:relative; }
.tvd-bar { height:100%;border-radius:8px;background:linear-gradient(90deg,#38bdf8,#818cf8);
  box-shadow:0 0 16px rgba(56,189,248,0.55);transition:width 0.6s ease; }
.tvd-row-val { width:clamp(90px,10vw,150px);text-align:right;flex-shrink:0;font-family:'Share Tech Mono',monospace;
  font-size:clamp(0.85rem,1.3vw,1.25rem);font-weight:800;color:#7dd3fc; }
.tvd-empty { flex:1;display:flex;align-items:center;justify-content:center;color:#6b7a94;font-size:clamp(0.9rem,1.3vw,1.2rem); }

#tvd-ticker-wrap {
  flex-shrink:0;margin:clamp(14px,2vh,26px) clamp(20px,3vw,48px) clamp(18px,2.6vh,34px);
  background:rgba(255,255,255,0.045);border:1px solid rgba(255,255,255,0.09);border-radius:20px;
  padding:clamp(14px,1.8vh,22px) clamp(20px,2.6vw,36px);display:flex;align-items:center;gap:16px;min-height:clamp(56px,8vh,96px);
}
#tvd-ticker-icon { font-size:clamp(1.3rem,2vw,2rem);flex-shrink:0; }
#tvd-ticker-text { flex:1;font-size:clamp(1rem,2vw,2rem);font-weight:700;color:#f1f5ff;
  opacity:0;transition:opacity .5s ease;line-height:1.3; }
#tvd-ticker-text.show { opacity:1; }
#tvd-ticker-dots { display:flex;gap:6px;flex-shrink:0; }
#tvd-ticker-dots span { width:7px;height:7px;border-radius:50%;background:rgba(255,255,255,0.22); }
#tvd-ticker-dots span.on { background:#38bdf8;box-shadow:0 0 8px #38bdf8; }

#tvd-fs-prompt {
  position:fixed;inset:0;z-index:20;background:rgba(2,4,10,0.86);backdrop-filter:blur(4px);
  display:flex;align-items:center;justify-content:center;flex-direction:column;gap:18px;text-align:center;padding:24px;
}
#tvd-fs-prompt.hidden { display:none; }
#tvd-fs-prompt .fsp-icon { font-size:3.4rem; }
#tvd-fs-prompt .fsp-title { font-size:1.4rem;font-weight:800;color:#fff; }
#tvd-fs-prompt .fsp-sub { font-size:0.95rem;color:#94a3b8;max-width:420px; }
#tvd-fs-btn {
  background:linear-gradient(135deg,#38bdf8,#818cf8);border:none;color:#02040a;font-weight:800;
  font-size:1.05rem;padding:14px 32px;border-radius:14px;cursor:pointer;box-shadow:0 0 30px rgba(56,189,248,0.45);
}
@media (max-width: 900px) {
  #tvd-kpis { grid-template-columns:1fr; }
  #tvd-mid { grid-template-columns:1fr; }
}
`
    document.head.appendChild(s)
  }

  overlay.innerHTML = `
    <div id="tvd-controls">
      <button id="tvd-fs-toggle" title="โหมดเต็มจอ">🖥️ เต็มจอ</button>
      <button id="tvd-exit-btn" title="ออกจากโหมดทีวี (Esc)">✕ ออก (Esc)</button>
    </div>

    <div id="tvd-topbar">
      <div id="tvd-brand"><span class="dot"></span> LAMOM ONE · โชว์รูม</div>
      <div id="tvd-date">-</div>
      <div id="tvd-spacer"></div>
      <div id="tvd-clock">--:--:--</div>
    </div>

    <div id="tvd-kpis">
      <div class="tvd-kpi" style="--tvd-c:#38bdf8;--tvd-c-glow:rgba(56,189,248,0.5)">
        <div class="tvd-kpi-label">📝 จองรถวันนี้</div>
        <div class="tvd-kpi-value" id="tvd-k-bookings">0</div>
        <div class="tvd-kpi-sub">รายการใบจองใหม่</div>
      </div>
      <div class="tvd-kpi" style="--tvd-c:#4ade80;--tvd-c-glow:rgba(74,222,128,0.5)">
        <div class="tvd-kpi-label">✅ ส่งมอบวันนี้</div>
        <div class="tvd-kpi-value" id="tvd-k-deliveries">0</div>
        <div class="tvd-kpi-sub">คันส่งมอบสำเร็จ</div>
      </div>
      <div class="tvd-kpi" style="--tvd-c:#fbbf24;--tvd-c-glow:rgba(251,191,36,0.5)">
        <div class="tvd-kpi-label">💰 ยอดขายสะสมเดือนนี้</div>
        <div class="tvd-kpi-value" id="tvd-k-revenue" style="font-size:clamp(1.8rem,4.6vw,4.6rem)">฿0</div>
        <div class="tvd-kpi-sub" id="tvd-k-revenue-sub">Month-to-date revenue</div>
      </div>
    </div>

    <div id="tvd-mid">
      <div class="tvd-panel">
        <div class="tvd-panel-title">🏆 Sales Leaderboard เดือนนี้</div>
        <div id="tvd-board"><div class="tvd-empty">กำลังโหลด...</div></div>
      </div>
      <div class="tvd-panel">
        <div class="tvd-panel-title">📊 สรุปเดือนนี้</div>
        <div id="tvd-board2"><div class="tvd-empty">กำลังโหลด...</div></div>
      </div>
    </div>

    <div id="tvd-ticker-wrap">
      <div id="tvd-ticker-icon">📣</div>
      <div id="tvd-ticker-text">กำลังโหลดกิจกรรมล่าสุด...</div>
      <div id="tvd-ticker-dots"></div>
    </div>

    <div id="tvd-fs-prompt" class="hidden">
      <div class="fsp-icon">🖥️</div>
      <div class="fsp-title">เข้าสู่โหมดเต็มจอสำหรับจอโชว์รูม</div>
      <div class="fsp-sub">เบราว์เซอร์ต้องการการยืนยันก่อนเข้าสู่โหมดเต็มจอ — กดปุ่มด้านล่างเพื่อเริ่มแสดงผลแบบเต็มจอ</div>
      <button id="tvd-fs-btn">🖥️ เข้าสู่โหมดเต็มจอ</button>
    </div>
  `

  container.innerHTML = ''

  // ── นาฬิกา + วันที่ ────────────────────────────────────────────────
  const clockEl = overlay.querySelector('#tvd-clock')
  const dateEl = overlay.querySelector('#tvd-date')
  function tickClock() {
    if (!overlay.isConnected) { clearInterval(clockTimer); return }
    const d = new Date()
    clockEl.textContent = d.toLocaleTimeString('th-TH', { hour12: false })
    dateEl.textContent = formatThaiDateFull(d)
  }
  const clockTimer = setInterval(tickClock, 1000)
  tickClock()

  // ── โหมดเต็มจอ ─────────────────────────────────────────────────────
  const fsPrompt = overlay.querySelector('#tvd-fs-prompt')
  function showFsPrompt() { fsPrompt.classList.remove('hidden') }
  function hideFsPrompt() { fsPrompt.classList.add('hidden') }

  async function tryFullscreen() {
    try {
      const el = overlay
      const req = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen
      if (!req) throw new Error('no fullscreen api')
      await req.call(el)
      hideFsPrompt()
    } catch (e) {
      showFsPrompt()
    }
  }
  tryFullscreen()

  overlay.querySelector('#tvd-fs-btn').addEventListener('click', tryFullscreen)
  overlay.querySelector('#tvd-fs-toggle').addEventListener('click', tryFullscreen)

  function onFullscreenChange() {
    if (!overlay.isConnected) return
    const fsEl = document.fullscreenElement || document.webkitFullscreenElement
    if (fsEl === overlay) hideFsPrompt()
    else showFsPrompt() // ผู้ใช้ออกจากเต็มจอเอง (เช่นกด Esc ของเบราว์เซอร์) — ยังอยู่หน้านี้ แต่เชิญกลับเข้าเต็มจอ
  }
  document.addEventListener('fullscreenchange', onFullscreenChange)
  document.addEventListener('webkitfullscreenchange', onFullscreenChange)

  // ── ออกจากโหมดทีวี ────────────────────────────────────────────────
  function exitTv() {
    cleanup()
    if (window.navigate) window.navigate('/')
  }
  overlay.querySelector('#tvd-exit-btn').addEventListener('click', exitTv)
  function onKeydown(e) { if (e.key === 'Escape') exitTv() }
  document.addEventListener('keydown', onKeydown)

  // ── ปุ่มควบคุมซ่อนอัตโนมัติเมื่อไม่ขยับเมาส์ ──────────────────────
  const controls = overlay.querySelector('#tvd-controls')
  let idleTimer = null
  function showControls() {
    controls.classList.add('show')
    clearTimeout(idleTimer)
    idleTimer = setTimeout(() => controls.classList.remove('show'), IDLE_HIDE_MS)
  }
  overlay.addEventListener('mousemove', showControls)
  overlay.addEventListener('touchstart', showControls)
  showControls()

  // ── ดึงข้อมูลจริง ──────────────────────────────────────────────────
  let tickerItems = []
  let tickerIdx = 0
  let tickerTimer = null

  function rankBadge(i) {
    return i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`
  }

  function renderBoard(entries) {
    const boardEl = overlay.querySelector('#tvd-board')
    if (!boardEl) return
    if (!entries.length) {
      boardEl.innerHTML = `<div class="tvd-empty">ยังไม่มีข้อมูลยอดขายเดือนนี้</div>`
      return
    }
    const max = Math.max(...entries.map(e => e.incomeTotal || 0), 1)
    boardEl.innerHTML = entries.map((e, i) => `
      <div class="tvd-row">
        <div class="tvd-rank">${rankBadge(i)}</div>
        <div class="tvd-row-name">${escHtml(e.salesName || 'ไม่ระบุ')}</div>
        <div class="tvd-bar-wrap"><div class="tvd-bar" style="width:${Math.max(6, Math.round((e.incomeTotal || 0) / max * 100))}%"></div></div>
        <div class="tvd-row-val">${e.carsSold} คัน</div>
      </div>
    `).join('')
  }

  function renderBoard2(bookings, thisMonth) {
    const el = overlay.querySelector('#tvd-board2')
    if (!el) return
    const inMonth = bookings.filter(b => (b.bookingDate || '').startsWith(thisMonth))
    const delivered = inMonth.filter(b => b.status === 'ส่งมอบแล้ว').length
    const pendingDelivery = inMonth.filter(b => b.status === 'รอส่งมอบ' || b.status === 'ตัดตัวเลขรอส่งมอบ').length
    const waitingFinance = inMonth.filter(b => b.status === 'รอผลไฟแนนซ์').length
    const withdrawn = inMonth.filter(b => b.status === 'ถอนจอง').length
    const rows = [
      { icon: '📝', label: 'ใบจองรวมเดือนนี้', val: inMonth.length, color: '#38bdf8' },
      { icon: '✅', label: 'ส่งมอบแล้ว', val: delivered, color: '#4ade80' },
      { icon: '📦', label: 'รอส่งมอบ', val: pendingDelivery, color: '#fbbf24' },
      { icon: '🏦', label: 'รอผลไฟแนนซ์', val: waitingFinance, color: '#818cf8' },
      { icon: '❌', label: 'ถอนจอง', val: withdrawn, color: '#f87171' },
    ]
    el.innerHTML = rows.map(r => `
      <div class="tvd-row">
        <div style="font-size:clamp(1.1rem,1.8vw,1.6rem);width:clamp(30px,3vw,44px);flex-shrink:0">${r.icon}</div>
        <div class="tvd-row-name" style="width:auto;flex:1">${r.label}</div>
        <div class="tvd-row-val" style="width:auto;color:${r.color};font-size:clamp(1rem,1.8vw,1.7rem)">${r.val}</div>
      </div>
    `).join('')
  }

  function showTickerItem() {
    const textEl = overlay.querySelector('#tvd-ticker-text')
    const dotsEl = overlay.querySelector('#tvd-ticker-dots')
    if (!textEl || !tickerItems.length) return
    textEl.classList.remove('show')
    setTimeout(() => {
      if (!textEl.isConnected) return
      textEl.textContent = tickerItems[tickerIdx % tickerItems.length]
      textEl.classList.add('show')
      if (dotsEl) {
        dotsEl.innerHTML = tickerItems.slice(0, 10).map((_, i) =>
          `<span class="${i === tickerIdx % tickerItems.length ? 'on' : ''}"></span>`).join('')
      }
    }, 260)
    tickerIdx++
  }

  function buildTicker(bookings) {
    const sorted = bookings.slice()
      .filter(b => b.status !== 'ถอนจอง')
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      .slice(0, 12)
    tickerItems = sorted.map(b => {
      const name = escHtml(b.custName || 'ลูกค้า')
      const car = escHtml(`${b.brand || ''} ${b.model || ''}`.trim() || 'รถยนต์')
      const sales = escHtml(b.salesName || '')
      if (b.status === 'ส่งมอบแล้ว') return `🎉 คุณ${sales || '-'} ส่งมอบ ${car} ให้คุณ${name} แล้ว!`
      return `📝 คุณ${name} จอง ${car}${sales ? ' — ดูแลโดยคุณ' + sales : ''}`
    })
    if (!tickerItems.length) tickerItems = ['📣 ยังไม่มีกิจกรรมล่าสุดในระบบ']
    tickerIdx = 0
    showTickerItem()
    clearInterval(tickerTimer)
    tickerTimer = setInterval(() => {
      if (!overlay.isConnected) { clearInterval(tickerTimer); return }
      showTickerItem()
    }, TICKER_MS)
  }

  async function loadData() {
    const today = new Date().toISOString().slice(0, 10)
    const thisMonth = new Date().toISOString().slice(0, 7)
    let bookings = [], sales = [], commission = []
    try {
      ;[bookings, sales, commission] = await Promise.all([
        listDocs('bookings', [], 'createdAt', 'desc', 500).catch(() => []),
        getSalesData().catch(() => []),
        getCommissionData().catch(() => []),
      ])
    } catch (e) { /* เก็บค่าว่างไว้ ไม่ให้จอทีวีพัง */ }
    if (container.__routerGen !== myGen || !overlay.isConnected) return

    const todayBookings = bookings.filter(b => (b.bookingDate || (b.createdAt || '').slice(0, 10) || '').startsWith(today) && b.status !== 'ถอนจอง')
    const todayDeliveries = bookings.filter(b => b.status === 'ส่งมอบแล้ว' && (b.actualDeliveryDate || '').startsWith(today))
    const mtdRevenue = sales.filter(s => s.delivered && (s.date || '').startsWith(thisMonth)).reduce((sum, s) => sum + (s.salePrice || 0), 0)
    const mtdCars = sales.filter(s => s.delivered && (s.date || '').startsWith(thisMonth)).length

    const bkEl = overlay.querySelector('#tvd-k-bookings')
    const dvEl = overlay.querySelector('#tvd-k-deliveries')
    const rvEl = overlay.querySelector('#tvd-k-revenue')
    const rvSubEl = overlay.querySelector('#tvd-k-revenue-sub')
    if (bkEl) bkEl.textContent = todayBookings.length
    if (dvEl) dvEl.textContent = todayDeliveries.length
    if (rvEl) rvEl.textContent = formatCurrency(mtdRevenue)
    if (rvSubEl) rvSubEl.textContent = `ส่งมอบแล้ว ${mtdCars} คันเดือนนี้`

    const board = commission
      .filter(c => c.month === thisMonth)
      .sort((a, b) => (b.incomeTotal || 0) - (a.incomeTotal || 0))
      .slice(0, 5)
    renderBoard(board)
    renderBoard2(bookings, thisMonth)
    buildTicker(bookings)
  }

  await loadData()
  const refreshTimer = setInterval(() => {
    if (!overlay.isConnected) { clearInterval(refreshTimer); return }
    loadData()
  }, REFRESH_MS)

  // ── Cleanup ────────────────────────────────────────────────────────
  const cleanup = () => {
    clearInterval(clockTimer)
    clearInterval(refreshTimer)
    clearInterval(tickerTimer)
    clearTimeout(idleTimer)
    document.removeEventListener('keydown', onKeydown)
    document.removeEventListener('fullscreenchange', onFullscreenChange)
    document.removeEventListener('webkitfullscreenchange', onFullscreenChange)
    if (document.fullscreenElement === overlay || document.webkitFullscreenElement === overlay) {
      const exitFn = document.exitFullscreen || document.webkitExitFullscreen
      if (exitFn) exitFn.call(document).catch?.(() => {})
    }
    overlay.remove()
  }
  container.__cleanup = cleanup
  return cleanup
}
