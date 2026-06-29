/**
 * Operations Dashboard — ภาพรวมการดำเนินงาน
 * Route: /analytics/operations
 */
import { formatCurrency } from '../../utils/format.js'
import { listDocs } from '../../core/db.js'

const MONTHS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.']

// Operations metrics demo data
const OPS_DATA = {
  inventory: {
    totalVehicles: 48,
    available: 32,
    reserved: 8,
    inTransit: 6,
    onHold: 2,
    avgDaysInStock: 38,
    stockHealth: 82,
  },
  service: {
    totalJobs: 142,
    completed: 128,
    inProgress: 8,
    pending: 6,
    avgTurnaround: 2.3, // days
    csatScore: 4.6,
    techUtilization: 87, // %
  },
  supply: {
    activeSuppliers: 8,
    openPOs: 5,
    overdueDeliveries: 1,
    partsStockValue: 485000,
    avgLeadTime: 4.2, // days
  },
  workforce: {
    totalStaff: 18,
    present: 16,
    onLeave: 2,
    avgPerformance: 87.5,
    openPositions: 2,
    trainingCompleted: 72, // %
  },
}

const MONTHLY_THROUGHPUT = {
  vehiclesSold: [8,6,11,9,13,7],
  serviceJobs: [98,87,112,105,118,96],
  newLeads: [65,52,88,72,98,64],
}

const BOTTLENECKS = [
  { issue: 'ไม่มีสต็อกสี Cosmos Black BYD Seal', impact: 'high', dept: 'DMS', days: 5 },
  { issue: 'ช่างไฟ EV ติดงานเต็ม — คิว 3 คัน', impact: 'medium', dept: 'Service', days: 2 },
  { issue: 'รอเอกสารลูกค้าไฟแนนซ์ FA004', impact: 'medium', dept: 'Finance', days: 3 },
  { issue: 'Neta Parts ล่าช้ากว่า ETA 2 วัน', impact: 'low', dept: 'DMS', days: 2 },
]

