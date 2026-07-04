/**
 * Department Operations Dashboard — KPI + จุดคอขวดแต่ละแผนก
 * Route: /analytics/dept-ops
 */
import { listDocs } from '../../core/db.js'
import { formatCurrency, timeAgo } from '../../utils/format.js'
import { navigate } from '../../core/router.js'

const DEPARTMENTS = {
  sales:     { label: 'ฝ่ายขาย', icon: '🚗' },
  finance:   { label: 'การเงิน/ไฟแนนซ์', icon: '💰' },
  service:   { label: 'ศูนย์บริการ', icon: '🔧' },
  dms:       { label: 'คลังรถ/สต็อก', icon: '📦' },
  marketing: { label: 'การตลาด', icon: '📣' },
  hr:        { label: 'HR', icon: '👤' },
  quality:   { label: 'คุณภาพ/QA', icon: '✅' },
  general:   { label: 'ทั่วไป', icon: '📋' },
}

const STUCK_JOB_STATUSES = ['waiting_parts', 'diagnosing']
const STUCK_BOOKING_STATUSES = ['รอผลไฟแนนซ์', 'จัดไฟแนนซ์ก่อนจอง', 'ยอดจองคงค้าง']
const STUCK_DAYS_THRESHOLD = 5

function escHtml(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }
function daysSince(dateStr) {
  if (!dateStr) return 0
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
}

export default async function DeptOperationsDashboardPage(container) {
  const myGen = container.__routerGen
  let tasks = [], bookings = [], jobs = []

  try {
    const [t, b, j] = await Promise.all([
      listDocs('tasks', [], 'dueDate', 'asc', 500).catch(() => []),
      listDocs('bookings', [], 'createdAt', 'desc', 300).catch(() => []),
      listDocs('job_cards', [], 'createdAt', 'desc', 300).catch(() => []),
    ])
    tasks = t; bookings = b; jobs = j
  } catch {}
  if (container.__routerGen !== myGen) return

  const today = new Date().toISOString().slice(0, 10)

  function taskStatsFor(deptKey) {
    const deptTasks = tasks.filter(t => (t.department || 'general') === deptKey && t.status !== 'done' && t.status !== 'cancelled')
    const overdue = deptTasks.filter(t => t.dueDate && t.dueDate < today)
    const routedIn = deptTasks.filter(t => t.originDept && t.originDept !== deptKey)
    return { pending: deptTasks.length, overdue: overdue.length, routedIn: routedIn.length }
  }

  // จุดคอขวดจริงจากข้อมูลจริง — ฝ่ายขาย: booking ค้างสถานะเดิมนาน, บริการ: job card รออะไหล่/วินิจฉัยนาน
  const stuckBookings = bookings.filter(b => STUCK_BOOKING_STATUSES.includes(b.status) && daysSince(b.createdAt) >= STUCK_DAYS_THRESHOLD)
  const stuckJobs = jobs.filter(j => STUCK_JOB_STATUSES.includes(j.status) && daysSince(j.createdAt) >= STUCK_DAYS_THRESHOLD)

  function render() {
    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🏭 ภาพรวมประสิทธิภาพแต่ละแผนก</div>
            <div class="page-subtitle">KPI งานค้าง + จุดคอขวดจากข้อมูลจริง</div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;margin-bottom:20px">
          ${Object.entries(DEPARTMENTS).map(([k, v]) => deptCard(k, v)).join('')}
        </div>

        <div class="card mb-4" style="padding:16px">
          <div style="font-weight:700;font-size:0.9rem;margin-bottom:4px">🚧 จุดคอขวดฝ่ายขาย — ใบจองค้างสถานะเกิน ${STUCK_DAYS_THRESHOLD} วัน</div>
          <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:10px">ตรวจจากสถานะ: ${STUCK_BOOKING_STATUSES.join(', ')}</div>
          ${stuckBookings.length ? stuckBookings.slice(0, 10).map(b => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:var(--surface-2);border-radius:8px;margin-bottom:6px;cursor:pointer" class="stuck-booking-row" data-id="${b.id}">
              <div style="font-size:0.78rem"><b>${escHtml(b.bookingNo || b.id)}</b> — ${escHtml(b.custName || '-')} <span style="color:var(--text-muted)">(${escHtml(b.status)})</span></div>
              <span class="badge badge-danger" style="font-size:0.66rem">ค้าง ${daysSince(b.createdAt)} วัน</span>
            </div>
          `).join('') : `<div style="font-size:0.78rem;color:var(--success)">✅ ไม่มีใบจองค้างเกินกำหนด</div>`}
        </div>

        <div class="card" style="padding:16px">
          <div style="font-weight:700;font-size:0.9rem;margin-bottom:4px">🚧 จุดคอขวดศูนย์บริการ — Job Card ค้างเกิน ${STUCK_DAYS_THRESHOLD} วัน</div>
          <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:10px">ตรวจจากสถานะ: รออะไหล่, วินิจฉัย</div>
          ${stuckJobs.length ? stuckJobs.slice(0, 10).map(j => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:var(--surface-2);border-radius:8px;margin-bottom:6px">
              <div style="font-size:0.78rem"><b>${escHtml(j.jobNo || j.id)}</b> — ${escHtml(j.custName || '-')} <span style="color:var(--text-muted)">(${escHtml(j.status)})</span></div>
              <span class="badge badge-danger" style="font-size:0.66rem">ค้าง ${daysSince(j.createdAt)} วัน</span>
            </div>
          `).join('') : `<div style="font-size:0.78rem;color:var(--success)">✅ ไม่มี Job Card ค้างเกินกำหนด</div>`}
        </div>
      </div>
    `

    container.querySelectorAll('[data-nav]').forEach(el => el.addEventListener('click', () => navigate(el.dataset.nav)))
    container.querySelectorAll('.stuck-booking-row').forEach(el => el.addEventListener('click', () => navigate('/crm/bookings')))
  }

  function deptCard(key, v) {
    const s = taskStatsFor(key)
    const hasBottleneck = s.overdue > 0
    return `<div class="card" style="padding:14px;cursor:pointer;border-top:3px solid ${hasBottleneck ? 'var(--danger)' : 'var(--success)'}" data-nav="/tasks">
      <div style="font-weight:700;font-size:0.88rem;margin-bottom:8px">${v.icon} ${v.label}</div>
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px">
        <span style="font-size:0.7rem;color:var(--text-muted)">งานค้าง</span>
        <span style="font-size:1.1rem;font-weight:800">${s.pending}</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px">
        <span style="font-size:0.7rem;color:var(--text-muted)">เกินกำหนด</span>
        <span style="font-size:0.95rem;font-weight:700;color:${s.overdue > 0 ? 'var(--danger)' : 'var(--success)'}">${s.overdue}</span>
      </div>
      ${s.routedIn > 0 ? `<div style="font-size:0.66rem;color:var(--accent);margin-top:4px">🔀 รับส่งต่อมา ${s.routedIn} งาน</div>` : ''}
    </div>`
  }

  render()
}
