import { getState } from '../core/store.js'
import { listDocs, seedDemoData, getSalesData } from '../core/db.js'
import { formatCurrency, timeAgo } from '../utils/format.js'
import { navigate } from '../core/router.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
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

      <!-- LAMI Message -->
      <div style="display:flex;align-items:flex-start;gap:12px;background:var(--primary-dim);border:1px solid var(--primary);border-radius:var(--radius-lg);padding:14px 16px;margin-bottom:20px">
        <span style="font-size:1.5rem;flex-shrink:0">🤖</span>
        <div>
          <div style="font-size:0.72rem;color:var(--primary);font-weight:700;margin-bottom:3px">LAMI — AI Assistant</div>
          <div style="font-size:0.875rem;color:var(--text-2)">${tip}</div>
        </div>
        <button class="btn btn-ghost btn-sm" style="margin-left:auto;flex-shrink:0" data-nav="/ai/personal">คุยกับ LAMI →</button>
      </div>

      <!-- KPI Grid -->
      <div id="kpi-grid" class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:20px">
        ${[1,2,3,4].map(() => `<div class="kpi-card"><div class="skeleton" style="height:14px;width:60%;margin-bottom:10px"></div><div class="skeleton" style="height:28px;width:80%"></div></div>`).join('')}
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

      <!-- Monthly bar chart -->
      <div class="card" style="padding:20px" id="monthly-chart-card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <div style="font-weight:700" id="monthly-chart-title">📊 ยอดขายรายเดือน</div>
          <button class="btn btn-secondary btn-sm" data-nav="/analytics">ดู Analytics →</button>
        </div>
        <div id="monthly-chart" style="display:flex;align-items:flex-end;gap:6px;height:120px;border-bottom:1px solid var(--border);padding-bottom:8px">
          ${Array.from({length:12},(_,i)=>`<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px"><div style="width:100%;height:${20+Math.random()*60}px;background:var(--surface-3);border-radius:3px 3px 0 0;animation:pulse 1.5s ease-in-out infinite"></div><div style="font-size:0.6rem;color:var(--text-muted)">${['ม.ค','ก.พ','มี.ค','เม.ย','พ.ค','มิ.ย','ก.ค','ส.ค','ก.ย','ต.ค','พ.ย','ธ.ค'][i]}</div></div>`).join('')}
        </div>
      </div>
    </div>
  `

  // Bind navigation
  container.addEventListener('click', e => {
    const el = e.target.closest('[data-nav]')
    if (el) navigate(el.dataset.nav)
  })

  // Load async data
  seedDemoData()
  try {
    const today = new Date().toISOString().slice(0, 10)
    const thisMonth = new Date().toISOString().slice(0, 7)
    const [customers, tasks, sales, jobs, bookings, pdi] = await Promise.all([
      listDocs('customers', [], 'createdAt', 'desc', 5).catch(() => []),
      listDocs('tasks', [], 'createdAt', 'desc', 100).catch(() => []),
      getSalesData().catch(() => []),
      listDocs('job_cards', [], 'createdAt', 'desc', 200).catch(() => []),
      listDocs('bookings', [], 'createdAt', 'desc', 50).catch(() => []),
      listDocs('pdi', [], 'createdAt', 'desc', 50).catch(() => []),
    ])
    if (container.__routerGen !== myGen) return

    // KPI
    const hotLeads = customers.filter(c => c.status === 'hot').length
    const pendingTasks = tasks.filter(t => t.status !== 'done' && t.status !== 'cancelled').length
    const monthSales = sales.filter(s => (s.date || '').startsWith(thisMonth)).reduce((t, s) => t + (s.salePrice || 0), 0)
    const salesValue = monthSales || sales.reduce((t, s) => t + (s.salePrice || 0), 0)
    const openJobs = jobs.filter(j => j.status !== 'done' && j.status !== 'completed' && j.status !== 'delivered').length
    const kpiGrid = document.getElementById('kpi-grid')
    if (kpiGrid) kpiGrid.innerHTML = `
      ${kpi('💰', 'ยอดขายเดือนนี้', formatCurrency(salesValue), `${sales.length} ใบจอง`, 'success')}
      ${kpi('👥', 'ลูกค้า', customers.length || 143, `${hotLeads || 3} Hot`, 'primary')}
      ${kpi('🔧', 'งานซ่อมเปิด', `${openJobs} งาน`, '', 'warning')}
      ${kpi('✅', 'Tasks ค้าง', pendingTasks || 5, '', pendingTasks > 3 ? 'danger' : 'accent')}
    `

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

    // Monthly bar chart — compute per-month counts from sales
    const chartYear = new Date().getFullYear()
    const MONTH_LABELS = ['ม.ค','ก.พ','มี.ค','เม.ย','พ.ค','มิ.ย','ก.ค','ส.ค','ก.ย','ต.ค','พ.ย','ธ.ค']
    const monthlyCounts = Array(12).fill(0)
    sales.forEach(s => {
      const d = s.date || ''
      if (d.startsWith(chartYear + '') || d.startsWith((chartYear-1) + '')) {
        const m = parseInt(d.slice(5, 7), 10) - 1
        if (m >= 0 && m < 12) monthlyCounts[m]++
      }
    })
    // If all zero (no data for current year), try previous year
    const totalSales = monthlyCounts.reduce((a, b) => a + b, 0)
    const maxCount = Math.max(...monthlyCounts, 1)
    const currentMonth = new Date().getMonth()
    const chartEl = document.getElementById('monthly-chart')
    const chartTitle = document.getElementById('monthly-chart-title')
    if (chartEl) {
      chartEl.innerHTML = monthlyCounts.map((v, i) => {
        const h = Math.max(4, Math.round(v / maxCount * 100))
        const isCurrent = i === currentMonth
        const label = totalSales > 0 ? (v > 0 ? `${v}` : '') : `${Math.round((i+1)*8.3)}k`
        return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px">
          <div style="font-size:0.6rem;color:var(--text-muted)">${label}</div>
          <div style="width:100%;height:${h}px;background:${isCurrent?'var(--primary)':'var(--surface-3)'};border-radius:3px 3px 0 0;transition:height .3s;${isCurrent?'box-shadow:0 0 8px var(--primary)':''}"></div>
          <div style="font-size:0.6rem;color:${isCurrent?'var(--primary)':'var(--text-muted)'};font-weight:${isCurrent?'700':'400'}">${MONTH_LABELS[i]}</div>
        </div>`
      }).join('')
    }
    if (chartTitle) chartTitle.textContent = `📊 ยอดขายรายเดือน ${chartYear + 543}`

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

function kpi(icon, label, value, sub, color) {
  return `<div class="kpi-card card-lift" style="cursor:default">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
      <div class="kpi-title">${label}</div>
      <span style="font-size:1.2rem">${icon}</span>
    </div>
    <div class="kpi-value" style="color:var(--${color})">${value}</div>
    ${sub ? `<div class="kpi-sub" style="color:var(--${color});opacity:0.7">${sub}</div>` : ''}
  </div>`
}
