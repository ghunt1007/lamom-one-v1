import { formatDate } from '../../utils/format.js'
import { openModal, confirmDialog } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const CAR_STATUS = {
  available: { label: 'พร้อมให้ยืม', color: 'success' },
  loaned:    { label: 'ปล่อยยืม', color: 'warning' },
  service:   { label: 'เข้าซ่อม', color: 'danger' },
  cleaning:  { label: 'ทำความสะอาด', color: 'primary' },
}

const DEMO_CARS = [
  { id:'LC001', plate:'กท-9001 กทม.', model:'Toyota Yaris 2022', color:'ขาว', fuel:'เบนซิน', fuelLevel:80, km:45200, status:'available', note:'' },
  { id:'LC002', plate:'กท-9002 กทม.', model:'Honda City 2023', color:'เงิน', fuel:'เบนซิน', fuelLevel:60, km:32100, status:'loaned', loanedTo:'สมชาย ใจดี', loanDate:'2025-06-07', returnDate:'2025-06-10', note:'คืนด้วยน้ำมันเต็มถัง' },
  { id:'LC003', plate:'กท-9003 กทม.', model:'Isuzu D-Max 2021', color:'เทา', fuel:'ดีเซล', fuelLevel:40, km:68900, status:'service', note:'เช็กระยะตามกำหนด' },
  { id:'LC004', plate:'กท-9004 กทม.', model:'Toyota Yaris 2023', color:'ดำ', fuel:'เบนซิน', fuelLevel:100, km:12000, status:'cleaning', note:'' },
]

const DEMO_LOANS = [
  { id:'LL001', carId:'LC002', carPlate:'กท-9002 กทม.', carModel:'Honda City 2023', custName:'สมชาย ใจดี', phone:'0812345678', jobCard:'JOB-2025-001', loanDate:'2025-06-07', returnDate:'2025-06-10', actualReturn:null, fuelOut:60, fuelIn:null, kmOut:32100, kmIn:null, status:'active', deposit:5000 },
  { id:'LL002', carId:'LC001', carPlate:'กท-9001 กทม.', carModel:'Toyota Yaris 2022', custName:'วิชัย เดินดี', phone:'0834567890', jobCard:'JOB-2025-002', loanDate:'2025-06-01', returnDate:'2025-06-05', actualReturn:'2025-06-05', fuelOut:80, fuelIn:75, kmOut:44800, kmIn:45200, status:'returned', deposit:5000 },
]

export default async function LoanerCarPage(container) {
  let cars = DEMO_CARS.map(c => ({ ...c }))
  let loans = DEMO_LOANS.map(l => ({ ...l }))
  let tab = 'fleet' // fleet | loans

  function renderPage() {
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
      btn.addEventListener('click', e => {
        e.stopPropagation()
        const car = cars.find(c => c.id === btn.dataset.id)
        if (car) { car.status = btn.dataset.s; showToast('✅ อัพเดตแล้ว', 'success'); renderPage() }
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
    el.querySelector('#ll-s').addEventListener('click', () => {
      const custName = el.querySelector('#ll-cust').value.trim()
      const carId = el.querySelector('#ll-car').value
      const loanDate = el.querySelector('#ll-loan').value
      const returnDate = el.querySelector('#ll-ret').value
      if (!custName || !carId || !loanDate || !returnDate) return showToast('❗ กรุณากรอกข้อมูลให้ครบ', 'warning')
      const car = cars.find(c => c.id === carId)
      car.status = 'loaned'; car.loanedTo = custName
      loans.push({
        id: 'LL' + Date.now(), carId, carPlate: car.plate, carModel: car.model,
        custName, phone: el.querySelector('#ll-phone').value,
        jobCard: el.querySelector('#ll-job').value,
        loanDate, returnDate, actualReturn: null,
        fuelOut: +el.querySelector('#ll-fuel').value, fuelIn: null,
        kmOut: car.km, kmIn: null, status: 'active',
        deposit: +el.querySelector('#ll-dep').value
      })
      showToast('🚙 บันทึกการยืมแล้ว', 'success'); close(); renderPage()
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
    el.querySelector('#ret-s').addEventListener('click', () => {
      loan.actualReturn = el.querySelector('#ret-date').value
      loan.fuelIn = +el.querySelector('#ret-fuel').value
      loan.kmIn = +el.querySelector('#ret-km').value
      loan.status = 'returned'
      if (car) { car.status = 'cleaning'; car.km = loan.kmIn; delete car.loanedTo }
      showToast('✅ รับรถคืนแล้ว', 'success'); close(); renderPage()
    })
  }

  renderPage()
}

function kpi(title, value, color) {
  return `<div class="kpi-card"><div class="kpi-title">${title}</div><div class="kpi-value" style="color:var(--${color})">${value}</div></div>`
}
