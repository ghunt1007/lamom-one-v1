import { listDocs, createDoc, updateDocData, seedDemoData, getCommissionData, getSalesData } from '../../core/db.js'
import { formatCurrency, formatDate } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { exportToExcel } from '../../utils/importExport.js'
import { printCommissionSlip } from '../../utils/payrollDocs.js'
import { calcCommission, loadOrSeedRules } from './CommissionRules.js'
import { navigate } from '../../core/router.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const DEMO_COMMISSIONS = [
  { id:'c1', salesName:'อรนุช เซลส์ดี', month:'2025-03', carsSold:2, salePriceTotal:2778000, financeTotal:350000, insuranceTotal:63000, accessoryTotal:95000, status:'paid', paidAt:'2025-04-05' },
  { id:'c2', salesName:'วิชัย ขายเก่ง', month:'2025-03', carsSold:1, salePriceTotal:949000, financeTotal:95000, insuranceTotal:22000, accessoryTotal:15000, status:'pending', paidAt:'' },
  { id:'c3', salesName:'อรนุช เซลส์ดี', month:'2025-04', carsSold:1, salePriceTotal:1479000, financeTotal:200000, insuranceTotal:35000, accessoryTotal:60000, status:'pending', paidAt:'' },
  { id:'c4', salesName:'วิชัย ขายเก่ง', month:'2025-04', carsSold:1, salePriceTotal:769000, financeTotal:80000, insuranceTotal:18000, accessoryTotal:12000, status:'pending', paidAt:'' },
]

