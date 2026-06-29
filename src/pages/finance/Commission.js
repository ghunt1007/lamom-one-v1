import { listDocs, createDoc, updateDocData, seedDemoData, getCommissionData } from '../../core/db.js'
import { formatCurrency, formatDate } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { exportToExcel } from '../../utils/importExport.js'
import { printCommissionSlip } from '../../utils/payrollDocs.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const COMMISSION_RULES = {
  car_sale:   { label: '🚗 ขายรถ',    rate: 0.005  }, // 0.5% of sale price
  finance:    { label: '🏦 Finance',  rate: 0.02   }, // 2% of finance amount
  insurance:  { label: '🛡 ประกัน',   rate: 0.05   }, // 5% of premium
  accessory:  { label: '🔧 อุปกรณ์',  rate: 0.10   }, // 10% of accessory
}

const DEMO_COMMISSIONS = [
  { id:'c1', salesName:'อรนุช เซลส์ดี', month:'2025-03', carsSold:2, salePriceTotal:2778000, financeTotal:350000, insuranceTotal:63000, accessoryTotal:95000, status:'paid', paidAt:'2025-04-05' },
  { id:'c2', salesName:'วิชัย ขายเก่ง', month:'2025-03', carsSold:1, salePriceTotal:949000, financeTotal:95000, insuranceTotal:22000, accessoryTotal:15000, status:'pending', paidAt:'' },
  { id:'c3', salesName:'อรนุช เซลส์ดี', month:'2025-04', carsSold:1, salePriceTotal:1479000, financeTotal:200000, insuranceTotal:35000, accessoryTotal:60000, status:'pending', paidAt:'' },
  { id:'c4', salesName:'วิชัย ขายเก่ง', month:'2025-04', carsSold:1, salePriceTotal:769000, financeTotal:80000, insuranceTotal:18000, accessoryTotal:12000, status:'pending', paidAt:'' },
]

function calcComm(c) {
  const car = (c.salePriceTotal || 0) * COMMISSION_RULES.car_sale.rate
  const fin = (c.financeTotal || 0) * COMMISSION_RULES.finance.rate
  const ins = (c.insuranceTotal || 0) * COMMISSION_RULES.insurance.rate
  const acc = (c.accessoryTotal || 0) * COMMISSION_RULES.accessory.rate
  return { car, fin, ins, acc, total: car + fin + ins + acc }
}

