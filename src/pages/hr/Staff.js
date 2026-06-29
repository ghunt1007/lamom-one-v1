import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'
import { showToast } from '../../core/store.js'
import { formatDate } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { exportToExcel } from '../../utils/importExport.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const DEPARTMENTS = ['ฝ่ายขาย','ฝ่ายบริการ','ฝ่ายการเงิน','ฝ่าย HR','ฝ่าย IT','ผู้บริหาร','อื่นๆ']
const ROLES = { owner:'เจ้าของ', admin:'แอดมิน', manager:'ผู้จัดการ', sales:'เซลส์', service:'ช่าง/บริการ', staff:'พนักงาน' }
const STATUS_EMP = { active:'✅ ทำงานอยู่', probation:'⏳ ทดลองงาน', leave:'🏖 ลา', inactive:'❌ ลาออก' }

const DEMO_STAFF = [
  { id:'st1', firstName:'ทวีศักดิ์', lastName:'สุขสมบัติเสถียร', nickname:'เจ้าของ', role:'owner', dept:'ผู้บริหาร', phone:'0812345678', email:'owner@lamom.com', startDate:'2020-01-01', salary:0, status:'active', avatar:'' },
  { id:'st2', firstName:'อรนุช', lastName:'เซลส์ดี', nickname:'นุ้ย', role:'sales', dept:'ฝ่ายขาย', phone:'0823456789', email:'nun@lamom.com', startDate:'2022-03-01', salary:25000, status:'active', avatar:'' },
  { id:'st3', firstName:'วิชัย', lastName:'ขายเก่ง', nickname:'วิ', role:'sales', dept:'ฝ่ายขาย', phone:'0834567890', email:'wichai@lamom.com', startDate:'2023-06-01', salary:22000, status:'active', avatar:'' },
  { id:'st4', firstName:'สมชาย', lastName:'ช่างดี', nickname:'ชาย', role:'service', dept:'ฝ่ายบริการ', phone:'0845678901', email:'somchai@lamom.com', startDate:'2021-09-01', salary:20000, status:'active', avatar:'' },
  { id:'st5', firstName:'วิชัย', lastName:'ช่างเก่ง', nickname:'เก่ง', role:'service', dept:'ฝ่ายบริการ', phone:'0856789012', email:'wichai2@lamom.com', startDate:'2022-12-01', salary:18000, status:'probation', avatar:'' },
]

