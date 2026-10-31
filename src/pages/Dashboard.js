import { getState, on } from '../core/store.js'
import { listDocs, watchDocs, seedDemoData, getSalesData } from '../core/db.js'
import { companyScopeFilters } from '../core/companyScope.js'
import { formatCurrency, timeAgo, todayBangkok, toDateStr, toDate, formatDate } from '../utils/format.js'
import { navigate } from '../core/router.js'
import { generateMorningBriefing, bangkokHour } from '../utils/ai.js'
import { getModuleForPath, hasModuleAccess, loadRolePermissions } from '../core/permissions.js'
import { t } from '../i18n/index.js'
import { DELIVERED_STATUSES as DELIVERED_ST } from '../utils/deliveryIncome.js'
import { businessFacts } from '../utils/bizFacts.js'
import { SOURCE_INFO, normSource } from '../utils/sourcePerformance.js'
import { monthStats, openBookings, isCancelled, isDelivered, stockSince, pctChange, sparkPath, rangeStats, statRows, periodMonths, prevPeriodAnchor, periodLabel, shiftYm, pipelineStages, salesBoard } from '../utils/dashStats.js'
import { exportToExcel } from '../utils/importExport.js'
import { DASH_SECTIONS, loadDashLayout, saveDashLayout, applyDashLayout, moveSection, normalizeLayout } from '../utils/dashLayout.js'
import { openModal } from '../utils/modal.js'

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
  'ผ่านไฟแนนซ์รอเบิก':    { label: 'ผ่านไฟแนนซ์รอเบิก', icon: '🏦', color: 'accent' },
  'ซื้อสดรอเบิกรถ':       { label: 'ซื้อสดรอเบิกรถ', icon: '💵', color: 'accent' },
  'ผ่านไฟแนนซ์รอจอง':     { label: 'ผ่านไฟแนนซ์รอจอง', icon: '📄', color: 'primary' },
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
  { icon:'🚗', label:'สต็อกรถ', path:'/dms/stock', color:'accent' },
  { icon:'📝', label:'จองรถ', path:'/crm/bookings', color:'warning' },
  { icon:'🔧', label:'งานซ่อม', path:'/service/jobs', color:'success' },
  { icon:'🔩', label:'อะไหล่', path:'/service/parts', color:'primary' },
  { icon:'💰', label:'กำไรต่อคัน', path:'/finance/margin', color:'success' },
  { icon:'📉', label:'กำไร-ขาดทุน', path:'/finance/pl', color:'primary' },
  { icon:'💳', label:'เงินเดือน', path:'/finance/payroll', color:'accent' },
  { icon:'🛡', label:'ประกันภัย', path:'/insurance', color:'accent' },
  { icon:'🤖', label:'ถาม LAMI', path:'/ai/ask', color:'primary' },
  { icon:'💬', label:'ข้อความรวม', path:'/comms', color:'accent' },
  { icon:'✅', label:'งานมอบหมาย', path:'/tasks', color:'success' },
  { icon:'🎓', label:'อบรม', path:'/training', color:'warning' },
  { icon:'🎮', label:'แข่งยอด', path:'/gamification', color:'accent' },
  { icon:'📈', label:'วิเคราะห์', path:'/analytics', color:'primary' },
  { icon:'🤝', label:'ลูกค้าองค์กร', path:'/b2b', color:'accent' },
  { icon:'🔗', label:'เชื่อมระบบ', path:'/integrations', color:'primary' },
  { icon:'📋', label:'คุณภาพ', path:'/quality', color:'warning' },
  { icon:'🔄', label:'ย้ายข้อมูล', path:'/migration', color:'danger' },
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
  // ใช้เวลาไทยเสมอ (เครื่องที่ตั้งโซนเวลาอื่นไว้จะได้ไม่ทักผิดช่วง) · ตี 0–4 นับเป็น "ดึก" ไม่ใช่ "เช้า"
  const hour = bangkokHour()
  const night = hour < 5
  // (v1.0.353) รองรับหลายภาษา — เฉพาะส่วน "เปลือก" ของหน้านี้ (คำทักทาย/ปุ่ม) เท่านั้น เนื้อหา KPI/กราฟ/
  // สถานะต่างๆด้านในยังเป็นภาษาไทยล้วน (เป็นเนื้อหาเชิงลึกของหน้า ไม่ใช่ขอบเขต "เมนู/ส่วนกลาง" ที่ตกลงกันไว้)
  const greeting = night ? t('greetingEvening') : hour < 12 ? t('greetingMorning') : hour < 17 ? t('greetingAfternoon') : t('greetingEvening')
  const briefIcon = night ? '🌙' : hour < 12 ? '🌅' : hour < 17 ? '☀️' : '🌙'
  const briefLabel = night ? 'สรุปวันนี้' : hour < 12 ? 'สรุปเช้านี้' : hour < 17 ? 'สรุประหว่างวัน' : 'สรุปวันนี้'

  // Quick Access เดิมโชว์ทุกโมดูลให้ทุก role เหมือนกันหมด ทั้งที่ Sidebar กรองเมนูตามสิทธิ์โมดูล (hasModuleAccess)
  // อยู่แล้ว ทำให้พนักงานบางคนเห็น shortcut ที่กดแล้วถูกบล็อกทันที (ไม่ตรงกับสิทธิ์จริง) แก้ให้กรองด้วยระบบเดียวกัน
  const myRole = getState('role') || user?.role || 'staff'
  const normName = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ')
  await loadRolePermissions()
  if (container.__routerGen !== myGen) return
  const visibleLinks = QUICK_LINKS.filter(l => hasModuleAccess(myRole, getModuleForPath(l.path)?.key, user?.extraGrants))

  container.innerHTML = `
    <div class="page-content animate-slide">
      <!-- Header -->
      <div class="page-header">
        <div>
          <div class="page-title" id="dash-greeting">${greeting} 👋 ${escHtml(user?.displayName || user?.email?.split('@')[0] || t('welcome'))}</div>
          <div class="page-subtitle">${formatThaiDate()} · LAMOM ONE</div>
        </div>
        <div class="page-actions">
          ${hasModuleAccess(myRole, getModuleForPath('/crm/my-day')?.key, user?.extraGrants) ? `<button class="btn btn-warning btn-sm" data-nav="/crm/my-day">☀️ งานของฉันวันนี้</button>` : ''}
          <button class="btn btn-secondary btn-sm" data-nav="/analytics">📊 วิเคราะห์</button>
        </div>
      </div>

      <!-- เดือนเดียวคุมทั้งหน้า: ทุกการ์ด/กราฟเปลี่ยนตามเดือนนี้ (เดิมปุ่ม ◀ ▶ ซ่อนอยู่กลางหน้าในการ์ดยอดจอง) -->
      <div class="dash-toolbar">
        <div class="dash-month">
          <button class="btn btn-ghost btn-sm" id="pm-prev" title="เดือนก่อน" aria-label="เดือนก่อน">◀</button>
          <span id="pm-label">...</span>
          <button class="btn btn-ghost btn-sm" id="pm-next" title="เดือนถัดไป" aria-label="เดือนถัดไป">▶</button>
          <button class="btn btn-ghost btn-xs" id="pm-now" style="display:none">กลับเดือนนี้</button>
        </div>
        <label class="dash-compare">เทียบกับ <select id="mom-compare-picker" class="input"></select></label>
        <div style="flex:1"></div>
        <span class="dash-live" title="ตัวเลขอัปเดตเองทันทีเมื่อมีคนแก้ใบจอง/งานซ่อม"><i></i>อัปเดตสด</span>
        <button class="btn btn-ghost btn-sm" id="dash-custom" title="เลือกการ์ดที่จะแสดงและลำดับ">⚙️ ปรับแต่ง</button>
        <button class="btn btn-ghost btn-sm" id="dash-print" title="พิมพ์หรือบันทึกเป็น PDF">🖨 พิมพ์</button>
      </div>

      <!-- Command HUD strip -->
      <style>
        .dash-jump { display:none; }
        @media (max-width: 640px) {
          .dash-jump { display:flex; gap:6px; overflow-x:auto; position:sticky; top:var(--topbar-height, 56px); z-index:5; margin:0 -12px 12px; padding:8px 12px; background:var(--bg, var(--surface)); border-bottom:1px solid var(--border); }
          .page-content .card { scroll-margin-top:calc(var(--topbar-height, 56px) + 52px); }
        }
        @keyframes dashRadarSpin { to { transform: rotate(360deg); } }
        @keyframes dashBlip { 0%,100% { opacity: 0.15; } 50% { opacity: 1; } }
        @keyframes dashPulseDot { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }
        @keyframes dashGaugeDraw { from { stroke-dasharray: 0 999; } }
        .dash-toolbar { display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin:-4px 0 16px; padding:8px 12px; background:var(--surface); border:1px solid var(--border); border-radius:var(--radius-lg); }
        .dash-month { display:flex; align-items:center; gap:4px; }
        .dash-month #pm-label { font-weight:800; font-size:0.95rem; min-width:96px; text-align:center; color:var(--primary); }
        .dash-compare { display:flex; align-items:center; gap:6px; font-size:0.74rem; color:var(--text-muted); }
        .dash-compare select { width:auto; font-size:0.76rem; padding:4px 8px; }
        .dash-live { display:flex; align-items:center; gap:6px; font-size:0.7rem; color:var(--success); font-weight:700; }
        .dash-live i { width:7px; height:7px; border-radius:50%; background:var(--success); box-shadow:0 0 8px var(--success); animation:dashPulseDot 2s infinite; }
        .dash-flow { display:flex; flex-direction:column; gap:16px; }
        .dash-flow > [data-sec] { margin:0 !important; }
        .dash-flow > [data-sec].dash-off { display:none !important; }
        .dash-hero-head { display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:10px; }
        .dash-hero-title { font-weight:700; font-size:0.86rem; }
        .dash-hero-title small { font-weight:500; color:var(--text-muted); font-size:0.74rem; margin-left:6px; }
        .dash-hero-hint { margin-left:auto; font-size:0.7rem; color:var(--text-muted); }
        .dash-seg { display:inline-flex; padding:3px; gap:2px; background:var(--surface-2); border:1px solid var(--border); border-radius:999px; }
        .dash-seg button { border:0; background:transparent; color:var(--text-2); font:inherit; font-size:0.76rem; font-weight:600; padding:4px 12px; border-radius:999px; cursor:pointer; }
        .dash-seg button.on { background:var(--primary); color:#fff; }
        .dash-flowline { display:flex; align-items:stretch; gap:4px; overflow-x:auto; padding:2px 2px 8px; scroll-snap-type:x proximity; }
        .dash-stage { flex:1 1 0; min-width:128px; scroll-snap-align:start; display:flex; flex-direction:column; gap:3px; text-align:left; font:inherit; color:inherit; padding:12px; border-radius:var(--radius-md); border:1px solid var(--border); border-top:3px solid var(--c); background:var(--surface-2); cursor:pointer; transition:transform .15s, border-color .15s; }
        .dash-stage:hover { transform:translateY(-2px); border-color:var(--c); }
        .dash-stage-n { font-size:1.6rem; font-weight:800; line-height:1.1; color:var(--c); }
        .dash-stage-l { font-size:0.76rem; font-weight:700; color:var(--text-2); }
        .dash-stage-v { font-size:0.7rem; color:var(--text-muted); font-variant-numeric:tabular-nums; }
        .dash-stage-a { font-size:0.66rem; font-weight:600; }
        .dash-stage-arrow { align-self:center; color:var(--text-muted); font-size:1.2rem; flex-shrink:0; }
        @media (max-width: 640px) {
          .dash-flowline { flex-direction:column; overflow:visible; gap:6px; }
          .dash-stage { display:grid; grid-template-columns:auto 1fr auto; align-items:center; column-gap:12px; row-gap:0; padding:10px 12px; border-top-width:1px; border-left:3px solid var(--c); }
          .dash-stage-n { grid-row:span 2; min-width:34px; text-align:center; }
          .dash-stage-v { text-align:right; }
          .dash-stage-a { grid-column:2 / 4; }
          .dash-stage-arrow { display:none; }
        }
        .dash-flow-foot { display:flex; flex-wrap:wrap; gap:6px 16px; font-size:0.74rem; margin-top:8px; color:var(--text-2); }
        .dash-board { display:flex; flex-direction:column; gap:8px; }
        .dash-board-row { display:flex; align-items:center; gap:10px; }
        .dash-ava { width:34px; height:34px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:0.8rem; flex-shrink:0; background:var(--primary-dim); color:var(--primary); position:relative; }
        .dash-ava i { position:absolute; right:-4px; bottom:-4px; font-style:normal; font-size:0.85rem; }
        .dash-board-main { flex:1; min-width:0; }
        .dash-board-top { display:flex; justify-content:space-between; gap:6px; font-size:0.8rem; }
        .dash-board-top b { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .dash-board-bar { height:6px; border-radius:3px; background:var(--surface-2); overflow:hidden; margin-top:4px; }
        .dash-board-bar span { display:block; height:100%; border-radius:3px; background:linear-gradient(90deg, var(--primary), var(--accent)); }
        .dash-board-sub { font-size:0.68rem; color:var(--text-muted); margin-top:2px; }
        .dash-tip { position:fixed; z-index:2000; display:none; pointer-events:none; background:var(--surface); border:1px solid var(--border); border-radius:10px; padding:8px 10px; font-size:0.74rem; line-height:1.55; color:var(--text-2); box-shadow:0 8px 24px rgba(0,0,0,0.3); max-width:260px; }
        .dash-tip b { color:var(--text); display:block; margin-bottom:2px; }
        .dash-drill-sum { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:10px; }
        .dash-drill-sum span { background:var(--surface-2); border:1px solid var(--border); border-radius:8px; padding:6px 10px; font-size:0.78rem; }
        .dash-drill-sum b { color:var(--primary); }
        .dash-drill tr[data-id] { cursor:pointer; }
        .dash-drill td { font-size:0.8rem; }
        @media (max-width: 640px) { .dash-hero-hint { display:none; } }
        .dash-hero-grid { display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); gap:12px; }
        .dash-kpi { position:relative; display:flex; flex-direction:column; text-align:left; font:inherit; color:inherit; background:var(--surface); border:1px solid var(--border); border-radius:var(--radius-lg); padding:14px 14px 8px; cursor:pointer; overflow:hidden; transition:transform .15s, border-color .15s, box-shadow .15s; min-width:0; }
        .dash-kpi::before { content:''; position:absolute; left:0; right:0; top:0; height:3px; background:var(--c); }
        .dash-kpi:hover { transform:translateY(-2px); border-color:var(--c); box-shadow:0 6px 18px color-mix(in srgb, var(--c) 18%, transparent); }
        .dash-kpi-label { font-size:0.74rem; color:var(--text-muted); font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .dash-kpi-val { font-size:clamp(1.15rem, 0.9rem + 0.8vw, 1.6rem); font-weight:800; color:var(--text); margin-top:2px; white-space:nowrap; line-height:1.25; }
        .dash-kpi-val small { font-size:0.6em; font-weight:700; color:var(--text-muted); margin-left:3px; }
        .dash-kpi-top { display:flex; justify-content:space-between; align-items:center; gap:6px; min-width:0; }
        .dash-kpi-sub { font-size:0.66rem; color:var(--text-muted); margin-top:1px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .dash-delta { font-weight:800; padding:1px 7px; border-radius:999px; font-size:0.66rem; flex-shrink:0; }
        .dash-delta.up { color:var(--success); background:var(--success-dim); }
        .dash-delta.down { color:var(--danger); background:var(--danger-dim); }
        .dash-delta.flat { color:var(--text-muted); background:var(--surface-2); }
        .dash-kpi svg { display:block; width:100%; height:26px; margin-top:6px; }
        @media (max-width: 1180px) { .dash-hero-grid { grid-template-columns:repeat(3,minmax(0,1fr)); } }
        @media (max-width: 640px) {
          .dash-hero-grid { grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; }
          .dash-kpi { padding:11px 11px 6px; }
          .dash-toolbar { gap:6px; padding:6px 8px; }
          .dash-live, #dash-print { display:none; }
        }
        @media (max-width: 400px) { .dash-kpi-top { flex-wrap:wrap; row-gap:3px; } .dash-kpi-top .dash-delta { order:2; } }
        .dash-cust-row { display:flex; align-items:center; gap:8px; padding:8px 10px; border:1px solid var(--border); border-radius:8px; margin-bottom:6px; background:var(--surface-2); }
        .dash-cust-row span { flex:1; font-size:0.84rem; }
        @media print {
          #sidebar, #topbar, .bottom-nav, .dash-toolbar button, .dash-jump, .dash-briefing-actions, .page-actions, .lami-fab, #lami-fab { display:none !important; }
          .main-wrap, .main-content, #main-content, .page-content { margin:0 !important; padding:0 !important; max-width:none !important; }
          .dash-flow > [data-sec] { break-inside:avoid; }
          .card, .dash-kpi { box-shadow:none !important; }
          * { animation:none !important; }
        }
      </style>
      <!-- มือถือ: หน้านี้ยาวมาก → แถบทางลัดกระโดดไปหัวข้อที่อยากดู (ติดอยู่บนจอเวลาเลื่อน) -->
      <div class="dash-jump">
        ${[['hero-kpis', '📊 ตัวเลข'], ['alerts-body', '🚨 เรื่องด่วน'], ['targets-body', '🎯 เป้า'], ['pipeline-card', '🚗 ยอดจอง'], ['monthly-chart-card', '📊 กราฟ'], ['top-sales', '🥇 ท็อปเซลส์'], ['funnel-body', '📶 Funnel']]
          .map(([id, label]) => `<button class="btn btn-secondary btn-xs" data-jump="${id}" style="border-radius:999px;flex-shrink:0">${label}</button>`).join('')}
      </div>

      <div class="dash-flow">
      <!-- ตัวเลขหลักของเดือน: ใหญ่ อ่านง่าย มี % เทียบเดือนที่เลือก + กราฟเส้นเล็ก 6 เดือน กดแล้วไปหน้านั้น -->
      <div data-sec="hero" id="hero-sec">
        <div class="dash-hero-head">
          <div class="dash-seg" role="tablist" aria-label="ช่วงเวลา">
            <button type="button" data-period="month">เดือน</button><button type="button" data-period="quarter">ไตรมาส</button><button type="button" data-period="year">ปี</button>
          </div>
          <span id="hero-period" class="dash-hero-title"></span>
          <span class="dash-hero-hint">กดตัวเลขเพื่อดูรายการใบจองที่นับ</span>
        </div>
        <div id="hero-kpis" class="dash-hero-grid">
          ${[1,2,3,4,5,6].map(() => `<div class="skeleton" style="height:112px;border-radius:var(--radius-lg)"></div>`).join('')}
        </div>
      </div>

      <!-- Morning Briefing: สรุปเชิงรุกทุกเช้าจากข้อมูลจริง แคชไว้ต่อวัน/ผู้ใช้ -->
      <div class="dash-briefing" data-sec="briefing" style="display:flex;align-items:flex-start;gap:12px;background:var(--primary-dim);border:1px solid var(--primary);border-radius:var(--radius-lg);padding:14px 16px;margin-bottom:20px">
        <span style="font-size:1.5rem;flex-shrink:0">${briefIcon}</span>
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:3px">
            <span style="font-size:0.72rem;color:var(--primary);font-weight:700">LAMI — ${briefLabel}</span>
            <span id="briefing-time" style="font-size:0.64rem;color:var(--text-muted);font-variant-numeric:tabular-nums"></span>
          </div>
          <div id="briefing-text" style="font-size:0.875rem;color:var(--text-2);line-height:1.6;white-space:pre-line;min-height:1.3em">กำลังวิเคราะห์ข้อมูลเช้านี้...</div>
        </div>
        <div class="dash-briefing-actions" style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0">
          <button class="btn btn-ghost btn-sm" id="briefing-regen" title="สร้างสรุปใหม่จากข้อมูลล่าสุด">🔄 สร้างใหม่</button>
          <button class="btn btn-ghost btn-sm" data-nav="/ai/ask">คุยกับ LAMI →</button>
        </div>
      </div>

      <!-- Intelligence Center: แจ้งเตือนอัจฉริยะ + เป้า vs ผลจริง -->
      <div class="dash-intel" data-sec="intel" style="display:grid;grid-template-columns:2fr 1fr;gap:16px;margin-bottom:16px">
        <div class="card" style="padding:16px">
          <div style="font-weight:700;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center">
            <span>🚨 เรื่องที่ต้องจัดการ</span>
            <span id="alert-count" class="badge badge-danger" style="display:none"></span>
          </div>
          <div id="alerts-body"><div class="skeleton" style="height:120px;border-radius:var(--radius-md)"></div></div>
        </div>
        <div class="card" style="padding:16px">
          <div style="font-weight:700;margin-bottom:12px">🎯 เป้า vs ผลจริง — <span class="fc-month" style="color:var(--primary);font-size:0.8rem"></span></div>
          <div id="targets-body"><div class="skeleton" style="height:120px;border-radius:var(--radius-md)"></div></div>
        </div>
      </div>

      <!-- Operations radar + ring gauges -->
      <div class="card mb-4 dash-radar" data-sec="radar" style="padding:16px">
        <div style="font-weight:700;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px">
          <span>🛰 เรดาร์งานค้าง — จุดบนจอ = รายการค้างจริง คลิกเพื่อไปจัดการ</span>
          <span id="radar-month" style="font-size:0.72rem;color:var(--primary);font-variant-numeric:tabular-nums;letter-spacing:0.08em"></span>
        </div>
        <div style="display:grid;grid-template-columns:230px 1fr;gap:20px;align-items:center">
          <div id="radar-scope"></div>
          <div id="ring-gauges" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px">
            ${[1,2,3,4].map(() => `<div class="skeleton" style="height:140px;border-radius:var(--radius-md)"></div>`).join('')}
          </div>
        </div>
      </div>

      <!-- ยอดจอง/ยอดขายรายเดือน: เดิมแยก 2 การ์ด (เทียบเดือน + รายละเอียดรายเดือน) ที่ใช้เดือนเดียวกันและโชว์ "จองใหม่/ส่งมอบ" ซ้ำกัน
           รวมเป็นการ์ดเดียว ปุ่ม ◀ ▶ เลือกเดือน ส่วนช่องเดือนใช้เลือกเดือนที่จะเทียบ -->
      <div class="card mb-4" data-sec="pipeline" style="padding:16px" id="pipeline-card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px">
          <div style="font-weight:700">🚗 ใบจองที่ยังไม่จบ — ค้างอยู่ขั้นไหน <span style="font-size:0.7rem;color:var(--text-muted);font-weight:500">กดขั้นเพื่อดูรายชื่อ</span></div>
          <button class="btn btn-secondary btn-sm" data-nav="/crm/bookings">ดูใบจอง →</button>
        </div>
        <div id="pipeline-body"></div>
      </div>

      <!-- Other Departments Detail -->
      <div class="card mb-4" data-sec="dept" style="padding:16px" id="dept-detail-card">
        <div style="font-weight:700;margin-bottom:14px">🏭 แผนกอื่น — รายละเอียดเดือนเดียวกัน</div>
        <div id="dept-detail-body" style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          ${[1,2].map(() => `<div class="skeleton" style="height:140px;border-radius:var(--radius-md)"></div>`).join('')}
        </div>
      </div>

      <!-- Main 2-col layout -->
      <div data-sec="main" style="display:grid;grid-template-columns:1fr 340px;gap:16px;margin-bottom:16px">
        <!-- Left: Quick Modules -->
        <div style="display:flex;flex-direction:column;gap:16px">

          <!-- Module shortcuts -->
          <div class="card dash-quick" style="padding:16px">
            <div style="font-weight:700;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center">
              ⚡ ทางลัด
              <span style="font-size:0.75rem;color:var(--text-muted)">${visibleLinks.length} เมนู</span>
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(80px,1fr));gap:8px">
              ${visibleLinks.map(l => `
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
      <div data-sec="trend" style="display:grid;grid-template-columns:1fr 320px;gap:16px;align-items:start">
        <div class="card" style="padding:20px" id="monthly-chart-card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;flex-wrap:wrap;gap:6px">
            <div style="font-weight:700" id="monthly-chart-title">📊 อดีต → ปัจจุบัน → อนาคต: ยอดจอง & มูลค่า</div>
            <div style="display:flex;gap:4px">
              <button class="btn btn-sm btn-primary" id="trend-6">6 เดือน</button>
              <button class="btn btn-sm btn-secondary" id="trend-12">12 เดือน</button>
              <button class="btn btn-secondary btn-sm" data-nav="/analytics">ดูการวิเคราะห์ →</button>
            </div>
          </div>
          <div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:12px">แท่ง: 🟢 ส่งมอบ · 🟡 ดำเนินการ · 🔴 ถอนจอง — เส้นเรืองแสง = มูลค่า · เส้นประม่วง = พยากรณ์ 3 เดือนข้างหน้า (คลิกแท่งเพื่อเลือกเดือน)</div>
          <div id="monthly-chart">
            <div class="skeleton" style="width:100%;height:180px;border-radius:var(--radius-md)"></div>
          </div>
          <div style="font-size:0.76rem;font-weight:700;color:var(--text-2);margin:14px 0 8px">📅 จองรายวัน — <span class="fc-month" style="color:var(--primary)"></span></div>
          <div id="day-heatmap"></div>
        </div>
        <div class="card" style="padding:20px">
          <div style="font-weight:700;margin-bottom:12px">🎯 สัดส่วนสถานะ — <span id="donut-month-label" style="color:var(--primary)">...</span></div>
          <div id="status-donut">
            <div class="skeleton" style="width:100%;height:160px;border-radius:var(--radius-md)"></div>
          </div>
        </div>
      </div>

      <!-- (v1.0.446) กราฟยอดส่งมอบ/ยอดถอนจองแยกเดี่ยว ตามที่ขอ ("เพิ่มกราฟแสดงยอดส่งมอบ", "เพิ่มกราฟแสดงยอดถอนจอง")
           — เดิมมีแค่ตัวเลขรวมในการ์ด KPI ด้านบน ไม่มีกราฟแนวโน้มรายเดือนแยกให้ดูย้อนหลังเหมือนกราฟยอดจองหลัก -->
      <div data-sec="dlv" style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px">
        <div class="card" style="padding:16px">
          <div style="font-weight:700;margin-bottom:2px">✅ ยอดส่งมอบรายเดือน <span style="font-size:0.65rem;color:var(--text-muted);font-weight:400">(นับตามวันตัดตัวเลข)</span></div>
          <div style="font-size:0.66rem;color:var(--text-muted);margin-bottom:8px">คลิกแท่งเพื่อเลือกดูเดือนนั้น</div>
          <div id="delivery-chart"><div class="skeleton" style="width:100%;height:140px;border-radius:var(--radius-md)"></div></div>
        </div>
        <div class="card" style="padding:16px">
          <div style="font-weight:700;margin-bottom:2px">❌ ยอดถอนจองรายเดือน</div>
          <div style="font-size:0.66rem;color:var(--text-muted);margin-bottom:8px">คลิกแท่งเพื่อเลือกดูเดือนนั้น</div>
          <div id="cancel-chart"><div class="skeleton" style="width:100%;height:140px;border-radius:var(--radius-md)"></div></div>
        </div>
      </div>

      <!-- Analysis row: forecast + rankings -->
      <div data-sec="analysis" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-top:16px">
        <div class="card" style="padding:16px">
          <div style="font-weight:700;margin-bottom:10px">🔮 พยากรณ์อนาคต</div>
          <div id="forecast-body"><div class="skeleton" style="height:150px;border-radius:var(--radius-md)"></div></div>
        </div>
        <div class="card" style="padding:16px">
          <div style="font-weight:700;margin-bottom:2px">🏆 รุ่นขายดี — <span class="fc-month" style="color:var(--primary);font-size:0.8rem"></span></div>
          <div style="font-size:0.66rem;color:var(--text-muted);margin-bottom:8px">📝 ยอดจอง · ✅ ยอดตัดตัวเลข/ส่งมอบ</div>
          <div id="top-models"><div class="skeleton" style="height:150px;border-radius:var(--radius-md)"></div></div>
        </div>
        <div class="card" style="padding:16px">
          <div style="font-weight:700;margin-bottom:10px">🥇 สุดยอดเซลส์ — <span class="fc-month" style="color:var(--primary);font-size:0.8rem"></span></div>
          <div id="top-sales"><div class="skeleton" style="height:150px;border-radius:var(--radius-md)"></div></div>
        </div>
      </div>

      <!-- Funnel + source row -->
      <div data-sec="funnel" style="display:grid;grid-template-columns:2fr 1fr;gap:16px;margin-top:16px">
        <div class="card" style="padding:16px">
          <div style="font-weight:700;margin-bottom:12px">📶 ลีด → จอง → ส่งมอบ — <span class="fc-month" style="color:var(--primary);font-size:0.8rem"></span></div>
          <div id="funnel-body"><div class="skeleton" style="height:120px;border-radius:var(--radius-md)"></div></div>
        </div>
        <div class="card" style="padding:16px">
          <div style="font-weight:700;margin-bottom:12px">🧲 แหล่งที่มาใบจอง</div>
          <div id="source-body"><div class="skeleton" style="height:120px;border-radius:var(--radius-md)"></div></div>
        </div>
      </div>
      </div>
    </div>
  `

  // Bind navigation
  container.addEventListener('click', e => {
    const el = e.target.closest('[data-nav]')
    if (el) navigate(el.dataset.nav)
    const j = e.target.closest('[data-jump]')
    if (j) document.getElementById(j.dataset.jump)?.closest('.card')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })

  // ── ปรับแต่งหน้า (เลือกการ์ด/ลำดับ ต่อเครื่อง) + พิมพ์ ──
  let layout = loadDashLayout()
  const flowEl = container.querySelector('.dash-flow')
  applyDashLayout(flowEl, layout)
  document.getElementById('dash-print')?.addEventListener('click', () => window.print())
  // ป้ายตัวเลขตอนชี้กราฟ (data-tip="หัว|บรรทัด|บรรทัด") — ใช้ร่วมกันทุกกราฟในหน้า
  const tipEl = document.createElement('div')
  tipEl.className = 'dash-tip'
  container.appendChild(tipEl)
  container.addEventListener('pointermove', e => {
    const t = e.target.closest?.('[data-tip]')
    if (!t || e.pointerType === 'touch') { tipEl.style.display = 'none'; return }
    const [head, ...lines] = t.dataset.tip.split('|')
    tipEl.innerHTML = `<b>${escHtml(head)}</b>${lines.map(l => `<div>${escHtml(l)}</div>`).join('')}`
    tipEl.style.display = 'block'
    const w = tipEl.offsetWidth, h = tipEl.offsetHeight
    tipEl.style.left = Math.min(window.innerWidth - w - 8, e.clientX + 14) + 'px'
    tipEl.style.top = Math.max(8, e.clientY - h - 12) + 'px'
  })
  container.addEventListener('pointerleave', () => { tipEl.style.display = 'none' })
  document.getElementById('dash-custom')?.addEventListener('click', () => {
    const rows = () => layout.order.map((k, i) => `
      <div class="dash-cust-row">
        <input type="checkbox" data-k="${k}" ${layout.hidden.includes(k) ? '' : 'checked'} aria-label="แสดง">
        <span>${(DASH_SECTIONS.find(x => x[0] === k) || [k, k])[1]}</span>
        <button class="btn btn-ghost btn-xs" data-up="${k}" ${i ? '' : 'disabled'} aria-label="เลื่อนขึ้น">▲</button>
        <button class="btn btn-ghost btn-xs" data-down="${k}" ${i < layout.order.length - 1 ? '' : 'disabled'} aria-label="เลื่อนลง">▼</button>
      </div>`).join('')
    const m = openModal({
      title: '⚙️ ปรับแต่งหน้าภาพรวม',
      body: `<div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:10px">ติ๊กเพื่อแสดง/ซ่อน · ▲▼ เลื่อนลำดับ — มีผลทันทีและจำไว้ในเครื่องนี้</div><div id="dash-cust-list">${rows()}</div>`,
      footer: `<button class="btn btn-secondary" id="dash-cust-reset">↺ ค่าเริ่มต้น</button><button class="btn btn-primary" id="dash-cust-done">✅ เสร็จ</button>`,
    })
    const update = next => { layout = normalizeLayout(next); saveDashLayout(layout); applyDashLayout(flowEl, layout); m.el.querySelector('#dash-cust-list').innerHTML = rows() }
    m.el.addEventListener('click', e => {
      const up = e.target.closest('[data-up]'), down = e.target.closest('[data-down]')
      if (up) update(moveSection(layout, up.dataset.up, -1))
      if (down) update(moveSection(layout, down.dataset.down, 1))
      if (e.target.closest('#dash-cust-reset')) update({ order: [], hidden: [] })
      if (e.target.closest('#dash-cust-done')) m.close()
    })
    m.el.addEventListener('change', e => {
      const k = e.target.dataset?.k
      if (k) update({ ...layout, hidden: e.target.checked ? layout.hidden.filter(x => x !== k) : [...layout.hidden, k] })
    })
  })

  // ── Radar scope: โครงจอ (วงแหวน + เส้นกวาด) ระหว่างรอข้อมูล — จุดจริงเติมโดย renderRadar() ──
  const radarShell = blipsMarkup => `
    <svg viewBox="0 0 220 220" style="width:100%;max-width:220px;display:block;margin:auto">
      ${[100,75,50,25].map(r => `<circle cx="110" cy="110" r="${r}" fill="none" stroke="var(--primary)" stroke-opacity="${r === 100 ? 0.5 : 0.22}" stroke-width="1"/>`).join('')}
      ${Array.from({ length: 12 }, (_, i) => {
        const a = i * 30 * Math.PI / 180
        return `<line x1="${(110 + Math.cos(a) * 96).toFixed(1)}" y1="${(110 + Math.sin(a) * 96).toFixed(1)}" x2="${(110 + Math.cos(a) * 101).toFixed(1)}" y2="${(110 + Math.sin(a) * 101).toFixed(1)}" stroke="var(--primary)" stroke-opacity="0.55" stroke-width="1.5"/>`
      }).join('')}
      ${[[110, 7, '000'], [213, 113, '090'], [110, 219, '180'], [7, 113, '270']].map(([x, y, t]) =>
        `<text x="${x}" y="${y}" text-anchor="middle" font-size="7" fill="var(--primary)" fill-opacity="0.6" font-family="monospace" letter-spacing="1">${t}</text>`).join('')}
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
  // เดิม new Date().toISOString().slice(0,7) คืนเดือนตาม UTC เสมอ ทำให้ "เดือนนี้" ผิดไป 1 วันทุกครั้งที่
  // เวลาไทยยังไม่ถึง 07:00 น. (เที่ยงคืน UTC ตรงกับเวลาไทย 07:00 น.) — แก้ให้ยึดวันที่ไทยจริงจาก todayBangkok()
  let selectedMonth = todayBangkok().slice(0, 7)
  let trendRange = 6
  // (v1.0.446) เดือนที่ใช้เปรียบเทียบในการ์ด MoM — เดิมล็อกตายเป็น "เดือนก่อนหน้า" เสมอ ไม่มีทางเลือกเดือน/ปี
  // อื่นมาเทียบเอง (เช่นเทียบกับเดือนเดียวกันปีที่แล้วแบบ YoY) ตามที่ขอ "เพิ่มการเปรียบเทียบแบบเลือกเดือนปี"
  let compareMonth = shiftMonth(selectedMonth, -1)
  // Real-time: จอง/งานซ่อม/Tasks อัปเดตสดผ่าน Firestore onSnapshot — เก็บ unsubscribe ไว้เคลียร์ตอนออกจากหน้า (คืนค่าท้ายฟังก์ชันให้ router เรียก)
  const unsubscribers = []
  let bookings = [], jobs = [], tasks = []
  try {
    // เดิม new Date().toISOString().slice(0,10)/(0,7) คืนวันที่ตาม UTC เสมอ ทำให้ "วันนี้"/"เดือนนี้" ผิดไป 1 วันทุกครั้งที่
    // เวลาไทยยังไม่ถึง 07:00 น. (เที่ยงคืน UTC ตรงกับเวลาไทย 07:00 น.) — แก้ให้ยึดวันที่ไทยจริงจาก todayBangkok()
    const today = todayBangkok()
    const thisMonth = today.slice(0, 7)
    // รอ snapshot แรกเหมือน listDocs ทั่วไป แล้วหลังจากนั้นอัปเดตสด → renderAll() ใหม่ทุกครั้งที่มีการเปลี่ยนแปลง
    function watchOnce(colName, sortBy, sortDir, maxDocs, assign) {
      return new Promise(resolve => {
        let first = true
        let unsub = () => {}
        function start() {
          unsub()
          unsub = watchDocs(colName, companyScopeFilters(), sortBy, sortDir, maxDocs, rows => {
            if (container.__routerGen !== myGen) { unsub(); return }
            assign(rows)
            if (first) { first = false; resolve() }
            else renderAll()
          })
        }
        start()
        unsubscribers.push(() => unsub())
        unsubscribers.push(on('activeCompanyFilter', start))
      })
    }
    const [customers, sales, pdi, allCustomersForLeads, vehicles, teamTargets] = await Promise.all([
      listDocs('customers', companyScopeFilters(), 'createdAt', 'desc', 5).catch(() => []),
      getSalesData().catch(() => []),
      listDocs('pdi', companyScopeFilters(), 'createdAt', 'desc', 50).catch(() => []),
      listDocs('customers', companyScopeFilters(), 'createdAt', 'desc', 3000).catch(() => []),
      // เดิม orderBy('createdAt') — รถจริงส่วนใหญ่ในระบบไม่มี field นี้ (มีแต่ arrivedAt) ทำให้ Firestore
      // orderBy ตัดออกจากผลลัพธ์ไปเงียบๆทั้งหมด เห็นสต็อกรถ 0 คันตลอด ต้องใช้ arrivedAt ให้ตรงกับ Stock.js
      listDocs('vehicles', companyScopeFilters(), 'arrivedAt', 'desc', 3000).catch(() => []),
      listDocs('team_targets', companyScopeFilters(), 'period', 'desc', 200).catch(() => []),
      // softDelete() ไม่ได้ลบเอกสารจริง แค่ตั้ง deleted:true — ถ้าไม่กรองออกตรงนี้ งานซ่อม/ใบจอง/งานที่ถูกลบ
      // ไปแล้วจะยังโผล่เป็นแจ้งเตือน "ค้าง" บน Dashboard และถูกนับรวมในตัวเลข KPI ด้านบนต่อไปเงียบๆ
      watchOnce('job_cards', 'createdAt', 'desc', 3000, rows => { jobs = rows.filter(r => !r.deleted) }),
      watchOnce('bookings', 'createdAt', 'desc', 3000, rows => { bookings = rows.filter(r => !r.deleted) }),
      watchOnce('tasks', 'createdAt', 'desc', 100, rows => { tasks = rows.filter(r => !r.deleted) }),
    ])
    const leads = allCustomersForLeads.filter(c => !c.deleted && (c.stage === 'lead' || c.stage === 'pp')).map(c => ({ ...c, status: c.stage === 'lead' ? 'new' : c.stage }))
    if (container.__routerGen !== myGen) return

    const pendingTasks = tasks.filter(t => t.status !== 'done' && t.status !== 'cancelled').length
    const openJobs = jobs.filter(j => j.status !== 'done' && j.status !== 'completed' && j.status !== 'delivered').length

    // (v1.0.446) จุดเดียวที่เปลี่ยน selectedMonth ทุกจุด (คลิกแท่งกราฟ/ปุ่ม ◀▶) ให้ผ่านฟังก์ชันนี้เสมอ — รีเซ็ต
    // compareMonth กลับเป็น "เดือนก่อนหน้าของเดือนที่เพิ่งเลือก" อัตโนมัติทุกครั้งที่เปลี่ยนเดือนหลัก (พฤติกรรม
    // เดิม) ผู้ใช้ยังเลือกเดือน/ปีอื่นมาเทียบเองได้ผ่าน picker บนการ์ด MoM สำหรับเดือนที่กำลังดูอยู่นี้
    function setSelectedMonth(m) {
      selectedMonth = m
      compareMonth = shiftMonth(m, -1)
      renderAll()
    }

    // ── ยอดจอง/ยอดขาย รายละเอียดรายเดือน (คลิกดูเดือนก่อนหน้าได้) ──────────────
    function renderPipeline() {
      const label = document.getElementById('pm-label')
      if (label) label.textContent = ymLabel(selectedMonth)

      const inMonth = bookings.filter(b => (b.bookingDate || '').startsWith(selectedMonth))
      // (v1.0.433) "ส่งมอบ" ของธุรกิจนี้นับตามวันตัดตัวเลข (cutDate — วันตัดรถออกจากสต็อกให้ใบจองนี้จริง ซึ่ง
      // อาจไม่ตรงกับวันส่งมอบจริง (actualDeliveryDate) ที่มักช้ากว่า) ใช้ pattern เดียวกับที่ Bookings.js ใช้
      // อยู่แล้วจริง (TERMINAL_STATUSES 2 ตัวแรก: ส่งมอบแล้ว + ตัดตัวเลขรอส่งมอบ) เดิม Dashboard ใช้แค่
      // actualDeliveryDate + เฉพาะสถานะ "ส่งมอบแล้ว" ตัวเลขจึงไม่ตรงกับที่ทีมขายเข้าใจว่าตัดตัวเลขเดือนไหนจริง
      // จองใหม่/ส่งมอบของเดือนนี้อยู่ในแถบเทียบเดือน (renderMoM) ด้านบนในการ์ดเดียวกันแล้ว
      // ยอดรอส่งมอบ/รอรถ/รอผลไฟแนนซ์ ต้องเป็นยอดค้างจริงทั้งหมดที่ยังไม่จบ ไม่ใช่แค่ที่จองมาในเดือนที่เลือกดู —
      // เดิมกรองจาก inMonth ทำให้ตัวเลข "ยอดค้าง" ดูน้อยกว่าจริงมาก เพราะยอดค้างจริงสะสมมาจากหลายเดือนก่อน
      // หน้านี้ด้วย ไม่ใช่แค่เดือนที่กำลังดูอยู่ ส่วนถอนจองยังคงนับเฉพาะเดือนที่เลือกเหมือนเดิม (ไม่มี field
      // วันที่ถอนจองแยกต่างหาก ใช้ bookingDate เป็นตัวกำหนดเดือนต่อไปเหมือนที่ทำมาตลอด)
      // เส้นทางใบจอง: ทุกใบที่ยังไม่จบ เรียงตามขั้นงานจริง เห็นทันทีว่ารถค้างขั้นไหน (กดขั้นไหนเห็นรายชื่อ)
      const stages = pipelineStages(bookings, todayBangkok())
      const withdrawn = inMonth.filter(isCancelled).length
      const body = document.getElementById('pipeline-body')
      if (!body) return
      pipeStages = stages
      const ageColor = a => a == null ? 'text-muted' : a >= 30 ? 'danger' : a >= 14 ? 'warning' : 'success'
      body.innerHTML = stages.length ? `
        <div class="dash-flowline">
          ${stages.map((st, i) => {
            const meta = BOOKING_STATUS_META[st.status] || { icon: '📄', color: 'secondary' }
            return `<button type="button" class="dash-stage" data-stage="${i}" style="--c:${colorVar(meta.color)}" title="กดเพื่อดูรายชื่อ ${escHtml(st.status)}">
              <span class="dash-stage-n">${st.count}</span>
              <span class="dash-stage-l">${meta.icon} ${escHtml(st.status)}</span>
              <span class="dash-stage-v">${moneyTxt(st.value)}</span>
              ${st.avgAge != null ? `<span class="dash-stage-a" style="color:var(--${ageColor(st.avgAge)})">⏱ เฉลี่ย ${st.avgAge} วัน${st.maxAge >= 30 ? ` · นานสุด ${st.maxAge}` : ''}</span>` : ''}
            </button>`
          }).join('<span class="dash-stage-arrow" aria-hidden="true">›</span>')}
        </div>
        <div class="dash-flow-foot">
          <span>รวมที่ยังไม่จบ <b>${stages.reduce((s, x) => s + x.count, 0)}</b> คัน · ${moneyTxt(stages.reduce((s, x) => s + x.value, 0))}</span>
          <span>❌ ถอนจองเดือนนี้ <b style="color:var(--${withdrawn ? 'danger' : 'text-muted'})">${withdrawn}</b></span>
          <span style="color:var(--text-muted)">⏱ สีเขียว &lt; 14 วัน · เหลือง 14–29 · แดง 30+</span>
        </div>`
        : `<div style="padding:16px;text-align:center;color:var(--success)">✅ ไม่มีใบจองค้าง — ทุกใบส่งมอบหรือปิดแล้ว</div>`
    }
    let pipeStages = []
    container.addEventListener('click', e => {
      const st = e.target.closest('[data-stage]')
      if (st && pipeStages[+st.dataset.stage]) {
        const g = pipeStages[+st.dataset.stage]
        showRows(`${(BOOKING_STATUS_META[g.status] || {}).icon || '📄'} ${g.status} — ${g.count} คัน`, g.rows.slice().sort((a, b) => String(a.bookingDate || '').localeCompare(String(b.bookingDate || ''))), 'stage')
      }
    })

    // ── แผนกอื่น: ศูนย์บริการ (Job Cards) + สรุปไฟแนนซ์ (จาก booking.finStatus) เดือนเดียวกัน ──
    function renderDeptDetail() {
      const jobsInMonth = jobs.filter(j => toDateStr(j.createdAt).startsWith(selectedMonth))
      const jobByStatus = {}
      jobsInMonth.forEach(j => { jobByStatus[j.status] = (jobByStatus[j.status] || 0) + 1 })

      const bookingsInMonth = bookings.filter(b => (b.bookingDate || '').startsWith(selectedMonth) && b.finStatus)
      const finByStatus = {}
      bookingsInMonth.forEach(b => { finByStatus[b.finStatus] = (finByStatus[b.finStatus] || 0) + 1 })

      const body = document.getElementById('dept-detail-body')
      if (!body) return
      // ไม่มีทั้ง Job Card และข้อมูลไฟแนนซ์เดือนนี้ → ซ่อนทั้งการ์ด ไม่ต้องโชว์กล่องว่างสองกล่อง
      const card = document.getElementById('dept-detail-card')
      if (card) card.style.display = jobsInMonth.length || bookingsInMonth.length ? '' : 'none'
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
        // มูลค่าไม่รวมใบที่ถอน/ยกเลิก (นิยามเดียวกับการ์ดตัวเลขด้านบน — utils/dashStats.js)
        return { m, total: inM.length, delivered: inM.filter(isDelivered).length, withdrawn: inM.filter(isCancelled).length,
                 revenue: monthStats(bookings, m).value }
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
        const tip = `${ymLabel(d.m)}|📝 จอง ${d.total} คัน|✅ ส่งมอบแล้ว ${d.delivered} · 🟡 ดำเนินการ ${d.total - d.delivered - d.withdrawn} · ❌ ถอน ${d.withdrawn}|💰 มูลค่า ${moneyTxt(d.revenue)}`
        bars += `<g data-month="${d.m}" data-tip="${escHtml(tip)}" style="cursor:pointer">
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
        // (v1.0.429) เดิมแท่งพยากรณ์ (เดือนถัดไปจาก selectedMonth) ไม่มี data-month/click listener เลย ต่างจาก
        // แท่งเดือนจริงทางซ้ายที่คลิกได้ทุกแท่ง — ผลคือถ้าผู้ใช้คลิกแท่งย้อนหลังไปเดือนก่อนๆ (selectedMonth ขยับ
        // ถอยหลัง) หน้าต่างกราฟทั้งหมดจะเลื่อนตามไปอยู่ที่เดือนนั้น ไม่มีแท่งไหนในกราฟให้คลิกเพื่อ "เดินหน้า" กลับมา
        // อีกเลย (ต้องออกไปกดปุ่ม ▶ นอกกราฟแทน) เพิ่ม data-month ให้แท่งพยากรณ์คลิกได้เหมือนแท่งจริงเพื่อเดินหน้าได้
        fBars += `<g data-month="${m}" data-tip="${escHtml(`${ymLabel(m)} (คาดการณ์)|📝 ≈ ${Math.round(cnt)} คัน|💰 ≈ ${moneyTxt(Math.round(fRevs[j]))}`)}" style="cursor:pointer">
          <rect x="${cx - groupW / 2}" y="${padT - 6}" width="${groupW}" height="${plotH + 6}" fill="transparent"/>
          <rect x="${x}" y="${yBase - hTotal}" width="${barW}" height="${hTotal}" fill="var(--info)" opacity="0.10" stroke="var(--info)" stroke-width="1.2" stroke-dasharray="4 3" rx="2"/>
          <text x="${cx}" y="${yBase - hTotal - 8}" text-anchor="middle" font-size="10" font-weight="700" fill="var(--info)">~${Math.round(cnt)}</text>
        </g>`
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
      chartEl.querySelectorAll('[data-month]').forEach(el => el.addEventListener('click', () => setSelectedMonth(el.dataset.month)))
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
          />`
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
                <span style="width:9px;height:9px;border-radius:2px;background:${colorVar(e.color)};flex-shrink:0"></span>
                <span style="flex:1;color:var(--text-2)">${e.icon} ${e.label}</span>
                <b style="color:${colorVar(e.color)}">${e.count}</b>
              </div>`).join('')}
          </div>
        </div>`
    }

    // ── กราฟแท่งเดี่ยวขนาดเล็ก ใช้ร่วมกันระหว่างกราฟยอดส่งมอบ/ยอดถอนจอง (v1.0.446) — คลิกแท่งเลือกเดือนได้
    // เหมือนกราฟหลัก (renderTrendChart) เพื่อให้ทุกกราฟบนหน้านี้ทำงานสัมพันธ์กัน คลิกจุดไหนก็ได้แล้วข้อมูล
    // ทั้งหน้าเปลี่ยนตามเดือนเดียวกันเสมอ
    function miniBarChart(elId, monthsArr, counts, color, emptyText = 'ไม่มีข้อมูลในช่วงนี้') {
      const el = document.getElementById(elId)
      if (!el) return
      const W = 400, H = 150, padL = 6, padR = 6, padT = 20, padB = 26
      const plotW = W - padL - padR, plotH = H - padT - padB
      const n = monthsArr.length
      const groupW = plotW / n
      const barW = Math.min(34, groupW * 0.55)
      const max = Math.max(...counts, 1)
      const yBase = padT + plotH
      let bars = '', labels = ''
      monthsArr.forEach((m, i) => {
        const cx = padL + groupW * i + groupW / 2
        const x = cx - barW / 2
        const v = counts[i]
        const h = v ? Math.max(4, Math.round(v / max * plotH)) : 0
        const sel = m === selectedMonth
        bars += `<g data-month="${m}" data-tip="${escHtml(`${ymLabel(m)}|${v} คัน`)}" style="cursor:pointer">
          <rect x="${cx - groupW / 2}" y="${padT}" width="${groupW}" height="${plotH}" fill="transparent"/>
          <rect x="${x}" y="${yBase - h}" width="${barW}" height="${h}" fill="var(--${color})" opacity="0.88" rx="2"/>
          ${sel ? `<rect x="${x - 3}" y="${yBase - h - 4}" width="${barW + 6}" height="${h + 4}" fill="none" stroke="var(--primary)" stroke-width="1.3" rx="3"/>` : ''}
          ${v ? `<text x="${cx}" y="${yBase - h - 6}" text-anchor="middle" font-size="9.5" font-weight="700" fill="var(--text-3)">${v}</text>` : ''}
        </g>`
        labels += `<text x="${cx}" y="${H - 8}" text-anchor="middle" font-size="8.5" fill="${sel ? 'var(--primary)' : 'var(--text-muted)'}" font-weight="${sel ? '700' : '400'}">${ymLabel(m).split(' ')[0]}</text>`
      })
      el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block">
        <line x1="${padL}" y1="${yBase}" x2="${W - padR}" y2="${yBase}" stroke="var(--border)" stroke-width="1"/>
        ${bars}${labels}
        ${counts.some(Boolean) ? '' : `<text x="${W / 2}" y="${padT + plotH / 2}" text-anchor="middle" font-size="12" fill="var(--text-muted)">${emptyText}</text>`}
      </svg>`
      el.querySelectorAll('[data-month]').forEach(g => g.addEventListener('click', () => setSelectedMonth(g.dataset.month)))
    }

    // ยอดส่งมอบนับตามวันตัดตัวเลข (cutDate) เหมือนการ์ด KPI "ตัดตัวเลข/ส่งมอบเดือนนี้" ด้านบนเป๊ะ (ไม่ใช่แค่
    // สถานะ "ส่งมอบแล้ว" อย่างเดียว — รวม "ตัดตัวเลขรอส่งมอบ" ด้วยตามนิยามเดียวกันทั้งหน้า)
    function renderDeliveryChart() {
      const months = []
      for (let i = trendRange - 1; i >= 0; i--) months.push(shiftMonth(selectedMonth, -i))
      const counts = months.map(m => bookings.filter(b => ['ส่งมอบแล้ว', 'ตัดตัวเลขรอส่งมอบ'].includes(b.status) && (b.cutDate || b.actualDeliveryDate || '').startsWith(m)).length)
      miniBarChart('delivery-chart', months, counts, 'success')
    }

    // ยอดถอนจองนับตาม bookingDate เดือนนั้นๆ เหมือนการ์ด KPI "ถอนจองเดือนนี้" ด้านบนเป๊ะ
    function renderCancelChart() {
      const months = []
      for (let i = trendRange - 1; i >= 0; i--) months.push(shiftMonth(selectedMonth, -i))
      const counts = months.map(m => bookings.filter(b => b.status === 'ถอนจอง' && (b.bookingDate || '').startsWith(m)).length)
      miniBarChart('cancel-chart', months, counts, 'danger', `ไม่มีถอนจองเลยใน ${trendRange} เดือน 👍`)
    }

    // ── ตัวเลขหลักของเดือน (แทนแถบ HUD/นาฬิกาเดิม) — สูตรจาก utils/dashStats.js ตัวเดียวกับทั้งหน้า ──
    const money = n => n >= 1e6 ? `฿${(n / 1e6).toFixed(2)}<small>ล้าน</small>` : formatCurrency(n)
    const moneyTxt = n => n >= 1e6 ? `฿${(n / 1e6).toFixed(2)} ล้าน` : formatCurrency(n)
    // ช่วงเวลาของแถบตัวเลขบนสุด: เดือน / ไตรมาส / ปี (จำไว้ในเครื่อง) — เดือนใช้ "เทียบกับ" ที่เลือกเอง ส่วนไตรมาส/ปีเทียบช่วงก่อนหน้าที่ยาวเท่ากัน
    let period = 'month'
    try { const v = localStorage.getItem('lamom_dash_period'); if (['month', 'quarter', 'year'].includes(v)) period = v } catch { /* ใช้ค่าเริ่มต้น */ }
    const curMonths = () => periodMonths(selectedMonth, period)
    const cmpMonths = () => period === 'month' ? [compareMonth] : periodMonths(prevPeriodAnchor(selectedMonth, period), period)
    const cmpLabel = () => period === 'month' ? ymLabel(compareMonth) : periodLabel(prevPeriodAnchor(selectedMonth, period), period)
    const leadsInRange = months => { const set = new Set(months); return leads.filter(l => set.has(String(toDateStr(l.createdAt) || l.date || '').slice(0, 7))) }
    function renderHero() {
      const el = document.getElementById('hero-kpis')
      if (!el) return
      container.querySelectorAll('[data-period]').forEach(b => b.classList.toggle('on', b.dataset.period === period))
      const cmpWrap = container.querySelector('.dash-compare')
      if (cmpWrap) cmpWrap.style.display = period === 'month' ? '' : 'none'
      const cmp = cmpLabel()
      const ttl = document.getElementById('hero-period')
      if (ttl) ttl.innerHTML = `${periodLabel(selectedMonth, period)}<small>เทียบ ${cmp}</small>`
      const cur = rangeStats(bookings, curMonths()), prev = rangeStats(bookings, cmpMonths())
      const open = openBookings(bookings)
      const delta = (c, p) => {
        const pct = pctChange(c, p)
        if (pct == null) return c ? `<span class="dash-delta up">ใหม่</span>` : `<span class="dash-delta flat">—</span>`
        if (Math.abs(pct) < 0.5) return `<span class="dash-delta flat">เท่าเดิม</span>`
        return `<span class="dash-delta ${pct > 0 ? 'up' : 'down'}">${pct > 0 ? '▲' : '▼'} ${Math.abs(pct).toFixed(0)}%</span>`
      }
      const spark = (vals, color) => {
        const d = sparkPath(vals, 100, 26)
        return d ? `<svg viewBox="0 0 100 26" preserveAspectRatio="none" aria-hidden="true"><path d="${d} L100,26 L0,26 Z" fill="var(--${color})" opacity="0.12"/><path d="${d}" fill="none" stroke="var(--${color})" stroke-width="1.8" vector-effect="non-scaling-stroke"/></svg>` : '<svg viewBox="0 0 100 26"></svg>'
      }
      // กราฟเล็ก: 6 ช่วงย้อนหลัง (6 เดือน / 6 ไตรมาส / 6 ปี)
      const step = period === 'year' ? 12 : period === 'quarter' ? 3 : 1
      const back = [5, 4, 3, 2, 1, 0].map(k => periodMonths(shiftYm(selectedMonth, -k * step), period))
      const series = key => back.map(ms => rangeStats(bookings, ms)[key])
      const leadsCur = leadsInRange(curMonths()).length, leadsPrev = leadsInRange(cmpMonths()).length
      const tiles = [
        { icon: '📝', label: 'จองใหม่', val: `${cur.booked}<small>คัน</small>`, d: delta(cur.booked, prev.booked), sub: `${cmp}: ${prev.booked} คัน`, sp: spark(series('booked'), 'primary'), color: 'primary', drill: 'booked' },
        { icon: '✅', label: 'ส่งมอบ', val: `${cur.delivered}<small>คัน</small>`, d: delta(cur.delivered, prev.delivered), sub: `${cmp}: ${prev.delivered} คัน`, sp: spark(series('delivered'), 'success'), color: 'success', drill: 'delivered' },
        { icon: '💰', label: 'มูลค่าจอง', val: money(cur.value), d: delta(cur.value, prev.value), sub: `${cmp}: ${moneyTxt(prev.value)}`, sp: spark(series('value'), 'accent'), color: 'accent', drill: 'value' },
        { icon: '📈', label: 'Margin', val: money(cur.margin), d: delta(cur.margin, prev.margin), sub: `${cmp}: ${moneyTxt(prev.margin)}`, sp: spark(series('margin'), 'warning'), color: 'warning', drill: 'margin' },
        { icon: '⏳', label: 'ค้างส่งมอบ', val: `${open.length}<small>คัน</small>`, d: '', sub: 'รวมทุกเดือน · ' + moneyTxt(open.reduce((s, b) => s + (Number(b.price) || 0), 0)), sp: '', color: 'info', drill: 'open' },
        { icon: '🧲', label: 'Lead ใหม่', val: `${leadsCur}<small>ราย</small>`, d: delta(leadsCur, leadsPrev), sub: `${cmp}: ${leadsPrev} ราย`, sp: spark(back.map(ms => leadsInRange(ms).length), 'danger'), color: 'danger', nav: '/crm/leads' },
      ]
      el.innerHTML = tiles.map(t => `
        <button type="button" class="dash-kpi" ${t.drill ? `data-drill="${t.drill}"` : `data-nav="${t.nav}"`} style="--c:var(--${t.color})" title="${t.label} — กดเพื่อดูรายการ">
          <span class="dash-kpi-top"><span class="dash-kpi-label">${t.icon} ${t.label}</span>${t.d}</span>
          <span class="dash-kpi-val">${t.val}</span>
          <span class="dash-kpi-sub">${t.sub}</span>
          ${t.sp || '<svg viewBox="0 0 100 26"></svg>'}
        </button>`).join('')
    }

    // ── กดตัวเลข → รายการใบจองที่นับจริง (ตรวจได้ว่าตัวเลขมาจากใบไหน) + ค้นหา + ส่งออก Excel ──
    const DRILL_TITLE = { booked: '📝 จองใหม่', delivered: '✅ ส่งมอบ/ตัดตัวเลข', value: '💰 มูลค่าจอง (ไม่รวมถอนจอง)', margin: '📈 Margin (ไม่รวมถอนจอง)', open: '⏳ ค้างส่งมอบ (ทุกเดือน)' }
    const dateOf = b => String(b.cutDate || b.actualDeliveryDate || '')
    function openDrill(key) {
      const byDate = (a, b) => String(b.bookingDate || '').localeCompare(String(a.bookingDate || ''))
      const sorter = key === 'margin' ? (a, b) => (Number(b.margin) || 0) - (Number(a.margin) || 0)
        : key === 'delivered' ? (a, b) => dateOf(b).localeCompare(dateOf(a)) : byDate
      const when = key === 'open' ? 'ทุกเดือน' : periodLabel(selectedMonth, period)
      showRows(`${DRILL_TITLE[key]} — ${when}`, statRows(bookings, curMonths(), key).slice().sort(sorter), key)
    }
    function showRows(title, rows, fileKey = 'list') {
      const sum = (list, f) => list.reduce((s, b) => s + (Number(b[f]) || 0), 0)
      const table = list => list.length ? `<div class="table-wrap"><table class="table tbl-cards dash-drill">
          <thead><tr><th>ลูกค้า</th><th>รุ่น</th><th>เซลส์</th><th>วันที่</th><th>สถานะ</th><th style="text-align:right">ราคา</th><th style="text-align:right">Margin</th></tr></thead>
          <tbody>${list.slice(0, 300).map(b => `<tr data-id="${escHtml(b.id)}">
            <td><div style="font-weight:600">${escHtml(b.custName || b.customerName || '-')}</div><div style="font-size:0.7rem;color:var(--text-muted)">${escHtml(b.bookingNo || '')}</div></td>
            <td>${escHtml([b.brand, b.model].filter(Boolean).join(' ') || '-')}</td>
            <td style="color:var(--text-muted)">👤 ${escHtml(b.salesName || '-')}</td>
            <td style="white-space:nowrap">📅 ${b.bookingDate ? formatDate(b.bookingDate) : '-'}${b.cutDate ? `<div style="font-size:0.7rem;color:var(--text-muted)">✂️ ตัด ${formatDate(b.cutDate)}</div>` : ''}</td>
            <td><span class="badge badge-${(BOOKING_STATUS_META[b.status] || {}).color || 'secondary'}">${escHtml(b.status || '-')}</span></td>
            <td style="text-align:right;white-space:nowrap;font-weight:700">${formatCurrency(Number(b.price) || 0)}</td>
            <td style="text-align:right;white-space:nowrap;color:var(--warning)">${b.margin ? formatCurrency(Number(b.margin)) : ''}</td>
          </tr>`).join('')}</tbody></table></div>${list.length > 300 ? `<div style="font-size:0.72rem;color:var(--text-muted);margin-top:6px">แสดง 300 จาก ${list.length} ใบ — ส่งออก Excel เพื่อดูทั้งหมด</div>` : ''}`
        : `<div style="padding:24px;text-align:center;color:var(--text-muted)">ไม่มีใบจองในช่วงนี้</div>`
      const summary = list => `<span>📄 <b>${list.length}</b> ใบ</span><span>💰 มูลค่า <b>${formatCurrency(sum(list, 'price'))}</b></span><span>📈 Margin <b>${formatCurrency(sum(list, 'margin'))}</b></span>`
      const m = openModal({
        title, size: 'xl',
        body: `<div class="dash-drill-sum" id="drill-sum">${summary(rows)}</div>
          <input class="input" id="drill-q" placeholder="🔍 ค้นหาชื่อลูกค้า / รุ่น / เซลส์ / เลขที่" style="margin-bottom:10px">
          <div id="drill-list">${table(rows)}</div>`,
        footer: `<button class="btn btn-secondary" id="drill-xls" ${rows.length ? '' : 'disabled'}>📥 ส่งออก Excel</button><button class="btn btn-primary" id="drill-all">เปิดหน้าใบจอง →</button>`,
      })
      let shown = rows
      m.el.querySelector('#drill-q')?.addEventListener('input', e => {
        const q = e.target.value.trim().toLowerCase()
        shown = q ? rows.filter(b => [b.custName, b.customerName, b.brand, b.model, b.salesName, b.bookingNo, b.status].join(' ').toLowerCase().includes(q)) : rows
        m.el.querySelector('#drill-list').innerHTML = table(shown)
        m.el.querySelector('#drill-sum').innerHTML = summary(shown)
      })
      m.el.addEventListener('click', e => {
        const tr = e.target.closest('tr[data-id]')
        if (tr) { m.close(); navigate('/crm/bookings?id=' + encodeURIComponent(tr.dataset.id)) }
        if (e.target.closest('#drill-all')) { m.close(); navigate('/crm/bookings') }
        if (e.target.closest('#drill-xls') && shown.length) exportToExcel(shown.map(b => ({
          'เลขที่': b.bookingNo || '', 'ลูกค้า': b.custName || b.customerName || '', 'ยี่ห้อ': b.brand || '', 'รุ่น': b.model || '', 'เซลส์': b.salesName || '',
          'วันจอง': b.bookingDate || '', 'วันตัดตัวเลข': b.cutDate || '', 'สถานะ': b.status || '', 'ราคา': Number(b.price) || 0, 'Margin': Number(b.margin) || 0,
        })), `dashboard-${fileKey}-${selectedMonth}.xlsx`, 'ใบจอง')
      })
    }
    container.addEventListener('click', e => {
      const d = e.target.closest('[data-drill]')
      if (d) openDrill(d.dataset.drill)
      const p = e.target.closest('[data-period]')
      if (p && p.dataset.period !== period) {
        period = p.dataset.period
        try { localStorage.setItem('lamom_dash_period', period) } catch { /* ไม่จำก็ได้ */ }
        renderHero()
      }
    })

    // ── Ring gauges: อัตราความสำเร็จของเดือนที่เลือก ──
    function ringGauge(label, pct, color, sub) {
      const R = 40, C = 2 * Math.PI * R
      // pct = null → ยังไม่มีข้อมูลเดือนนี้ (0/0) แสดง "—" สีจาง แทน 0% ที่ดูเหมือนผลงานแย่
      const none = pct == null
      if (none) color = 'text-muted'
      const p = none ? 0 : Math.max(0, Math.min(100, pct || 0))
      return `<div style="display:flex;flex-direction:column;align-items:center;gap:4px">
        <svg viewBox="0 0 100 100" style="width:94px;height:94px">
          <circle cx="50" cy="50" r="${R}" fill="none" stroke="var(--surface-3)" stroke-width="8"/>
          <circle cx="50" cy="50" r="${R}" fill="none" stroke="var(--${color})" stroke-width="8" stroke-linecap="round"
            stroke-dasharray="${(p / 100 * C).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 50 50)"
            style="filter:drop-shadow(0 0 5px var(--${color}));animation:dashGaugeDraw 900ms ease-out"/>
          <text x="50" y="55" text-anchor="middle" font-size="19" font-weight="800" fill="var(--${color})">${none ? '—' : Math.round(p) + '%'}</text>
        </svg>
        <div style="font-size:0.72rem;font-weight:700;color:var(--text-2);text-align:center">${label}</div>
        <div style="font-size:0.64rem;color:var(--text-muted);text-align:center;font-variant-numeric:tabular-nums">${sub}</div>
      </div>`
    }

    function renderGauges() {
      const el = document.getElementById('ring-gauges')
      if (!el) return
      const mEl = document.getElementById('radar-month')
      if (mEl) mEl.textContent = ymLabel(selectedMonth).toUpperCase()
      const inMonth = bookings.filter(b => (b.bookingDate || '').startsWith(selectedMonth))
      const delivered = inMonth.filter(b => DELIVERED_ST.includes(b.status)).length
      const withFin = inMonth.filter(b => b.finStatus)
      const finPassed = withFin.filter(b => b.finStatus === 'ผ่าน').length
      const jobsInMonth = jobs.filter(j => toDateStr(j.createdAt).startsWith(selectedMonth))
      const jobsDone = jobsInMonth.filter(j => ['done', 'completed', 'delivered'].includes(j.status)).length
      const tasksDone = tasks.filter(t => t.status === 'done').length
      const gauges = [
        ['ส่งมอบสำเร็จ', inMonth.length ? delivered / inMonth.length * 100 : null, 'success', `${delivered}/${inMonth.length} ใบจอง`],
        ['ไฟแนนซ์ผ่าน', withFin.length ? finPassed / withFin.length * 100 : null, 'primary', `${finPassed}/${withFin.length} เคส`],
        ['งานซ่อมเสร็จ', jobsInMonth.length ? jobsDone / jobsInMonth.length * 100 : null, 'warning', `${jobsDone}/${jobsInMonth.length} งาน`],
        ['งานมอบหมายเสร็จ', tasks.length ? tasksDone / tasks.length * 100 : null, 'accent', `${tasksDone}/${tasks.length} งาน`],
      ]
      // วงที่ยังไม่มีข้อมูล (0/0) ไม่ต้องวาดเป็นวงว่าง "—" ให้เปลืองที่ — รวมชื่อไว้บรรทัดเดียวแทน
      const has = gauges.filter(g => g[1] != null), none = gauges.filter(g => g[1] == null).map(g => g[0])
      el.style.gridTemplateColumns = `repeat(${Math.max(1, has.length)},minmax(110px,1fr))`
      el.innerHTML = has.map(g => ringGauge(...g)).join('') +
        (none.length ? `<div style="grid-column:1/-1;font-size:0.7rem;color:var(--text-muted);text-align:center">ยังไม่มีข้อมูลเดือนนี้: ${none.join(' · ')}</div>` : '')
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

    // ช่องเลือกเดือนที่จะเทียบ: เดิมเป็น input type=month ที่บางเครื่องโชว์ภาษาอังกฤษ (September 2026) → ใช้รายการเดือนไทยแทน
    function renderMoM() {
      const picker = document.getElementById('mom-compare-picker')
      if (!picker || document.activeElement === picker) return
      const opts = []
      for (let i = 1; i <= 24; i++) opts.push(shiftMonth(selectedMonth, -i))
      if (!opts.includes(compareMonth)) opts.push(compareMonth)
      picker.innerHTML = opts.map(m => `<option value="${m}"${m === compareMonth ? ' selected' : ''}>${ymLabel(m)}${m === shiftMonth(selectedMonth, -12) ? ' (ปีก่อน)' : ''}</option>`).join('')
      const nowBtn = document.getElementById('pm-now')
      if (nowBtn) nowBtn.style.display = selectedMonth === todayBangkok().slice(0, 7) ? 'none' : ''
    }

    // ── พยากรณ์อนาคต: เดือนหน้า + โมเมนตัม + run-rate + สถิติสูงสุด ──
    function renderForecast() {
      const el = document.getElementById('forecast-body')
      if (!el) return
      const hist = [...Array(6)].map((_, i) => shiftMonth(selectedMonth, i - 5)).map(m => {
        const st = monthStats(bookings, m)
        return { m, count: st.booked, revenue: st.value }
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
      // เดิม new Date().toISOString().slice(0,7) คืนเดือนตาม UTC เสมอ — แก้ให้ยึดเดือนไทยจริงจาก todayBangkok()
      const nowYm = todayBangkok().slice(0, 7)
      let runRate = ''
      // การ์ด "เป้า vs ผลจริง" แสดงคาดการณ์สิ้นเดือนอยู่แล้ว (ตอนใช้เป้าแนะนำ) — ไม่ต้องโชว์ซ้ำที่นี่
      const [fy, fm] = selectedMonth.split('-').map(Number)
      const hadPrev3 = [1, 2, 3].some(k => { const d = new Date(fy, fm - 1 - k, 1), ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        return bookings.some(b => String(b.bookingDate || '').startsWith(ym) && !['ถอนจอง', 'ยกเลิก'].includes(b.status)) })
      const paceInTargets = hadPrev3 && !teamTargets.some(t => t.period === selectedMonth)
      if (selectedMonth === nowYm && !paceInTargets) {
        const dayNow = Number(todayBangkok().slice(8, 10))
        const daysInM = new Date(fy, fm, 0).getDate()
        const soFar = bookings.filter(b => (b.bookingDate || '').startsWith(selectedMonth)).length
        const proj = dayNow ? Math.round(soFar / dayNow * daysInM) : 0
        runRate = `<div style="background:var(--primary-dim);border:1px solid var(--primary);border-radius:8px;padding:9px 11px;margin-top:8px">
          <div style="font-size:0.66rem;color:var(--primary);font-weight:700;font-variant-numeric:tabular-nums">RUN-RATE เดือนนี้</div>
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
      // ไม่นับใบที่ตัดตัวเลขแล้ว/ยกเลิก (เดิมนับรวม)
      const outstanding = openBookings(bookings).reduce((s, b) => s + (Number(b.price) || 0), 0)

      const rowStyle = 'display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--border-subtle);font-size:0.78rem'
      el.innerHTML = `
        <div style="${rowStyle}">
          <span style="color:var(--text-muted)">📅 ${ymLabel(shiftMonth(selectedMonth, 1))} (คาดการณ์)</span>
          <b style="color:var(--info);font-variant-numeric:tabular-nums">≈ ${Math.round(fcCount)} คัน</b>
        </div>
        <div style="${rowStyle}">
          <span style="color:var(--text-muted)">💰 มูลค่าคาดการณ์</span>
          <b style="color:var(--info);font-variant-numeric:tabular-nums">≈ ${formatCurrency(Math.round(fcRev))}</b>
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
          <b style="color:var(--text-2);font-variant-numeric:tabular-nums">${avgDeliverDays !== null ? avgDeliverDays + ' วัน' : '—'}</b>
        </div>
        <div style="${rowStyle};border-bottom:none">
          <span style="color:var(--text-muted)">💼 มูลค่าค้างส่งมอบ</span>
          <b style="color:var(--warning);font-variant-numeric:tabular-nums">${formatCurrency(outstanding)}</b>
        </div>
        ${runRate}
        <div style="font-size:0.62rem;color:var(--text-muted);margin-top:8px">* พยากรณ์จาก linear regression ยอดจองจริง 6 เดือนล่าสุด</div>`
    }

    // ── อันดับรุ่นขายดี + สุดยอดเซลส์ ของเดือนที่เลือก ──

    // (v1.0.433) เดิม "รุ่นขายดี" นับแค่ยอดจอง (ตาม bookingDate) อย่างเดียว ไม่มีคอลัมน์ยอดส่งมอบเลย — ตามที่
    // ขอให้เห็นทั้งยอดจองและยอดส่งมอบคู่กัน เพิ่มยอดส่งมอบเข้าไปด้วย นับตามเกณฑ์เดียวกับการ์ด KPI ด้านบน
    // (cutDate/actualDeliveryDate ตรงกับเดือนที่เลือกดู ไม่ใช่ของที่จองเดือนนี้แล้วเพิ่งส่งมอบทีหลัง)
    function modelRankBars(entries) {
      if (!entries.length) return `<div style="font-size:0.78rem;color:var(--text-muted);padding:20px 0;text-align:center">ไม่มีข้อมูลเดือนนี้</div>`
      const max = Math.max(...entries.map(e => e.count), 1)
      return entries.map((e, i) => `
        <div style="margin-bottom:9px">
          <div style="display:flex;justify-content:space-between;font-size:0.75rem;margin-bottom:3px">
            <span style="font-weight:${i === 0 ? '700' : '500'};color:${i === 0 ? 'var(--accent)' : 'var(--text-2)'}">${i + 1}. ${escHtml(e.name)}</span>
            <span style="font-variant-numeric:tabular-nums;color:var(--text-3)">📝${e.count} · ✅${e.delivered} · ${formatCurrency(e.revenue)}</span>
          </div>
          <div style="background:var(--surface-2);border-radius:3px;height:7px;overflow:hidden">
            <div style="width:${Math.round(e.count / max * 100)}%;height:100%;background:var(--accent);border-radius:3px"></div>
          </div>
        </div>`).join('')
    }

    function renderTops() {
      const inMonth = bookings.filter(b => (b.bookingDate || '').startsWith(selectedMonth) && !isCancelled(b))
      const deliveredInMonthAll = bookings.filter(b => ['ส่งมอบแล้ว', 'ตัดตัวเลขรอส่งมอบ'].includes(b.status) && (b.cutDate || b.actualDeliveryDate || '').startsWith(selectedMonth))
      const byModel = {}, bySales = {}
      inMonth.forEach(b => {
        const mk = `${b.brand || ''} ${b.model || 'ไม่ระบุ'}`.trim()
        byModel[mk] = byModel[mk] || { name: mk, count: 0, revenue: 0, delivered: 0 }
        byModel[mk].count++; byModel[mk].revenue += b.price || 0
      })
      // (v1.0.433) รายได้เซลส์เดิมนับจาก price ของใบจองที่เข้าเดือนนี้ตาม bookingDate — ตามที่ขอให้นับจาก
      // "รายได้รวม" (totalIncome — กำไรขั้นต้น+ค่าคอม ไม่ใช่แค่ราคาขาย) ของคันที่ตัดตัวเลข/ส่งมอบเข้าเดือนนี้
      // จริง (cutDate) ไม่ใช่ตอนที่ลูกค้าจองครั้งแรก เปลี่ยนแหล่งข้อมูลให้ตรงตามนั้น
      deliveredInMonthAll.forEach(b => {
        const mk = `${b.brand || ''} ${b.model || 'ไม่ระบุ'}`.trim()
        byModel[mk] = byModel[mk] || { name: mk, count: 0, revenue: 0, delivered: 0 }
        byModel[mk].delivered++
        const sk = b.salesName || 'ไม่ระบุ'
        bySales[sk] = bySales[sk] || { name: sk, count: 0, revenue: 0 }
        bySales[sk].count++
        bySales[sk].revenue += (b.totalIncome != null ? b.totalIncome : (b.price || 0))
      })
      const mEl = document.getElementById('top-models')
      if (mEl) mEl.innerHTML = modelRankBars(Object.values(byModel).sort((a, b) => b.count - a.count || b.revenue - a.revenue).slice(0, 5))
      // เซลส์เห็นเฉพาะรายได้ของตัวเอง (ยังไม่ใช่ผลรวมทั้งบริษัทเหมือนหัวหน้า) — เทียบชื่อแบบ normalize เหมือน
      // ที่ทำไว้แล้วที่หน้าลูกค้า (v1.0.432) เพราะ salesName เป็นชื่อพิมพ์เอง ไม่ใช่ uid ผูกตรงๆ
      const sEl = document.getElementById('top-sales')
      if (sEl) {
        if (myRole === 'sales' && user?.displayName) {
          const myKey = Object.keys(bySales).find(k => normName(k) === normName(user.displayName))
          const mine = myKey ? bySales[myKey] : { count: 0, revenue: 0 }
          sEl.innerHTML = `
            <div style="text-align:center;padding:14px 0">
              <div style="font-size:0.72rem;color:var(--text-muted)">💰 รายได้ของคุณเดือนนี้ (ตัดตัวเลข/ส่งมอบ)</div>
              <div style="font-size:1.6rem;font-weight:800;color:var(--primary);margin-top:4px">${formatCurrency(mine.revenue)}</div>
              <div style="font-size:0.72rem;color:var(--text-muted);margin-top:2px">${mine.count} ดีล</div>
            </div>`
        } else {
          // อันดับเซลส์: ส่งมอบ (ตัดตัวเลข) ในเดือนนี้ก่อน แล้วจองใหม่ · มีเหรียญ 1–3 และแถบเทียบคนที่ 1
          const board = salesBoard(bookings, [selectedMonth]).slice(0, 6)
          const top = Math.max(1, ...board.map(r => r.delivered * 1000 + r.booked))
          const medal = ['🥇', '🥈', '🥉']
          const initials = n => n === 'ไม่ระบุ' ? '?' : n.replace(/^(เซลส์|คุณ)\s*/, '').trim().slice(0, 2)
          sEl.innerHTML = board.length ? `<div class="dash-board">${board.map((r, i) => `
            <div class="dash-board-row">
              <span class="dash-ava">${escHtml(initials(r.name))}${medal[i] ? `<i>${medal[i]}</i>` : ''}</span>
              <div class="dash-board-main">
                <div class="dash-board-top"><b>${escHtml(r.name)}</b><span style="white-space:nowrap">✅ ${r.delivered} · 📝 ${r.booked}</span></div>
                <div class="dash-board-bar"><span style="width:${Math.max(4, Math.round((r.delivered * 1000 + r.booked) / top * 100))}%"></span></div>
                <div class="dash-board-sub">รายได้ ${formatCurrency(r.income)} · มูลค่าจอง ${moneyTxt(r.value)}</div>
              </div>
            </div>`).join('')}</div>` : `<div style="font-size:0.78rem;color:var(--text-muted);padding:20px 0;text-align:center">ยังไม่มีข้อมูลเดือนนี้</div>`
        }
      }
    }

    // ── Conversion Funnel: Lead → จอง → ส่งมอบ + แหล่งที่มา ──
    function renderFunnel() {
      const el = document.getElementById('funnel-body')
      if (el) {
        const leadsInM = leads.filter(l => (toDateStr(l.createdAt) || l.date || '').startsWith(selectedMonth)).length
        const bookedInM = bookings.filter(b => (b.bookingDate || '').startsWith(selectedMonth)).length
        const dlvInM = bookings.filter(b => ['ส่งมอบแล้ว', 'ตัดตัวเลขรอส่งมอบ'].includes(b.status) && (b.cutDate || b.actualDeliveryDate || '').startsWith(selectedMonth)).length
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
              <div style="width:${Math.max(4, Math.round(s.count / max * 100))}%;height:100%;background:var(--${s.color});opacity:0.8;border-radius:4px"></div>
              <span style="position:absolute;right:8px;top:50%;transform:translateY(-50%);font-size:0.78rem;font-weight:800;color:var(--text);font-variant-numeric:tabular-nums">${s.count}</span>
            </div>
          </div>
          ${i < 2 ? `<div style="margin:2px 0 6px 130px;font-size:0.66rem;color:var(--text-muted);font-variant-numeric:tabular-nums">↓ อัตราแปลง ${conv(stages[i].count, stages[i + 1].count)}</div>` : ''}
        `).join('')
      }
      const sEl = document.getElementById('source-body')
      if (sEl) {
        const inMonth = bookings.filter(b => (b.bookingDate || '').startsWith(selectedMonth))
        const bySrc = {}
        // ใบจองส่วนใหญ่ (จาก Sheet) ไม่ได้กรอกที่มา — ดูจากลูกค้าคนเดียวกัน (customerId หรือเบอร์โทร) แทน
        const digits = v => String(v || '').replace(/\D/g, '')
        const custById = new Map(), custByPhone = new Map()
        allCustomersForLeads.forEach(c => { if (c.deleted) return; custById.set(c.id, c); if (digits(c.phone).length >= 9) custByPhone.set(digits(c.phone), c) })
        const srcOf = b => {
          if (b.source) return b.source
          const c = custById.get(b.customerId) || custByPhone.get(digits(b.phone))
          return c?.source ? (SOURCE_INFO[normSource(c.source)]?.[1] || c.source) : 'ไม่ระบุ'
        }
        inMonth.forEach(b => { const k = srcOf(b); bySrc[k] = (bySrc[k] || 0) + 1 })
        const entries = Object.entries(bySrc).sort((a, b) => b[1] - a[1]).slice(0, 6)
        const max = Math.max(...entries.map(e => e[1]), 1)
        const onlyUnknown = entries.length === 1 && entries[0][0] === 'ไม่ระบุ'
        sEl.innerHTML = onlyUnknown ? `<div style="font-size:0.78rem;color:var(--text-muted);line-height:1.6;padding:6px 0">ใบจองเดือนนี้ ${entries[0][1]} ใบยังไม่ได้ระบุที่มา — ใส่ช่อง "แหล่งที่มา" ตอนจอง แล้วการ์ดนี้จะบอกว่าช่องทางไหนได้ลูกค้ามากสุด</div>`
          : entries.length ? entries.map(([k, v]) => `
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;font-size:0.75rem">
            <span style="width:80px;color:var(--text-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(k)}</span>
            <div style="flex:1;background:var(--surface-2);border-radius:3px;height:8px;overflow:hidden">
              <div style="width:${Math.round(v / max * 100)}%;height:100%;background:var(--accent)"></div>
            </div>
            <b style="color:var(--accent);font-variant-numeric:tabular-nums">${v}</b>
          </div>`).join('') : `<div style="font-size:0.78rem;color:var(--text-muted);padding:20px 0;text-align:center">ไม่มีข้อมูลเดือนนี้</div>`
      }
    }

    // ── Intelligence Center: สแกนเรื่องค้าง/ด่วนจากข้อมูลจริง (กดแล้วพาไปหน้านั้น) ──
    function renderAlerts() {
      const el = document.getElementById('alerts-body')
      if (!el) return
      const now = Date.now()
      // d มักเป็น Firestore serverTimestamp() object (j.createdAt/l.createdAt/v.createdAt) — new Date(d) ตรงๆ
      // ได้ Invalid Date เงียบๆ (NaN) เทียบกับตัวเลขได้ false เสมอ ทำให้แจ้งเตือนงานค้าง/Lead ค้าง/รถค้างสต็อก
      // ไม่เคยขึ้นเลยแม้จะค้างจริง ใช้ toDate() แทนเพื่อรองรับทั้ง Timestamp/string/Date ให้ถูกต้อง
      const daysSince = d => { const dt = toDate(d); return dt ? Math.floor((now - dt.getTime()) / 86400000) : -Infinity }
      const alerts = []

      // ใบจองค้างสถานะเกิน 14 วัน (ยังไม่ส่งมอบ/ไม่ถอน)
      // ใบที่ตัดตัวเลขแล้ว/ยกเลิก ไม่ใช่งานค้าง (เดิมนับรวม)
      const stuck = openBookings(bookings)
        .filter(b => b.bookingDate && daysSince(b.bookingDate) >= 14)
        .map(b => ({ ...b, age: daysSince(b.bookingDate) }))
        .sort((a, b) => b.age - a.age)
      stuck.slice(0, 4).forEach(b => alerts.push({
        icon: '⏳', sev: b.age >= 30 ? 'danger' : 'warning', nav: '/crm/bookings?id=' + encodeURIComponent(b.id), // เปิดใบจองนั้นเลย
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
      if (staleLeads.length) alerts.push({ icon: '🧲', sev: 'warning', nav: '/crm/my-day' /* มีรายการ "Lead ไม่ได้ติดตามเกิน 3 วัน" พร้อมปุ่มโทร */, text: `Lead ใหม่ยังไม่ติดตามเกิน 3 วัน: ${staleLeads.length} ราย`, age: null })

      // รถค้างสต็อกเกิน 90 วัน (สรุปรวม)
      const agingStock = vehicles.filter(v => !['sold', 'ขายแล้ว', 'ส่งมอบแล้ว'].includes(v.status) && !v.deleted && stockSince(v) && daysSince(stockSince(v)) >= 90)
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
          ${a.age !== null ? `<span style="font-size:0.7rem;font-weight:800;color:var(--${a.sev});font-variant-numeric:tabular-nums;flex-shrink:0">${a.age} วัน</span>` : `<span style="font-size:0.72rem;color:var(--${a.sev});flex-shrink:0">ดู →</span>`}
        </div>`).join('')
        : `<div style="display:flex;align-items:center;gap:10px;padding:16px;background:var(--success-dim);border-radius:8px;font-size:0.82rem;color:var(--success)"><span style="font-size:1.2rem">✅</span> ระบบปกติ — ไม่มีเรื่องค้างเกินกำหนด</div>`
    }

    // ── Radar จริง: จุด = รายการค้างจริงในระบบ · ยิ่งใกล้ศูนย์กลาง = ยิ่งด่วน · คลิกจุดเพื่อไปจัดการ ──
    function renderRadar() {
      const el = document.getElementById('radar-scope')
      if (!el) return
      const now = Date.now()
      const daysSince = d => { const dt = toDate(d); return dt ? Math.floor((now - dt.getTime()) / 86400000) : -Infinity }
      const items = []
      openBookings(bookings).filter(b => b.bookingDate && daysSince(b.bookingDate) >= 14).forEach(b => {
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
      vehicles.filter(v => !['sold', 'ขายแล้ว', 'ส่งมอบแล้ว'].includes(v.status) && !v.deleted && stockSince(v) && daysSince(stockSince(v)) >= 90).slice(0, 4).forEach(v => {
        const age = daysSince(stockSince(v))
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
        // ยังไม่ได้ตั้งเป้า: แนะนำเป้าอัตโนมัติจากยอดจองเฉลี่ย 3 เดือนก่อน +10% แทนการ์ดว่าง
        const ymOf = (y, m) => `${y}-${String(m).padStart(2, '0')}`
        const [sy, sm] = selectedMonth.split('-').map(Number)
        const prev3 = [1, 2, 3].map(k => { const d = new Date(sy, sm - 1 - k, 1); return ymOf(d.getFullYear(), d.getMonth() + 1) })
        const bookedIn = ym => bookings.filter(b => String(b.bookingDate || '').startsWith(ym) && !['ถอนจอง', 'ยกเลิก'].includes(b.status)).length
        const avg = prev3.reduce((a, ym) => a + bookedIn(ym), 0) / 3
        const goal = Math.max(1, Math.ceil(avg * 1.1))
        const now = bookedIn(selectedMonth), pct = Math.round(now / goal * 100)
        const color = pct >= 100 ? 'success' : pct >= 80 ? 'primary' : pct >= 50 ? 'warning' : 'danger'
        el.innerHTML = avg > 0 ? `<div data-nav="/crm/bookings" style="cursor:pointer">
            <div style="display:flex;justify-content:space-between;font-size:0.73rem;margin-bottom:3px;gap:8px">
              <span style="color:var(--text-2)">🤖 เป้าแนะนำ: ยอดจอง ${goal} คัน</span>
              <b style="color:var(--${color});font-variant-numeric:tabular-nums">${pct}%</b>
            </div>
            <div style="background:var(--surface-2);border-radius:3px;height:8px;overflow:hidden">
              <div style="width:${Math.min(100, pct)}%;height:100%;background:var(--${color})"></div>
            </div>
            <div style="font-size:0.66rem;color:var(--text-muted);margin-top:4px">จองแล้ว ${now} คัน · ${now >= goal ? 'ถึงเป้าแล้ว 🎉' : `ขาดอีก ${goal - now} คัน`} · คิดจากเฉลี่ย 3 เดือนก่อน (${avg.toFixed(1)} คัน) +10%</div>
            ${(() => { /* เดือนปัจจุบันเท่านั้น: คาดการณ์สิ้นเดือนจากจังหวะที่จองอยู่ */
              // วันที่ไทยเสมอ (เดิม new Date() ตามเครื่อง)
              if (selectedMonth !== todayBangkok().slice(0, 7)) return ''
              const dayNow = Number(todayBangkok().slice(8, 10))
              const dim = new Date(sy, sm, 0).getDate(), proj = Math.round(now / dayNow * dim)
              return `<div style="margin-top:8px;padding:8px 10px;border-radius:8px;background:var(--surface-2);font-size:0.72rem;line-height:1.5">📈 จังหวะตอนนี้ สิ้นเดือนน่าจะได้ราว <b style="color:var(--${proj >= goal ? 'success' : 'warning'})">${proj} คัน</b>${proj >= goal ? ' — ทันเป้า' : ` — ต้องเร่งอีกวันละ ${((goal - now) / Math.max(1, dim - dayNow + 1)).toFixed(1)} คัน`}</div>`
            })()}
          </div>
          <div style="text-align:center;margin-top:10px"><button class="btn btn-xs btn-ghost" data-nav="/hr/targets">ตั้งเป้าเอง →</button></div>`
          : `<div style="font-size:0.78rem;color:var(--text-muted);padding:14px 0;text-align:center">ไม่มีเป้าหมายเดือนนี้<br><button class="btn btn-sm btn-secondary" data-nav="/hr/targets" style="margin-top:8px">ตั้งเป้าหมาย →</button></div>`
        return
      }
      el.innerHTML = entries.slice(0, 5).map(t => {
        const pct = t.target ? Math.round((t.actual || 0) / t.target * 100) : 0
        const color = pct >= 100 ? 'success' : pct >= 80 ? 'primary' : pct >= 50 ? 'warning' : 'danger'
        const fmt = v => t.metric === 'revenue' ? formatCurrency(v) : v
        return `<div style="margin-bottom:10px" data-nav="/hr/targets">
          <div style="display:flex;justify-content:space-between;font-size:0.73rem;margin-bottom:3px">
            <span style="color:var(--text-2)">${escHtml(t.department)}${t.team ? ' · ' + escHtml(t.team) : ''} — ${METRIC_LABEL[t.metric] || escHtml(t.metric)}</span>
            <b style="color:var(--${color});font-variant-numeric:tabular-nums">${pct}%</b>
          </div>
          <div style="background:var(--surface-2);border-radius:3px;height:8px;overflow:hidden">
            <div style="width:${Math.min(100, pct)}%;height:100%;background:var(--${color})"></div>
          </div>
          <div style="font-size:0.64rem;color:var(--text-muted);margin-top:2px;font-variant-numeric:tabular-nums">${fmt(t.actual || 0)} / ${fmt(t.target)}</div>
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
      el.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(24px,1fr));gap:3px">
        ${counts.map((c, i) => {
          const op = c ? (0.25 + 0.75 * c / max).toFixed(2) : 0
          return `<div data-tip="${i + 1} ${ymLabel(selectedMonth)}|${c} ใบจอง" style="height:26px;border-radius:5px;background:${c ? `rgba(0,180,255,${op})` : 'var(--surface-2)'};border:1px solid var(--border-subtle);display:flex;align-items:center;justify-content:center;font-size:0.55rem;color:${c ? (op > 0.55 ? '#04202e' : 'var(--text)') : 'var(--text-muted)'};${op > 0.55 ? 'font-weight:700;' : ''}font-variant-numeric:tabular-nums">${i + 1}</div>`
        }).join('')}
      </div>
      <div style="font-size:0.62rem;color:var(--text-muted);margin-top:6px">เข้มมาก = จองเยอะ · สูงสุด ${max} ใบจอง/วัน</div>`
    }

    function renderAll() {
      renderHero()
      renderPipeline(); renderDeptDetail(); renderTrendChart(); renderDonut(); renderGauges()
      renderMoM(); renderForecast(); renderTops(); renderFunnel()
      renderAlerts(); renderTargets(); renderHeatmap(); renderRadar()
      renderDeliveryChart(); renderCancelChart()
      document.querySelectorAll('.fc-month').forEach(s => { s.textContent = ymLabel(selectedMonth) })
    }

    document.getElementById('pm-prev')?.addEventListener('click', () => setSelectedMonth(shiftMonth(selectedMonth, -1)))
    document.getElementById('pm-next')?.addEventListener('click', () => setSelectedMonth(shiftMonth(selectedMonth, 1)))
    document.getElementById('pm-now')?.addEventListener('click', () => setSelectedMonth(todayBangkok().slice(0, 7)))
    document.getElementById('mom-compare-picker')?.addEventListener('change', e => {
      if (e.target.value) { compareMonth = e.target.value; renderHero() }
    })
    // (v1.0.446) ต้องรีเฟรชกราฟส่งมอบ/ถอนจองด้วย — ใช้ trendRange เดียวกับกราฟหลัก ถ้าเรียกแค่ renderTrendChart()
    // อย่างเดียวเหมือนเดิม กราฟ 2 อันใหม่จะค้างช่วงเดือนเก่าไม่ตรงกับกราฟหลักที่เพิ่งสลับ 6/12 เดือน
    document.getElementById('trend-6')?.addEventListener('click', () => { trendRange = 6; renderTrendChart(); renderDeliveryChart(); renderCancelChart() })
    document.getElementById('trend-12')?.addEventListener('click', () => { trendRange = 12; renderTrendChart(); renderDeliveryChart(); renderCancelChart() })

    renderAll()

    // Today panel — ใช้ข้อมูลจริง
    // จองใหม่วันนี้ = bookingDate วันนี้ (เดิมดูวันนัด/วันสร้างเอกสาร ซึ่งนับใบที่นำเข้าจาก Sheet วันนี้เป็น "จองวันนี้" ด้วย)
    const todayBookings = bookings.filter(b => b.bookingDate === today)
    const dueToday = openBookings(bookings).filter(b => String(b.deliveryDate || '').startsWith(today))
    const pendingPdi = pdi.filter(p => p.status !== 'passed' && p.status !== 'completed')

    // ── Morning Briefing: สรุปเชิงรุกจากข้อมูลจริง — mirror ตรรกะเดียวกับ Intelligence Center ──
    // แคชต่อผู้ใช้/ต่อวันใน localStorage เพื่อไม่ต้องเรียก LLM ทุกครั้งที่เข้าหน้า
    ;(() => {
      const textEl = document.getElementById('briefing-text')
      const timeEl = document.getElementById('briefing-time')
      const regenBtn = document.getElementById('briefing-regen')
      if (!textEl) return

      const daysSinceNow = d => { const dt = toDate(d); return dt ? Math.floor((Date.now() - dt.getTime()) / 86400000) : -Infinity }
      const stuckBookingsCount = openBookings(bookings).filter(b => b.bookingDate && daysSinceNow(b.bookingDate) >= 14).length
      const overdueJobsCount = jobs.filter(j => !['done', 'completed', 'delivered'].includes(j.status) && j.createdAt && daysSinceNow(j.createdAt) >= 7).length
      const staleLeadsCount = leads.filter(l => l.status === 'new' && l.createdAt && daysSinceNow(l.createdAt) >= 3).length
      const agingStockCount = vehicles.filter(v => !['sold', 'ขายแล้ว', 'ส่งมอบแล้ว'].includes(v.status) && !v.deleted && stockSince(v) && daysSinceNow(stockSince(v)) >= 90).length
      const deliveredToday = bookings.filter(b => b.status === 'ส่งมอบแล้ว' && (b.actualDeliveryDate || '').startsWith(today)).length
      const todayCount = todayBookings.length + deliveredToday
      const revenueThisMonth = monthStats(bookings, thisMonth).value
      const monthTargets = teamTargets.filter(t => t.period === thisMonth && t.metric === 'units')
      const targetSum = monthTargets.reduce((s, t) => s + (t.target || 0), 0)
      const targetPct = monthTargets.length && targetSum ? Math.round(monthTargets.reduce((s, t) => s + (t.actual || 0), 0) / targetSum * 100) : null

      // ข้อมูลใบจองเชิงลึก (ค้างแยกสถานะ/แนวโน้ม 6 เดือน/ยอดเดือนนี้เทียบเดือนก่อน) — ให้สรุปเจาะจงขึ้น ไม่ใช่แค่นับรวม
      // หน้านี้โหลดลูกค้าแค่บางส่วน จึงใช้เฉพาะหัวข้อที่คิดจากใบจองล้วน
      let facts = {}
      try { facts = Object.fromEntries(Object.entries(businessFacts({ customers: [], bookings }, today)).filter(([k]) => /^(ใบจอง|แนวโน้ม|กำหนดส่งมอบ|รุ่นที่ถูกจอง)/.test(k))) } catch { /* ไม่มีก็สรุปแบบเดิม */ }
      const briefingCtx = { todayCount, stuckBookings: stuckBookingsCount, overdueJobs: overdueJobsCount, staleLeads: staleLeadsCount, agingStock: agingStockCount, revenueThisMonth, targetPct, facts }
      const cacheKey = `lamom_morning_briefing_${user?.uid || 'anon'}_${today}`

      function showBriefing(text, generatedAt) {
        if (!textEl.isConnected || container.__routerGen !== myGen) return
        textEl.textContent = text
        if (timeEl) timeEl.textContent = generatedAt ? `อัปเดต ${new Date(generatedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}` : ''
      }

      async function loadBriefing(forceRegen) {
        if (!forceRegen) {
          try {
            const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null')
            if (cached?.text) { showBriefing(cached.text, cached.generatedAt); return }
          } catch { /* corrupt cache — regenerate below */ }
        }
        if (regenBtn) { regenBtn.disabled = true; regenBtn.textContent = '⏳ กำลังสร้าง...' }
        textEl.textContent = 'กำลังวิเคราะห์ข้อมูลเช้านี้...'
        try {
          const text = await generateMorningBriefing(briefingCtx)
          if (container.__routerGen !== myGen) return
          const generatedAt = new Date().toISOString()
          try { localStorage.setItem(cacheKey, JSON.stringify({ text, generatedAt })) } catch { /* storage full/blocked — ยังแสดงผลได้ */ }
          showBriefing(text, generatedAt)
        } catch {
          showBriefing('ไม่สามารถสร้างสรุปได้ในขณะนี้ — ลองกด "สร้างใหม่" อีกครั้งครับ', null)
        } finally {
          if (regenBtn) { regenBtn.disabled = false; regenBtn.textContent = '🔄 สร้างใหม่' }
        }
      }

      regenBtn?.addEventListener('click', () => loadBriefing(true))
      loadBriefing(false)
    })()

    const todayEl = document.getElementById('today-stats')
    if (todayEl) {
      const todayItems = [
        { label:'จองใหม่วันนี้', n: todayBookings.length, unit:'ใบ', icon:'📝', color:'primary', nav:'/crm/bookings' },
        { label:'นัดส่งมอบวันนี้', n: dueToday.length, unit:'คัน', icon:'🚗', color:'success', nav:'/crm/bookings' },
        { label:'งานซ่อมเปิดอยู่', n: openJobs, unit:'งาน', icon:'🔧', color:'warning', nav:'/service/jobs' },
        { label:'PDI รอตรวจ', n: pendingPdi.length || 0, unit:'คัน', icon:'✅', color:'accent', nav:'/dms/pdi' },
        { label:'งานมอบหมายค้าง', n: pendingTasks, unit:'งาน', icon:'📋', color: pendingTasks > 3 ? 'danger' : 'accent', nav:'/tasks' },
      ]
      // แถวที่เป็น 0 รวมเป็นบรรทัดเดียว ไม่ต้องโชว์ "0 งาน" ซ้ำ ๆ
      const busy = todayItems.filter(s => +s.n), idle = todayItems.filter(s => !+s.n)
      todayEl.innerHTML = busy.map(s => `
        <div style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:8px;border-radius:var(--radius-md);background:var(--surface-2)" data-nav="${s.nav}">
          <span style="font-size:1.1rem">${s.icon}</span>
          <span style="flex:1;font-size:0.83rem">${s.label}</span>
          <span style="font-weight:700;color:var(--${s.color})">${s.n} ${s.unit}</span>
        </div>
      `).join('') + (idle.length ? `<div style="font-size:0.76rem;color:var(--text-muted);padding:6px 8px;line-height:1.6">✅ ไม่มีค้าง: ${idle.map(s => `<span data-nav="${s.nav}" style="cursor:pointer">${s.icon} ${s.label}</span>`).join(' · ')}</div>` : '')
    }

    // Activity Feed — ประกอบจาก recent docs ทุก collection
    const feed = []
    customers.slice(0, 3).forEach(c => feed.push({ icon:'👥', text:`ลูกค้า: ${escHtml(c.firstName||'')} ${escHtml(c.lastName||'')}`, time: timeAgo(c.createdAt), rawTime: toDate(c.createdAt)?.getTime() || 0, color:'primary' }))
    jobs.slice(0, 3).forEach(j => feed.push({ icon:'🔧', text:`Job Card: ${escHtml(j.jobNo||j.plate||j.licensePlate||j.vin||'')} ${escHtml(j.custName||'')} — ${escHtml(j.serviceType||j.type||'งานซ่อม')}`, time: timeAgo(j.createdAt), rawTime: toDate(j.createdAt)?.getTime() || 0, color:'warning' }))
    bookings.slice(0, 3).forEach(b => feed.push({ icon:'📝', text:`จอง: ${escHtml(b.custName||b.customerName||'')} — ${escHtml(b.model||b.vehicleModel||'')}`, time: timeAgo(b.createdAt), rawTime: toDate(b.createdAt)?.getTime() || 0, color:'accent' }))
    tasks.slice(0, 2).forEach(t => feed.push({ icon:'✅', text:`งาน: ${escHtml(t.title||t.name||'')}`, time: timeAgo(t.createdAt), rawTime: toDate(t.createdAt)?.getTime() || 0, color:'success' }))
    // Sort by time descending (most recent first)
    feed.sort((a, b) => (b.rawTime || 0) - (a.rawTime || 0))
    const feedEl = document.getElementById('activity-feed')
    // ไม่มีความเคลื่อนไหวจริง → บอกตรงๆ (เดิมโชว์รายการตัวอย่างปลอม เช่น "จองรถ BYD Seal — คุณสมศักดิ์" ทำให้เข้าใจผิด)
    if (feedEl && !feed.length) feedEl.innerHTML = `<div style="padding:18px 16px;font-size:0.8rem;color:var(--text-muted)">ยังไม่มีความเคลื่อนไหว — เพิ่มลูกค้าหรือใบจองแล้วจะขึ้นที่นี่</div>`
    else if (feedEl) {
      feedEl.innerHTML = feed.slice(0, 10).map(a => `
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
      // อุณหภูมิอยู่ใน c.temperature (c.status เป็นฟิลด์เก่า) — เดิมป้ายขึ้น "-" ทุกคน · กดแล้วเปิดลูกค้าคนนั้นเลย
      const tempKey = c => c.isLost ? 'lost' : c.vip ? 'vip' : (c.temperature || c.status || '')
      list.innerHTML = customers.slice(0, 5).map(c => `
        <div style="display:flex;align-items:center;gap:10px;padding:10px 16px;border-bottom:1px solid var(--border);cursor:pointer" data-nav="/crm/customers?id=${encodeURIComponent(c.id || '')}">
          <div style="width:32px;height:32px;border-radius:50%;background:var(--${STATUS_COLORS[tempKey(c)] || 'secondary'}-dim);display:flex;align-items:center;justify-content:center;font-size:0.8rem;font-weight:700;color:var(--${STATUS_COLORS[tempKey(c)] || 'secondary'});flex-shrink:0">
            ${escHtml(c.firstName?.[0] || '?')}${escHtml(c.lastName?.[0] || '')}
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-size:0.85rem;font-weight:600">${escHtml(c.firstName || '')} ${escHtml(c.lastName || '')}</div>
            <div style="font-size:0.73rem;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml([c.interestedModel, c.phone].filter(Boolean).join(' · ') || '-')}</div>
          </div>
          ${STATUS_LABELS[tempKey(c)] ? `<span class="badge badge-${STATUS_COLORS[tempKey(c)]}" style="font-size:0.68rem;flex-shrink:0">${STATUS_LABELS[tempKey(c)]}</span>` : ''}
        </div>
      `).join('')
    }
  } catch {}

  return function cleanupDashboard() {
    unsubscribers.forEach(u => { try { u() } catch {} })
  }
}
