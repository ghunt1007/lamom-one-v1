import { formatDate } from '../../utils/format.js'
import { openModal, confirmDialog } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const CAR_STATUS = {
  available: { label: 'พร้อมให้ยืม', color: 'success' },
  loaned:    { label: 'ปล่อยยืม', color: 'warning' },
  service:   { label: 'เข้าซ่อม', color: 'danger' },
  cleaning:  { label: 'ทำความสะอาด', color: 'primary' },
}

export default async function LoanerCarPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let cars = []
  let loans = []
  let tab = 'fleet' // fleet | loans
  let loading = true

  async function loadData() {
    loading = true
    try {
      const [c, l] = await Promise.all([
        listDocs('loaner_cars', [], 'plate', 'asc', 200),
        listDocs('loaner_loans', [], 'loanDate', 'desc', 500),
      ])
      cars = c; loans = l
    } catch (e) { cars = []; loans = [] }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const avail = cars.filter(c => c.status === 'available').length
    const loaned = cars.filter(c => c.status === 'loaned').length
    const activeLoans = loans.filter(l => l.status === 'active')
    const overdue = activeLoans.filter(l => l.returnDate < new Date().toISOString().slice(0,10)).length

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🚙 Loaner Car</div>
            <div class="page-subtitle">จัดการรถสำรอง / รถให้ยืม</div>
          </div>
          <div class="page-actions">
            ${tab === 'loans' ? `<button class="btn btn-primary" id="new-loan-btn">➕ บันทึกยืมรถ</button>` : ''}
          </div>
        </div>

        <!-- KPI -->
        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:20px">
          ${kpi('🚙 รถทั้งหมด', cars.length, 'primary')}
          ${kpi('✅ พร้อมให้ยืม', avail, 'success')}
          ${kpi('📤 ปล่อยยืมอยู่', loaned, 'warning')}
          ${overdue > 0 ? kpi('⚠️ เกินกำหนด', overdue, 'danger') : kpi('📋 การยืมทั้งหมด', activeLoans.length, 'primary')}
        </div>

        <!-- Tabs -->
        <div style="display:flex;gap:4px;margin-bottom:16px">
          <button class="btn btn-sm ${tab==='fleet'?'btn-primary':'btn-secondary'} tab-btn" data-t="fleet">🚙 Fleet รถสำรอง</button>
          <button class="btn btn-sm ${tab==='loans'?'btn-primary':'btn-secondary'} tab-btn" data-t="loans">📋 ประวัติยืมรถ</button>
        </div>

        <!-- Content -->
        ${tab === 'fleet' ? renderFleet() : renderLoans()}
      </div>
    `

    document.querySelectorAll('.tab-btn').forEach(b => b.addEventListener('click', () => { tab = b.dataset.t; renderPage() }))
    document.getElementById('new-loan-btn')?.addEventListener('click', () => openLoanForm())
    document.querySelectorAll('.car-status-btn').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.stopPropagation()
        const car = cars.find(c => c.id === btn.dataset.id)
        if (!car) return
        car.status = btn.dataset.s
        renderPage()
        showToast('✅ อัพเดตแล้ว', 'success')
        try { await updateDocData('loaner_cars', car.id, { status: car.status }) } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      })
    })
    document.querySelectorAll('.return-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const loan = loans.find(l => l.id === btn.dataset.id)
        if (loan) openReturnForm(loan)
      })
    })
  }

  function renderFleet() {
    return `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px">
      ${cars.map(c => {
        const st = CAR_STATUS[c.status]
        return `<div class="card" style="padding:16px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
            <div>
              <div style="font-weight:700;font-size:0.9rem">${escHtml(c.model)}</div>
              <div style="font-size:0.78rem;color:var(--text-muted)">${escHtml(c.plate)} · ${escHtml(c.color)}</div>
            </div>
            <span class="badge badge-${st.color}">${st.label}</span>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:0.78rem;margin-bottom:10px">
            <div>⛽ ${c.fuel}</div>
            <div>📏 ${c.km.toLocaleString()} km</div>
            <div style="grid-column:1/-1">
              <div style="display:flex;justify-content:space-between;margin-bottom:2px"><span>เชื้อเพลิง</span><span>${c.fuelLevel}%</span></div>
              <div style="height:5px;background:var(--surface-3);border-radius:99px"><div style="height:100%;width:${c.fuelLevel}%;background:${c.fuelLevel>50?'var(--success)':c.fuelLevel>20?'var(--warning)':'var(--danger)'};border-radius:99px"></div></div>
            </div>
          </div>
          ${c.loanedTo ? `<div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:8px">👤 ยืมโดย: ${escHtml(c.loanedTo)}</div>` : ''}
          <div style="display:flex;gap:4px;flex-wrap:wrap">
            ${c.status === 'loaned' ? `<button class="btn btn-xs btn-success car-status-btn" data-id="${c.id}" data-s="available">คืนรถ</button>` : ''}
            ${c.status === 'available' ? `<button class="btn btn-xs btn-warning car-status-btn" data-id="${c.id}" data-s="service">ส่งซ่อม</button>` : ''}
            ${c.status === 'service' ? `<button class="btn btn-xs btn-success car-status-btn" data-id="${c.id}" data-s="available">ซ่อมเสร็จ</button>` : ''}
            ${c.status === 'cleaning' ? `<button class="btn btn-xs btn-success car-status-btn" data-id="${c.id}" data-s="available">สะอาดแล้ว</button>` : ''}
          </div>
        </div>`
      }).join('')}
    </div>`
  }

  function renderLoans() {
    const sorted = [...loans].sort((a, b) => b.loanDate.localeCompare(a.loanDate))
    return `<div class="card" style="padding:0;overflow:hidden">
      <table class="table">
        <thead><tr><th>ลูกค้า</th><th>รถสำรอง</th><th>Job Card</th><th>วันยืม</th><th>กำหนดคืน</th><th>สถานะ</th><th></th></tr></thead>
        <tbody>
          ${sorted.map(l => {
            const isOverdue = l.status === 'active' && l.returnDate < new Date().toISOString().slice(0,10)
            return `<tr>
              <td>
                <div style="font-weight:600;font-size:0.85rem">${escHtml(l.custName)}</div>
                <div style="font-size:0.75rem;color:var(--text-muted)">${escHtml(l.phone)}</div>
              </td>
              <td style="font-size:0.83rem">${escHtml(l.carModel)}<br><span style="font-size:0.73rem;color:var(--text-muted)">${escHtml(l.carPlate)}</span></td>
              <td style="font-size:0.8rem">${escHtml(l.jobCard)}</td>
              <td style="font-size:0.8rem">${escHtml(l.loanDate)}</td>
              <td style="font-size:0.8rem;color:${isOverdue?'var(--danger)':'inherit'}">${escHtml(l.returnDate)} ${isOverdue?'⚠️':''}</td>
              <td><span class="badge badge-${l.status==='returned'?'success':'warning'}">${l.status==='returned'?'คืนแล้ว':'กำลังยืม'}</span></td>
              <td>${l.status === 'active' ? `<button class="btn btn-xs btn-success return-btn" data-id="${l.id}">รับคืน</button>` : ''}</td>
            </tr>`
          }).join('')}
        </tbody>
      </table>
    </div>`
  }

  function openLoanForm() {
    const availCars = cars.filter(c => c.status === 'available')
    const today = new Date().toISOString().slice(0, 10)
    const { el, close } = openModal({
      title: '🚙 บันทึกการยืมรถ', size: 'md',
      body: `<div style="display:flex;flex-direction:column;gap:12px">
        <div class="grid-2">
          <div class="input-group"><label class="input-label">ลูกค้า *</label><input class="input" id="ll-cust" placeholder="ชื่อ-นามสกุล"></div>
          <div class="input-group"><label class="input-label">เบอร์โทร</label><input class="input" id="ll-phone" placeholder="08x-xxx-xxxx"></div>
        </div>
        <div class="grid-2">
          <div class="input-group"><label class="input-label">รถสำรอง *</label>
            <select class="input" id="ll-car">
              <option value="">-- เลือกรถ --</option>
              ${availCars.map(c => `<option value="${c.id}">${c.model} (${c.plate})</option>`).join('')}
            </select>
          </div>
          <div class="input-group"><label class="input-label">Job Card</label><input class="input" id="ll-job" placeholder="JOB-2025-xxx"></div>
        </div>
        <div class="grid-2">
          <div class="input-group"><label class="input-label">วันที่ยืม *</label><input class="input" type="date" id="ll-loan" value="${today}"></div>
          <div class="input-group"><label class="input-label">กำหนดคืน *</label><input class="input" type="date" id="ll-ret" value="${today}"></div>
        </div>
        <div class="grid-2">
          <div class="input-group"><label class="input-label">เชื้อเพลิงตอนออก (%)</label><input class="input" type="number" id="ll-fuel" min="0" max="100" value="100"></div>
          <div class="input-group"><label class="input-label">มัดจำ (฿)</label><input class="input" type="number" id="ll-dep" value="5000"></div>
        </div>
      </div>`,
      footer: `<button class="btn btn-secondary" id="ll-c">ยกเลิก</button><button class="btn btn-primary" id="ll-s">💾 บันทึก</button>`
    })
    el.querySelector('#ll-c').addEventListener('click', close)
    el.querySelector('#ll-s').addEventListener('click', async () => {
      const custName = el.querySelector('#ll-cust').value.trim()
      const carId = el.querySelector('#ll-car').value
      const loanDate = el.querySelector('#ll-loan').value
      const returnDate = el.querySelector('#ll-ret').value
      if (!custName || !carId || !loanDate || !returnDate) return showToast('❗ กรุณากรอกข้อมูลให้ครบ', 'warning')
      const car = cars.find(c => c.id === carId)
      if (!car) return
      try {
        await updateDocData('loaner_cars', car.id, { status: 'loaned', loanedTo: custName })
        await createDoc('loaner_loans', {
          carId, carPlate: car.plate, carModel: car.model,
          custName, phone: el.querySelector('#ll-phone').value,
          jobCard: el.querySelector('#ll-job').value,
          loanDate, returnDate, actualReturn: null,
          fuelOut: +el.querySelector('#ll-fuel').value, fuelIn: null,
          kmOut: car.km, kmIn: null, status: 'active',
          deposit: +el.querySelector('#ll-dep').value
        })
        showToast('🚙 บันทึกการยืมแล้ว', 'success'); close(); await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    })
  }

  function openReturnForm(loan) {
    const car = cars.find(c => c.id === loan.carId)
    const today = new Date().toISOString().slice(0, 10)
    const { el, close } = openModal({
      title: '🔄 รับรถคืน', size: 'sm',
      body: `<div style="display:flex;flex-direction:column;gap:12px">
        <div class="input-group"><label class="input-label">วันที่คืนจริง</label><input class="input" type="date" id="ret-date" value="${today}"></div>
        <div class="grid-2">
          <div class="input-group"><label class="input-label">เชื้อเพลิงตอนคืน (%)</label><input class="input" type="number" id="ret-fuel" min="0" max="100" value="${loan.fuelOut}"></div>
          <div class="input-group"><label class="input-label">เลขไมล์ตอนคืน</label><input class="input" type="number" id="ret-km" value="${car?.km||loan.kmOut}"></div>
        </div>
      </div>`,
      footer: `<button class="btn btn-secondary" id="ret-c">ยกเลิก</button><button class="btn btn-success" id="ret-s">✅ รับคืน</button>`
    })
    el.querySelector('#ret-c').addEventListener('click', close)
    el.querySelector('#ret-s').addEventListener('click', async () => {
      const actualReturn = el.querySelector('#ret-date').value
      const fuelIn = +el.querySelector('#ret-fuel').value
      const kmIn = +el.querySelector('#ret-km').value
      try {
        await updateDocData('loaner_loans', loan.id, { actualReturn, fuelIn, kmIn, status: 'returned' })
        if (car) await updateDocData('loaner_cars', car.id, { status: 'cleaning', km: kmIn, loanedTo: null })
        showToast('✅ รับรถคืนแล้ว', 'success'); close(); await loadData()
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    })
  }

  await loadData()
}

function kpi(title, value, color) {
  return `<div class="kpi-card"><div class="kpi-title">${title}</div><div class="kpi-value" style="color:var(--${color})">${value}</div></div>`
}
