/**
 * Operations Dashboard — ภาพรวมการดำเนินงาน
 * Route: /analytics/operations
 */
import { formatCurrency, todayBangkok, toDateStr } from '../../utils/format.js'
import { listDocs } from '../../core/db.js'
import { companyScopeFilters } from '../../core/companyScope.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const THAI_MONTH_SHORT = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']
const FINAL_BOOKING_STATUS = ['ส่งมอบแล้ว', 'ถอนจอง']

// ยังไม่มีแหล่งข้อมูลจริงในระบบให้เมตริกกลุ่มนี้ (ไม่มี field วันปิดงาน/คะแนน performance/ตำแหน่งงานว่าง
// เก็บอยู่ที่ไหนเลย) — คงไว้เป็นตัวอย่างพร้อมป้ายกำกับชัดเจน ดีกว่าเดาตัวเลขที่ไม่มีทางตรวจสอบได้
const SAMPLE_ONLY = {
  service: { avgTurnaround: 2.3, techUtilization: 87 },
  workforce: { avgPerformance: 87.5, openPositions: 2, trainingCompleted: 72 },
}

function daysSince(dateStr) {
  if (!dateStr) return 0
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
}
function monthKey(dateStr) { return (dateStr || '').slice(0, 7) }
function last6MonthKeys() {
  const [y, m] = todayBangkok().split('-').map(Number)
  const keys = []
  for (let i = 5; i >= 0; i--) {
    let yy = y, mm = m - i
    while (mm <= 0) { mm += 12; yy-- }
    keys.push(`${yy}-${String(mm).padStart(2, '0')}`)
  }
  return keys
}

