import { listDocs, createDoc, updateDocData, softDelete, seedDemoData, setDocData, migrateStaffSalaries } from '../../core/db.js'
import { showToast, getState, on } from '../../core/store.js'
import { companyScopeFilters, myEffectiveCompanyId } from '../../core/companyScope.js'
import { formatDate, todayBangkok } from '../../utils/format.js'
import { openModal, confirmDialog } from '../../utils/modal.js'
import { exportToExcel } from '../../utils/importExport.js'
import { getPositions } from '../../data/masterData.js'
import { navigate } from '../../core/router.js'
import { validateThaiId } from '../../utils/thaiId.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
function companyNameOf(companiesList, companyId) {
  if (!companyId) return ''
  return companiesList.find(c => c.id === companyId)?.name || ''
}
// (v1.0.463) พนักงาน 1 คนสังกัดได้หลายบริษัทในเครือ (เช่น ตำแหน่งงานที่ดูแลรวมทุกบริษัท) ตามที่ขอ — ข้อมูลเดิม
// มีแค่ companyId เดี่ยว เก็บ fallback ไว้ให้ยังอ่านข้อมูลเก่าได้ปกติ ไม่ต้อง migrate ย้อนหลัง
function companyIdsOf(s) {
  return s?.companyIds?.length ? s.companyIds : (s?.companyId ? [s.companyId] : [])
}
function companyNamesOf(companiesList, s) {
  return companyIdsOf(s).map(id => companyNameOf(companiesList, id)).filter(Boolean).join(', ')
}
// (v1.0.463) เดิมช่องตำแหน่งเป็น <input list=datalist> ตามที่แจ้งว่า "กดเปลี่ยนไม่ได้" — เบราว์เซอร์ส่วนใหญ่
// ไม่เปิด dropdown ให้อัตโนมัติถ้าช่องมีข้อความอยู่แล้ว (ต้องลบข้อความเดิมก่อนถึงเห็นตัวเลือก) ทำให้ดูเหมือนกดไม่ติด
// เปลี่ยนเป็น <select> จริงแทน กดแล้วเห็น dropdown ทันทีเหมือนช่องอื่นๆในฟอร์มนี้ ยังพิมพ์เองได้ผ่านตัวเลือก "อื่นๆ"
function positionSelectHtml(id, currentValue, allowEmpty = false) {
  const positions = getPositions()
  const isOther = currentValue && !positions.includes(currentValue)
  return `
    <select class="input position-select" id="${id}" data-other-id="${id}-other">
      ${allowEmpty ? `<option value="">— ไม่ระบุ —</option>` : ''}
      ${positions.map(p => `<option value="${escHtml(p)}" ${currentValue===p?'selected':''}>${escHtml(p)}</option>`).join('')}
      <option value="__other__" ${isOther?'selected':''}>อื่นๆ (พิมพ์เอง)</option>
    </select>
    <input class="input" id="${id}-other" value="${escHtml(isOther?currentValue:'')}" placeholder="พิมพ์ตำแหน่งเอง" style="margin-top:6px;display:${isOther?'block':'none'}">
  `
}

// พบว่าเดิมหน้านี้แสดงเงินเดือนของ "ทุกคน" บนการ์ด/ป๊อปอัพรายละเอียด/ยอดรวมหัวหน้า/ไฟล์ Export ให้เห็นตรงๆ
// โดยไม่มีการเช็คสิทธิ์เลยแม้แต่จุดเดียว — พนักงานขาย/ช่างธรรมดาที่เปิดหน้านี้ (ซึ่งเข้าถึงได้โดยปริยายถ้าแอดมิน
// ไม่ได้ไปจำกัดสิทธิ์โมดูล HR ไว้เป็นพิเศษ) เห็นเงินเดือนของเพื่อนร่วมงานทุกคนได้ทันที — จำกัดการแสดงผลเฉพาะ
// ผู้บริหาร/ผู้จัดการ/HR เท่านั้น (การป้องกันจริงต้องทำที่ Firestore Rules ด้วย เพราะนี่แค่ซ่อนที่ UI —
// staff collection ยังต้องเปิดให้ isStaff() อ่านได้กว้างเพื่อให้หน้าอื่นที่ต้องใช้ชื่อ/แผนกพนักงานทำงานได้ปกติ)
const SALARY_VIEW_ROLES = ['owner', 'admin', 'manager', 'hr']

// (v1.0.303) เงินเดือนย้ายไปเก็บที่ staff_salaries แยกต่างหากแล้ว แต่เอกสารพนักงานเก่าที่มีอยู่จริงในระบบก่อน
// หน้านี้จะยังฝัง salary ค้างอยู่ (โค้ดใหม่แค่หยุดเขียนซ้ำ ไม่ได้ลบข้อมูลเก่าให้อัตโนมัติ) ปุ่มนี้รันการย้าย
// ข้อมูลจริงครั้งเดียว (ปลอดภัยที่จะกดซ้ำได้ — เอกสารที่ย้ายแล้วจะถูกข้าม) จำกัดเฉพาะเจ้าของ/แอดมินเท่านั้น
// เพราะเป็นการแก้ไขโครงสร้างข้อมูลจริงของพนักงานทุกคน ไม่ใช่งาน HR ประจำวัน
const MIGRATION_ROLES = ['owner', 'admin']

// (v1.0.444) ข้อมูลอ่อนไหวสูง (เลขบัตรประชาชน/วันเกิด/ที่อยู่/ผู้ติดต่อฉุกเฉิน/บัญชีธนาคาร) เก็บแยกที่
// staff_pii collection ต่างหาก (ตรงกับ Firestore Rules ที่เพิ่งเพิ่ม — isHR()||isFinance()||isManager()
// เท่านั้น) เหมือน pattern เดียวกับ SALARY_VIEW_ROLES/staff_salaries ด้านล่าง — ต่างจาก canViewSalary ตรงที่
// รวม 'finance' เข้ามาด้วย (บัญชีธนาคารใช้จ่ายเงินเดือนจริงเป็นข้อมูลที่ฝ่ายการเงินต้องใช้)
const PII_VIEW_ROLES = ['owner', 'admin', 'manager', 'hr', 'finance']

