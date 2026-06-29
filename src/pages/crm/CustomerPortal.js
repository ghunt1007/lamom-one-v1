import { formatCurrency, formatDate, timeAgo } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'

// Demo customer view - simulates what a customer sees after login
const DEMO_CUSTOMER = {
  name: 'สมศักดิ์ เจริญสุข',
  phone: '0812345678',
  email: 'somsak@email.com',
  vehicles: [
    { id:'V001', plate:'กข-5678 กทม.', model:'BYD Seal AWD', color:'ขาว', year:2025, vin:'LSVNX21D4PA000001', purchaseDate:'2025-06-02', warrantyExpiry:'2028-06-02' },
  ],
  jobs: [
    { id:'J001', no:'JOB-2025-001', plate:'กข-5678 กทม.', model:'BYD Seal AWD', type:'เช็กระยะ 10,000 km', status:'done', date:'2025-05-15', doneDate:'2025-05-15', cost:2800, tech:'วิชัย ช่างดี', note:'เปลี่ยนน้ำมันเครื่อง + filter' },
    { id:'J002', no:'JOB-2025-002', plate:'กข-5678 กทม.', model:'BYD Seal AWD', type:'ตรวจสภาพก่อน summer', status:'inprogress', date:'2025-06-09', doneDate:null, cost:null, tech:'ธนา ซ่อมเก่ง', note:'' },
  ],
  insurance: [
    { id:'I001', company:'AXA Smile', type:'ชั้น 1', premium:18500, startDate:'2025-06-02', endDate:'2026-06-01', plate:'กข-5678 กทม.' },
  ],
  documents: [
    { id:'D001', type:'invoice', no:'INV-2025-001', amount:1299000, date:'2025-06-02', status:'paid' },
    { id:'D002', type:'receipt', no:'REC-2025-001', amount:1299000, date:'2025-06-02', status:'paid' },
  ],
  nextService: { date:'2025-09-02', km:20000, type:'เช็กระยะ 20,000 km' },
}

const JOB_STATUS = {
  pending:    { label: 'รอดำเนินการ', color: 'primary', icon: '⏳' },
  inprogress: { label: 'กำลังซ่อม', color: 'warning', icon: '🔧' },
  done:       { label: 'เสร็จแล้ว', color: 'success', icon: '✅' },
  waiting:    { label: 'รอรับรถ', color: 'primary', icon: '🚗' },
}