export default async function CommissionPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let comms = []
  let monthFilter = 'all'

  async function loadData() {
    try { comms = await getCommissionData() } catch {}
    if (!comms.length) DEMO_COMMISSIONS.forEach(c => comms.push({ ...c }))
    applyFilter()
  }

  function getFiltered() {
    return comms.filter(c => monthFilter === 'all' || c.month === monthFilter)
  }

  function applyFilter() {
    renderSummary(); renderTable()
  }

  function renderSummary() {
    const filtered = getFiltered()
    const total = filtered.reduce((s, c) => s + calcComm(c).total, 0)
    const paid = filtered.filter(c => c.status === 'paid').reduce((s, c) => s + calcComm(c).total, 0)
    const pending = total - paid

    const el = document.getElementById('comm-summary')
    if (!el) return

    // Group by sales
    const bySales = {}
    filtered.forEach(c => {
      if (!bySales[c.salesName]) bySales[c.salesName] = { name: c.salesName, total: 0, paid: 0, cars: 0 }
      const comm = calcComm(c)
      bySales[c.salesName].total += comm.total
      bySales[c.salesName].cars += c.carsSold || 0
      if (c.status === 'paid') bySales[c.salesName].paid += comm.total
    })

    el.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;margin-bottom:20px">
        ${summCard('💰','ค่าคอมทั้งหมด', formatCurrency(total), 'accent')}
        ${summCard('✅','จ่ายแล้ว', formatCurrency(paid), 'success')}
        ${summCard('⏳','ค้างจ่าย', formatCurrency(pending), 'warning')}
        ${summCard('👥','จำนวนเซลส์', Object.keys(bySales).length + ' คน', 'primary')}
      </div>
      <!-- By Sales -->
      <div style="font-weight:600;margin-bottom:10px">📊 สรุปรายเซลส์</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px;margin-bottom:20px">
        ${Object.values(bySales).sort((a,b) => b.total - a.total).map(s => `
          <div class="card" style="padding:14px 16px">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
              <div style="font-weight:700">${escHtml(s.name)}</div>
              <span style="font-size:0.8rem;color:var(--text-muted)">${s.cars} คัน</span>
            </div>
            <div style="font-size:1.2rem;font-weight:800;color:var(--accent)">${formatCurrency(s.total)}</div>
            <div style="margin-top:8px;height:4px;background:var(--surface-2);border-radius:4px">
              <div style="height:4px;background:var(--success);border-radius:4px;width:${s.total ? Math.round((s.paid/s.total)*100) : 0}%"></div>
            </div>
            <div style="font-size:0.72rem;color:var(--text-muted);margin-top:4px">จ่ายแล้ว ${formatCurrency(s.paid)}</div>
          </div>
        `).join('')}
      </div>
    `
  }

  function renderTable() {
    const wrap = document.getElementById('comm-table')
    if (!wrap) return
    const filtered = getFiltered()

    if (!filtered.length) {
      wrap.innerHTML = `<div class="empty-state" style="padding:48px"><div class="empty-icon">🏆</div><div class="empty-title">ไม่มีข้อมูลค่าคอม</div></div>`
      return
    }

    wrap.innerHTML = `
      <div style="font-weight:600;margin-bottom:10px">📋 รายละเอียดค่าคอม</div>
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>เดือน</th><th>เซลส์</th><th>รถที่ขาย</th>
            <th>ค่าคอมรถ</th><th>ค่าคอม Finance</th><th>ค่าคอมประกัน</th><th>ค่าคอมอุปกรณ์</th>
            <th>รวม</th><th>สถานะ</th><th></th>
          </tr></thead>
          <tbody>${filtered.map(c => {
            const comm = calcComm(c)
            const isPaid = c.status === 'paid'
            return `
              <tr>
                <td style="font-weight:600;color:var(--primary)">${escHtml(c.month)}</td>
                <td style="font-weight:600">${escHtml(c.salesName)}</td>
                <td style="text-align:center">${c.carsSold || 0} คัน</td>
                <td>${formatCurrency(comm.car)}</td>
                <td>${formatCurrency(comm.fin)}</td>
                <td>${formatCurrency(comm.ins)}</td>
                <td>${formatCurrency(comm.acc)}</td>
                <td style="font-weight:700;font-size:1rem;color:var(--accent)">${formatCurrency(comm.total)}</td>
                <td>
                  <span class="badge badge-${isPaid ? 'success' : 'warning'}">${isPaid ? '✅ จ่ายแล้ว' : '⏳ รอจ่าย'}</span>
                  ${isPaid ? `<div style="font-size:0.7rem;color:var(--text-muted);margin-top:2px">${formatDate(c.paidAt)}</div>` : ''}
                </td>
                <td style="white-space:nowrap">
                  <button class="btn btn-secondary btn-sm slip-btn" data-id="${escHtml(c.id)}">🖨 สลิป</button>
                  ${!isPaid ? `<button class="btn btn-success btn-sm pay-btn" data-id="${escHtml(c.id)}">💳 จ่าย</button>` : ''}
                </td>
              </tr>`
          }).join('')}</tbody>
        </table>
      </div>
    `

    document.querySelectorAll('.pay-btn').forEach(btn => btn.addEventListener('click', async () => {
      const c = comms.find(x => x.id === btn.dataset.id)
      if (!c) return
      btn.disabled = true; btn.textContent = '...'
      const paidAt = new Date().toISOString().slice(0,10)
      try {
        await updateDocData('commissions', c.id, { status: 'paid', paidAt })
        c.status = 'paid'; c.paidAt = paidAt
        showToast(`✅ จ่ายค่าคอม ${c.salesName} แล้ว`, 'success'); applyFilter()
      } catch { btn.disabled=false; btn.textContent='💰 จ่าย'; showToast('เกิดข้อผิดพลาด','error') }
    }))
    document.querySelectorAll('.slip-btn').forEach(btn => btn.addEventListener('click', () => {
      const c = comms.find(x => x.id === btn.dataset.id)
      if (!c) return
      const comm = calcComm(c)
      printCommissionSlip({
        salesName: c.salesName, month: c.month, carsSold: c.carsSold, status: c.status, paidAt: c.paidAt,
        breakdown: [
          { label: COMMISSION_RULES.car_sale.label,  base: c.salePriceTotal, rate: COMMISSION_RULES.car_sale.rate,  amount: comm.car },
          { label: COMMISSION_RULES.finance.label,   base: c.financeTotal,   rate: COMMISSION_RULES.finance.rate,   amount: comm.fin },
          { label: COMMISSION_RULES.insurance.label, base: c.insuranceTotal, rate: COMMISSION_RULES.insurance.rate, amount: comm.ins },
          { label: COMMISSION_RULES.accessory.label, base: c.accessoryTotal, rate: COMMISSION_RULES.accessory.rate, amount: comm.acc },
        ],
        total: comm.total,
      })
    }))
  }

  const months = [...new Set(DEMO_COMMISSIONS.map(c => c.month))].sort().reverse()

  container.innerHTML = `
    <div class="page-content animate-slide">
      <div class="page-header">
        <div>
          <div class="page-title">🏆 ค่าคอมมิชชั่น</div>
          <div class="page-subtitle">ค่าคอมเซลส์ทุกช่องทาง</div>
        </div>
        <div class="page-actions">
          <button class="btn btn-secondary btn-sm" id="comm-export">📥 Export</button>
        </div>
      </div>

      <!-- Commission Rate Info -->
      <div class="card mb-4" style="padding:12px 16px">
        <div style="font-size:0.82rem;color:var(--text-muted);margin-bottom:6px">อัตราค่าคอม</div>
        <div style="display:flex;gap:16px;flex-wrap:wrap">
          ${Object.entries(COMMISSION_RULES).map(([k,v]) => `
            <div style="font-size:0.8rem"><span style="color:var(--text-2)">${v.label}</span> <span style="font-weight:700;color:var(--accent)">${(v.rate*100).toFixed(1)}%</span></div>
          `).join('')}
        </div>
      </div>

      <!-- Month filter -->
      <div class="card mb-4" style="padding:10px 16px">
        <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
          <span style="font-size:0.85rem;color:var(--text-muted)">เดือน:</span>
          <button class="btn btn-sm cf-btn btn-primary" data-mf="all">ทั้งหมด</button>
          ${months.map(m => `<button class="btn btn-sm cf-btn btn-secondary" data-mf="${m}">${m}</button>`).join('')}
        </div>
      </div>

      <div id="comm-summary">
        ${[...Array(2)].map(() => `<div class="skeleton" style="height:80px;border-radius:var(--radius-lg);margin-bottom:12px"></div>`).join('')}
      </div>
      <div id="comm-table">
        ${[...Array(3)].map(() => `<div class="skeleton" style="height:44px;border-radius:6px;margin-bottom:8px"></div>`).join('')}
      </div>
    </div>
  `

  document.querySelectorAll('.cf-btn').forEach(btn => btn.addEventListener('click', () => {
    monthFilter = btn.dataset.mf
    document.querySelectorAll('.cf-btn').forEach(b => b.className = `btn btn-sm cf-btn ${b.dataset.mf === monthFilter ? 'btn-primary' : 'btn-secondary'}`)
    applyFilter()
  }))
  document.getElementById('comm-export').addEventListener('click', () => {
    const filtered = getFiltered()
    exportToExcel(filtered.map(c => {
      const comm = calcComm(c)
      return { เดือน:c.month, เซลส์:c.salesName, รถที่ขาย:c.carsSold, ค่าคอมรถ:comm.car, ค่าคอมFinance:comm.fin, ค่าคอมประกัน:comm.ins, ค่าคอมอุปกรณ์:comm.acc, รวม:comm.total, สถานะ:c.status === 'paid' ? 'จ่ายแล้ว' : 'รอจ่าย', วันที่จ่าย:formatDate(c.paidAt) }
    }), `commission-${new Date().toISOString().slice(0,10)}.xlsx`, 'Commission')
    showToast('Export แล้ว', 'success')
  })

  if (container.__routerGen === myGen) await loadData()

  function getFiltered() {
    return comms.filter(c => monthFilter === 'all' || c.month === monthFilter)
  }
}

function summCard(icon, label, value, color) {
  return `<div class="card" style="padding:14px 16px;border-left:3px solid var(--${color})">
    <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:4px">${icon} ${label}</div>
    <div style="font-size:1.1rem;font-weight:800;color:var(--${color})">${value}</div>
  </div>`
}