const DEPARTMENTS = ['ฝ่ายขาย','ฝ่ายบริการ','ฝ่ายการเงิน','ฝ่าย HR','ฝ่าย IT','ผู้บริหาร','อื่นๆ']
export const ROLES = { owner:'เจ้าของ', admin:'แอดมิน', manager:'ผู้จัดการ', sales:'เซลส์', service:'ช่าง/บริการ', staff:'พนักงาน' }
const STATUS_EMP = { active:'✅ ทำงานอยู่', probation:'⏳ ทดลองงาน', leave:'🏖 ลา', inactive:'❌ ลาออก' }
const GENDERS = { male:'ชาย', female:'หญิง', other:'อื่นๆ/ไม่ระบุ' }
const EDUCATION_LEVELS = ['ต่ำกว่า ม.6', 'ม.6/ปวช.', 'ปวส./อนุปริญญา', 'ปริญญาตรี', 'ปริญญาโท', 'ปริญญาเอก']

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
  const myRole = getState('role') || getState('user')?.role || 'staff'
  const canViewSalary = SALARY_VIEW_ROLES.includes(myRole)
  const canRunMigration = MIGRATION_ROLES.includes(myRole)
  // เชื่อม staff↔users ต้องดึง collection users ทั้งหมดมาเลือก (มีอีเมล/ข้อมูลอ่อนไหวของทุกคน) — Firestore
  // Rules อนุญาตอ่านทั้ง collection นี้เฉพาะ isManager() (owner/admin/manager) เท่านั้น ต่างจาก canViewSalary
  // ที่ isHR() ครอบคลุมถึง role 'hr' ด้วย — ถ้าใช้ SALARY_VIEW_ROLES เดิม (มี 'hr') ตรงนี้ ผู้ใช้ role 'hr' จะ
  // เห็นปุ่มแต่กดแล้ว query ล้มเหลวเงียบๆ (catch ไว้) กลายเป็นดรอปดาวน์ว่างเปล่าโดยไม่รู้สาเหตุ
  const canLinkAccount = ['owner', 'admin', 'manager'].includes(myRole)
  // audit_log อ่านได้เฉพาะ owner/admin เท่านั้นตาม Firestore Rules จริง (isAdmin()) — ต่างจาก canViewSalary/
  // canLinkAccount ที่รวม manager/hr ด้วย ถ้าเผลอใช้ตัวแปรเดียวกันปุ่มจะโชว์ให้ manager/hr กด แต่ query จะ
  // permission-denied เงียบๆ (จับ error ไว้แล้วไม่ throw) ทำให้เห็น "ไม่พบประวัติ" ทั้งที่จริงมีประวัติอยู่
  const canViewHistory = ['owner', 'admin'].includes(myRole)
  const canViewPII = PII_VIEW_ROLES.includes(myRole)

  let staff = []
  let filtered = []
  let deptFilter = 'all'
  let search = ''
  let loginAccounts = [] // users ที่ยังไม่มี staff doc เชื่อมอยู่ — ใช้เติมตัวเลือก "เชื่อมกับบัญชีผู้ใช้"
  // (v1.0.458) เดิมหน้านี้ไม่รู้จักบริษัทในเครือเลย แม้ staff.companyId จะมีอยู่แล้ว (ใช้กรองข้อมูลตาม
  // companyScopeFilters() อยู่แล้ว) แต่ไม่เคยแสดง/แก้ไขชื่อบริษัทที่หน้าจอเลยสักจุด ("พนักงานคนนี้อยู่บริษัท
  // อะไร" ตอบไม่ได้จากหน้านี้) — โหลดมาเพื่อแสดง+แก้ไขได้จริง
  let companiesList = []
  // เดิม DEMO_STAFF (ผสมชื่อเจ้าของจริงกับเงินเดือนสมมติ 4 คน) ถูก push เข้า staff list เงียบๆทุกครั้งที่
  // collection จริงว่างเปล่า โดยไม่มีตัวบอกบนหน้าจอเลยว่านี่คือข้อมูลตัวอย่าง (ต่างจาก ExpenseOcr.js ที่ label
  // "Demo" ไว้ชัดเจน) ผู้ใช้อาจเข้าใจผิดว่าเป็นพนักงานจริง — เพิ่มตัวแปรนี้ไว้โชว์ป้าย "ข้อมูลตัวอย่าง" แทน
  let isDemoData = false

  async function loadData() {
    // softDelete() ไม่ได้ลบเอกสารจริง แค่ตั้ง deleted:true — ถ้าไม่กรองออก พนักงานที่ "ลบ" ไปแล้วจะยังโผล่
    // กลับมาในรายชื่อทุกครั้งที่โหลดหน้านี้ใหม่ (และยังเข้าเกณฑ์ลงเวลา/คำนวณเงินเดือนที่หน้าอื่นต่อไปด้วย)
    try { staff = (await listDocs('staff', companyScopeFilters(), 'startDate', 'asc', 500)).filter(s => !s.deleted) } catch {}
    isDemoData = !staff.length
    if (isDemoData) DEMO_STAFF.forEach(s => staff.push({ ...s }))
    // เงินเดือนย้ายไปเก็บที่ staff_salaries แยกต่างหากแล้ว (v1.0.303) — ดึงมาผสานทับ s.salary เฉพาะตอนมี
    // สิทธิ์เห็นเท่านั้น (staff_salaries อ่านได้แค่ HR/การเงิน/ผู้จัดการ ยิงคำขอไปก็ได้แค่ permission-denied
    // เปล่าๆถ้าไม่มีสิทธิ์) เอกสารเก่าที่ยังไม่ได้ย้ายข้อมูลออกจะ fallback ไปใช้ค่าเดิมที่ฝังใน staff doc ต่อไป
    if (canViewSalary) {
      try {
        const salaryDocs = await listDocs('staff_salaries', [], 'updatedAt', 'desc', 500)
        const salaryMap = Object.fromEntries(salaryDocs.map(d => [d.id, d.salary]))
        staff.forEach(s => { if (salaryMap[s.id] != null) s.salary = salaryMap[s.id] })
      } catch {}
    }
    if (canLinkAccount) {
      try { loginAccounts = await listDocs('users', [], 'createdAt', 'desc', 500) } catch { loginAccounts = [] }
    }
    try { companiesList = await listDocs('org_companies', [], 'name', 'asc', 100) } catch { companiesList = [] }
    // (v1.0.444) PII อ่อนไหวสูง (เลขบัตรประชาชน/วันเกิด/ที่อยู่/ผู้ติดต่อฉุกเฉิน/บัญชีธนาคาร) เก็บแยกที่
    // staff_pii เหมือน pattern เดียวกับ staff_salaries ด้านบน — ผสานทับเข้า staff เฉพาะตอนมีสิทธิ์เห็นเท่านั้น
    if (canViewPII) {
      try {
        const piiDocs = await listDocs('staff_pii', [], 'updatedAt', 'desc', 500)
        // ตัด id/createdAt/updatedAt ของเอกสาร staff_pii ทิ้งก่อนผสาน — ไม่งั้นจะไปทับ timestamp ของ
        // staff doc เองโดยไม่ตั้งใจ (2 collection คนละเอกสารกัน แค่ id ตรงกัน)
        const piiMap = Object.fromEntries(piiDocs.map(d => { const { id, createdAt, updatedAt, ...rest } = d; return [d.id, rest] }))
        staff.forEach(s => { if (piiMap[s.id]) Object.assign(s, piiMap[s.id]) })
      } catch {}
    }
    updateStats(); applyFilter()
  }

  function updateStats() {
    const active = staff.filter(s => s.status === 'active').length
    const totalEl = document.getElementById('staff-total')
    if (totalEl) totalEl.textContent = `${staff.length} คน (ปฏิบัติงาน ${active} คน)`
    const demoEl = document.getElementById('staff-demo-indicator')
    if (demoEl) demoEl.textContent = isDemoData ? '⚠️ ข้อมูลตัวอย่าง (ยังไม่มีพนักงานจริงในระบบ)' : ''
    const salaryEl = document.getElementById('staff-salary')
    if (salaryEl) {
      if (!canViewSalary) { salaryEl.textContent = ''; return }
      const total = staff.filter(s => s.status !== 'inactive').reduce((t, s) => t + (s.salary || 0), 0)
      salaryEl.textContent = `เงินเดือนรวม: ฿${total.toLocaleString()}/เดือน`
    }
  }

  function applyFilter() {
    // (v1.0.453) การกรองตามบริษัทย้ายเข้า query จริงแล้ว (companyScopeFilters() ใน loadData()) — ไม่ต้อง
    // กรองซ้ำที่นี่อีก
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
        if (e.target.closest('.edit-staff,.del-staff')) return
        openDetail(staff.find(x => x.id === card.dataset.id))
      })
    })
    document.querySelectorAll('.edit-staff').forEach(btn => btn.addEventListener('click', e => {
      e.stopPropagation(); openForm(staff.find(x => x.id === btn.dataset.id))
    }))
    document.querySelectorAll('.del-staff').forEach(btn => btn.addEventListener('click', e => {
      e.stopPropagation(); const s = staff.find(x => x.id === btn.dataset.id); if (s) deleteStaff(s)
    }))
  }

  async function deleteStaff(s) {
    const ok = await confirmDialog({ title: '🗑️ ลบพนักงาน', message: `ยืนยันลบข้อมูลพนักงาน "${escHtml(s.firstName)} ${escHtml(s.lastName)}"? การลบนี้ไม่สามารถย้อนกลับได้`, confirmText: 'ลบถาวร', danger: true })
    if (!ok) return
    await softDelete('staff', s.id)
    staff = staff.filter(x => x.id !== s.id)
    showToast('🗑️ ลบข้อมูลพนักงานแล้ว', 'success')
    document.querySelectorAll('.modal-overlay').forEach(m => m.remove())
    updateStats(); applyFilter()
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
          <div style="display:flex;gap:2px">
            <button class="btn btn-ghost btn-sm edit-staff" data-id="${s.id}" style="padding:4px">✏️</button>
            <button class="btn btn-ghost btn-sm del-staff" data-id="${s.id}" style="padding:4px" title="ลบ">🗑️</button>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;font-size:0.82rem">
          <div><span class="badge badge-${color}" style="font-size:0.72rem">${role}</span> <span style="color:var(--text-muted);font-size:0.78rem">${escHtml(s.dept)}</span></div>
          ${s.position ? `<div style="color:var(--text-2);font-weight:600">🏷️ ${escHtml(s.position)}${s.positionSecondary ? ` <span style="color:var(--text-muted);font-weight:400">(+${escHtml(s.positionSecondary)})</span>` : ''}</div>` : ''}
          ${companyNamesOf(companiesList, s) ? `<div style="color:var(--text-muted)">🏢 ${escHtml(companyNamesOf(companiesList, s))}</div>` : ''}
          <div style="color:var(--text-2)">${stEl}</div>
          <div style="color:var(--text-muted)">📅 ${formatDate(s.startDate)}</div>
          ${s.phone ? `<div style="color:var(--text-muted)">📱 ${escHtml(s.phone)}</div>` : ''}
          ${canViewSalary && s.salary ? `<div style="color:var(--accent);font-weight:600">💰 ฿${s.salary.toLocaleString()}</div>` : ''}
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
          ${dRow('💼','ระดับสิทธิ์',role)}
          ${companyNamesOf(companiesList, s) ? dRow('🏢','บริษัท', escHtml(companyNamesOf(companiesList, s))) : ''}
          ${s.position ? dRow('🏷️','ตำแหน่งหลัก',s.position) : ''}
          ${s.positionSecondary ? dRow('🏷️','ตำแหน่งรอง',s.positionSecondary) : ''}
          ${dRow('🏬','แผนก',s.dept||'-')}
          ${s.managerId ? dRow('🧑‍💼','หัวหน้างาน', (() => { const m = staff.find(x=>x.id===s.managerId); return m ? escHtml(m.firstName)+' '+escHtml(m.lastName) : '-' })()) : ''}
          ${dRow('📱','โทร',s.phone||'-')}
          ${dRow('📧','อีเมล',s.email||'-')}
          ${dRow('📅','วันเริ่มงาน',formatDate(s.startDate))}
          ${s.contractEndDate ? dRow('📆','สิ้นสุดสัญญา',formatDate(s.contractEndDate)) : ''}
          ${s.gender ? dRow('🧑','เพศ',GENDERS[s.gender]||s.gender) : ''}
          ${s.education ? dRow('🎓','วุฒิการศึกษา',s.education) : ''}
          ${s.eduSchool ? dRow('🏫','สถาบันการศึกษา',s.eduSchool) : ''}
          ${s.eduMajor ? dRow('📚','สาขาวิชา',s.eduMajor) : ''}
          ${canViewSalary && s.salary ? dRow('💰','เงินเดือน',`฿${s.salary.toLocaleString()}/เดือน`) : ''}
          ${dRow('✅','สถานะ',STATUS_EMP[s.status]||s.status)}
          ${s.workHistory?.length ? `
          <div style="margin-top:4px;padding-top:10px;border-top:1px solid var(--border)">
            <div style="font-size:0.68rem;color:var(--text-muted);font-weight:700;margin-bottom:6px">💼 ประวัติการทำงาน</div>
            <div style="display:flex;flex-direction:column;gap:6px">
              ${s.workHistory.map(w => `<div style="font-size:0.8rem;color:var(--text-2)">
                <b>${escHtml(w.company||'-')}</b>${w.position ? ' — '+escHtml(w.position) : ''}${w.period ? ` <span style="color:var(--text-muted);font-size:0.72rem">(${escHtml(w.period)})</span>` : ''}
              </div>`).join('')}
            </div>
          </div>` : ''}
          ${canLinkAccount ? dRow('🔗','บัญชีผู้ใช้ (login)', (() => { const u = loginAccounts.find(x=>x.id===s.uid); return u ? escHtml(u.email) : (s.uid ? 'เชื่อมแล้ว (ไม่พบบัญชี)' : 'ยังไม่ได้เชื่อม') })()) : ''}
          ${canViewPII ? `
          <div style="margin-top:4px;padding-top:10px;border-top:1px solid var(--border)">
            <div style="font-size:0.68rem;color:var(--text-muted);font-weight:700;margin-bottom:6px">🔒 ข้อมูลอ่อนไหว (จำกัดสิทธิ์)</div>
            <div style="display:flex;flex-direction:column;gap:10px">
              ${s.nationalId ? dRow('🪪','เลขบัตรประชาชน',s.nationalId) : ''}
              ${s.birthDate ? dRow('🎂','วันเกิด',formatDate(s.birthDate)) : ''}
              ${s.address ? dRow('🏠','ที่อยู่',s.address) : ''}
              ${s.emergencyContactName ? dRow('🆘','ผู้ติดต่อฉุกเฉิน',`${s.emergencyContactName}${s.emergencyContactPhone ? ' · '+s.emergencyContactPhone : ''}`) : ''}
              ${s.bankName || s.bankAccount ? dRow('🏦','บัญชีธนาคาร',`${s.bankName||'-'} · ${s.bankAccount||'-'}`) : ''}
            </div>
          </div>` : ''}
        </div>
      `,
      footer: `<button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">ปิด</button>
               ${canViewHistory ? `<button class="btn btn-secondary" id="s-hist">🕐 ประวัติการแก้ไข</button>` : ''}
               <button class="btn btn-secondary" id="s-docs">📎 เอกสาร/เรซูเม่</button>
               <button class="btn btn-primary" id="s-edit">✏️ แก้ไข</button>
               <button class="btn btn-danger" id="s-del">🗑️ ลบ</button>`
    })
    document.getElementById('s-edit')?.addEventListener('click', () => { document.querySelector('.modal-overlay')?.remove(); openForm(s) })
    document.getElementById('s-del')?.addEventListener('click', () => deleteStaff(s))
    document.getElementById('s-hist')?.addEventListener('click', () => openHistory(s))
    document.getElementById('s-docs')?.addEventListener('click', () => { document.querySelector('.modal-overlay')?.remove(); navigate('/hr/documents') })
  }

  // (v1.0.430) เดิมไม่มีวิธีดูประวัติการแก้ไขข้อมูลพนักงานคนหนึ่งๆเลย ทั้งที่ audit_log บันทึกทุก
  // create/update/delete ของทุก collection อยู่แล้วโดยอัตโนมัติ (logAction() ใน core/db.js) รวมถึง staff —
  // แค่ไม่เคยมีหน้าไหน filter มาแสดงเจาะจงต่อพนักงาน 1 คน ใช้ข้อมูลที่มีอยู่แล้วทั้งหมด ไม่ต้องสร้าง
  // ระบบบันทึกประวัติใหม่ซ้ำซ้อน
  async function openHistory(s) {
    openModal({ title: `🕐 ประวัติการแก้ไข — ${escHtml(s.firstName)} ${escHtml(s.lastName)}`, size: 'md', body: `<div class="empty-state" style="padding:24px"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div>` })
    let entries = []
    // ไม่ใช้ where(module)+where(resource)+orderBy(ts) รวมกัน (ต้องมี composite index ที่ยังไม่ได้สร้างไว้ —
    // บั๊กคลาสเดิมที่เคยตั้งใจเลี่ยงไว้แล้วในโปรเจกต์นี้) ดึงมากรองฝั่ง client แทนเหมือน AuditLog.js เดิม
    try {
      entries = (await listDocs('audit_log', [], 'ts', 'desc', 500)).filter(e => e.module === 'staff' && e.resource === s.id)
    } catch {}
    const body = document.querySelector('.modal-overlay .modal-body')
    if (!body) return
    if (!entries.length) {
      body.innerHTML = `<div class="empty-state" style="padding:24px"><div class="empty-icon">📭</div><div class="empty-title">ไม่พบประวัติการแก้ไข</div></div>`
      return
    }
    const ACTION_LABEL = { create:'➕ สร้าง', update:'✏️ แก้ไข', delete:'🗑️ ลบ' }
    body.innerHTML = `<div style="display:flex;flex-direction:column;gap:8px;max-height:60vh;overflow-y:auto">
      ${entries.map(e => `<div style="padding:8px 10px;background:var(--surface-2);border-radius:8px;font-size:0.78rem">
        <div style="display:flex;justify-content:space-between;gap:8px">
          <span style="font-weight:700">${ACTION_LABEL[e.action]||escHtml(e.action)}</span>
          <span style="color:var(--text-muted);font-size:0.68rem">${e.ts ? formatDate(e.ts) : '-'}</span>
        </div>
        <div style="color:var(--text-2);margin-top:2px">${escHtml(e.detail||'')}</div>
        <div style="color:var(--text-muted);font-size:0.68rem;margin-top:2px">โดย ${escHtml(e.user||'-')}</div>
      </div>`).join('')}
    </div>`
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
            <div class="input-group"><label class="input-label">ระดับสิทธิ์ในระบบ</label>
              <select class="input" id="sf-role">
                ${Object.entries(ROLES).map(([k,v]) => `<option value="${k}" ${existing?.role===k?'selected':''}>${v}</option>`).join('')}
              </select>
            </div>
          </div>
          ${companiesList.length ? (() => {
            const selectedIds = isEdit ? companyIdsOf(existing) : (myEffectiveCompanyId() ? [myEffectiveCompanyId()] : [])
            return `<div class="input-group"><label class="input-label">บริษัท (เลือกได้หลายบริษัท) <span style="font-size:0.65rem;color:var(--text-muted)">(พนักงานคนนี้อยู่บริษัทไหนในเครือได้มากกว่า 1 บริษัท — แก้รายชื่อบริษัทได้ที่ Settings > บริษัทในเครือ)</span></label>
            <div style="display:flex;flex-wrap:wrap;gap:12px;padding:8px 0">
              ${companiesList.map(c => `<label style="display:flex;align-items:center;gap:6px;font-size:0.85rem;cursor:pointer">
                <input type="checkbox" class="sf-company-cb" value="${c.id}" ${selectedIds.includes(c.id) ? 'checked' : ''}> ${escHtml(c.name)}
              </label>`).join('')}
            </div>
          </div>`
          })() : ''}
          <div class="grid-2">
            <div class="input-group"><label class="input-label">ตำแหน่งหลัก (ชื่อตำแหน่งจริง) <span style="font-size:0.65rem;color:var(--text-muted)">(เลือกจากรายชื่อมาตรฐาน หรือพิมพ์เองได้ — แก้รายชื่อมาตรฐานได้ที่ Settings > Master Data)</span></label>
              ${positionSelectHtml('sf-position', existing?.position || '')}
            </div>
            <div class="input-group"><label class="input-label">ตำแหน่งรอง <span style="font-size:0.65rem;color:var(--text-muted)">(ถ้ามี — เช่น รักษาการตำแหน่งอื่นควบ)</span></label>
              ${positionSelectHtml('sf-position2', existing?.positionSecondary || '', true)}
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
            <div class="input-group"><label class="input-label">วันเริ่มงาน</label><input class="input" type="date" id="sf-start" value="${existing?.startDate||todayBangkok()}"></div>
            <div class="input-group"><label class="input-label">สิ้นสุดสัญญา <span style="font-size:0.65rem;color:var(--text-muted)">(ถ้าเป็นสัญญาจ้างแบบมีกำหนดเวลา)</span></label><input class="input" type="date" id="sf-contract-end" value="${existing?.contractEndDate||''}"></div>
          </div>
          <div class="grid-2">
            <div class="input-group"><label class="input-label">เพศ</label>
              <select class="input" id="sf-gender">
                <option value="">— ไม่ระบุ —</option>
                ${Object.entries(GENDERS).map(([k,v]) => `<option value="${k}" ${existing?.gender===k?'selected':''}>${v}</option>`).join('')}
              </select>
            </div>
            <div class="input-group"><label class="input-label">วุฒิการศึกษา</label>
              <input class="input" id="sf-education" list="sf-education-options" value="${escHtml(existing?.education||'')}">
              <datalist id="sf-education-options">${EDUCATION_LEVELS.map(e => `<option value="${e}">`).join('')}</datalist>
            </div>
          </div>
          <div class="grid-2">
            <div class="input-group"><label class="input-label">สถาบันการศึกษา</label><input class="input" id="sf-edu-school" value="${escHtml(existing?.eduSchool||'')}" placeholder="เช่น มหาวิทยาลัยธรรมศาสตร์"></div>
            <div class="input-group"><label class="input-label">สาขาวิชา</label><input class="input" id="sf-edu-major" value="${escHtml(existing?.eduMajor||'')}" placeholder="เช่น บริหารธุรกิจ"></div>
          </div>
          ${canViewSalary ? `<div class="input-group"><label class="input-label">เงินเดือน (บาท)</label><input class="input" type="number" id="sf-salary" value="${existing?.salary||''}"></div>` : ''}
          <div class="input-group">
            <label class="input-label">ประวัติการทำงาน (ที่อื่นก่อนหน้า)</label>
            <div id="sf-wh-list" style="display:flex;flex-direction:column;gap:8px">
              ${(existing?.workHistory?.length ? existing.workHistory : [{}]).map(w => workHistoryRow(w)).join('')}
            </div>
            <button type="button" class="btn btn-secondary btn-sm" id="sf-wh-add" style="margin-top:8px;align-self:flex-start">➕ เพิ่มประวัติการทำงาน</button>
          </div>
          <div class="input-group"><label class="input-label">หัวหน้างาน (ใช้แสดงในแผนผังองค์กร)</label>
            <select class="input" id="sf-manager">
              <option value="">— ไม่มี / เป็นระดับสูงสุด —</option>
              ${staff.filter(s => s.id !== existing?.id).map(s => `<option value="${s.id}" ${existing?.managerId===s.id?'selected':''}>${escHtml(s.firstName)} ${escHtml(s.lastName)}</option>`).join('')}
            </select>
          </div>
          ${canLinkAccount ? `<div class="input-group"><label class="input-label">เชื่อมกับบัญชีผู้ใช้ (login) <span style="font-size:0.65rem;color:var(--text-muted)">(บัญชีที่สร้างใหม่ผ่าน User Management จะเชื่อมให้อัตโนมัติแล้ว — ใช้ช่องนี้เชื่อมย้อนหลังสำหรับพนักงานเก่า)</span></label>
            <select class="input" id="sf-uid">
              <option value="">— ไม่เชื่อม —</option>
              ${loginAccounts.filter(u => u.id === existing?.uid || !staff.some(s => s.uid === u.id && s.id !== existing?.id)).map(u => `<option value="${u.id}" ${existing?.uid===u.id?'selected':''}>${escHtml(u.displayName||u.email)} (${escHtml(u.email)})</option>`).join('')}
            </select>
          </div>` : ''}
          ${canViewPII ? `
          <div style="padding-top:10px;border-top:1px solid var(--border)">
            <div style="font-size:0.72rem;color:var(--text-muted);font-weight:700;margin-bottom:8px">🔒 ข้อมูลอ่อนไหว (เก็บแยกจากข้อมูลทั่วไป จำกัดสิทธิ์เห็นเฉพาะเจ้าของ/แอดมิน/ผู้จัดการ/HR/การเงิน)</div>
            <div style="display:flex;flex-direction:column;gap:12px">
              <div class="input-group"><label class="input-label">เลขบัตรประชาชน</label>
                <input class="input" id="sf-nid" value="${escHtml(existing?.nationalId||'')}" maxlength="17" placeholder="x-xxxx-xxxxx-xx-x">
                <span class="input-error" id="sf-nid-e"></span>
              </div>
              <div class="grid-2">
                <div class="input-group"><label class="input-label">วันเกิด</label><input class="input" type="date" id="sf-dob" value="${existing?.birthDate||''}"></div>
                <div></div>
              </div>
              <div class="input-group"><label class="input-label">ที่อยู่</label><textarea class="input" id="sf-address" rows="2">${escHtml(existing?.address||'')}</textarea></div>
              <div class="grid-2">
                <div class="input-group"><label class="input-label">ผู้ติดต่อฉุกเฉิน</label><input class="input" id="sf-emc-name" value="${escHtml(existing?.emergencyContactName||'')}"></div>
                <div class="input-group"><label class="input-label">เบอร์ผู้ติดต่อฉุกเฉิน</label><input class="input" id="sf-emc-phone" value="${escHtml(existing?.emergencyContactPhone||'')}"></div>
              </div>
              <div class="grid-2">
                <div class="input-group"><label class="input-label">ธนาคาร</label><input class="input" id="sf-bank-name" value="${escHtml(existing?.bankName||'')}" placeholder="เช่น กสิกรไทย"></div>
                <div class="input-group"><label class="input-label">เลขบัญชี</label><input class="input" id="sf-bank-acc" value="${escHtml(existing?.bankAccount||'')}"></div>
              </div>
            </div>
          </div>` : ''}
        </div>
      `,
      footer: `<button class="btn btn-secondary" id="sfc">ยกเลิก</button><button class="btn btn-primary" id="sfs">💾 บันทึก</button>`
    })
    el.querySelector('#sfc').addEventListener('click', close)
    // ตรวจเลขบัตรประชาชนแบบ real-time (MOD-11 checksum เดียวกับที่ใช้ตรวจเลขบัตรลูกค้าอยู่แล้ว) — เตือนทันที
    // ไม่ต้องรอกดบันทึกก่อนถึงจะรู้ว่าพิมพ์ผิด ช่องว่างไม่ถือว่าผิด (ไม่บังคับกรอก)
    el.querySelector('#sf-nid')?.addEventListener('input', e => {
      const v = e.target.value.trim()
      const errEl = el.querySelector('#sf-nid-e')
      if (!v) { errEl.textContent = ''; return }
      const r = validateThaiId(v)
      errEl.textContent = r.valid ? '' : r.error
    })
    // (v1.0.452) แถวประวัติการทำงานเพิ่ม/ลบได้ไดนามิก — ใช้ event delegation ที่ container เดียว (#sf-wh-list)
    // แทนการ bind listener ทีละแถว เพราะแถวใหม่ที่เพิ่มเข้ามาทีหลังด้วย insertAdjacentHTML ไม่มี listener
    // ของตัวเองอยู่แล้วโดยธรรมชาติ — delegation จับ event จาก parent ที่ยังอยู่ตลอดแทน ใช้ได้กับทุกแถวไม่ว่า
    // จะเพิ่มเข้ามาเมื่อไหร่ก็ตาม
    const whList = el.querySelector('#sf-wh-list')
    el.querySelector('#sf-wh-add')?.addEventListener('click', () => {
      whList.insertAdjacentHTML('beforeend', workHistoryRow())
    })
    whList?.addEventListener('click', e => {
      const btn = e.target.closest('.wh-remove')
      if (!btn) return
      // เหลือแถวเดียวไว้เสมอ (ลบเป็นค่าว่างแทนการลบ DOM ทิ้งหมด) กันฟอร์มดูพังถ้าลบจนหมด
      if (whList.querySelectorAll('.wh-row').length <= 1) {
        btn.closest('.wh-row').querySelectorAll('input').forEach(i => i.value = '')
      } else {
        btn.closest('.wh-row').remove()
      }
    })
    el.querySelectorAll('.position-select').forEach(sel => {
      sel.addEventListener('change', () => {
        const other = el.querySelector('#' + sel.dataset.otherId)
        if (other) other.style.display = sel.value === '__other__' ? 'block' : 'none'
      })
    })
    el.querySelector('#sfs').addEventListener('click', async () => {
      const fn = el.querySelector('#sf-fn').value.trim()
      const ln = el.querySelector('#sf-ln').value.trim()
      if (!fn) { el.querySelector('#sf-fn-e').textContent = 'กรุณาระบุ'; return }
      if (!ln) { el.querySelector('#sf-ln-e').textContent = 'กรุณาระบุ'; return }
      const nidRaw = el.querySelector('#sf-nid')?.value.trim() || ''
      if (nidRaw) {
        const r = validateThaiId(nidRaw)
        if (!r.valid) { el.querySelector('#sf-nid-e').textContent = r.error; return }
      }
      const btn = el.querySelector('#sfs'); btn.disabled = true; btn.innerHTML = '<span class="spinner spinner-sm"></span>'
      const readPosition = (selId, otherId) => {
        const v = el.querySelector('#' + selId)?.value || ''
        return v === '__other__' ? (el.querySelector('#' + otherId)?.value.trim() || '') : v
      }
      const selectedCompanyIds = [...el.querySelectorAll('.sf-company-cb:checked')].map(cb => cb.value)
      const data = {
        firstName: fn, lastName: ln, nickname: el.querySelector('#sf-nn').value.trim(),
        role: el.querySelector('#sf-role').value, position: readPosition('sf-position', 'sf-position-other'),
        positionSecondary: readPosition('sf-position2', 'sf-position2-other'),
        ...(el.querySelector('.sf-company-cb') ? { companyIds: selectedCompanyIds, companyId: selectedCompanyIds[0] || null } : {}),
        dept: el.querySelector('#sf-dept').value,
        status: el.querySelector('#sf-status').value, phone: el.querySelector('#sf-phone').value.trim(),
        email: el.querySelector('#sf-email').value.trim(), startDate: el.querySelector('#sf-start').value,
        contractEndDate: el.querySelector('#sf-contract-end').value || null,
        gender: el.querySelector('#sf-gender').value || null,
        education: el.querySelector('#sf-education').value.trim(),
        eduSchool: el.querySelector('#sf-edu-school').value.trim(),
        eduMajor: el.querySelector('#sf-edu-major').value.trim(),
        // (v1.0.452) กรองแถวที่ว่างทั้งแถวทิ้งก่อนบันทึก (เช่นแถวเริ่มต้นที่ไม่ได้กรอกอะไรเลย) ไม่งั้นจะมี
        // entry ว่างเปล่าติดไปในอาร์เรย์ทุกครั้งที่บันทึกโดยไม่มีข้อมูลจริงอะไรเลย
        workHistory: [...el.querySelectorAll('.wh-row')].map(row => ({
          company: row.querySelector('.wh-company').value.trim(),
          position: row.querySelector('.wh-position').value.trim(),
          period: row.querySelector('.wh-period').value.trim(),
        })).filter(w => w.company || w.position || w.period),
        managerId: el.querySelector('#sf-manager').value || null,
        ...(canLinkAccount ? { uid: el.querySelector('#sf-uid')?.value || null } : {}),
      }
      // เงินเดือนเก็บแยกที่ staff_salaries เสมอ (v1.0.303) ไม่เขียนลง staff doc อีกต่อไปเลย (Firestore Rules
      // บล็อกไว้แล้วด้วย) — ช่อง #sf-salary ไม่ถูกสร้างใน DOM เลยถ้าไม่มีสิทธิ์เห็น จึงเขียนเฉพาะตอน canViewSalary
      const newSalary = canViewSalary ? (Number(el.querySelector('#sf-salary').value)||0) : null
      // (v1.0.444) เลขบัตรประชาชน/วันเกิด/ที่อยู่/ผู้ติดต่อฉุกเฉิน/บัญชีธนาคาร เก็บแยกที่ staff_pii เสมอ
      // เหมือนเงินเดือนด้านบน (Firestore Rules จำกัดเฉพาะ HR/การเงิน/ผู้จัดการ) — ช่องพวกนี้ไม่ถูกสร้างใน DOM
      // เลยถ้าไม่มีสิทธิ์เห็น (canViewPII) จึงเขียนเฉพาะตอนมีสิทธิ์เท่านั้น
      const piiData = canViewPII ? {
        nationalId: nidRaw, birthDate: el.querySelector('#sf-dob').value || null,
        address: el.querySelector('#sf-address').value.trim(),
        emergencyContactName: el.querySelector('#sf-emc-name').value.trim(),
        emergencyContactPhone: el.querySelector('#sf-emc-phone').value.trim(),
        bankName: el.querySelector('#sf-bank-name').value.trim(),
        bankAccount: el.querySelector('#sf-bank-acc').value.trim(),
      } : null
      try {
        let staffId = existing?.id
        // ถ้ากำลังแก้ "พนักงาน" ที่จริงๆเป็นแค่ DEMO_STAFF (isDemoData — ไม่มีพนักงานจริงในระบบเลย ระบบเลยโชว์
        // ตัวอย่างแทน) existing.id จะเป็น id ปลอม (st1-st5) ที่ไม่เคยมีเอกสารจริงใน Firestore เลย เรียก
        // updateDocData ตรงๆ จะพัง "No document to update" (บั๊กจริงที่เจอในระบบ error log การผลิต) ต้องสร้าง
        // เป็นเอกสารจริงใหม่แทนการอัปเดต เพื่อให้สิ่งที่ผู้ใช้กรอกแก้ไขถูกบันทึกจริง ไม่หายไปเงียบๆ
        if (isEdit && !isDemoData) { await updateDocData('staff', existing.id, data); Object.assign(existing, data) }
        else if (isEdit && isDemoData) {
          // กำลัง "แก้ไข" พนักงานตัวอย่าง (DEMO_STAFF) อยู่ — สร้างเป็นเอกสารจริงแทนการอัปเดต (ดูคอมเมนต์ด้านบน)
          // แล้วโหลดข้อมูลใหม่ทั้งหมด เพราะตอนนี้ collection มีเอกสารจริงแล้ว isDemoData จะกลายเป็น false
          // ไม่ต้องใช้ DEMO_STAFF fallback อีกต่อไป — ต้อง reload กันรายการตัวอย่างเดิม (รวมตัวที่เพิ่งแก้)
          // ค้างซ้ำอยู่กับของจริงที่เพิ่งสร้าง
          const payload = { ...data, companyId: data.companyId ?? myEffectiveCompanyId(), companyIds: data.companyIds?.length ? data.companyIds : (myEffectiveCompanyId() ? [myEffectiveCompanyId()] : []) }
          staffId = await createDoc('staff', payload)
          await loadData()
        } else {
          // Phase 2 หลายบริษัท — ติด companyId ของบริษัทหลักที่พนักงานคนสร้างสังกัดอยู่ (ถ้ามี) พนักงานเดิม
          // ที่ไม่มี companyId ยังเห็นได้ทุกคนเหมือนเดิม (ไม่ถูกกรองออก)
          const payload = { ...data, companyId: data.companyId ?? myEffectiveCompanyId(), companyIds: data.companyIds?.length ? data.companyIds : (myEffectiveCompanyId() ? [myEffectiveCompanyId()] : []) }
          staffId = await createDoc('staff', payload)
          // (v1.0.448) เดิมกดปุ่ม "เพิ่มพนักงาน" (ไม่ใช่แก้ไข) ตอน isDemoData=true (ยังไม่มีพนักงานจริงเลย
          // ระบบเลยโชว์ DEMO_STAFF 5 คนตัวอย่างแทน) จะแค่ unshift พนักงานจริงที่เพิ่งสร้างเข้าไปปนกับของตัวอย่าง
          // เดิมในหน่วยความจำ โดยไม่รีเซ็ต isDemoData/reload เลย ผลคือป้าย "⚠️ ข้อมูลตัวอย่าง" กับพนักงานปลอม
          // 5 คนยังค้างแสดงอยู่ปนกับพนักงานจริงที่เพิ่งเพิ่ม จนกว่าจะรีเฟรชหน้าเอง — ใช้ pattern เดียวกับตอนแก้ไข
          // พนักงานตัวอย่างด้านบน คือ reload ใหม่ทั้งหมดทันทีถ้าเพิ่งสร้างพนักงานจริงคนแรก
          if (isDemoData) await loadData()
          else staff.unshift({ ...payload, id: staffId })
        }
        if (newSalary != null) {
          await setDocData('staff_salaries', staffId, { salary: newSalary })
          const rec = staff.find(x => x.id === staffId); if (rec) rec.salary = newSalary
        }
        if (piiData) {
          await setDocData('staff_pii', staffId, piiData)
          const rec = staff.find(x => x.id === staffId); if (rec) Object.assign(rec, piiData)
        }
        showToast(isEdit ? 'แก้ไขแล้ว' : '✅ เพิ่มพนักงานแล้ว', 'success')
        close(); updateStats(); applyFilter()
      } catch (e) {
        // (v1.0.444) เดิมข้อความ error ทั่วไปเกินไป ("บันทึกไม่สำเร็จ") ไม่บอกสาเหตุจริงเลย — ถ้าเป็น
        // permission-denied จาก Firestore Rules หรือ error อื่นที่วินิจฉัยได้ ให้โชว์ข้อความจริงแทน
        showToast('บันทึกไม่สำเร็จ: ' + (e?.message || 'เกิดข้อผิดพลาดไม่ทราบสาเหตุ'), 'error', 8000)
        btn.disabled = false; btn.innerHTML = '💾 บันทึก'
      }
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
            <span style="font-size:0.76rem;color:var(--warning);font-weight:600" id="staff-demo-indicator"></span>
          </div>
        </div>
        <div class="page-actions">
          ${canRunMigration ? `<button class="btn btn-secondary btn-sm" id="migrate-salary-btn" title="ย้ายเงินเดือนที่ยังฝังอยู่ใน staff doc เก่าไปเก็บที่ collection แยกต่างหาก">🔧 ย้ายข้อมูลเงินเดือน</button>` : ''}
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
  document.getElementById('migrate-salary-btn')?.addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: '🔧 ย้ายข้อมูลเงินเดือน',
      message: 'จะย้ายเงินเดือนที่ยังฝังอยู่ในเอกสารพนักงานเก่าไปเก็บที่ collection แยกต่างหาก (staff_salaries) ที่จำกัดสิทธิ์อ่านเฉพาะผู้บริหาร/ผู้จัดการ/HR/การเงินเท่านั้น แล้วลบ field เงินเดือนออกจากเอกสารพนักงานเดิม — เป็นการแก้ไขข้อมูลจริงของพนักงานทุกคน ปลอดภัยที่จะกดซ้ำได้ (เอกสารที่ย้ายไปแล้วจะถูกข้ามอัตโนมัติ) ต้องการดำเนินการหรือไม่?',
      confirmText: 'ย้ายข้อมูลเลย', danger: true,
    })
    if (!ok) return
    const btn = document.getElementById('migrate-salary-btn')
    btn.disabled = true; btn.innerHTML = '<span class="spinner spinner-sm"></span> กำลังย้าย...'
    try {
      const result = await migrateStaffSalaries()
      showToast(`✅ ย้ายข้อมูลเงินเดือนสำเร็จ ${result.migrated} คน (ข้าม ${result.skipped} คนที่ย้ายไปแล้ว/ไม่มีข้อมูล)${result.errors.length ? ` — พลาด ${result.errors.length} คน` : ''}`, result.errors.length ? 'warning' : 'success', 8000)
      await loadData()
    } catch {
      showToast('ย้ายข้อมูลไม่สำเร็จ', 'error')
    } finally {
      btn.disabled = false; btn.innerHTML = '🔧 ย้ายข้อมูลเงินเดือน'
    }
  })
  document.getElementById('staff-search').addEventListener('input', e => { search = e.target.value.toLowerCase(); applyFilter() })
  document.getElementById('dept-filter').addEventListener('change', e => { deptFilter = e.target.value; applyFilter() })
  document.getElementById('staff-export').addEventListener('click', () => {
    exportToExcel(staff.map(s => ({
      ชื่อ:s.firstName, นามสกุล:s.lastName, ชื่อเล่น:s.nickname, ระดับสิทธิ์:ROLES[s.role]||s.role, ตำแหน่งงาน:s.position||'', แผนก:s.dept,
      เพศ:GENDERS[s.gender]||'', วุฒิการศึกษา:s.education||'', สถาบันการศึกษา:s.eduSchool||'', สาขาวิชา:s.eduMajor||'',
      ประวัติการทำงาน:(s.workHistory||[]).map(w => `${w.company||''}${w.position?' ('+w.position+')':''}${w.period?' '+w.period:''}`).join('; '),
      โทร:s.phone, อีเมล:s.email, วันเริ่มงาน:s.startDate, สิ้นสุดสัญญา:s.contractEndDate||'',
      ...(canViewSalary ? { เงินเดือน:s.salary } : {}),
      ...(canViewPII ? { เลขบัตรประชาชน:s.nationalId||'', วันเกิด:s.birthDate||'', ที่อยู่:s.address||'', ผู้ติดต่อฉุกเฉิน:s.emergencyContactName||'', เบอร์ฉุกเฉิน:s.emergencyContactPhone||'', ธนาคาร:s.bankName||'', เลขบัญชี:s.bankAccount||'' } : {}),
      สถานะ:STATUS_EMP[s.status]||s.status,
    })), `staff-${todayBangkok()}.xlsx`, 'พนักงาน')
    showToast('Export แล้ว', 'success')
  })

  if (container.__routerGen === myGen) await loadData()

  // (v1.0.453) การกรองตามบริษัทย้ายเข้า query จริงแล้ว (companyScopeFilters()) — หน้านี้ไม่มี live
  // subscription (แค่โหลดครั้งเดียว) ต้อง reload ใหม่เองทุกครั้งที่ activeCompanyFilter (ตัวกรอง Topbar)
  // เปลี่ยน ไม่งั้นตัวกรองจะหยุดทำงานจนกว่าจะรีเฟรชหน้าเอง
  const offCompanyFilter = on('activeCompanyFilter', () => { if (container.__routerGen === myGen) loadData() })
  return function cleanupStaff() { offCompanyFilter() }
}

