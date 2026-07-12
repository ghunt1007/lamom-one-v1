import { getState } from '../core/store.js'
import { listDocs, seedDemoData, getSalesData } from '../core/db.js'
import { formatCurrency, timeAgo } from '../utils/format.js'
import { navigate } from '../core/router.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const TH_MONTHS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']
function ymLabel(ym) {
  const [y, m] = ym.split('-').map(Number)
  return TH_MONTHS[m - 1] + ' ' + (y + 543)
}
function shiftMonth(ym, delta) {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
}

// พยากรณ์เชิงเส้น (least squares) k ก้าวข้างหน้า
function linForecast(series, k) {
  const n = series.length
  if (n < 2) return Array(k).fill(series[0] || 0)
  const mx = (n - 1) / 2
  const my = series.reduce((a, b) => a + b, 0) / n
  let num = 0, den = 0
  series.forEach((y, x) => { num += (x - mx) * (y - my); den += (x - mx) ** 2 })
  const slope = den ? num / den : 0
  const intercept = my - slope * mx
  return Array.from({ length: k }, (_, j) => Math.max(0, slope * (n + j) + intercept))
}

const BOOKING_STATUS_META = {
  'ส่งมอบแล้ว':          { label: 'ส่งมอบแล้ว', icon: '✅', color: 'success' },
  'รอส่งมอบ':            { label: 'รอส่งมอบ', icon: '📦', color: 'warning' },
  'ตัดตัวเลขรอส่งมอบ':    { label: 'ตัดตัวเลขรอส่งมอบ', icon: '🧮', color: 'warning' },
  'รอรถ':                { label: 'รอรถ', icon: '🚗', color: 'accent' },
  'รอผลไฟแนนซ์':         { label: 'รอผลไฟแนนซ์', icon: '🏦', color: 'primary' },
  'จัดไฟแนนซ์ก่อนจอง':   { label: 'จัดไฟแนนซ์ก่อนจอง', icon: '📄', color: 'primary' },
  'ยอดจองคงค้าง':        { label: 'ยอดจองคงค้าง', icon: '⏳', color: 'secondary' },
  'ถอนจอง':              { label: 'ถอนจอง', icon: '❌', color: 'danger' },
}

const JOB_STATUS_META = {
  waiting:       { label: 'รอรับรถ', color: 'primary' },
  checkin:       { label: 'รับรถแล้ว', color: 'accent' },
  diagnosing:    { label: 'วินิจฉัย', color: 'primary' },
  inprogress:    { label: 'กำลังซ่อม', color: 'warning' },
  waiting_parts: { label: 'รออะไหล่', color: 'danger' },
  qc:            { label: 'QC ตรวจสอบ', color: 'success' },
  done:          { label: 'เสร็จแล้ว', color: 'success' },
  delivered:     { label: 'ส่งคืนแล้ว', color: 'primary' },
}

const FIN_STATUS_META = {
  'ผ่าน':        { label: 'ผ่าน', color: 'success' },
  'รอผล':        { label: 'รอผล', color: 'warning' },
  'รอเซ็นสัญญา':  { label: 'รอเซ็นสัญญา', color: 'primary' },
  'ไม่ผ่าน':      { label: 'ไม่ผ่าน', color: 'danger' },
  'รอส่ง':        { label: 'รอส่ง', color: 'secondary' },
  'ซื้อสด':       { label: 'ซื้อสด', color: 'accent' },
}

const QUICK_LINKS = [
  { icon:'👥', label:'ลูกค้า', path:'/crm/customers', color:'primary' },
  { icon:'🧲', label:'Leads', path:'/crm/leads', color:'accent' },
  { icon:'🚗', label:'สต็อกรถ', path:'/dms/stock', color:'accent' },
  { icon:'📝', label:'จองรถ', path:'/crm/bookings', color:'warning' },
  { icon:'🔧', label:'Job Cards', path:'/service/jobs', color:'success' },
  { icon:'🔩', label:'อะไหล่', path:'/service/parts', color:'primary' },
  { icon:'💰', label:'Margin', path:'/finance/margin', color:'success' },
  { icon:'📉', label:'P&L', path:'/finance/pl', color:'primary' },
  { icon:'💳', label:'Payroll', path:'/finance/payroll', color:'accent' },
  { icon:'🛡', label:'Insurance', path:'/insurance', color:'accent' },
  { icon:'🤖', label:'AI Officers', path:'/ai', color:'primary' },
  { icon:'💬', label:'Comm Hub', path:'/comms', color:'accent' },
  { icon:'✅', label:'Tasks', path:'/tasks', color:'success' },
  { icon:'🎓', label:'Training', path:'/training', color:'warning' },
  { icon:'🎮', label:'Gamification', path:'/gamification', color:'accent' },
  { icon:'📈', label:'Analytics', path:'/analytics', color:'primary' },
  { icon:'🤝', label:'B2B Portal', path:'/b2b', color:'accent' },
  { icon:'🔗', label:'Integrations', path:'/integrations', color:'primary' },
  { icon:'📋', label:'Quality', path:'/quality', color:'warning' },
  { icon:'🔄', label:'Migration', path:'/migration', color:'danger' },
]

const LAMI_TIPS = [
  'ตรวจสอบ Lead Hot ทุกเช้า — โอกาสปิดดีลสูงสุดใน 24 ชั่วโมงแรก 🔥',
  'ยอดขายเดือนนี้อยู่ที่ 78% ของ Target — อีกนิดเดียวก็ถึงแล้ว! 💪',
  'มีรถใน PDI 2 คัน รอส่งมอบ ติดตามสถานะให้ลูกค้าด้วยนะครับ 🚗',
  'อะไหล่ Filter น้ำมัน ใกล้หมด — พิจารณาสั่งเพิ่มก่อนรับงานซ่อมใหม่ 🔩',
  'Commission เดือนนี้: อรนุช ฿85,000 — Top Performer! 🏆',
  'Training คอร์ส EV Safety ยังไม่ครบ — แจ้งทีมช่างด้วยนะครับ 🎓',
  'ลูกค้า VIP 3 ราย ครบกำหนดต่อประกันใน 30 วัน — แจ้งเตือนล่วงหน้า 🛡',
]

const ACTIVITY_FEED = [
  { icon:'🚗', text:'จองรถ BYD Seal AWD — คุณ สมศักดิ์ เจริญสุข', time:'5 นาทีที่แล้ว', color:'primary' },
  { icon:'💰', text:'ปิดดีล MG4 X ฿1,199,000 — อรนุช เซลส์ดี', time:'23 นาทีที่แล้ว', color:'success' },
  { icon:'🔧', text:'รับงานซ่อม BYD Atto 3 — ธีรยุทธ เก่งกาจ', time:'1 ชม.ที่แล้ว', color:'warning' },
  { icon:'🧲', text:'Lead ใหม่จาก Facebook — DEEPAL S7', time:'2 ชม.ที่แล้ว', color:'accent' },
  { icon:'✅', text:'PDI ผ่าน — BYD Atto 3 พร้อมส่งมอบ', time:'3 ชม.ที่แล้ว', color:'success' },
  { icon:'🛡', text:'ต่อประกัน — Toyota Corolla (เก่า)', time:'เมื่อวาน', color:'accent' },
  { icon:'📝', text:'เพิ่มลูกค้าใหม่ — นภา สุขใจ', time:'เมื่อวาน', color:'primary' },
]

function formatThaiDate() {
  const d = new Date()
  const days = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์']
  const months = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']
  return `วัน${days[d.getDay()]}ที่ ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543}`
}

