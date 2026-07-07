/**
 * Staff Profile — โปรไฟล์พนักงาน
 * Route: /hr/profile
 */
import { formatDate, formatCurrency } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, seedDemoData } from '../../core/db.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const EMPLOYMENT_TYPE = {
  fulltime:  { label: 'พนักงานประจำ', color: 'success' },
  parttime:  { label: 'พนักงานพาร์ทไทม์', color: 'warning' },
  contract:  { label: 'สัญญาจ้าง', color: 'primary' },
  probation: { label: 'ทดลองงาน', color: 'warning' },
}

const STAFF_STATUS = {
  active:     { label: 'ทำงานอยู่', color: 'success' },
  leave:      { label: 'ลางาน', color: 'warning' },
  resigned:   { label: 'ลาออก', color: 'secondary' },
  terminated: { label: 'ให้ออก', color: 'danger' },
}

function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }
function addYears(n) { const d = new Date(); d.setFullYear(d.getFullYear() + n); return d.toISOString().slice(0, 10) }

export default async function StaffProfilePage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let staff = []
  let deptFilter = 'all'
  let search = ''
  let selected = null
  let loading = true

  async function loadData() {
    loading = true
    try { staff = await listDocs('staff_profiles', [], 'name', 'asc', 500) } catch (e) { staff = [] }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function filtered() {
    return staff.filter(s => {
      if (deptFilter !== 'all' && s.dept !== deptFilter) return false
      if (search && !s.name.toLowerCase().includes(search.toLowerCase()) && !s.role.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const list = filtered()
    const depts = [...new Set(staff.map(s => s.dept))]

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">👤 Staff Profiles</div>
            <div class="page-subtitle">โปรไฟล์พนักงาน — ข้อมูลครบทุกด้าน</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="add-staff-btn">+ เพิ่มพนักงาน</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('👥 พนักงานทั้งหมด', staff.length + ' คน', 'primary')}
          ${kpi('✅ ทำงานอยู่', staff.filter(s=>s.status==='active').length + ' คน', 'success')}
          ${kpi('⏳ ทดลองงาน', staff.filter(s=>s.empType==='probation').length + ' คน', 'warning')}
          ${kpi('📊 KPI เฉลี่ย', Math.round(staff.reduce((a,s)=>a+s.kpiScore,0)/staff.length) + '%', 'primary')}
        </div>

        <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;align-items:center">
          <input class="input" id="search-inp" placeholder="🔍 ค้นหา..." style="max-width:200px" value="${escHtml(search)}">
          <div style="display:flex;gap:4px">
            <button class="btn btn-xs ${deptFilter==='all'?'btn-primary':'btn-secondary'} df-btn" data-d="all">ทั้งหมด</button>
            ${depts.map(d => `<button class="btn btn-xs ${deptFilter===d?'btn-primary':'btn-secondary'} df-btn" data-d="${escHtml(d)}">${escHtml(d)}</button>`).join('')}
          </div>
        </div>

        <div style="display:grid;grid-template-columns:${selected?'1fr 1fr':'repeat(auto-fill,minmax(280px,1fr))'};gap:12px">
          ${selected ? `
            <!-- List side -->
            <div style="display:flex;flex-direction:column;gap:8px">
              ${list.map(s => {
                const st = STAFF_STATUS[s.status]
                const isSelected = selected?.id === s.id
                return `<div class="card staff-card" data-id="${s.id}" style="padding:12px;cursor:pointer;${isSelected?'box-shadow:0 0 0 2px var(--primary)':''}">
                  <div style="display:flex;align-items:center;gap:10px">
                    <div style="font-size:1.5rem">${s.avatar}</div>
                    <div style="flex:1">
                      <div style="font-weight:700;font-size:0.85rem">${escHtml(s.name)}</div>
                      <div style="font-size:0.72rem;color:var(--text-muted)">${escHtml(s.role)} · ${escHtml(s.dept)}</div>
                    </div>
                    <span class="badge badge-${st?.color}" style="font-size:0.62rem">${st?.label}</span>
                  </div>
                </div>`
              }).join('')}
            </div>
            <!-- Detail side -->
            <div class="card" style="padding:16px">${renderProfileDetail(selected)}</div>
          ` : list.map(s => {
            const et = EMPLOYMENT_TYPE[s.empType]
            const st = STAFF_STATUS[s.status]
            return `<div class="card staff-card" data-id="${s.id}" style="padding:14px;cursor:pointer">
              <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
                <div style="font-size:2rem">${s.avatar}</div>
                <div>
                  <div style="font-weight:700">${escHtml(s.name)}</div>
                  <div style="font-size:0.75rem;color:var(--text-muted)">${escHtml(s.role)}</div>
                  <div style="font-size:0.72rem;color:var(--text-muted)">${escHtml(s.dept)}</div>
                </div>
              </div>
              <div style="display:flex;gap:6px;margin-bottom:8px">
                <span class="badge badge-${et?.color}" style="font-size:0.62rem">${et?.label}</span>
                <span class="badge badge-${st?.color}" style="font-size:0.62rem">${st?.label}</span>
              </div>
              <!-- KPI bar -->
              <div style="margin-bottom:8px">
                <div style="display:flex;justify-content:space-between;font-size:0.7rem;margin-bottom:2px">
                  <span style="color:var(--text-muted)">KPI Score</span>
                  <span style="font-weight:700;color:${s.kpiScore>=90?'var(--success)':s.kpiScore>=70?'var(--warning)':'var(--danger)'}">${s.kpiScore}%</span>
                </div>
                <div style="background:var(--surface-2);border-radius:3px;height:5px">
                  <div style="width:${s.kpiScore}%;background:${s.kpiScore>=90?'var(--success)':s.kpiScore>=70?'var(--warning)':'var(--danger)'};height:5px;border-radius:3px"></div>
                </div>
              </div>
              <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
                ${s.skills.slice(0,3).map(sk => `<span style="font-size:0.62rem;padding:2px 6px;background:var(--surface-2);border-radius:10px;color:var(--text-muted)">${escHtml(sk)}</span>`).join('')}
              </div>
            </div>`
          }).join('')}
        </div>
      </div>
    `

    document.getElementById('search-inp')?.addEventListener('input', e => { search = e.target.value; renderPage() })
    container.querySelectorAll('.df-btn').forEach(b => b.addEventListener('click', () => { deptFilter = b.dataset.d; renderPage() }))
    document.getElementById('add-staff-btn')?.addEventListener('click', openAddForm)
    container.querySelectorAll('.staff-card').forEach(el => el.addEventListener('click', () => {
      const s = staff.find(x => x.id === el.dataset.id)
      selected = selected?.id === s?.id ? null : s
      renderPage()
    }))
  }

  function renderProfileDetail(s) {
    const et = EMPLOYMENT_TYPE[s.empType]
    const st = STAFF_STATUS[s.status]
    const tenure = Math.floor((new Date() - new Date(s.startDate)) / (365.25 * 86400000))
    return `
      <div style="text-align:center;margin-bottom:14px">
        <div style="font-size:3.5rem">${s.avatar}</div>
        <div style="font-size:1.1rem;font-weight:800;margin-top:6px">${escHtml(s.name)}</div>
        <div style="font-size:0.78rem;color:var(--text-muted)">${escHtml(s.nameEn)}</div>
        <div style="font-size:0.83rem;margin-top:4px">${escHtml(s.role)} · ${escHtml(s.dept)}</div>
        <div style="display:flex;gap:6px;justify-content:center;margin-top:8px">
          <span class="badge badge-${et?.color}">${et?.label}</span>
          <span class="badge badge-${st?.color}">${st?.label}</span>
        </div>
      </div>
      ${row('อีเมล', escHtml(s.email))}
      ${row('โทรศัพท์', escHtml(s.phone))}
      ${row('เงินเดือน', formatCurrency(s.salary) + ' / เดือน')}
      ${row('วันเริ่มงาน', formatDate(s.startDate))}
      ${row('อายุงาน', tenure + ' ปี')}
      ${row('KPI Score', s.kpiScore + '%')}
      ${row('วันลาคงเหลือ', s.leaveBalance + ' วัน')}
      <div style="margin-top:10px">
        <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:6px">ทักษะ</div>
        <div style="display:flex;gap:4px;flex-wrap:wrap">
          ${s.skills.map(sk => `<span style="font-size:0.73rem;padding:3px 8px;background:var(--surface-2);border-radius:10px">${escHtml(sk)}</span>`).join('')}
        </div>
      </div>
    `
  }

  function openAddForm() {
    openModal({
      title: '+ เพิ่มพนักงาน',
      size: 'md',
      body: `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="input-group"><label class="input-label">ชื่อ-นามสกุล (ไทย) *</label><input class="input" id="sf-name"></div>
          <div class="input-group"><label class="input-label">ชื่อ (อังกฤษ)</label><input class="input" id="sf-nameEn"></div>
          <div class="input-group"><label class="input-label">ตำแหน่ง</label><input class="input" id="sf-role"></div>
          <div class="input-group"><label class="input-label">แผนก</label>
            <select class="input" id="sf-dept"><option>ฝ่ายขาย</option><option>ศูนย์บริการ</option><option>การเงิน</option><option>ทรัพยากรบุคคล</option></select>
          </div>
          <div class="input-group"><label class="input-label">ประเภทการจ้าง</label>
            <select class="input" id="sf-type">${Object.entries(EMPLOYMENT_TYPE).map(([k,v])=>`<option value="${k}">${v.label}</option>`).join('')}</select>
          </div>
          <div class="input-group"><label class="input-label">เงินเดือน</label><input type="number" class="input" id="sf-salary" placeholder="25000"></div>
          <div class="input-group"><label class="input-label">วันเริ่มงาน</label><input type="date" class="input" id="sf-start" value="${new Date().toISOString().slice(0,10)}"></div>
          <div class="input-group"><label class="input-label">โทรศัพท์</label><input class="input" id="sf-phone"></div>
        </div>
      `,
      async onConfirm() {
        const name = document.getElementById('sf-name')?.value?.trim()
        if (!name) { showToast('❗ กรุณากรอกชื่อ', 'error'); return false }
        try {
          await createDoc('staff_profiles', {
            name,
            nameEn: document.getElementById('sf-nameEn')?.value||'', avatar: '👤',
            dept: document.getElementById('sf-dept')?.value||'ฝ่ายขาย',
            role: document.getElementById('sf-role')?.value||'พนักงาน',
            empType: document.getElementById('sf-type')?.value||'fulltime', status: 'active',
            startDate: document.getElementById('sf-start')?.value||addDays(0),
            salary: +document.getElementById('sf-salary')?.value||0,
            phone: document.getElementById('sf-phone')?.value||'', email: '',
            skills: [], kpiScore: 0, leaveBalance: 10
          })
          showToast('✅ เพิ่มพนักงานแล้ว!', 'success')
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      }
    })
  }

  await loadData()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
function row(l, v) { return `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:0.83rem"><span style="color:var(--text-muted)">${l}</span><span>${v}</span></div>` }