export default async function OperationsDashboardPage(container) {
  const myGen = container.__routerGen
  const today = todayBangkok()

  const d = {
    inventory: { totalVehicles: 0, available: 0, reserved: 0, inTransit: 0, onHold: 0, avgDaysInStock: 0, stockHealth: 0 },
    service: { totalJobs: 0, completed: 0, inProgress: 0, pending: 0, ...SAMPLE_ONLY.service },
    supply: { activeSuppliers: 0, openPOs: 0, overdueDeliveries: 0, partsStockValue: 0, avgLeadTime: 0 },
    workforce: { totalStaff: 0, present: 0, ...SAMPLE_ONLY.workforce },
  }
  let vehiclesSoldByMonth = last6MonthKeys().map(() => 0)
  let bottlenecks = []
  let pendingFeedback = 0

  try {
    const [vehicles, jobs, staffList, attendance, bookings, suppliers, pos, parts] = await Promise.all([
      // เดิม orderBy('createdAt') — รถจริงในระบบไม่มี field นี้ (มีแต่ arrivedAt) ทำให้ Firestore orderBy
      // ตัดออกจากผลลัพธ์ไปเงียบๆทั้งหมด เห็นสต็อกรถ 0 คันตลอด ต้องใช้ arrivedAt ให้ตรงกับ Stock.js
      listDocs('vehicles', [], 'arrivedAt', 'desc', 500).catch(() => []),
      listDocs('job_cards', companyScopeFilters(), 'createdAt', 'desc', 500).catch(() => []),
      // เดิม orderBy('name') — พนักงานจริงเก็บเป็น firstName/lastName แยกกัน ไม่มี field 'name' รวมเลย
      // (ดู Staff.js) ทำให้ Firestore orderBy ตัดพนักงานทุกคนออกจากผลลัพธ์ เห็นพนักงาน 0 คนตลอด
      listDocs('staff', [], 'firstName', 'asc', 500).catch(() => []),
      listDocs('attendance', [['date', '==', today]], 'date', 'desc', 500).catch(() => []),
      listDocs('bookings', [], 'createdAt', 'desc', 1000).catch(() => []),
      listDocs('suppliers', [], 'name', 'asc', 300).catch(() => []),
      listDocs('purchase_orders', companyScopeFilters(), 'requestDate', 'desc', 300).catch(() => []),
      listDocs('parts', companyScopeFilters(), 'name', 'asc', 1000).catch(() => []),
    ])
    if (container.__routerGen !== myGen) return

    const liveVehicles = vehicles.filter(v => !v.deleted)
    const liveJobs = jobs.filter(j => !j.deleted)
    const liveStaff = staffList.filter(s => !s.deleted)
    const liveBookings = bookings.filter(b => !b.deleted)
    const liveSuppliers = suppliers.filter(s => !s.deleted)
    const livePOs = pos.filter(p => !p.deleted)
    const liveParts = parts.filter(p => !p.deleted)

    // ── สต็อกรถ ──────────────────────────────────────────────────────────────
    if (liveVehicles.length) {
      d.inventory.totalVehicles = liveVehicles.length
      d.inventory.available = liveVehicles.filter(v => v.status === 'พร้อมขาย' || v.status === 'available').length
      d.inventory.reserved = liveVehicles.filter(v => v.status === 'จอง' || v.status === 'reserved').length
      d.inventory.inTransit = liveVehicles.filter(v => v.status === 'กำลังขนส่ง' || v.status === 'transit').length
      d.inventory.onHold = liveVehicles.filter(v => v.status === 'พักไว้' || v.status === 'hold').length
      const ages = liveVehicles.map(v => daysSince(v.arrivedAt))
      d.inventory.avgDaysInStock = Math.round(ages.reduce((a, x) => a + x, 0) / ages.length)
      // สุขภาพสต็อก = สัดส่วนรถที่ยังไม่ค้างเกิน 60 วัน (ใช้เกณฑ์เดียวกับ VehicleAging.js bucket "31-60 วัน")
      d.inventory.stockHealth = Math.round(ages.filter(a => a <= 60).length / ages.length * 100)
    }

    // ── ศูนย์บริการ ──────────────────────────────────────────────────────────
    if (liveJobs.length) {
      d.service.totalJobs = liveJobs.length
      d.service.completed = liveJobs.filter(j => j.status === 'เสร็จแล้ว' || j.status === 'completed' || j.status === 'done').length
      d.service.inProgress = liveJobs.filter(j => j.status === 'กำลังซ่อม' || j.status === 'in_progress' || j.status === 'กำลังดำเนินการ').length
      d.service.pending = liveJobs.filter(j => j.status === 'รอ' || j.status === 'pending').length
    }

    // ── พนักงาน ──────────────────────────────────────────────────────────────
    if (liveStaff.length) {
      d.workforce.totalStaff = liveStaff.length
      d.workforce.present = attendance.filter(a => a.checkIn).length
    }

    // ── Supply Chain (จาก suppliers/purchase_orders/parts จริง) ────────────────
    d.supply.activeSuppliers = liveSuppliers.filter(s => s.status === 'active').length
    const openStatuses = ['pending', 'approved', 'ordered']
    const openPOs = livePOs.filter(p => openStatuses.includes(p.status))
    d.supply.openPOs = openPOs.length
    d.supply.overdueDeliveries = livePOs.filter(p => p.status === 'ordered' && p.expectedDate && p.expectedDate < today).length
    d.supply.partsStockValue = liveParts.reduce((a, p) => a + (p.qty || 0) * (p.unitCost || 0), 0)
    const leadTimes = livePOs.filter(p => p.requestDate && p.expectedDate).map(p => {
      const days = Math.round((new Date(p.expectedDate) - new Date(toDateStr(p.requestDate))) / 86400000)
      return days
    }).filter(n => Number.isFinite(n) && n >= 0)
    d.supply.avgLeadTime = leadTimes.length ? Math.round(leadTimes.reduce((a, x) => a + x, 0) / leadTimes.length * 10) / 10 : 0

    // ── ยอดส่งมอบรถรายเดือน (6 เดือนล่าสุด) จากใบจองจริง ────────────────────────
    const monthKeys = last6MonthKeys()
    const delivered = liveBookings.filter(b => b.status === 'ส่งมอบแล้ว' && b.actualDeliveryDate)
    vehiclesSoldByMonth = monthKeys.map(k => delivered.filter(b => monthKey(b.actualDeliveryDate) === k).length)

    // ── Bottlenecks จริง: รถค้างสต็อก / ใบจองค้างนาน / PO ส่งล่าช้า ────────────────
    const agingVehicles = liveVehicles
      .map(v => ({ v, days: daysSince(v.arrivedAt) }))
      .filter(x => x.days > 60)
      .sort((a, b) => b.days - a.days)
      .slice(0, 3)
    agingVehicles.forEach(({ v, days }) => {
      bottlenecks.push({
        issue: `รถค้างสต็อก ${days} วัน — ${escHtml(v.brand || '')} ${escHtml(v.model || '')}`.trim(),
        impact: days > 90 ? 'high' : 'medium', dept: 'DMS', days,
      })
    })

    const stuckBookings = liveBookings
      .filter(b => !FINAL_BOOKING_STATUS.includes(b.status) && b.bookingDate)
      .map(b => ({ b, days: daysSince(b.bookingDate) }))
      .filter(x => x.days >= 14)
      .sort((a, b) => b.days - a.days)
      .slice(0, 3)
    stuckBookings.forEach(({ b, days }) => {
      bottlenecks.push({
        issue: `ใบจองค้าง ${days} วัน — ${escHtml(b.custName || 'ลูกค้า')} (${escHtml(b.status || '')})`,
        impact: days > 30 ? 'high' : 'medium', dept: 'Sales', days,
      })
    })

    const overduePOs = livePOs
      .filter(p => p.status === 'ordered' && p.expectedDate && p.expectedDate < today)
      .map(p => ({ p, days: daysSince(p.expectedDate) }))
      .sort((a, b) => b.days - a.days)
      .slice(0, 2)
    overduePOs.forEach(({ p, days }) => {
      bottlenecks.push({ issue: `PO ล่าช้ากว่ากำหนด ${days} วัน — ${escHtml(p.title || p.id)}`, impact: days > 7 ? 'high' : 'low', dept: 'Supply', days })
    })

    bottlenecks.sort((a, b) => b.days - a.days)

    pendingFeedback = delivered.length
  } catch {}

  function renderPage() {
    const chartMax = Math.max(1, ...vehiclesSoldByMonth)
    const monthKeys = last6MonthKeys()

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">⚙️ Operations Dashboard</div>
            <div class="page-subtitle">ภาพรวมการดำเนินงาน — สต็อก / บริการ / ซัพพลาย / HR</div>
          </div>
        </div>

        <!-- Top KPIs -->
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px">
          ${opsKpi('📦 สต็อกรถพร้อมขาย', d.inventory.available + ' คัน', 'primary', d.inventory.totalVehicles + ' คันทั้งหมด')}
          ${opsKpi('🔧 งานบริการเสร็จ', d.service.completed + ' งาน', 'success', 'กำลังซ่อม ' + d.service.inProgress)}
          ${opsKpi('⭐ รอลูกค้าให้คะแนน', pendingFeedback + ' ใบส่งมอบ', 'warning', 'จากใบจองที่ส่งมอบแล้ว — ยังไม่มี CSAT เฉลี่ยจริงจนกว่าลูกค้าจะตอบ')}
          ${opsKpi('👥 พนักงานวันนี้', d.workforce.present + '/' + d.workforce.totalStaff, 'primary', 'ลงเวลาแล้ว (จาก Attendance จริง)')}
        </div>

        <!-- Main grid -->
        <div style="display:grid;grid-template-columns:2fr 1fr;gap:16px;margin-bottom:16px">
          <!-- Sales trend -->
          <div class="card" style="padding:14px">
            <div style="font-weight:700;font-size:0.85rem;margin-bottom:12px">📈 ยอดส่งมอบรถรายเดือน <span style="font-weight:400;color:var(--text-muted);font-size:0.7rem">(6 เดือนล่าสุด — จากใบจองจริง)</span></div>
            <div style="display:flex;align-items:flex-end;gap:5px;height:80px;border-bottom:1px solid var(--border);margin-bottom:6px">
              ${monthKeys.map((k, i) => {
                const s = vehiclesSoldByMonth[i]
                const h = Math.max(4, Math.round(s / chartMax * 80))
                return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px">
                  <div style="font-size:0.58rem;color:var(--text-muted)">${s}</div>
                  <div style="width:100%;height:${h}px;background:var(--primary);border-radius:2px 2px 0 0;opacity:0.85"></div>
                </div>`
              }).join('')}
            </div>
            <div style="display:flex;gap:0">
              ${monthKeys.map(k => `<div style="flex:1;text-align:center;font-size:0.62rem;color:var(--text-muted)">${THAI_MONTH_SHORT[Number(k.slice(5,7)) - 1]}</div>`).join('')}
            </div>
            <div style="font-size:0.72rem;color:var(--primary);margin-top:4px">🚗 ส่งมอบแล้ว (คัน)</div>
          </div>

          <!-- Bottlenecks -->
          <div class="card" style="padding:14px">
            <div style="font-weight:700;font-size:0.85rem;margin-bottom:10px">⚠️ Bottlenecks <span style="font-weight:400;color:var(--text-muted);font-size:0.7rem">(จริง — รถค้าง&gt;60วัน / ใบจองค้าง&gt;14วัน / PO ล่าช้า)</span></div>
            ${bottlenecks.length ? bottlenecks.map(b => `
              <div style="display:flex;align-items:flex-start;gap:8px;padding:7px 0;border-bottom:1px solid var(--border)">
                <span style="font-size:0.7rem;padding:2px 6px;border-radius:3px;background:var(--${b.impact==='high'?'danger':b.impact==='medium'?'warning':'secondary'}-dim,var(--surface-2));color:var(--${b.impact==='high'?'danger':b.impact==='medium'?'warning':'text-muted'});flex-shrink:0">${b.impact.toUpperCase()}</span>
                <div style="flex:1">
                  <div style="font-size:0.77rem;line-height:1.4">${b.issue}</div>
                  <div style="font-size:0.68rem;color:var(--text-muted)">${b.dept} · ${b.days} วัน</div>
                </div>
              </div>
            `).join('') : `<div style="font-size:0.8rem;color:var(--success);padding:8px 0">✅ ไม่พบปัญหาค้างขณะนี้</div>`}
          </div>
        </div>

        <!-- Department health cards -->
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px">
          <!-- Inventory -->
          <div class="card" style="padding:14px">
            <div style="font-weight:700;font-size:0.82rem;margin-bottom:10px">📦 สต็อกรถ</div>
            ${healthBar('พร้อมขาย', d.inventory.available, d.inventory.totalVehicles, 'success')}
            ${healthBar('จอง', d.inventory.reserved, d.inventory.totalVehicles, 'warning')}
            ${healthBar('กำลังขนส่ง', d.inventory.inTransit, d.inventory.totalVehicles, 'primary')}
            <div style="margin-top:8px;font-size:0.75rem;color:var(--text-muted)">เฉลี่ยอยู่ในสต็อก ${d.inventory.avgDaysInStock} วัน</div>
            <div style="margin-top:4px;display:flex;justify-content:space-between;font-size:0.73rem">
              <span>Stock Health</span>
              <strong style="color:var(--${d.inventory.stockHealth>=80?'success':'warning'})">${d.inventory.stockHealth}%</strong>
            </div>
          </div>

          <!-- Service -->
          <div class="card" style="padding:14px">
            <div style="font-weight:700;font-size:0.82rem;margin-bottom:10px">🔧 ศูนย์บริการ</div>
            ${healthBar('เสร็จแล้ว', d.service.completed, d.service.totalJobs, 'success')}
            ${healthBar('กำลังซ่อม', d.service.inProgress, d.service.totalJobs, 'warning')}
            ${healthBar('รอรับ', d.service.pending, d.service.totalJobs, 'secondary')}
            <div style="margin-top:8px;font-size:0.75rem;color:var(--text-muted)">Turnaround ${d.service.avgTurnaround} วัน <span style="font-size:0.65rem">(ตัวอย่าง — ยังไม่มี field วันปิดงานให้คำนวณจริง)</span></div>
            <div style="margin-top:4px;display:flex;justify-content:space-between;font-size:0.73rem">
              <span>ช่างใช้งาน <span style="font-size:0.65rem;color:var(--text-muted)">(ตัวอย่าง)</span></span>
              <strong style="color:var(--success)">${d.service.techUtilization}%</strong>
            </div>
          </div>

          <!-- Supply -->
          <div class="card" style="padding:14px">
            <div style="font-weight:700;font-size:0.82rem;margin-bottom:10px">🛒 Supply Chain</div>
            <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);font-size:0.78rem">
              <span style="color:var(--text-muted)">ซัพพลายเออร์ที่ใช้งานอยู่</span><strong>${d.supply.activeSuppliers}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);font-size:0.78rem">
              <span style="color:var(--text-muted)">PO เปิดอยู่</span><strong>${d.supply.openPOs}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);font-size:0.78rem">
              <span style="color:var(--text-muted)">ส่งล่าช้า</span><strong style="color:${d.supply.overdueDeliveries>0?'var(--danger)':'var(--success)'}">${d.supply.overdueDeliveries}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:0.78rem">
              <span style="color:var(--text-muted)">Lead time เฉลี่ย (ตามแผน)</span><strong>${d.supply.avgLeadTime} วัน</strong>
            </div>
            <div style="margin-top:6px;font-size:0.7rem;color:var(--text-muted)">มูลค่าอะไหล่คงคลัง ${formatCurrency(d.supply.partsStockValue)}</div>
          </div>

          <!-- Workforce -->
          <div class="card" style="padding:14px">
            <div style="font-weight:700;font-size:0.82rem;margin-bottom:10px">👥 HR</div>
            ${healthBar('ลงเวลาวันนี้', d.workforce.present, d.workforce.totalStaff, 'success')}
            <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);font-size:0.78rem">
              <span style="color:var(--text-muted)">Performance avg <span style="font-size:0.65rem">(ตัวอย่าง)</span></span><strong style="color:var(--success)">${d.workforce.avgPerformance}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);font-size:0.78rem">
              <span style="color:var(--text-muted)">ตำแหน่งว่าง <span style="font-size:0.65rem">(ตัวอย่าง)</span></span><strong style="color:${d.workforce.openPositions>0?'var(--warning)':'var(--success)'}">${d.workforce.openPositions}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:0.78rem">
              <span style="color:var(--text-muted)">Training ผ่าน <span style="font-size:0.65rem">(ตัวอย่าง)</span></span><strong>${d.workforce.trainingCompleted}%</strong>
            </div>
          </div>
        </div>
      </div>
    `
  }

  renderPage()
}

function opsKpi(title, value, color, sub) {
  return `<div class="kpi-card" style="padding:14px">
    <div class="kpi-title">${title}</div>
    <div class="kpi-value" style="color:var(--${color})">${value}</div>
    <div style="font-size:0.73rem;color:var(--text-muted);margin-top:2px">${sub}</div>
  </div>`
}

function healthBar(label, value, total, color) {
  const pct = total ? Math.round(value / total * 100) : 0
  return `<div style="margin-bottom:7px">
    <div style="display:flex;justify-content:space-between;font-size:0.73rem;margin-bottom:2px">
      <span style="color:var(--text-muted)">${label}</span><span style="font-weight:700">${value}</span>
    </div>
    <div style="background:var(--surface-2);border-radius:3px;height:5px">
      <div style="width:${pct}%;background:var(--${color});height:5px;border-radius:3px"></div>
    </div>
  </div>`
}