export default async function DashboardPage(container) {
  const myGen = container.__routerGen
  const user = getState('user')
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'อรุณสวัสดิ์' : hour < 17 ? 'สวัสดีตอนบ่าย' : 'สวัสดีตอนเย็น'
  const tip = LAMI_TIPS[new Date().getDate() % LAMI_TIPS.length]

  container.innerHTML = `
    <div class="page-content animate-slide">
      <!-- Header -->
      <div class="page-header">
        <div>
          <div class="page-title">${greeting} 👋 ${escHtml(user?.displayName || user?.email?.split('@')[0] || 'ยินดีต้อนรับ')}</div>
          <div class="page-subtitle">${formatThaiDate()} · LAMOM ONE</div>
        </div>
        <div class="page-actions">
          <button class="btn btn-secondary btn-sm" data-nav="/analytics">📊 Analytics</button>
          <button class="btn btn-primary btn-sm" data-nav="/crm/leads">➕ Lead ใหม่</button>
        </div>
      </div>

      <!-- Command HUD strip -->
      <style>
        @keyframes dashRadarSpin { to { transform: rotate(360deg); } }
        @keyframes dashBlip { 0%,100% { opacity: 0.15; } 50% { opacity: 1; } }
        @keyframes dashPulseDot { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }
      </style>
      <div class="card" style="padding:10px 16px;margin-bottom:16px;display:flex;align-items:center;gap:18px;flex-wrap:wrap">
        <div style="display:flex;align-items:center;gap:7px">
          <span style="width:8px;height:8px;border-radius:50%;background:var(--success);box-shadow:0 0 10px var(--success);animation:dashPulseDot 2s infinite;flex-shrink:0"></span>
          <span style="font-size:0.7rem;letter-spacing:0.14em;color:var(--success);font-weight:700;font-family:'Share Tech Mono',monospace">SYSTEM ONLINE</span>
        </div>
        <div id="hud-clock" style="font-size:0.76rem;color:var(--primary);letter-spacing:0.1em;font-family:'Share Tech Mono',monospace;font-weight:700">--:--:--</div>
        <div style="flex:1"></div>
        <div id="hud-readouts" style="display:flex;gap:16px;font-family:'Share Tech Mono',monospace;font-size:0.7rem;letter-spacing:0.08em;color:var(--text-3);flex-wrap:wrap"></div>
      </div>

      <!-- LAMI Message -->
      <div style="display:flex;align-items:flex-start;gap:12px;background:var(--primary-dim);border:1px solid var(--primary);border-radius:var(--radius-lg);padding:14px 16px;margin-bottom:20px">
        <span style="font-size:1.5rem;flex-shrink:0">🤖</span>
        <div>
          <div style="font-size:0.72rem;color:var(--primary);font-weight:700;margin-bottom:3px">LAMI — AI Assistant</div>
          <div style="font-size:0.875rem;color:var(--text-2)">${tip}</div>
        </div>
        <button class="btn btn-ghost btn-sm" style="margin-left:auto;flex-shrink:0" data-nav="/ai/personal">คุยกับ LAMI →</button>
      </div>

      <!-- Operations radar + ring gauges -->
      <div class="card mb-4" style="padding:16px">
        <div style="font-weight:700;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px">
          <span>🛰 Operations Radar — จุดบนจอ = รายการค้างจริง คลิกเพื่อไปจัดการ</span>
          <span id="radar-month" style="font-size:0.72rem;color:var(--primary);font-family:'Share Tech Mono',monospace;letter-spacing:0.08em"></span>
        </div>
        <div style="display:grid;grid-template-columns:230px 1fr;gap:20px;align-items:center">
          <div id="radar-scope"></div>
          <div id="ring-gauges" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px">
            ${[1,2,3,4].map(() => `<div class="skeleton" style="height:140px;border-radius:var(--radius-md)"></div>`).join('')}
          </div>
        </div>
      </div>

      <!-- MoM comparison -->
      <div class="card mb-4" style="padding:16px" id="mom-card">
        <div style="font-weight:700;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px">
          <span>📡 เปรียบเทียบ เดือนที่เลือก vs เดือนก่อนหน้า</span>
          <span id="mom-label" style="font-size:0.72rem;color:var(--primary);font-family:'Share Tech Mono',monospace;letter-spacing:0.06em"></span>
        </div>
        <div id="mom-strip" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px">
          ${[1,2,3,4].map(() => `<div class="skeleton" style="height:86px;border-radius:var(--radius-md)"></div>`).join('')}
        </div>
      </div>

      <!-- Intelligence Center: แจ้งเตือนอัจฉริยะ + เป้า vs ผลจริง -->
      <div style="display:grid;grid-template-columns:2fr 1fr;gap:16px;margin-bottom:16px">
        <div class="card" style="padding:16px">
          <div style="font-weight:700;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center">
            <span>🚨 Intelligence Center — เรื่องที่ต้องจัดการ</span>
            <span id="alert-count" class="badge badge-danger" style="display:none"></span>
          </div>
          <div id="alerts-body"><div class="skeleton" style="height:120px;border-radius:var(--radius-md)"></div></div>
        </div>
        <div class="card" style="padding:16px">
          <div style="font-weight:700;margin-bottom:12px">🎯 เป้า vs ผลจริง — <span class="fc-month" style="color:var(--primary);font-size:0.8rem"></span></div>
          <div id="targets-body"><div class="skeleton" style="height:120px;border-radius:var(--radius-md)"></div></div>
        </div>
      </div>

      <!-- Sales/Booking Pipeline Detail -->
      <div class="card mb-4" style="padding:16px" id="pipeline-card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px">
          <div style="font-weight:700">🚗 ยอดจอง/ยอดขาย — รายละเอียดรายเดือน</div>
          <div style="display:flex;align-items:center;gap:6px">
            <button class="btn btn-ghost btn-sm" id="pm-prev">◀</button>
            <span id="pm-label" style="font-size:0.85rem;font-weight:700;min-width:90px;text-align:center">...</span>
            <button class="btn btn-ghost btn-sm" id="pm-next">▶</button>
            <button class="btn btn-secondary btn-sm" data-nav="/crm/bookings" style="margin-left:6px">ดูใบจอง →</button>
          </div>
        </div>
        <div id="pipeline-body">
          ${[1,2,3,4,5].map(() => `<div class="skeleton" style="height:60px;border-radius:var(--radius-md);margin-bottom:8px"></div>`).join('')}
        </div>
      </div>

      <!-- Other Departments Detail -->
      <div class="card mb-4" style="padding:16px" id="dept-detail-card">
        <div style="font-weight:700;margin-bottom:14px">🏭 แผนกอื่น — รายละเอียดเดือนเดียวกัน</div>
        <div id="dept-detail-body" style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          ${[1,2].map(() => `<div class="skeleton" style="height:140px;border-radius:var(--radius-md)"></div>`).join('')}
        </div>
      </div>

      <!-- Main 2-col layout -->
      <div style="display:grid;grid-template-columns:1fr 340px;gap:16px;margin-bottom:16px">
        <!-- Left: Quick Modules -->
        <div style="display:flex;flex-direction:column;gap:16px">

          <!-- Module shortcuts -->
          <div class="card" style="padding:16px">
            <div style="font-weight:700;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center">
              ⚡ Quick Access
              <span style="font-size:0.75rem;color:var(--text-muted)">${QUICK_LINKS.length} modules</span>
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(80px,1fr));gap:8px">
              ${QUICK_LINKS.map(l => `
                <button data-nav="${l.path}" style="
                  display:flex;flex-direction:column;align-items:center;gap:5px;
                  padding:10px 6px;background:var(--surface-2);border:1px solid var(--border);
                  border-radius:var(--radius-md);cursor:pointer;transition:all 0.15s;
                " onmouseover="this.style.borderColor='var(--${l.color})';this.style.background='var(--${l.color}-dim)'"
                   onmouseout="this.style.borderColor='var(--border)';this.style.background='var(--surface-2)'">
                  <span style="font-size:1.4rem">${l.icon}</span>
                  <span style="font-size:0.68rem;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:72px;text-align:center">${l.label}</span>
                </button>
              `).join('')}
            </div>
          </div>

          <!-- Recent customers -->
          <div class="card" style="padding:0;overflow:hidden">
            <div style="padding:14px 16px;font-weight:700;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
              <span>👥 ลูกค้าล่าสุด</span>
              <button class="btn btn-ghost btn-sm" data-nav="/crm/customers">ดูทั้งหมด →</button>
            </div>
            <div id="customers-list">
              ${[1,2,3,4,5].map(() => `<div class="skeleton" style="height:48px;margin:8px 16px;border-radius:var(--radius-md)"></div>`).join('')}
            </div>
          </div>
        </div>

        <!-- Right: Activity + Tasks -->
        <div style="display:flex;flex-direction:column;gap:16px">
          <!-- Today stats -->
          <div class="card" style="padding:16px">
            <div style="font-weight:700;margin-bottom:14px">📅 วันนี้</div>
            <div id="today-stats" style="display:flex;flex-direction:column;gap:10px">
              ${['📅','🔧','✅','📋'].map(() => `<div class="skeleton" style="height:36px;border-radius:var(--radius-md)"></div>`).join('')}
            </div>
          </div>

          <!-- Activity Feed -->
          <div class="card" style="padding:0;overflow:hidden">
            <div style="padding:14px 16px;font-weight:700;border-bottom:1px solid var(--border)">⚡ กิจกรรมล่าสุด</div>
            <div id="activity-feed" style="overflow-y:auto;max-height:320px">
              ${[1,2,3,4].map(() => `<div class="skeleton" style="height:48px;margin:8px 16px;border-radius:var(--radius-md)"></div>`).join('')}
            </div>
          </div>
        </div>
      </div>

      <!-- Charts row: trend combo (past+forecast) + status donut -->
      <div style="display:grid;grid-template-columns:1fr 320px;gap:16px">
        <div class="card" style="padding:20px" id="monthly-chart-card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;flex-wrap:wrap;gap:6px">
            <div style="font-weight:700" id="monthly-chart-title">📊 อดีต → ปัจจุบัน → อนาคต: ยอดจอง & มูลค่า</div>
            <div style="display:flex;gap:4px">
              <button class="btn btn-sm btn-primary" id="trend-6">6 เดือน</button>
              <button class="btn btn-sm btn-secondary" id="trend-12">12 เดือน</button>
              <button class="btn btn-secondary btn-sm" data-nav="/analytics">Analytics →</button>
            </div>
          </div>
          <div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:12px">แท่ง: 🟢 ส่งมอบ · 🟡 ดำเนินการ · 🔴 ถอนจอง — เส้นเรืองแสง = มูลค่า · เส้นประม่วง = พยากรณ์ 3 เดือนข้างหน้า (คลิกแท่งเพื่อเลือกเดือน)</div>
          <div id="monthly-chart">
            <div class="skeleton" style="width:100%;height:180px;border-radius:var(--radius-md)"></div>
          </div>
        </div>
        <div class="card" style="padding:20px">
          <div style="font-weight:700;margin-bottom:12px">🎯 สัดส่วนสถานะ — <span id="donut-month-label" style="color:var(--primary)">...</span></div>
          <div id="status-donut">
            <div class="skeleton" style="width:100%;height:160px;border-radius:var(--radius-md)"></div>
          </div>
          <div class="divider"></div>
          <div style="font-size:0.76rem;font-weight:700;color:var(--text-2);margin-bottom:8px">📅 ความถี่การจองรายวัน</div>
          <div id="day-heatmap"></div>
        </div>
      </div>

      <!-- Analysis row: forecast + rankings -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-top:16px">
        <div class="card" style="padding:16px">
          <div style="font-weight:700;margin-bottom:10px">🔮 พยากรณ์อนาคต</div>
          <div id="forecast-body"><div class="skeleton" style="height:150px;border-radius:var(--radius-md)"></div></div>
        </div>
        <div class="card" style="padding:16px">
          <div style="font-weight:700;margin-bottom:10px">🏆 รุ่นขายดี — <span class="fc-month" style="color:var(--primary);font-size:0.8rem"></span></div>
          <div id="top-models"><div class="skeleton" style="height:150px;border-radius:var(--radius-md)"></div></div>
        </div>
        <div class="card" style="padding:16px">
          <div style="font-weight:700;margin-bottom:10px">🥇 สุดยอดเซลส์ — <span class="fc-month" style="color:var(--primary);font-size:0.8rem"></span></div>
          <div id="top-sales"><div class="skeleton" style="height:150px;border-radius:var(--radius-md)"></div></div>
        </div>
      </div>

      <!-- Funnel + source row -->
      <div style="display:grid;grid-template-columns:2fr 1fr;gap:16px;margin-top:16px">
        <div class="card" style="padding:16px">
          <div style="font-weight:700;margin-bottom:12px">📶 Conversion Funnel — <span class="fc-month" style="color:var(--primary);font-size:0.8rem"></span></div>
          <div id="funnel-body"><div class="skeleton" style="height:120px;border-radius:var(--radius-md)"></div></div>
        </div>
        <div class="card" style="padding:16px">
          <div style="font-weight:700;margin-bottom:12px">🧲 แหล่งที่มาใบจอง</div>
          <div id="source-body"><div class="skeleton" style="height:120px;border-radius:var(--radius-md)"></div></div>
        </div>
      </div>
    </div>
  `

  // Bind navigation
  container.addEventListener('click', e => {
    const el = e.target.closest('[data-nav]')
    if (el) navigate(el.dataset.nav)
  })

  // ── HUD: นาฬิกาเดินจริง (เคลียร์ตัวเองเมื่อออกจากหน้า) ──
  const clockEl = document.getElementById('hud-clock')
  const clockTimer = setInterval(() => {
    if (!clockEl || !clockEl.isConnected) { clearInterval(clockTimer); return }
    const d = new Date()
    clockEl.textContent = `${d.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' })} · ${d.toLocaleTimeString('th-TH', { hour12: false })} · GMT+7`
  }, 1000)

  // ── Radar scope: โครงจอ (วงแหวน + เส้นกวาด) ระหว่างรอข้อมูล — จุดจริงเติมโดย renderRadar() ──
  const radarShell = blipsMarkup => `
    <svg viewBox="0 0 220 220" style="width:100%;max-width:220px;display:block;margin:auto">
      ${[100,75,50,25].map(r => `<circle cx="110" cy="110" r="${r}" fill="none" stroke="var(--primary)" stroke-opacity="${r === 100 ? 0.5 : 0.22}" stroke-width="1"/>`).join('')}
      <line x1="10" y1="110" x2="210" y2="110" stroke="var(--primary)" stroke-opacity="0.18"/>
      <line x1="110" y1="10" x2="110" y2="210" stroke="var(--primary)" stroke-opacity="0.18"/>
      <circle cx="110" cy="110" r="3" fill="var(--primary)" style="filter:drop-shadow(0 0 4px var(--primary-glow))"/>
      <g style="transform-origin:110px 110px;animation:dashRadarSpin 4s linear infinite">
        <path d="M110,110 L110,10 A100,100 0 0,1 178,37 Z" fill="var(--primary)" opacity="0.16"/>
        <line x1="110" y1="110" x2="110" y2="10" stroke="var(--primary)" stroke-width="1.5" style="filter:drop-shadow(0 0 5px var(--primary-glow))"/>
      </g>
      ${blipsMarkup}
    </svg>`
  const radarEl = document.getElementById('radar-scope')
  if (radarEl) radarEl.innerHTML = radarShell('')

  // Load async data
  seedDemoData()
  let selectedMonth = new Date().toISOString().slice(0, 7)
  let trendRange = 6
  try {
    const today = new Date().toISOString().slice(0, 10)
    const thisMonth = new Date().toISOString().slice(0, 7)
    const [customers, tasks, sales, jobs, bookings, pdi, leads, vehicles, teamTargets] = await Promise.all([
      listDocs('customers', [], 'createdAt', 'desc', 5).catch(() => []),
      listDocs('tasks', [], 'createdAt', 'desc', 100).catch(() => []),
      getSalesData().catch(() => []),
      listDocs('job_cards', [], 'createdAt', 'desc', 500).catch(() => []),
      listDocs('bookings', [], 'createdAt', 'desc', 500).catch(() => []),
      listDocs('pdi', [], 'createdAt', 'desc', 50).catch(() => []),
      listDocs('leads', [], 'createdAt', 'desc', 500).catch(() => []),
      listDocs('vehicles', [], 'createdAt', 'desc', 500).catch(() => []),
      listDocs('team_targets', [], 'period', 'desc', 200).catch(() => []),
    ])
    if (container.__routerGen !== myGen) return

    const pendingTasks = tasks.filter(t => t.status !== 'done' && t.status !== 'cancelled').length
    const openJobs = jobs.filter(j => j.status !== 'done' && j.status !== 'completed' && j.status !== 'delivered').length

    // ── ยอดจอง/ยอดขาย รายละเอียดรายเดือน (คลิกดูเดือนก่อนหน้าได้) ──────────────
    function renderPipeline() {
      const label = document.getElementById('pm-label')
      if (label) label.textContent = ymLabel(selectedMonth)

      const inMonth = bookings.filter(b => (b.bookingDate || '').startsWith(selectedMonth))
      const deliveredInMonth = bookings.filter(b => b.status === 'ส่งมอบแล้ว' && (b.actualDeliveryDate || '').startsWith(selectedMonth))
      const byStatus = {}
      inMonth.forEach(b => { byStatus[b.status] = (byStatus[b.status] || 0) + 1 })
      const revenue = inMonth.reduce((s, b) => s + (b.price || 0), 0)

      const body = document.getElementById('pipeline-body')
      if (!body) return
      body.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin-bottom:14px">
          ${pCard('📝', 'จองมาเดือนนี้', inMonth.length, 'primary', '/crm/bookings')}
          ${pCard('✅', 'ส่งมอบไปแล้ว', deliveredInMonth.length, 'success', '/crm/bookings')}
          ${pCard('📦', 'รอส่งมอบ', (byStatus['รอส่งมอบ'] || 0) + (byStatus['ตัดตัวเลขรอส่งมอบ'] || 0), 'warning', '/crm/bookings')}
          ${pCard('🚗', 'รอรถ', byStatus['รอรถ'] || 0, 'accent', '/crm/bookings')}
          ${pCard('🏦', 'รอผลไฟแนนซ์', byStatus['รอผลไฟแนนซ์'] || 0, 'primary', '/crm/bookings')}
          ${pCard('❌', 'ถอนจอง', byStatus['ถอนจอง'] || 0, 'danger', '/crm/bookings')}
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:var(--surface-2);border-radius:8px;font-size:0.8rem">
          <span>💰 มูลค่ารวมใบจองเดือนนี้</span>
          <b style="color:var(--success);font-size:0.95rem">${formatCurrency(revenue)}</b>
        </div>
        <div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:6px">
          ${Object.entries(BOOKING_STATUS_META).filter(([k]) => byStatus[k]).map(([k, v]) =>
            `<span class="badge badge-${v.color}" style="font-size:0.68rem">${v.icon} ${v.label}: ${byStatus[k]}</span>`
          ).join('')}
        </div>
      `
    }

    // ── แผนกอื่น: ศูนย์บริการ (Job Cards) + สรุปไฟแนนซ์ (จาก booking.finStatus) เดือนเดียวกัน ──
    function renderDeptDetail() {
      const jobsInMonth = jobs.filter(j => (j.createdAt || '').startsWith(selectedMonth))
      const jobByStatus = {}
      jobsInMonth.forEach(j => { jobByStatus[j.status] = (jobByStatus[j.status] || 0) + 1 })

      const bookingsInMonth = bookings.filter(b => (b.bookingDate || '').startsWith(selectedMonth) && b.finStatus)
      const finByStatus = {}
      bookingsInMonth.forEach(b => { finByStatus[b.finStatus] = (finByStatus[b.finStatus] || 0) + 1 })

      const body = document.getElementById('dept-detail-body')
      if (!body) return
      body.innerHTML = `
        <div style="background:var(--surface-2);border-radius:10px;padding:14px;cursor:pointer" data-nav="/service/jobs">
          <div style="font-weight:700;font-size:0.85rem;margin-bottom:10px">🔧 ศูนย์บริการ — Job Card เดือนนี้ (${jobsInMonth.length})</div>
          ${jobsInMonth.length ? Object.entries(JOB_STATUS_META).filter(([k]) => jobByStatus[k]).map(([k, v]) => `
            <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:0.78rem">
              <span>${v.label}</span><b style="color:var(--${v.color})">${jobByStatus[k]}</b>
            </div>`).join('') : `<div style="font-size:0.76rem;color:var(--text-muted)">ไม่มี Job Card เดือนนี้</div>`}
        </div>
        <div style="background:var(--surface-2);border-radius:10px;padding:14px;cursor:pointer" data-nav="/crm/bookings">
          <div style="font-weight:700;font-size:0.85rem;margin-bottom:10px">💰 สรุปไฟแนนซ์ — จากใบจองเดือนนี้ (${bookingsInMonth.length})</div>
          ${bookingsInMonth.length ? Object.entries(FIN_STATUS_META).filter(([k]) => finByStatus[k]).map(([k, v]) => `
            <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:0.78rem">
              <span>${v.label}</span><b style="color:var(--${v.color})">${finByStatus[k]}</b>
            </div>`).join('') : `<div style="font-size:0.76rem;color:var(--text-muted)">ไม่มีข้อมูลไฟแนนซ์เดือนนี้</div>`}
        </div>
      `
    }

    function pCard(icon, label, value, color, nav) {
      return `<div style="background:var(--surface-2);border-radius:10px;padding:12px;cursor:pointer;border-left:3px solid var(--${color})" data-nav="${nav}">
        <div style="font-size:0.68rem;color:var(--text-muted);margin-bottom:4px">${icon} ${label}</div>
        <div style="font-size:1.3rem;font-weight:800;color:var(--${color})">${value}</div>
      </div>`
    }

    // สีสถานะ → CSS variable (secondary ไม่มี var จริง ใช้ text-muted แทน)
    const colorVar = c => c === 'secondary' ? 'var(--text-muted)' : `var(--${c})`

    // ── กราฟ combo SVG: อดีต (แท่ง stacked + เส้นมูลค่า) + อนาคต (พยากรณ์ 3 เดือน เส้นประ) ──
    function renderTrendChart() {
      const chartEl = document.getElementById('monthly-chart')
      if (!chartEl) return
      const b6 = document.getElementById('trend-6'), b12 = document.getElementById('trend-12')
      if (b6) b6.className = 'btn btn-sm ' + (trendRange === 6 ? 'btn-primary' : 'btn-secondary')
      if (b12) b12.className = 'btn btn-sm ' + (trendRange === 12 ? 'btn-primary' : 'btn-secondary')

      const months = []
      for (let i = trendRange - 1; i >= 0; i--) months.push(shiftMonth(selectedMonth, -i))
      const data = months.map(m => {
        const inM = bookings.filter(b => (b.bookingDate || '').startsWith(m))
        const delivered = inM.filter(b => b.status === 'ส่งมอบแล้ว').length
        const withdrawn = inM.filter(b => b.status === 'ถอนจอง').length
        return { m, total: inM.length, delivered, withdrawn,
                 revenue: inM.reduce((s, b) => s + (b.price || 0), 0) }
      })
      const FC = 3
      const fCounts = linForecast(data.map(d => d.total), FC)
      const fRevs = linForecast(data.map(d => d.revenue), FC)
      const fMonths = [...Array(FC)].map((_, j) => shiftMonth(selectedMonth, j + 1))
      const nGroups = trendRange + FC
      const maxTotal = Math.max(...data.map(d => d.total), ...fCounts, 1)
      const maxRev = Math.max(...data.map(d => d.revenue), ...fRevs, 1)

      const W = 760, H = 210, padL = 10, padR = 10, padT = 26, padB = 28
      const plotW = W - padL - padR, plotH = H - padT - padB
      const groupW = plotW / nGroups
      const barW = Math.min(trendRange === 6 ? 44 : 30, groupW * 0.55)
      const yBase = padT + plotH

      let bars = '', labels = '', dots = ''
      const linePts = []
      data.forEach((d, i) => {
        const cx = padL + groupW * i + groupW / 2
        const x = cx - barW / 2
        const hTotal = d.total ? Math.max(6, Math.round(d.total / maxTotal * plotH)) : 0
        const dH = d.total ? Math.round(hTotal * d.delivered / d.total) : 0
        const wH = d.total ? Math.round(hTotal * d.withdrawn / d.total) : 0
        const pH = Math.max(0, hTotal - dH - wH)
        const sel = d.m === selectedMonth
        bars += `<g data-month="${d.m}" style="cursor:pointer">
          <rect x="${cx - groupW / 2}" y="${padT - 6}" width="${groupW}" height="${plotH + 6}" fill="transparent"/>
          <rect x="${x}" y="${yBase - dH}" width="${barW}" height="${dH}" fill="var(--success)" opacity="0.9"/>
          <rect x="${x}" y="${yBase - dH - pH}" width="${barW}" height="${pH}" fill="var(--warning)" opacity="0.85"/>
          <rect x="${x}" y="${yBase - hTotal}" width="${barW}" height="${wH}" fill="var(--danger)" opacity="0.85"/>
          ${sel ? `<rect x="${x - 4}" y="${yBase - hTotal - 5}" width="${barW + 8}" height="${hTotal + 5}" fill="none" stroke="var(--primary)" stroke-width="1.5" rx="4" style="filter:drop-shadow(0 0 4px var(--primary-glow))"/>` : ''}
          ${d.total ? `<text x="${cx}" y="${yBase - hTotal - 10}" text-anchor="middle" font-size="10" font-weight="700" fill="var(--text-3)">${d.total}</text>` : ''}
        </g>`
        labels += `<text x="${cx}" y="${H - 8}" text-anchor="middle" font-size="9.5" fill="${sel ? 'var(--primary)' : 'var(--text-muted)'}" font-weight="${sel ? '700' : '400'}">${ymLabel(d.m).split(' ')[0]}</text>`
        const ly = yBase - Math.round(d.revenue / maxRev * plotH * 0.88)
        linePts.push([cx, ly])
        dots += `<circle cx="${cx}" cy="${ly}" r="3.5" fill="var(--bg)" stroke="var(--primary)" stroke-width="2" style="filter:drop-shadow(0 0 4px var(--primary-glow))"/>`
      })

      // ส่วนพยากรณ์ (เส้นประ + แท่งโปร่ง สีม่วง info)
      const xDiv = padL + groupW * trendRange
      let fBars = '', fDots = ''
      const fPts = [linePts[linePts.length - 1]]
      fMonths.forEach((m, j) => {
        const cx = padL + groupW * (trendRange + j) + groupW / 2
        const x = cx - barW / 2
        const cnt = fCounts[j]
        const hTotal = cnt ? Math.max(4, Math.round(cnt / maxTotal * plotH)) : 0
        fBars += `<rect x="${x}" y="${yBase - hTotal}" width="${barW}" height="${hTotal}" fill="var(--info)" opacity="0.10" stroke="var(--info)" stroke-width="1.2" stroke-dasharray="4 3" rx="2"/>
          <text x="${cx}" y="${yBase - hTotal - 8}" text-anchor="middle" font-size="10" font-weight="700" fill="var(--info)">~${Math.round(cnt)}</text>`
        labels += `<text x="${cx}" y="${H - 8}" text-anchor="middle" font-size="9.5" fill="var(--info)" font-style="italic">${ymLabel(m).split(' ')[0]}</text>`
        const ly = yBase - Math.round(fRevs[j] / maxRev * plotH * 0.88)
        fPts.push([cx, ly])
        fDots += `<circle cx="${cx}" cy="${ly}" r="3" fill="var(--bg)" stroke="var(--info)" stroke-width="1.8" stroke-dasharray="2 2"/>`
      })
      const lineStr = linePts.map(p => p.join(',')).join(' ')
      const fLineStr = fPts.map(p => p.join(',')).join(' ')
      const areaStr = `${linePts[0][0]},${yBase} ${lineStr} ${linePts[linePts.length - 1][0]},${yBase}`

      chartEl.innerHTML = `
        <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block">
          <defs>
            <linearGradient id="dash-rev-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="var(--primary)" stop-opacity="0.22"/>
              <stop offset="100%" stop-color="var(--primary)" stop-opacity="0"/>
            </linearGradient>
          </defs>
          ${[0.25, 0.5, 0.75].map(f => `<line x1="${padL}" y1="${padT + plotH * f}" x2="${W - padR}" y2="${padT + plotH * f}" stroke="var(--border)" stroke-width="0.6" stroke-dasharray="4 6" opacity="0.6"/>`).join('')}
          <line x1="${padL}" y1="${yBase}" x2="${W - padR}" y2="${yBase}" stroke="var(--border)" stroke-width="1"/>
          <line x1="${xDiv}" y1="${padT - 4}" x2="${xDiv}" y2="${yBase}" stroke="var(--info)" stroke-width="1" stroke-dasharray="5 4" opacity="0.7"/>
          <text x="${xDiv + 5}" y="${padT + 4}" font-size="9" fill="var(--info)" font-family="monospace" letter-spacing="1">FORECAST →</text>
          <polygon points="${areaStr}" fill="url(#dash-rev-grad)"/>
          ${bars}
          ${fBars}
          <polyline points="${lineStr}" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linejoin="round" style="filter:drop-shadow(0 0 6px var(--primary-glow))"/>
          <polyline points="${fLineStr}" fill="none" stroke="var(--info)" stroke-width="1.8" stroke-dasharray="6 4" stroke-linejoin="round" style="filter:drop-shadow(0 0 4px var(--info-dim))"/>
          ${dots}
          ${fDots}
          ${labels}
        </svg>`
      chartEl.querySelectorAll('[data-month]').forEach(el => el.addEventListener('click', () => {
        selectedMonth = el.dataset.month
        renderAll()
      }))
    }

    // ── กราฟโดนัท: สัดส่วนสถานะใบจองของเดือนที่เลือก ──
    function renderDonut() {
      const el = document.getElementById('status-donut')
      if (!el) return
      const mLabel = document.getElementById('donut-month-label')
      if (mLabel) mLabel.textContent = ymLabel(selectedMonth)
      const inMonth = bookings.filter(b => (b.bookingDate || '').startsWith(selectedMonth))
      const byStatus = {}
      inMonth.forEach(b => { byStatus[b.status] = (byStatus[b.status] || 0) + 1 })
      const entries = Object.entries(BOOKING_STATUS_META)
        .filter(([k]) => byStatus[k])
        .map(([k, v]) => ({ ...v, count: byStatus[k] }))
      const total = inMonth.length
      if (!total) {
        el.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:160px;font-size:0.8rem;color:var(--text-muted)">ไม่มีใบจองเดือนนี้</div>`
        return
      }
      const R = 54, CIRC = 2 * Math.PI * R
      let acc = 0
      const segs = entries.map(e => {
        const frac = e.count / total
        const seg = `<circle cx="80" cy="80" r="${R}" fill="none" stroke="${colorVar(e.color)}" stroke-width="16"
          stroke-dasharray="${Math.max(0.5, frac * CIRC - 1.5).toFixed(1)} ${CIRC.toFixed(1)}"
          stroke-dashoffset="${(-acc * CIRC).toFixed(1)}" transform="rotate(-90 80 80)" opacity="0.92"
          style="filter:drop-shadow(0 0 3px ${colorVar(e.color)})"/>`
        acc += frac
        return seg
      }).join('')
      el.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;gap:12px">
          <svg viewBox="0 0 160 160" style="width:150px;height:150px">
            <circle cx="80" cy="80" r="${R}" fill="none" stroke="var(--surface-3)" stroke-width="16"/>
            ${segs}
            <text x="80" y="77" text-anchor="middle" font-size="26" font-weight="800" fill="var(--text)">${total}</text>
            <text x="80" y="97" text-anchor="middle" font-size="10" fill="var(--text-muted)">ใบจอง</text>
          </svg>
          <div style="display:flex;flex-direction:column;gap:5px;width:100%">
            ${entries.map(e => `
              <div style="display:flex;align-items:center;gap:6px;font-size:0.73rem">
                <span style="width:9px;height:9px;border-radius:2px;background:${colorVar(e.color)};flex-shrink:0;box-shadow:0 0 5px ${colorVar(e.color)}"></span>
                <span style="flex:1;color:var(--text-2)">${e.icon} ${e.label}</span>
                <b style="color:${colorVar(e.color)}">${e.count}</b>
              </div>`).join('')}
          </div>
        </div>`
    }

    // ── HUD readouts (ตัวเลขรวมทั้งระบบ) ──
    const readEl = document.getElementById('hud-readouts')
    if (readEl) {
      readEl.innerHTML = `
        <span>BOOKINGS <b style="color:var(--primary)">${bookings.length}</b></span>
        <span>JOBS <b style="color:var(--warning)">${jobs.length}</b></span>
        <span>CUSTOMERS <b style="color:var(--accent)">${customers.length}+</b></span>
        <span>TASKS <b style="color:var(--success)">${tasks.length}</b></span>`
    }

    // ── Ring gauges: อัตราความสำเร็จของเดือนที่เลือก ──
    function ringGauge(label, pct, color, sub) {
      const R = 40, C = 2 * Math.PI * R
      const p = Math.max(0, Math.min(100, pct || 0))
      return `<div style="display:flex;flex-direction:column;align-items:center;gap:4px">
        <svg viewBox="0 0 100 100" style="width:94px;height:94px">
          <circle cx="50" cy="50" r="${R}" fill="none" stroke="var(--surface-3)" stroke-width="8"/>
          <circle cx="50" cy="50" r="${R}" fill="none" stroke="var(--${color})" stroke-width="8" stroke-linecap="round"
            stroke-dasharray="${(p / 100 * C).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 50 50)"
            style="filter:drop-shadow(0 0 5px var(--${color}))"/>
          <text x="50" y="55" text-anchor="middle" font-size="19" font-weight="800" fill="var(--${color})">${Math.round(p)}%</text>
        </svg>
        <div style="font-size:0.72rem;font-weight:700;color:var(--text-2);text-align:center">${label}</div>
        <div style="font-size:0.64rem;color:var(--text-muted);text-align:center;font-family:'Share Tech Mono',monospace">${sub}</div>
      </div>`
    }

    function renderGauges() {
      const el = document.getElementById('ring-gauges')
      if (!el) return
      const mEl = document.getElementById('radar-month')
      if (mEl) mEl.textContent = ymLabel(selectedMonth).toUpperCase()
      const inMonth = bookings.filter(b => (b.bookingDate || '').startsWith(selectedMonth))
      const delivered = inMonth.filter(b => b.status === 'ส่งมอบแล้ว').length
      const withFin = inMonth.filter(b => b.finStatus)
      const finPassed = withFin.filter(b => b.finStatus === 'ผ่าน').length
      const jobsInMonth = jobs.filter(j => (j.createdAt || '').startsWith(selectedMonth))
      const jobsDone = jobsInMonth.filter(j => ['done', 'completed', 'delivered'].includes(j.status)).length
      const tasksDone = tasks.filter(t => t.status === 'done').length
      el.innerHTML =
        ringGauge('ส่งมอบสำเร็จ', inMonth.length ? delivered / inMonth.length * 100 : 0, 'success', `${delivered}/${inMonth.length} ใบจอง`) +
        ringGauge('ไฟแนนซ์ผ่าน', withFin.length ? finPassed / withFin.length * 100 : 0, 'primary', `${finPassed}/${withFin.length} เคส`) +
        ringGauge('งานซ่อมเสร็จ', jobsInMonth.length ? jobsDone / jobsInMonth.length * 100 : 0, 'warning', `${jobsDone}/${jobsInMonth.length} งาน`) +
        ringGauge('Tasks เสร็จ', tasks.length ? tasksDone / tasks.length * 100 : 0, 'accent', `${tasksDone}/${tasks.length} งาน`)
    }

    // ── MoM: เปรียบเทียบเดือนที่เลือกกับเดือนก่อนหน้า ──
    function momDelta(cur, prev) {
      if (!prev && !cur) return `<span style="color:var(--text-muted);font-size:0.72rem">—</span>`
      if (!prev) return `<span style="color:var(--success);font-size:0.72rem;font-weight:700">▲ ใหม่</span>`
      const pct = (cur - prev) / prev * 100
      if (Math.abs(pct) < 0.5) return `<span style="color:var(--text-muted);font-size:0.72rem;font-weight:700">◆ ทรงตัว</span>`
      const up = pct > 0
      return `<span style="color:var(--${up ? 'success' : 'danger'});font-size:0.72rem;font-weight:700">${up ? '▲' : '▼'} ${Math.abs(pct).toFixed(0)}%</span>`
    }

    function renderMoM() {
      const el = document.getElementById('mom-strip')
      if (!el) return
      const prevM = shiftMonth(selectedMonth, -1)
      const lbl = document.getElementById('mom-label')
      if (lbl) lbl.textContent = `${ymLabel(selectedMonth)} VS ${ymLabel(prevM)}`
      const cur = bookings.filter(b => (b.bookingDate || '').startsWith(selectedMonth))
      const prev = bookings.filter(b => (b.bookingDate || '').startsWith(prevM))
      const dlvCur = bookings.filter(b => b.status === 'ส่งมอบแล้ว' && (b.actualDeliveryDate || '').startsWith(selectedMonth)).length
      const dlvPrev = bookings.filter(b => b.status === 'ส่งมอบแล้ว' && (b.actualDeliveryDate || '').startsWith(prevM)).length
      const revCur = cur.reduce((s, b) => s + (b.price || 0), 0)
      const revPrev = prev.reduce((s, b) => s + (b.price || 0), 0)
      const mgCur = cur.reduce((s, b) => s + (b.margin || 0), 0)
      const mgPrev = prev.reduce((s, b) => s + (b.margin || 0), 0)
      const item = (icon, label, curV, prevV, curDisplay, prevDisplay, color) => `
        <div style="background:var(--surface-2);border-radius:10px;padding:12px;border-left:3px solid var(--${color})">
          <div style="font-size:0.68rem;color:var(--text-muted);margin-bottom:4px">${icon} ${label}</div>
          <div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap">
            <span style="font-size:1.25rem;font-weight:800;color:var(--${color})">${curDisplay}</span>
            ${momDelta(curV, prevV)}
          </div>
          <div style="font-size:0.64rem;color:var(--text-muted);margin-top:3px;font-family:'Share Tech Mono',monospace">เดือนก่อน: ${prevDisplay}</div>
        </div>`
      el.innerHTML =
        item('📝', 'จองใหม่', cur.length, prev.length, cur.length + ' คัน', prev.length + ' คัน', 'primary') +
        item('✅', 'ส่งมอบ', dlvCur, dlvPrev, dlvCur + ' คัน', dlvPrev + ' คัน', 'success') +
        item('💰', 'มูลค่าใบจอง', revCur, revPrev, formatCurrency(revCur), formatCurrency(revPrev), 'accent') +
        item('📈', 'Margin รวม', mgCur, mgPrev, formatCurrency(mgCur), formatCurrency(mgPrev), 'warning')
    }

    // ── พยากรณ์อนาคต: เดือนหน้า + โมเมนตัม + run-rate + สถิติสูงสุด ──
    function renderForecast() {
      const el = document.getElementById('forecast-body')
      if (!el) return
      const hist = [...Array(6)].map((_, i) => shiftMonth(selectedMonth, i - 5)).map(m => {
        const inM = bookings.filter(b => (b.bookingDate || '').startsWith(m))
        return { m, count: inM.length, revenue: inM.reduce((s, b) => s + (b.price || 0), 0) }
      })
      const counts = hist.map(h => h.count)
      const [fcCount] = linForecast(counts, 1)
      const [fcRev] = linForecast(hist.map(h => h.revenue), 1)
      const avgFirst = (counts[0] + counts[1] + counts[2]) / 3
      const avgLast = (counts[3] + counts[4] + counts[5]) / 3
      const momPct = avgFirst ? (avgLast - avgFirst) / avgFirst * 100 : (avgLast > 0 ? 100 : 0)
      const momIcon = momPct > 5 ? '▲' : momPct < -5 ? '▼' : '◆'
      const momColor = momPct > 5 ? 'success' : momPct < -5 ? 'danger' : 'warning'
      const momText = momPct > 5 ? 'ขาขึ้น' : momPct < -5 ? 'ขาลง' : 'ทรงตัว'

      // run-rate: เฉพาะเมื่อดูเดือนปัจจุบัน
      const nowYm = new Date().toISOString().slice(0, 7)
      let runRate = ''
      if (selectedMonth === nowYm) {
        const d = new Date()
        const dayNow = d.getDate()
        const daysInM = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
        const soFar = bookings.filter(b => (b.bookingDate || '').startsWith(selectedMonth)).length
        const proj = dayNow ? Math.round(soFar / dayNow * daysInM) : 0
        runRate = `<div style="background:var(--primary-dim);border:1px solid var(--primary);border-radius:8px;padding:9px 11px;margin-top:8px">
          <div style="font-size:0.66rem;color:var(--primary);font-weight:700;font-family:'Share Tech Mono',monospace">RUN-RATE เดือนนี้</div>
          <div style="font-size:0.76rem;color:var(--text-2);margin-top:2px">ผ่านไป ${dayNow}/${daysInM} วัน จองแล้ว <b>${soFar}</b> คัน → คาดปิดเดือน ≈ <b style="color:var(--primary)">${proj} คัน</b></div>
        </div>`
      }
      const best = hist.reduce((a, b) => b.count > a.count ? b : a, hist[0])

      // เวลาเฉลี่ยจากวันจอง → วันส่งมอบจริง (ทุกใบจองที่ส่งมอบแล้วและมีวันที่ครบ)
      const deliveredPairs = bookings.filter(b => b.status === 'ส่งมอบแล้ว' && b.bookingDate && b.actualDeliveryDate)
      const avgDeliverDays = deliveredPairs.length
        ? Math.round(deliveredPairs.reduce((s, b) => s + Math.max(0, (new Date(b.actualDeliveryDate) - new Date(b.bookingDate)) / 86400000), 0) / deliveredPairs.length)
        : null
      // มูลค่าใบจองที่ยังไม่ปิด (ไม่ส่งมอบ/ไม่ถอน) — เงินในอนาคตที่รออยู่
      const outstanding = bookings.filter(b => !['ส่งมอบแล้ว', 'ถอนจอง'].includes(b.status)).reduce((s, b) => s + (b.price || 0), 0)

      const rowStyle = 'display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--border-subtle);font-size:0.78rem'
      el.innerHTML = `
        <div style="${rowStyle}">
          <span style="color:var(--text-muted)">📅 ${ymLabel(shiftMonth(selectedMonth, 1))} (คาดการณ์)</span>
          <b style="color:var(--info);font-family:'Share Tech Mono',monospace">≈ ${Math.round(fcCount)} คัน</b>
        </div>
        <div style="${rowStyle}">
          <span style="color:var(--text-muted)">💰 มูลค่าคาดการณ์</span>
          <b style="color:var(--info);font-family:'Share Tech Mono',monospace">≈ ${formatCurrency(Math.round(fcRev))}</b>
        </div>
        <div style="${rowStyle}">
          <span style="color:var(--text-muted)">📊 โมเมนตัม 6 เดือน</span>
          <b style="color:var(--${momColor})">${momIcon} ${momText} ${Math.abs(momPct).toFixed(0)}%</b>
        </div>
        <div style="${rowStyle}">
          <span style="color:var(--text-muted)">🏅 เดือนที่ดีที่สุด</span>
          <b style="color:var(--accent)">${ymLabel(best.m)} · ${best.count} คัน</b>
        </div>
        <div style="${rowStyle}">
          <span style="color:var(--text-muted)">⏱ เฉลี่ยจอง→ส่งมอบ</span>
          <b style="color:var(--text-2);font-family:'Share Tech Mono',monospace">${avgDeliverDays !== null ? avgDeliverDays + ' วัน' : '—'}</b>
        </div>
        <div style="${rowStyle};border-bottom:none">
          <span style="color:var(--text-muted)">💼 มูลค่าค้างส่งมอบ</span>
          <b style="color:var(--warning);font-family:'Share Tech Mono',monospace">${formatCurrency(outstanding)}</b>
        </div>
        ${runRate}
        <div style="font-size:0.62rem;color:var(--text-muted);margin-top:8px">* พยากรณ์จาก linear regression ยอดจองจริง 6 เดือนล่าสุด</div>`
    }

    // ── อันดับรุ่นขายดี + สุดยอดเซลส์ ของเดือนที่เลือก ──
    function rankBars(entries, color, unit) {
      if (!entries.length) return `<div style="font-size:0.78rem;color:var(--text-muted);padding:20px 0;text-align:center">ไม่มีข้อมูลเดือนนี้</div>`
      const max = Math.max(...entries.map(e => e.count), 1)
      return entries.map((e, i) => `
        <div style="margin-bottom:9px">
          <div style="display:flex;justify-content:space-between;font-size:0.75rem;margin-bottom:3px">
            <span style="font-weight:${i === 0 ? '700' : '500'};color:${i === 0 ? `var(--${color})` : 'var(--text-2)'}">${i + 1}. ${escHtml(e.name)}</span>
            <span style="font-family:'Share Tech Mono',monospace;color:var(--text-3)">${e.count} ${unit} · ${formatCurrency(e.revenue)}</span>
          </div>
          <div style="background:var(--surface-2);border-radius:3px;height:7px;overflow:hidden">
            <div style="width:${Math.round(e.count / max * 100)}%;height:100%;background:var(--${color});box-shadow:0 0 8px var(--${color});border-radius:3px"></div>
          </div>
        </div>`).join('')
    }

    function renderTops() {
      const inMonth = bookings.filter(b => (b.bookingDate || '').startsWith(selectedMonth) && b.status !== 'ถอนจอง')
      const byModel = {}, bySales = {}
      inMonth.forEach(b => {
        const mk = `${b.brand || ''} ${b.model || 'ไม่ระบุ'}`.trim()
        byModel[mk] = byModel[mk] || { name: mk, count: 0, revenue: 0 }
        byModel[mk].count++; byModel[mk].revenue += b.price || 0
        const sk = b.salesName || 'ไม่ระบุ'
        bySales[sk] = bySales[sk] || { name: sk, count: 0, revenue: 0 }
        bySales[sk].count++; bySales[sk].revenue += b.price || 0
      })
      const mEl = document.getElementById('top-models')
      if (mEl) mEl.innerHTML = rankBars(Object.values(byModel).sort((a, b) => b.count - a.count || b.revenue - a.revenue).slice(0, 5), 'accent', 'คัน')
      const sEl = document.getElementById('top-sales')
      if (sEl) sEl.innerHTML = rankBars(Object.values(bySales).sort((a, b) => b.revenue - a.revenue).slice(0, 5), 'primary', 'ดีล')
    }

    // ── Conversion Funnel: Lead → จอง → ส่งมอบ + แหล่งที่มา ──
    function renderFunnel() {
      const el = document.getElementById('funnel-body')
      if (el) {
        const leadsInM = leads.filter(l => (l.createdAt || l.date || '').startsWith(selectedMonth)).length
        const bookedInM = bookings.filter(b => (b.bookingDate || '').startsWith(selectedMonth)).length
        const dlvInM = bookings.filter(b => b.status === 'ส่งมอบแล้ว' && ((b.actualDeliveryDate || '').startsWith(selectedMonth) || (b.bookingDate || '').startsWith(selectedMonth))).length
        const stages = [
          { label: '🧲 Leads เข้าใหม่', count: leadsInM, color: 'info' },
          { label: '📝 เปิดใบจอง', count: bookedInM, color: 'primary' },
          { label: '✅ ส่งมอบสำเร็จ', count: dlvInM, color: 'success' },
        ]
        const max = Math.max(...stages.map(s => s.count), 1)
        const conv = (a, b) => a ? `${(b / a * 100).toFixed(0)}%` : '—'
        el.innerHTML = stages.map((s, i) => `
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:${i < 2 ? '4px' : '0'}">
            <div style="width:120px;font-size:0.75rem;color:var(--text-2);flex-shrink:0">${s.label}</div>
            <div style="flex:1;background:var(--surface-2);border-radius:4px;height:26px;overflow:hidden;position:relative">
              <div style="width:${Math.max(4, Math.round(s.count / max * 100))}%;height:100%;background:var(--${s.color});opacity:0.8;box-shadow:0 0 12px var(--${s.color});border-radius:4px"></div>
              <span style="position:absolute;right:8px;top:50%;transform:translateY(-50%);font-size:0.78rem;font-weight:800;color:var(--text);font-family:'Share Tech Mono',monospace">${s.count}</span>
            </div>
          </div>
          ${i < 2 ? `<div style="margin:2px 0 6px 130px;font-size:0.66rem;color:var(--text-muted);font-family:'Share Tech Mono',monospace">↓ อัตราแปลง ${conv(stages[i].count, stages[i + 1].count)}</div>` : ''}
        `).join('')
      }
      const sEl = document.getElementById('source-body')
      if (sEl) {
        const inMonth = bookings.filter(b => (b.bookingDate || '').startsWith(selectedMonth))
        const bySrc = {}
        inMonth.forEach(b => { const k = b.source || 'ไม่ระบุ'; bySrc[k] = (bySrc[k] || 0) + 1 })
        const entries = Object.entries(bySrc).sort((a, b) => b[1] - a[1]).slice(0, 6)
        const max = Math.max(...entries.map(e => e[1]), 1)
        sEl.innerHTML = entries.length ? entries.map(([k, v]) => `
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;font-size:0.75rem">
            <span style="width:80px;color:var(--text-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(k)}</span>
            <div style="flex:1;background:var(--surface-2);border-radius:3px;height:8px;overflow:hidden">
              <div style="width:${Math.round(v / max * 100)}%;height:100%;background:var(--accent);box-shadow:0 0 8px var(--accent)"></div>
            </div>
            <b style="color:var(--accent);font-family:'Share Tech Mono',monospace">${v}</b>
          </div>`).join('') : `<div style="font-size:0.78rem;color:var(--text-muted);padding:20px 0;text-align:center">ไม่มีข้อมูลเดือนนี้</div>`
      }
    }

    // ── Intelligence Center: สแกนเรื่องค้าง/ด่วนจากข้อมูลจริง (กดแล้วพาไปหน้านั้น) ──
    function renderAlerts() {
      const el = document.getElementById('alerts-body')
      if (!el) return
      const now = Date.now()
      const daysSince = d => Math.floor((now - new Date(d).getTime()) / 86400000)
      const alerts = []

      // ใบจองค้างสถานะเกิน 14 วัน (ยังไม่ส่งมอบ/ไม่ถอน)
      const FINAL = ['ส่งมอบแล้ว', 'ถอนจอง']
      const stuck = bookings
        .filter(b => !FINAL.includes(b.status) && b.bookingDate && daysSince(b.bookingDate) >= 14)
        .map(b => ({ ...b, age: daysSince(b.bookingDate) }))
        .sort((a, b) => b.age - a.age)
      stuck.slice(0, 4).forEach(b => alerts.push({
        icon: '⏳', sev: b.age >= 30 ? 'danger' : 'warning', nav: '/crm/bookings',
        text: `ใบจอง ${escHtml(b.custName || b.bookingNo || b.id)} (${escHtml((b.brand || '') + ' ' + (b.model || ''))}) ค้าง "${escHtml(b.status)}"`,
        age: b.age,
      }))
      if (stuck.length > 4) alerts.push({ icon: '⏳', sev: 'warning', nav: '/crm/bookings', text: `ใบจองค้างสถานะเกิน 14 วัน อีก ${stuck.length - 4} รายการ`, age: null })

      // งานซ่อมเปิดค้างเกิน 7 วัน
      const openJobs7 = jobs
        .filter(j => !['done', 'completed', 'delivered'].includes(j.status) && j.createdAt && daysSince(j.createdAt) >= 7)
        .map(j => ({ ...j, age: daysSince(j.createdAt) }))
        .sort((a, b) => b.age - a.age)
      openJobs7.slice(0, 2).forEach(j => alerts.push({
        icon: '🔧', sev: j.age >= 14 ? 'danger' : 'warning', nav: '/service/jobs',
        text: `งานซ่อม ${escHtml(j.licensePlate || j.vin || j.id)} ยังไม่เสร็จ`, age: j.age,
      }))
      if (openJobs7.length > 2) alerts.push({ icon: '🔧', sev: 'warning', nav: '/service/jobs', text: `งานซ่อมค้างเกิน 7 วัน อีก ${openJobs7.length - 2} งาน`, age: null })

      // Lead ใหม่ไม่ถูกติดตามเกิน 3 วัน (สรุปรวม)
      const staleLeads = leads.filter(l => l.status === 'new' && l.createdAt && daysSince(l.createdAt) >= 3)
      if (staleLeads.length) alerts.push({ icon: '🧲', sev: 'warning', nav: '/crm/leads', text: `Lead ใหม่ยังไม่ติดตามเกิน 3 วัน: ${staleLeads.length} ราย`, age: null })

      // รถค้างสต็อกเกิน 90 วัน (สรุปรวม)
      const agingStock = vehicles.filter(v => !['sold', 'ขายแล้ว', 'ส่งมอบแล้ว'].includes(v.status) && !v.deleted && v.createdAt && daysSince(v.createdAt) >= 90)
      if (agingStock.length) alerts.push({ icon: '🚗', sev: 'warning', nav: '/dms/aging', text: `รถค้างสต็อกเกิน 90 วัน: ${agingStock.length} คัน`, age: null })

      const badge = document.getElementById('alert-count')
      if (badge) {
        const total = stuck.length + openJobs7.length + (staleLeads.length ? 1 : 0) + (agingStock.length ? 1 : 0)
        badge.textContent = total + ' เรื่อง'
        badge.style.display = total ? '' : 'none'
      }
      el.innerHTML = alerts.length ? alerts.map(a => `
        <div data-nav="${a.nav}" style="display:flex;align-items:center;gap:10px;padding:8px 10px;margin-bottom:6px;background:var(--${a.sev}-dim);border-left:3px solid var(--${a.sev});border-radius:6px;cursor:pointer">
          <span style="font-size:1rem;flex-shrink:0">${a.icon}</span>
          <span style="flex:1;font-size:0.78rem;color:var(--text-2)">${a.text}</span>
          ${a.age !== null ? `<span style="font-size:0.7rem;font-weight:800;color:var(--${a.sev});font-family:'Share Tech Mono',monospace;flex-shrink:0">${a.age} วัน</span>` : `<span style="font-size:0.72rem;color:var(--${a.sev});flex-shrink:0">ดู →</span>`}
        </div>`).join('')
        : `<div style="display:flex;align-items:center;gap:10px;padding:16px;background:var(--success-dim);border-radius:8px;font-size:0.82rem;color:var(--success)"><span style="font-size:1.2rem">✅</span> ระบบปกติ — ไม่มีเรื่องค้างเกินกำหนด</div>`
    }

    // ── Radar จริง: จุด = รายการค้างจริงในระบบ · ยิ่งใกล้ศูนย์กลาง = ยิ่งด่วน · คลิกจุดเพื่อไปจัดการ ──
    function renderRadar() {
      const el = document.getElementById('radar-scope')
      if (!el) return
      const now = Date.now()
      const daysSince = d => Math.floor((now - new Date(d).getTime()) / 86400000)
      const FINAL = ['ส่งมอบแล้ว', 'ถอนจอง']
      const items = []
      bookings.filter(b => !FINAL.includes(b.status) && b.bookingDate && daysSince(b.bookingDate) >= 14).forEach(b => {
        const age = daysSince(b.bookingDate)
        items.push({ nav: '/crm/bookings', sev: age >= 30 ? 'danger' : 'warning', u: Math.min(1, age / 45),
          label: `📝 ใบจอง ${b.custName || b.bookingNo || b.id} ค้าง "${b.status}" ${age} วัน` })
      })
      jobs.filter(j => !['done', 'completed', 'delivered'].includes(j.status) && j.createdAt && daysSince(j.createdAt) >= 7).forEach(j => {
        const age = daysSince(j.createdAt)
        items.push({ nav: '/service/jobs', sev: age >= 14 ? 'danger' : 'warning', u: Math.min(1, age / 30),
          label: `🔧 งานซ่อม ${j.licensePlate || j.vin || j.id} เปิดค้าง ${age} วัน` })
      })
      leads.filter(l => l.status === 'new' && l.createdAt && daysSince(l.createdAt) >= 3).forEach(l => {
        const age = daysSince(l.createdAt)
        items.push({ nav: '/crm/leads', sev: 'warning', u: Math.min(1, age / 10),
          label: `🧲 Lead ${l.firstName || ''} ${l.lastName || ''} ยังไม่ติดตาม ${age} วัน` })
      })
      vehicles.filter(v => !['sold', 'ขายแล้ว', 'ส่งมอบแล้ว'].includes(v.status) && !v.deleted && v.createdAt && daysSince(v.createdAt) >= 90).slice(0, 4).forEach(v => {
        const age = daysSince(v.createdAt)
        items.push({ nav: '/dms/aging', sev: 'warning', u: Math.min(1, age / 365),
          label: `🚗 ${(v.brand || '') + ' ' + (v.model || '')} ค้างสต็อก ${age} วัน` })
      })
      const top = items.sort((a, b) => b.u - a.u).slice(0, 14)
      const blips = top.map((it, i) => {
        const ang = (i * 137.5) * Math.PI / 180
        const r = 92 - it.u * 70
        const cx = 110 + r * Math.cos(ang), cy = 110 + r * Math.sin(ang)
        return `<g data-nav="${it.nav}" style="cursor:pointer">
          <title>${escHtml(it.label)} — คลิกเพื่อไปจัดการ</title>
          <circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="10" fill="transparent"/>
          <circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${it.sev === 'danger' ? 4.5 : 3.5}" fill="var(--${it.sev})" style="animation:dashBlip ${(1.4 + i * 0.25).toFixed(2)}s ease-in-out infinite;filter:drop-shadow(0 0 6px var(--${it.sev}))"/>
        </g>`
      }).join('')
      const nDanger = top.filter(t => t.sev === 'danger').length
      const nWarn = top.length - nDanger
      el.innerHTML = radarShell(top.length ? blips : `<text x="110" y="114" text-anchor="middle" font-size="11" fill="var(--success)" font-family="monospace" letter-spacing="1">ALL CLEAR</text>`) + `
        <div style="font-size:0.64rem;color:var(--text-muted);text-align:center;margin-top:6px">
          ${top.length
            ? `<span style="color:var(--danger)">● วิกฤต ${nDanger}</span> · <span style="color:var(--warning)">● เตือน ${nWarn}</span> — ยิ่งใกล้ศูนย์กลาง = ยิ่งด่วน · <b>คลิกจุดเพื่อไปจัดการ</b>`
            : `<span style="color:var(--success)">✅ ไม่มีรายการค้างในระบบ</span>`}
        </div>`
    }

    // ── เป้า vs ผลจริง (จากระบบเป้าหมายทีม /hr/targets) ──
    const METRIC_LABEL = { units: 'ยอดขาย (คัน)', revenue: 'รายได้', service: 'งานบริการ', csat: 'ความพึงพอใจ (%)', leads: 'Leads', other: 'อื่นๆ' }
    function renderTargets() {
      const el = document.getElementById('targets-body')
      if (!el) return
      const entries = teamTargets.filter(t => t.period === selectedMonth)
      if (!entries.length) {
        el.innerHTML = `<div style="font-size:0.78rem;color:var(--text-muted);padding:14px 0;text-align:center">ไม่มีเป้าหมายเดือนนี้<br><button class="btn btn-sm btn-secondary" data-nav="/hr/targets" style="margin-top:8px">ตั้งเป้าหมาย →</button></div>`
        return
      }
      el.innerHTML = entries.slice(0, 5).map(t => {
        const pct = t.target ? Math.round((t.actual || 0) / t.target * 100) : 0
        const color = pct >= 100 ? 'success' : pct >= 80 ? 'primary' : pct >= 50 ? 'warning' : 'danger'
        const fmt = v => t.metric === 'revenue' ? formatCurrency(v) : v
        return `<div style="margin-bottom:10px" data-nav="/hr/targets">
          <div style="display:flex;justify-content:space-between;font-size:0.73rem;margin-bottom:3px">
            <span style="color:var(--text-2)">${escHtml(t.department)}${t.team ? ' · ' + escHtml(t.team) : ''} — ${METRIC_LABEL[t.metric] || escHtml(t.metric)}</span>
            <b style="color:var(--${color});font-family:'Share Tech Mono',monospace">${pct}%</b>
          </div>
          <div style="background:var(--surface-2);border-radius:3px;height:8px;overflow:hidden">
            <div style="width:${Math.min(100, pct)}%;height:100%;background:var(--${color});box-shadow:0 0 8px var(--${color})"></div>
          </div>
          <div style="font-size:0.64rem;color:var(--text-muted);margin-top:2px;font-family:'Share Tech Mono',monospace">${fmt(t.actual || 0)} / ${fmt(t.target)}</div>
        </div>`
      }).join('')
    }

    // ── Heatmap รายวัน: ความถี่ใบจองแต่ละวันของเดือนที่เลือก ──
    function renderHeatmap() {
      const el = document.getElementById('day-heatmap')
      if (!el) return
      const [y, m] = selectedMonth.split('-').map(Number)
      const daysInM = new Date(y, m, 0).getDate()
      const counts = Array(daysInM).fill(0)
      bookings.forEach(b => {
        if ((b.bookingDate || '').startsWith(selectedMonth)) {
          const d = parseInt((b.bookingDate || '').slice(8, 10))
          if (d >= 1 && d <= daysInM) counts[d - 1]++
        }
      })
      const max = Math.max(...counts, 1)
      el.innerHTML = `<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px">
        ${counts.map((c, i) => {
          const op = c ? (0.25 + 0.75 * c / max).toFixed(2) : 0
          return `<div title="${i + 1} ${ymLabel(selectedMonth)}: ${c} ใบจอง" style="aspect-ratio:1;border-radius:3px;background:${c ? `rgba(0,180,255,${op})` : 'var(--surface-2)'};border:1px solid var(--border-subtle);display:flex;align-items:center;justify-content:center;font-size:0.55rem;color:${c ? 'var(--text)' : 'var(--text-muted)'};font-family:'Share Tech Mono',monospace;${c ? `box-shadow:0 0 6px rgba(0,180,255,${op})` : ''}">${i + 1}</div>`
        }).join('')}
      </div>
      <div style="font-size:0.62rem;color:var(--text-muted);margin-top:6px">เข้มมาก = จองเยอะ · สูงสุด ${max} ใบจอง/วัน</div>`
    }

    function renderAll() {
      renderPipeline(); renderDeptDetail(); renderTrendChart(); renderDonut(); renderGauges()
      renderMoM(); renderForecast(); renderTops(); renderFunnel()
      renderAlerts(); renderTargets(); renderHeatmap(); renderRadar()
      document.querySelectorAll('.fc-month').forEach(s => { s.textContent = ymLabel(selectedMonth) })
    }

    document.getElementById('pm-prev')?.addEventListener('click', () => {
      selectedMonth = shiftMonth(selectedMonth, -1)
      renderAll()
    })
    document.getElementById('pm-next')?.addEventListener('click', () => {
      selectedMonth = shiftMonth(selectedMonth, 1)
      renderAll()
    })
    document.getElementById('trend-6')?.addEventListener('click', () => { trendRange = 6; renderTrendChart() })
    document.getElementById('trend-12')?.addEventListener('click', () => { trendRange = 12; renderTrendChart() })

    renderAll()

    // Today panel — ใช้ข้อมูลจริง
    const todayBookings = bookings.filter(b => (b.pickupDate || b.appointmentDate || b.createdAt || '').startsWith(today))
    const pendingPdi = pdi.filter(p => p.status !== 'passed' && p.status !== 'completed')
    const todayEl = document.getElementById('today-stats')
    if (todayEl) {
      const todayItems = [
        { label:'นัดหมาย/จอง', value:`${todayBookings.length || bookings.filter(b=>b.status==='จอง').length} รายการ`, icon:'📅', color:'primary', nav:'/crm/bookings' },
        { label:'Job Cards เปิด', value:`${openJobs} งาน`, icon:'🔧', color:'warning', nav:'/service/jobs' },
        { label:'PDI รอตรวจ', value:`${pendingPdi.length || 0} คัน`, icon:'✅', color:'accent', nav:'/dms/pdi' },
        { label:'Tasks ค้าง', value:`${pendingTasks} งาน`, icon:'📋', color: pendingTasks > 3 ? 'danger' : 'accent', nav:'/tasks' },
      ]
      todayEl.innerHTML = todayItems.map(s => `
        <div style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:8px;border-radius:var(--radius-md);background:var(--surface-2)" data-nav="${s.nav}">
          <span style="font-size:1.1rem">${s.icon}</span>
          <span style="flex:1;font-size:0.83rem">${s.label}</span>
          <span style="font-weight:700;color:var(--${s.color})">${s.value}</span>
        </div>
      `).join('')
    }

    // Activity Feed — ประกอบจาก recent docs ทุก collection
    const feed = []
    customers.slice(0, 3).forEach(c => feed.push({ icon:'👥', text:`ลูกค้า: ${escHtml(c.firstName||'')} ${escHtml(c.lastName||'')}`, time: timeAgo(c.createdAt), color:'primary' }))
    jobs.slice(0, 3).forEach(j => feed.push({ icon:'🔧', text:`Job Card: ${escHtml(j.licensePlate||j.vin||j.id||'')} — ${escHtml(j.serviceType||j.type||'งานซ่อม')}`, time: timeAgo(j.createdAt), color:'warning' }))
    bookings.slice(0, 3).forEach(b => feed.push({ icon:'📝', text:`จอง: ${escHtml(b.customerName||'')} — ${escHtml(b.model||b.vehicleModel||'')}`, time: timeAgo(b.createdAt), color:'accent' }))
    tasks.slice(0, 2).forEach(t => feed.push({ icon:'✅', text:`Task: ${escHtml(t.title||t.name||'')}`, time: timeAgo(t.createdAt), color:'success' }))
    // Sort by time descending (most recent first)
    feed.sort((a, b) => (b.rawTime || 0) - (a.rawTime || 0))
    const feedEl = document.getElementById('activity-feed')
    const feedItems = feed.length ? feed : ACTIVITY_FEED
    if (feedEl) {
      feedEl.innerHTML = feedItems.slice(0, 10).map(a => `
        <div style="padding:10px 16px;border-bottom:1px solid var(--border);display:flex;gap:10px;align-items:flex-start">
          <div style="width:28px;height:28px;border-radius:50%;background:var(--${a.color}-dim);display:flex;align-items:center;justify-content:center;font-size:0.85rem;flex-shrink:0">${a.icon}</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:0.8rem;line-height:1.4">${a.text}</div>
            <div style="font-size:0.7rem;color:var(--text-muted);margin-top:2px">${a.time}</div>
          </div>
        </div>
      `).join('')
    }

    // Customer list
    const STATUS_COLORS = { hot:'danger', warm:'warning', cold:'primary', vip:'accent', lost:'secondary' }
    const STATUS_LABELS = { hot:'🔥 Hot', warm:'☀️ Warm', cold:'❄️ Cold', vip:'⭐ VIP', lost:'💨 Lost' }
    const list = document.getElementById('customers-list')
    if (list && customers.length) {
      list.innerHTML = customers.slice(0, 5).map(c => `
        <div style="display:flex;align-items:center;gap:10px;padding:10px 16px;border-bottom:1px solid var(--border);cursor:pointer" data-nav="/crm/customers">
          <div style="width:32px;height:32px;border-radius:50%;background:var(--${STATUS_COLORS[c.status] || 'secondary'}-dim);display:flex;align-items:center;justify-content:center;font-size:0.8rem;font-weight:700;color:var(--${STATUS_COLORS[c.status] || 'secondary'});flex-shrink:0">
            ${escHtml(c.firstName?.[0] || '?')}${escHtml(c.lastName?.[0] || '')}
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-size:0.85rem;font-weight:600">${escHtml(c.firstName || '')} ${escHtml(c.lastName || '')}</div>
            <div style="font-size:0.73rem;color:var(--text-muted)">${escHtml(c.interestedModel || '-')} · ${escHtml(c.phone || '-')}</div>
          </div>
          <span class="badge badge-${STATUS_COLORS[c.status] || 'secondary'}" style="font-size:0.68rem">${STATUS_LABELS[c.status] || escHtml(c.status) || '-'}</span>
        </div>
      `).join('')
    }
  } catch {}
}