export default async function StaffPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let staff = []
  let filtered = []
  let deptFilter = 'all'
  let search = ''

  async function loadData() {
    try { staff = await listDocs('staff', [], 'startDate', 'asc', 500) } catch {}
    if (!staff.length) DEMO_STAFF.forEach(s => staff.push({ ...s }))
    updateStats(); applyFilter()
  }

  function updateStats() {
    const active = staff.filter(s => s.status === 'active').length
    const totalEl = document.getElementById('staff-total')
    if (totalEl) totalEl.textContent = `${staff.length} คน (ปฏิบัติงาน ${active} คน)`
    const salaryEl = document.getElementById('staff-salary')
    if (salaryEl) {
      const total = staff.filter(s => s.status !== 'inactive').reduce((t, s) => t + (s.salary || 0), 0)
      salaryEl.textContent = `เงินเดือนรวม: ฿${total.toLocaleString()}/เดือน`
    }
  }

  function applyFilter() {
    filtered = staff.filter(s => {
      const ds = deptFilter === 'all' || s.dept === deptFilter
      const qs = !search || `${s.firstName} ${s.lastName} ${s.nickname} ${s.role}`.toLowerCase().includes(search)
      return ds && qs
    })
    renderCards()
  }

  function renderCards() {
    const wrap = document.getElementById('staff-content')
    if (!wrap) return

    if (!filtered.length) {
      wrap.innerHTML = `<div class="empty-state" style="padding:48px"><div class="empty-icon">👤</div><div class="empty-title">ไม่พบพนักงาน</div></div>`
      return
    }

    wrap.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:14px">
      ${filtered.map(s => staffCard(s)).join('')}
    </div>`

    document.querySelectorAll('.staff-card').forEach(card => {
      card.addEventListener('click', e => {
        if (e.target.closest('.edit-staff')) return
        openDetail(staff.find(x => x.id === card.dataset.id))
      })
    })
    document.querySelectorAll('.edit-staff').forEach(btn => btn.addEventListener('click', e => {
      e.stopPropagation(); openForm(staff.find(x => x.id === btn.dataset.id))
    }))
  }

  function staffCard(s) {
    const role = escHtml(ROLES[s.role] || s.role)
    const stEl = escHtml(STATUS_EMP[s.status] || s.status)
    const initials = escHtml(`${s.firstName?.[0]||''}${s.lastName?.[0]||''}`.toUpperCase())
    const deptColors = { 'ฝ่ายขาย':'primary', 'ฝ่ายบริการ':'warning', 'ผู้บริหาร':'accent', 'ฝ่ายการเงิน':'success', 'ฝ่าย HR':'primary', 'ฝ่าย IT':'danger', 'อื่นๆ':'secondary' }
    const color = deptColors[s.dept] || 'secondary'
    return `
      <div class="card card-lift staff-card" data-id="${s.id}" style="cursor:pointer;padding:16px;${s.status === 'inactive' ? 'opacity:0.5' : ''}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
          <div style="display:flex;align-items:center;gap:10px">
            <div class="avatar" style="background:var(--${color}-dim);color:var(--${color});font-weight:700">${initials}</div>
            <div>
              <div style="font-weight:700">${escHtml(s.firstName)} ${escHtml(s.lastName)}</div>
              <div style="font-size:0.78rem;color:var(--text-muted)">${s.nickname ? `"${escHtml(s.nickname)}"` : ''}</div>
            </div>
          </div>
          <button class="btn btn-ghost btn-sm edit-staff" data-id="${s.id}" style="padding:4px">✏️</button>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;font-size:0.82rem">
          <div><span class="badge badge-${color}" style="font-size:0.72rem">${role}</span> <span style="color:var(--text-muted);font-size:0.78rem">${escHtml(s.dept)}</span></div>
          <div style="color:var(--text-2)">${stEl}</div>
          <div style="color:var(--text-muted)">📅 ${formatDate(s.startDate)}</div>
          ${s.phone ? `<div style="color:var(--text-muted)">📱 ${escHtml(s.phone)}</div>` : ''}
          ${s.salary ? `<div style="color:var(--accent);font-weight:600">💰 ฿${s.salary.toLocaleString()}</div>` : ''}
        </div>
      </div>`
  }

  function openDetail(s) {
    if (!s) return
    const role = ROLES[s.role] || s.role
    openModal({
      title: '👤 ' + escHtml(s.firstName) + ' ' + escHtml(s.lastName), size: 'md',
      body: `
        <div style="display:flex;flex-direction:column;gap:10px">
          ${dRow('🏷','ชื่อ-นามสกุล',`${s.firstName} ${s.lastName}`)}
          ${s.nickname ? dRow('😊','ชื่อเล่น',s.nickname) : ''}
          ${dRow('💼','ตำแหน่ง',role)}
          ${dRow('🏢','แผนก',s.dept||'-')}
          ${dRow('📱','โทร',s.phone||'-')}
          ${dRow('📧','อีเมล',s.email||'-')}
          ${dRow('📅','วันเริ่มงาน',formatDate(s.startDate))}
          ${s.salary ? dRow('💰','เงินเดือน',`฿${s.salary.toLocaleString()}/เดือน`) : ''}
          ${dRow('✅','สถานะ',STATUS_EMP[s.status]||s.status)}
        </div>
      `,
      footer: `<button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">ปิด</button>
               <button class="btn btn-primary" id="s-edit">✏️ แก้ไข</button>`
    })
    document.getElementById('s-edit')?.addEventListener('click', () => { document.querySelector('.modal-overlay')?.remove(); openForm(s) })
  }

  function openForm(existing = null) {
    const isEdit = !!existing
    const { el, close } = openModal({
      title: isEdit ? '✏️ แก้ไขข้อมูล ' + escHtml(existing.firstName) : '➕ เพิ่มพนักงาน', size: 'lg',
      body: `
        <div style="display:flex;flex-direction:column;gap:12px">
          <div class="grid-2">
            <div class="input-group"><label class="input-label">ชื่อ *</label><input class="input" id="sf-fn" value="${escHtml(existing?.firstName||'')}"><span class="input-error" id="sf-fn-e"></span></div>
            <div class="input-group"><label class="input-label">นามสกุล *</label><input class="input" id="sf-ln" value="${escHtml(existing?.lastName||'')}"><span class="input-error" id="sf-ln-e"></span></div>
          </div>
          <div class="grid-2">
            <div class="input-group"><label class="input-label">ชื่อเล่น</label><input class="input" id="sf-nn" value="${escHtml(existing?.nickname||'')}"></div>
            <div class="input-group"><label class="input-label">ตำแหน่ง</label>
              <select class="input" id="sf-role">
                ${Object.entries(ROLES).map(([k,v]) => `<option value="${k}" ${existing?.role===k?'selected':''}>${v}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="grid-2">
            <div class="input-group"><label class="input-label">แผนก</label>
              <select class="input" id="sf-dept">
                ${DEPARTMENTS.map(d => `<option value="${d}" ${existing?.dept===d?'selected':''}>${d}</option>`).join('')}
              </select>
            </div>
            <div class="input-group"><label class="input-label">สถานะ</label>
              <select class="input" id="sf-status">
                ${Object.entries(STATUS_EMP).map(([k,v]) => `<option value="${k}" ${existing?.status===k?'selected':''}>${v}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="grid-2">
            <div class="input-group"><label class="input-label">โทร</label><input class="input" id="sf-phone" value="${escHtml(existing?.phone||'')}"></div>
            <div class="input-group"><label class="input-label">อีเมล</label><input class="input" type="email" id="sf-email" value="${escHtml(existing?.email||'')}"></div>
          </div>
          <div class="grid-2">
            <div class="input-group"><label class="input-label">วันเริ่มงาน</label><input class="input" type="date" id="sf-start" value="${existing?.startDate||new Date().toISOString().slice(0,10)}"></div>
            <div class="input-group"><label class="input-label">เงินเดือน (บาท)</label><input class="input" type="number" id="sf-salary" value="${existing?.salary||''}"></div>
          </div>
        </div>
      `,
      footer: `<button class="btn btn-secondary" id="sfc">ยกเลิก</button><button class="btn btn-primary" id="sfs">💾 บันทึก</button>`
    })
    el.querySelector('#sfc').addEventListener('click', close)
    el.querySelector('#sfs').addEventListener('click', async () => {
      const fn = el.querySelector('#sf-fn').value.trim()
      const ln = el.querySelector('#sf-ln').value.trim()
      if (!fn) { el.querySelector('#sf-fn-e').textContent = 'กรุณาระบุ'; return }
      if (!ln) { el.querySelector('#sf-ln-e').textContent = 'กรุณาระบุ'; return }
      const btn = el.querySelector('#sfs'); btn.disabled = true; btn.innerHTML = '<span class="spinner spinner-sm"></span>'
      const data = {
        firstName: fn, lastName: ln, nickname: el.querySelector('#sf-nn').value.trim(),
        role: el.querySelector('#sf-role').value, dept: el.querySelector('#sf-dept').value,
        status: el.querySelector('#sf-status').value, phone: el.querySelector('#sf-phone').value.trim(),
        email: el.querySelector('#sf-email').value.trim(), startDate: el.querySelector('#sf-start').value,
        salary: Number(el.querySelector('#sf-salary').value)||0,
      }
      try {
        if (isEdit) { await updateDocData('staff', existing.id, data); Object.assign(existing, data) }
        else { const id = await createDoc('staff', data); staff.unshift({ ...data, id }) }
        showToast(isEdit ? 'แก้ไขแล้ว' : '✅ เพิ่มพนักงานแล้ว', 'success')
        close(); updateStats(); applyFilter()
      } catch { showToast('บันทึกไม่สำเร็จ','error') }
    })
  }

  container.innerHTML = `
    <div class="page-content animate-slide">
      <div class="page-header">
        <div>
          <div class="page-title">👥 พนักงาน</div>
          <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
            <span class="page-subtitle" id="staff-total">กำลังโหลด...</span>
            <span style="font-size:0.8rem;color:var(--accent)" id="staff-salary"></span>
          </div>
        </div>
        <div class="page-actions">
          <button class="btn btn-secondary btn-sm" id="staff-export">📥 Export</button>
          <button class="btn btn-primary" id="add-staff-btn">➕ เพิ่มพนักงาน</button>
        </div>
      </div>

      <!-- Filter -->
      <div class="card mb-4" style="padding:12px 16px">
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
          <div style="position:relative;flex:1;min-width:180px">
            <span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text-muted)">🔍</span>
            <input class="input" id="staff-search" placeholder="ค้นหาชื่อ ชื่อเล่น ตำแหน่ง..." style="padding-left:32px">
          </div>
          <select class="input" id="dept-filter" style="width:160px">
            <option value="all">ทุกแผนก</option>
            ${DEPARTMENTS.map(d => `<option value="${d}">${d}</option>`).join('')}
          </select>
        </div>
      </div>

      <div id="staff-content">
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:14px">
          ${[...Array(5)].map(() => `<div class="skeleton" style="height:160px;border-radius:var(--radius-lg)"></div>`).join('')}
        </div>
      </div>
    </div>
  `

  document.getElementById('add-staff-btn').addEventListener('click', () => openForm())
  document.getElementById('staff-search').addEventListener('input', e => { search = e.target.value.toLowerCase(); applyFilter() })
  document.getElementById('dept-filter').addEventListener('change', e => { deptFilter = e.target.value; applyFilter() })
  document.getElementById('staff-export').addEventListener('click', () => {
    exportToExcel(staff.map(s => ({ ชื่อ:s.firstName, นามสกุล:s.lastName, ชื่อเล่น:s.nickname, ตำแหน่ง:ROLES[s.role]||s.role, แผนก:s.dept, โทร:s.phone, อีเมล:s.email, วันเริ่มงาน:s.startDate, เงินเดือน:s.salary, สถานะ:STATUS_EMP[s.status]||s.status })), `staff-${new Date().toISOString().slice(0,10)}.xlsx`, 'พนักงาน')
    showToast('Export แล้ว', 'success')
  })

  if (container.__routerGen === myGen) await loadData()
}

function dRow(icon, label, value) {
  return `<div style="font-size:0.83rem;display:flex;gap:6px"><span>${icon}</span><span style="color:var(--text-muted);min-width:80px;flex-shrink:0">${label}</span><span style="color:var(--text-2)">${escHtml(String(value ?? ''))}</span></div>`
}