export default async function CommissionPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let comms = []
  let monthFilter = 'all'
  let rules = []       // กติกาจริงจาก commission_rules (ตั้งค่าได้ที่หน้า Commission Rules)
  let salesRows = []    // ใบจองจริงทั้งหมด — ใช้หา premiumUnits/overFloor ต่อเซลส์+เดือน (กติกา bonus/percent-over-floor ต้องใช้ระดับรายคัน ไม่ใช่ยอดรวมเดือน)
  let isDemoData = false

  // เดิมหน้านี้จ่ายค่าคอมจริงด้วยอัตราคงที่ในไฟล์นี้เอง (0.5%/2%/5%/10%) แยกขาดจากกติกาที่ตั้งค่าได้จริงใน
  // CommissionRules.js โดยสิ้นเชิง — เจ้าของระบบยืนยันให้เปลี่ยนมาใช้กติกาจาก CommissionRules.js เป็นทางการ
  // (v1.0.358) เพราะแต่ละบริษัทมีสูตรจ่ายจริงต่างกัน (ค่ารายคัน/ขั้นบันได/โบนัส Premium/% กำไรส่วนเกิน floor/
  // %ไฟแนนซ์/%ประกัน/%อุปกรณ์) — ดูฟังก์ชัน calcCommission() ที่ CommissionRules.js สำหรับตรรกะเต็ม
  function calcComm(c) {
    const [name, month] = [c.salesName, c.month]
    let premiumUnits = 0, overFloor = 0
    salesRows.forEach(s => {
      if (s.salesName !== name || !(s.date || '').startsWith(month)) return
      const model = (s.model || '').toLowerCase()
      if (model.includes('seal') || model.includes('han') || model.includes('atto')) premiumUnits++
      overFloor += Math.max(0, (s.salePrice || 0) - (s.floor || s.cost || s.salePrice || 0))
    })
    const { total, breakdownRows } = calcCommission({
      units: c.carsSold || 0, premiumUnits, overFloor,
      saleTotal: c.salePriceTotal || 0, financeTotal: c.financeTotal || 0,
      insuranceTotal: c.insuranceTotal || 0, accessoryTotal: c.accessoryTotal || 0,
    }, rules)
    return { total, breakdown: breakdownRows }
  }

  async function loadData() {
    try {
      const [c, r, s] = await Promise.all([getCommissionData(), loadOrSeedRules(), getSalesData()])
      comms = c; rules = r; salesRows = s
    } catch {}
    isDemoData = !comms.length
    if (isDemoData) DEMO_COMMISSIONS.forEach(c => comms.push({ ...c }))
    applyFilter()
  }

  function getFiltered() {
    return comms.filter(c => monthFilter === 'all' || c.month === monthFilter)
  }

  function applyFilter() {
    renderSummary(); renderTable(); renderMonthFilter()
  }

  function renderSummary() {
    const filtered = getFiltered()
    const total = filtered.reduce((s, c) => s + calcComm(c).total, 0)
    const paid = filtered.filter(c => c.status === 'paid').reduce((s, c) => s + calcComm(c).total, 0)
    const pending = total - paid

    const el = document.getElementById('comm-summary')
    const demoEl = document.getElementById('comm-demo-indicator')
    if (demoEl) demoEl.textContent = isDemoData ? '⚠️ ข้อมูลตัวอย่าง (ยังไม่มีค่าคอมจริงในระบบ)' : ''
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

    // เดิมตารางนี้มี 4 คอลัมน์ค่าคอมตายตัว (รถ/Finance/ประกัน/อุปกรณ์) เพราะสูตรเดิมมีแค่ 4 หมวดคงที่ — ตอนนี้
    // กติกาจริงจาก CommissionRules.js ปรับได้ (เปิด/ปิด/เพิ่มกติกาเองได้) ทำให้จำนวนรายการต่อคนไม่คงที่แล้ว จึง
    // ย่อเหลือ "รวม" คอลัมน์เดียว ส่วนรายละเอียดเต็มดูได้จากปุ่ม "🖨 สลิป" (รองรับรายการไม่จำกัดจำนวนอยู่แล้ว)
    wrap.innerHTML = `
      <div style="font-weight:600;margin-bottom:10px">📋 รายละเอียดค่าคอม</div>
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>เดือน</th><th>เซลส์</th><th>รถที่ขาย</th><th>รวม</th><th>สถานะ</th><th></th>
          </tr></thead>
          <tbody>${filtered.map(c => {
            const comm = calcComm(c)
            const isPaid = c.status === 'paid'
            return `
              <tr>
                <td style="font-weight:600;color:var(--primary)">${escHtml(c.month)}</td>
                <td style="font-weight:600">${escHtml(c.salesName)}</td>
                <td style="text-align:center">${c.carsSold || 0} คัน</td>
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
        breakdown: comm.breakdown.length ? comm.breakdown : [{ label: 'ไม่มีกติกาคอมมิชชั่นที่ใช้งานอยู่ (ตั้งค่าได้ที่หน้า Commission Rules)', amount: 0 }],
        total: comm.total,
      })
    }))
  }

  container.innerHTML = `
    <div class="page-content animate-slide">
      <div class="page-header">
        <div>
          <div class="page-title">🏆 ค่าคอมมิชชั่น</div>
          <div style="display:flex;gap:10px;align-items:center">
            <div class="page-subtitle">ค่าคอมเซลส์ทุกช่องทาง</div>
            <span style="font-size:0.76rem;color:var(--warning);font-weight:600" id="comm-demo-indicator"></span>
          </div>
        </div>
        <div class="page-actions">
          <button class="btn btn-secondary btn-sm" id="comm-export">📥 Export</button>
        </div>
      </div>

      <!-- Commission Rate Info — ดึงจากกติกาจริงที่ตั้งค่าได้ที่หน้า Commission Rules (v1.0.358) -->
      <div class="card mb-4" style="padding:12px 16px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <div style="font-size:0.82rem;color:var(--text-muted)">กติกาคอมมิชชั่นที่ใช้งานอยู่</div>
          <button class="btn btn-ghost btn-xs" id="comm-goto-rules" style="font-size:0.72rem;color:var(--primary)">⚙️ ตั้งค่ากติกา →</button>
        </div>
        <div style="display:flex;gap:16px;flex-wrap:wrap">
          ${rules.filter(r => r.active).length ? rules.filter(r => r.active).map(r => `
            <div style="font-size:0.8rem"><span style="color:var(--text-2)">${escHtml(r.name)}</span> <span style="font-weight:700;color:var(--accent)">${r.type === 'tiered' ? 'ขั้นบันได' : r.type === 'percent' ? (r.value || 0) + '%' : formatCurrency(r.value || 0)}</span></div>
          `).join('') : '<div style="font-size:0.8rem;color:var(--warning)">⚠️ ยังไม่มีกติกาที่เปิดใช้งาน — ค่าคอมจะเป็น 0 ทุกรายการ</div>'}
        </div>
      </div>

      <!-- Month filter -->
      <div class="card mb-4" style="padding:10px 16px">
        <div id="comm-monthfilter" style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
          <span style="font-size:0.85rem;color:var(--text-muted)">เดือน:</span>
          <button class="btn btn-sm cf-btn btn-primary" data-mf="all">ทั้งหมด</button>
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

  // เดิมปุ่มกรองเดือนสร้างจาก DEMO_COMMISSIONS.map(c=>c.month) ตายตัว (คำนวณก่อน loadData() รันเสร็จด้วยซ้ำ)
  // ทำให้ปุ่มเดือนไม่ตรงกับข้อมูลค่าคอมจริงที่โหลดมาเลย แก้ให้สร้างจากเดือนของ comms (ข้อมูลจริงที่โหลดแล้ว)
  // เรียกใหม่ทุกครั้งหลัง loadData() เผื่อเดือนที่มีข้อมูลเปลี่ยน
  function renderMonthFilter() {
    const wrap = document.getElementById('comm-monthfilter')
    if (!wrap) return
    const months = [...new Set(comms.map(c => c.month))].filter(Boolean).sort().reverse()
    wrap.innerHTML = `
      <span style="font-size:0.85rem;color:var(--text-muted)">เดือน:</span>
      <button class="btn btn-sm cf-btn ${monthFilter==='all'?'btn-primary':'btn-secondary'}" data-mf="all">ทั้งหมด</button>
      ${months.map(m => `<button class="btn btn-sm cf-btn ${monthFilter===m?'btn-primary':'btn-secondary'}" data-mf="${escHtml(m)}">${escHtml(m)}</button>`).join('')}
    `
    wrap.querySelectorAll('.cf-btn').forEach(btn => btn.addEventListener('click', () => {
      monthFilter = btn.dataset.mf
      renderMonthFilter()
      applyFilter()
    }))
  }

  document.getElementById('comm-export').addEventListener('click', () => {
    const filtered = getFiltered()
    // เดิม export คอลัมน์ค่าคอมแยก 4 หมวดคงที่ (รถ/Finance/ประกัน/อุปกรณ์) ตอนนี้กติกาจริงปรับได้ไม่จำกัด
    // จำนวนหมวดแล้ว จึง export ยอดรวมสุทธิ + ตัวเลขฐานคำนวณจริงแทน (ดูรายละเอียดต่อรายการได้จากใบสลิป)
    exportToExcel(filtered.map(c => {
      const comm = calcComm(c)
      return { เดือน:c.month, เซลส์:c.salesName, รถที่ขาย:c.carsSold, ยอดขายรถ:c.salePriceTotal, ยอดจัดไฟแนนซ์:c.financeTotal, ยอดขายประกัน:c.insuranceTotal, ยอดขายอุปกรณ์:c.accessoryTotal, ค่าคอมรวมสุทธิ:comm.total, สถานะ:c.status === 'paid' ? 'จ่ายแล้ว' : 'รอจ่าย', วันที่จ่าย:formatDate(c.paidAt) }
    }), `commission-${new Date().toISOString().slice(0,10)}.xlsx`, 'Commission')
    showToast('Export แล้ว', 'success')
  })
  document.getElementById('comm-goto-rules')?.addEventListener('click', () => navigate('/finance/commission-rules'))

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