export default async function OperationsDashboardPage(container) {
  const myGen = container.__routerGen
  const d = JSON.parse(JSON.stringify(OPS_DATA))

  try {
    const [vehicles, jobs] = await Promise.all([
      listDocs('vehicles', [], 'createdAt', 'desc', 500).catch(() => []),
      listDocs('job_cards', [], 'createdAt', 'desc', 500).catch(() => []),
    ])
    if (container.__routerGen !== myGen) return

    if (vehicles.length) {
      d.inventory.totalVehicles = vehicles.length
      d.inventory.available = vehicles.filter(v => v.status === 'พร้อมขาย' || v.status === 'available').length
      d.inventory.reserved = vehicles.filter(v => v.status === 'จอง' || v.status === 'reserved').length
      d.inventory.inTransit = vehicles.filter(v => v.status === 'กำลังขนส่ง' || v.status === 'transit').length
      d.inventory.onHold = vehicles.filter(v => v.status === 'พักไว้' || v.status === 'hold').length
    }

    if (jobs.length) {
      d.service.totalJobs = jobs.length
      d.service.completed = jobs.filter(j => j.status === 'เสร็จแล้ว' || j.status === 'completed' || j.status === 'done').length
      d.service.inProgress = jobs.filter(j => j.status === 'กำลังซ่อม' || j.status === 'in_progress' || j.status === 'กำลังดำเนินการ').length
      d.service.pending = jobs.filter(j => j.status === 'รอ' || j.status === 'pending').length
    }
  } catch {}

  function renderPage() {
    const chartMax = Math.max(...MONTHLY_THROUGHPUT.vehiclesSold)
    const svcMax = Math.max(...MONTHLY_THROUGHPUT.serviceJobs)

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
          ${opsKpi('⭐ CSAT', d.service.csatScore + '/5.0', 'warning', 'จาก Service')}
          ${opsKpi('👥 พนักงานวันนี้', d.workforce.present + '/' + d.workforce.totalStaff, 'primary', 'ลา ' + d.workforce.onLeave + ' คน')}
        </div>

        <!-- Main grid -->
        <div style="display:grid;grid-template-columns:2fr 1fr;gap:16px;margin-bottom:16px">
          <!-- Sales & Service trend -->
          <div class="card" style="padding:14px">
            <div style="font-weight:700;font-size:0.85rem;margin-bottom:12px">📈 Throughput H1 2025</div>
            <div style="display:flex;align-items:flex-end;gap:5px;height:80px;border-bottom:1px solid var(--border);margin-bottom:6px">
              ${MONTHS.map((m, i) => {
                const s = MONTHLY_THROUGHPUT.vehiclesSold[i]
                const h = Math.max(4, Math.round(s / chartMax * 80))
                return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px">
                  <div style="font-size:0.58rem;color:var(--text-muted)">${s}</div>
                  <div style="width:100%;height:${h}px;background:var(--primary);border-radius:2px 2px 0 0;opacity:0.85"></div>
                </div>`
              }).join('')}
            </div>
            <div style="display:flex;gap:0">
              ${MONTHS.map(m => `<div style="flex:1;text-align:center;font-size:0.62rem;color:var(--text-muted)">${m}</div>`).join('')}
            </div>
            <div style="font-size:0.72rem;color:var(--primary);margin-top:4px">🚗 ยอดขายรถ (คัน)</div>
          </div>

          <!-- Bottlenecks -->
          <div class="card" style="padding:14px">
            <div style="font-weight:700;font-size:0.85rem;margin-bottom:10px">⚠️ Bottlenecks</div>
            ${BOTTLENECKS.map(b => `
              <div style="display:flex;align-items:flex-start;gap:8px;padding:7px 0;border-bottom:1px solid var(--border)">
                <span style="font-size:0.7rem;padding:2px 6px;border-radius:3px;background:var(--${b.impact==='high'?'danger':b.impact==='medium'?'warning':'secondary'}-dim,var(--surface-2));color:var(--${b.impact==='high'?'danger':b.impact==='medium'?'warning':'text-muted'});flex-shrink:0">${b.impact.toUpperCase()}</span>
                <div style="flex:1">
                  <div style="font-size:0.77rem;line-height:1.4">${b.issue}</div>
                  <div style="font-size:0.68rem;color:var(--text-muted)">${b.dept} · ${b.days} วัน</div>
                </div>
              </div>
            `).join('')}
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
            <div style="margin-top:8px;font-size:0.75rem;color:var(--text-muted)">Turnaround ${d.service.avgTurnaround} วัน</div>
            <div style="margin-top:4px;display:flex;justify-content:space-between;font-size:0.73rem">
              <span>ช่างใช้งาน</span>
              <strong style="color:var(--success)">${d.service.techUtilization}%</strong>
            </div>
          </div>

          <!-- Supply -->
          <div class="card" style="padding:14px">
            <div style="font-weight:700;font-size:0.82rem;margin-bottom:10px">🛒 Supply Chain</div>
            <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);font-size:0.78rem">
              <span style="color:var(--text-muted)">ซัพพลายเออร์</span><strong>${d.supply.activeSuppliers}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);font-size:0.78rem">
              <span style="color:var(--text-muted)">PO เปิดอยู่</span><strong>${d.supply.openPOs}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);font-size:0.78rem">
              <span style="color:var(--text-muted)">ส่งล่าช้า</span><strong style="color:${d.supply.overdueDeliveries>0?'var(--danger)':'var(--success)'}">${d.supply.overdueDeliveries}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:0.78rem">
              <span style="color:var(--text-muted)">Lead time avg</span><strong>${d.supply.avgLeadTime} วัน</strong>
            </div>
          </div>

          <!-- Workforce -->
          <div class="card" style="padding:14px">
            <div style="font-weight:700;font-size:0.82rem;margin-bottom:10px">👥 HR</div>
            ${healthBar('มาทำงาน', d.workforce.present, d.workforce.totalStaff, 'success')}
            <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);font-size:0.78rem">
              <span style="color:var(--text-muted)">Performance avg</span><strong style="color:var(--success)">${d.workforce.avgPerformance}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);font-size:0.78rem">
              <span style="color:var(--text-muted)">ตำแหน่งว่าง</span><strong style="color:${d.workforce.openPositions>0?'var(--warning)':'var(--success)'}">${d.workforce.openPositions}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:0.78rem">
              <span style="color:var(--text-muted)">Training ผ่าน</span><strong>${d.workforce.trainingCompleted}%</strong>
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