// (v1.0.452) ประวัติการทำงานที่อื่นก่อนหน้า — เก็บเป็น array บน staff doc เอง (ไม่ใช่ข้อมูลอ่อนไหวระดับ
// เดียวกับเลขบัตรประชาชน/บัญชีธนาคาร จึงไม่ต้องแยกไป staff_pii) แต่ละแถวแก้/ลบเองได้อิสระผ่าน event
// delegation บน #sf-wh-list (รองรับแถวที่เพิ่มเข้ามาใหม่แบบไดนามิกด้วย ไม่ต้อง bind listener ทีละแถว)
function workHistoryRow(w = {}) {
  return `<div class="wh-row" style="display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:6px;align-items:start">
    <input class="input wh-company" value="${escHtml(w.company||'')}" placeholder="บริษัท/องค์กร">
    <input class="input wh-position" value="${escHtml(w.position||'')}" placeholder="ตำแหน่ง">
    <input class="input wh-period" value="${escHtml(w.period||'')}" placeholder="ช่วงเวลา เช่น 2563-2565">
    <button type="button" class="btn btn-ghost btn-sm wh-remove" style="padding:6px" title="ลบแถวนี้">🗑️</button>
  </div>`
}

function dRow(icon, label, value) {
  return `<div style="font-size:0.83rem;display:flex;gap:6px"><span>${icon}</span><span style="color:var(--text-muted);min-width:80px;flex-shrink:0">${label}</span><span style="color:var(--text-2)">${escHtml(String(value ?? ''))}</span></div>`
}