export default async function CustomerPortalPage(container) {
  const cust = DEMO_CUSTOMER
  let tab = 'home'

  function renderPage() {
    const activeJob = cust.jobs.find(j => j.status === 'inprogress' || j.status === 'waiting')

    container.innerHTML = `
      <div class="page-content animate-slide">
        <!-- Portal Header -->
        <div style="background:linear-gradient(135deg,var(--primary),var(--accent));padding:24px 20px;border-radius:var(--radius-lg);margin-bottom:20px;color:white">
          <div style="display:flex;align-items:center;gap:14px">
            <div style="width:52px;height:52px;border-radius:50%;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;font-size:1.4rem">👤</div>
            <div>
              <div style="font-size:1.1rem;font-weight:700">สวัสดีคุณ ${cust.name}</div>
              <div style="opacity:0.85;font-size:0.82rem">${cust.phone} · ${cust.email}</div>
            </div>
          </div>
          ${activeJob ? `<div style="margin-top:14px;background:rgba(255,255,255,0.15);padding:10px 14px;border-radius:var(--radius-sm)">
            <div style="font-size:0.8rem;opacity:0.85;margin-bottom:2px">🔧 งานที่กำลังดำเนินการ</div>
            <div style="font-weight:700">${activeJob.no} — ${activeJob.type}</div>
            <div style="font-size:0.78rem;opacity:0.85">ช่าง: ${activeJob.tech}</div>
          </div>` : ''}
        </div>

        <!-- Quick tabs -->
        <div style="display:flex;gap:4px;margin-bottom:16px;overflow-x:auto">
          ${[['home','🏠 ภาพรวม'],['vehicles','🚗 รถของฉัน'],['service','🔧 งานซ่อม'],['docs','📄 เอกสาร'],['insurance','🛡 ประกัน'],['book','📅 นัดซ่อม']].map(([t,l]) => `<button class="btn btn-sm ${tab===t?'btn-primary':'btn-secondary'} tab-btn" data-t="${t}" style="white-space:nowrap">${l}</button>`).join('')}
        </div>

        ${tab === 'home' ? renderHome(cust) : tab === 'vehicles' ? renderVehicles(cust) : tab === 'service' ? renderService(cust) : tab === 'docs' ? renderDocs(cust) : tab === 'insurance' ? renderInsurance(cust) : renderBooking()}
      </div>
    `

    document.querySelectorAll('.tab-btn').forEach(b => b.addEventListener('click', () => { tab = b.dataset.t; renderPage() }))
    document.getElementById('book-submit')?.addEventListener('click', () => {
      showToast('📅 ส่งคำขอนัดหมายแล้ว ทีมงานจะติดต่อยืนยัน', 'success')
    })
    container.querySelectorAll('.dl-btn').forEach(btn => btn.addEventListener('click', () => {
      const doc = cust.documents.find(d => d.id === btn.dataset.id)
      if (!doc) return
      const typeLabel = { invoice:'ใบแจ้งหนี้', receipt:'ใบเสร็จรับเงิน', tax_invoice:'ใบกำกับภาษี' }[doc.type] || doc.type
      openModal({
        title: `📄 ${typeLabel} — ${doc.no}`,
        size: 'sm',
        body: `
          <div style="font-size:0.82rem">
            <div style="text-align:center;padding:20px 0;border-bottom:1px solid var(--border);margin-bottom:14px">
              <div style="font-size:2rem;margin-bottom:6px">📄</div>
              <div style="font-weight:700;font-size:1rem">${typeLabel}</div>
              <div style="font-size:0.76rem;color:var(--text-muted);margin-top:2px">${doc.no}</div>
            </div>
            <div style="display:flex;flex-direction:column;gap:8px">
              <div style="display:flex;justify-content:space-between"><span style="color:var(--text-muted)">วันที่</span><span>${doc.date}</span></div>
              <div style="display:flex;justify-content:space-between"><span style="color:var(--text-muted)">ลูกค้า</span><span>${cust.name}</span></div>
              <div style="display:flex;justify-content:space-between"><span style="color:var(--text-muted)">รายการ</span><span>${cust.vehicles[0]?.model || '-'}</span></div>
              <div style="display:flex;justify-content:space-between;border-top:1px solid var(--border);padding-top:8px;margin-top:4px">
                <span style="font-weight:700">จำนวนเงิน</span>
                <span style="font-weight:700;color:var(--primary);font-size:1rem">${formatCurrency(doc.amount)}</span>
              </div>
              <div style="display:flex;justify-content:space-between"><span style="color:var(--text-muted)">สถานะ</span><span style="color:var(--success);font-weight:600">✅ ชำระแล้ว</span></div>
            </div>
            <button class="btn btn-primary" style="width:100%;margin-top:16px" onclick="window.__portalDownload?.('${doc.no}')">⬇️ ดาวน์โหลด PDF</button>
          </div>
        `
      })
      window.__portalDownload = (no) => {
        document.querySelector('.modal-overlay')?.remove()
        showToast('📄 ดาวน์โหลด ' + no + ' แล้ว', 'success')
      }
    }))
  }

  function renderHome(c) {
    const ns = c.nextService
    return `
      <div style="display:flex;flex-direction:column;gap:12px">
        <!-- Next service reminder -->
        ${ns ? `<div style="background:var(--warning-dim);border:1px solid var(--warning);border-radius:var(--radius-md);padding:14px 16px">
          <div style="font-weight:700;color:var(--warning);margin-bottom:4px">⏰ ถึงเวลาเช็กระยะแล้ว</div>
          <div style="font-size:0.85rem">${ns.type} ที่ ${ns.km.toLocaleString()} km</div>
          <div style="font-size:0.78rem;color:var(--text-muted)">กำหนด: ${ns.date}</div>
          <button class="btn btn-sm btn-warning" style="margin-top:8px" onclick="document.querySelector('[data-t=book]').click()">📅 นัดซ่อมเลย</button>
        </div>` : ''}

        <!-- Vehicle summary -->
        ${c.vehicles.map(v => `<div class="card" style="padding:16px">
          <div style="font-weight:700;margin-bottom:4px">🚗 ${v.model}</div>
          <div style="font-size:0.82rem;color:var(--text-muted);display:grid;grid-template-columns:1fr 1fr;gap:4px">
            <div>ทะเบียน: ${v.plate}</div>
            <div>สี: ${v.color}</div>
            <div>ปี: ${v.year}</div>
            <div>รับประกัน: ${v.warrantyExpiry}</div>
          </div>
        </div>`).join('')}

        <!-- Stats -->
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">
          ${miniStat('🔧 งานซ่อม', c.jobs.length + ' ครั้ง')}
          ${miniStat('🛡 ประกันภัย', c.insurance.length + ' กรมธรรม์')}
          ${miniStat('📄 เอกสาร', c.documents.length + ' ฉบับ')}
        </div>
      </div>
    `
  }

  function renderVehicles(c) {
    return c.vehicles.map(v => `
      <div class="card" style="padding:20px">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
          <div style="font-size:2.5rem">🚗</div>
          <div>
            <div style="font-size:1.1rem;font-weight:700">${v.model}</div>
            <div style="font-size:0.8rem;color:var(--text-muted)">${v.plate} · ${v.color} · ปี ${v.year}</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:0.83rem">
          <div><div style="color:var(--text-muted);font-size:0.72rem;margin-bottom:2px">VIN</div><div style="font-family:monospace">${v.vin}</div></div>
          <div><div style="color:var(--text-muted);font-size:0.72rem;margin-bottom:2px">วันที่รับรถ</div><div>${v.purchaseDate}</div></div>
          <div><div style="color:var(--text-muted);font-size:0.72rem;margin-bottom:2px">รับประกัน</div><div style="color:var(--success);font-weight:600">ถึง ${v.warrantyExpiry}</div></div>
        </div>
      </div>
    `).join('')
  }

  function renderService(c) {
    return `<div style="display:flex;flex-direction:column;gap:10px">
      ${c.jobs.map(j => {
        const st = JOB_STATUS[j.status]
        return `<div class="card" style="padding:16px;${j.status==='inprogress'?'border-left:3px solid var(--warning)':''}">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:8px">
            <div>
              <div style="font-weight:700;font-size:0.9rem">${j.no}</div>
              <div style="font-size:0.8rem;color:var(--text-muted)">${j.type}</div>
            </div>
            <span class="badge badge-${st.color}">${st.icon} ${st.label}</span>
          </div>
          <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px;font-size:0.78rem;color:var(--text-muted)">
            <div>📅 ${j.date}</div>
            <div>🔧 ช่าง: ${j.tech}</div>
            ${j.doneDate ? `<div>✅ เสร็จ: ${j.doneDate}</div>` : ''}
            ${j.cost ? `<div>💰 ${formatCurrency(j.cost)}</div>` : ''}
          </div>
          ${j.note ? `<div style="margin-top:8px;font-size:0.78rem;background:var(--surface-2);padding:6px 10px;border-radius:var(--radius-sm)">📝 ${j.note}</div>` : ''}
        </div>`
      }).join('')}
    </div>`
  }

  function renderDocs(c) {
    return `<div class="card" style="padding:0;overflow:hidden">
      <table class="table">
        <thead><tr><th>เลขที่</th><th>ประเภท</th><th>วันที่</th><th class="text-right">จำนวน</th><th>สถานะ</th><th></th></tr></thead>
        <tbody>
          ${c.documents.map(d => `<tr>
            <td style="font-family:monospace;font-size:0.8rem">${d.no}</td>
            <td style="font-size:0.82rem">${{invoice:'ใบแจ้งหนี้',receipt:'ใบเสร็จ',tax_invoice:'ใบกำกับภาษี'}[d.type]||d.type}</td>
            <td style="font-size:0.8rem">${d.date}</td>
            <td class="text-right" style="font-weight:700">${formatCurrency(d.amount)}</td>
            <td><span class="badge badge-success">ชำระแล้ว</span></td>
            <td><button class="btn btn-xs btn-secondary dl-btn" data-id="${d.id}">📥</button></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`
  }

  function renderInsurance(c) {
    return c.insurance.map(ins => `
      <div class="card" style="padding:20px">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
          <div style="font-size:2rem">🛡</div>
          <div>
            <div style="font-weight:700">${ins.company} — ${ins.type}</div>
            <div style="font-size:0.78rem;color:var(--text-muted)">${ins.plate}</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:0.83rem">
          <div><div style="color:var(--text-muted);font-size:0.72rem">เบี้ยประกัน</div><div style="font-weight:700">${formatCurrency(ins.premium)}</div></div>
          <div><div style="color:var(--text-muted);font-size:0.72rem">เริ่มคุ้มครอง</div><div>${ins.startDate}</div></div>
          <div><div style="color:var(--text-muted);font-size:0.72rem">สิ้นสุด</div><div style="color:var(--warning);font-weight:600">${ins.endDate}</div></div>
        </div>
      </div>
    `).join('')
  }

  function renderBooking() {
    const today = new Date().toISOString().slice(0, 10)
    return `
      <div class="card" style="padding:20px">
        <div style="font-weight:700;font-size:1rem;margin-bottom:14px">📅 ขอนัดหมายงานซ่อม</div>
        <div style="display:flex;flex-direction:column;gap:12px">
          <div class="input-group"><label class="input-label">รถที่ต้องการนำเข้าซ่อม</label>
            <select class="input">
              ${DEMO_CUSTOMER.vehicles.map(v => `<option>${v.model} (${v.plate})</option>`).join('')}
            </select>
          </div>
          <div class="input-group"><label class="input-label">ประเภทงาน</label>
            <select class="input">
              <option>เช็กระยะตามกำหนด</option>
              <option>ซ่อมแซมปัญหา</option>
              <option>ตรวจสภาพรถ</option>
              <option>งานรับประกัน</option>
              <option>อื่นๆ</option>
            </select>
          </div>
          <div class="grid-2">
            <div class="input-group"><label class="input-label">วันที่ต้องการ</label><input class="input" type="date" value="${today}"></div>
            <div class="input-group"><label class="input-label">เวลาที่ต้องการ</label>
              <select class="input">
                ${['08:00','09:00','10:00','11:00','13:00','14:00','15:00','16:00'].map(t=>`<option>${t}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="input-group"><label class="input-label">อาการ / รายละเอียด</label><textarea class="input" rows="3" placeholder="อธิบายอาการหรือสิ่งที่ต้องการ..."></textarea></div>
          <button class="btn btn-primary" id="book-submit">📅 ส่งคำขอนัดหมาย</button>
        </div>
      </div>
    `
  }

  function miniStat(label, value) {
    return `<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-md);padding:12px;text-align:center">
      <div style="font-size:0.85rem;font-weight:700">${value}</div>
      <div style="font-size:0.72rem;color:var(--text-muted)">${label}</div>
    </div>`
  }

  renderPage()
}
