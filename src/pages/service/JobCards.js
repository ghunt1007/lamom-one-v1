import { watchDocs, createDoc, updateDocData, softDelete, seedDemoData } from '../../core/db.js'
import { showToast, getState, on } from '../../core/store.js'
import { companyScopeFilters, myEffectiveCompanyId } from '../../core/companyScope.js'
import { getVisibilityScope } from '../../core/hierarchy.js'
import { formatDate, formatCurrency, timeAgo, todayBangkok } from '../../utils/format.js'
import { openModal, confirmDialog } from '../../utils/modal.js'
import { exportToExcel } from '../../utils/importExport.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const JOB_STATUS = {
  waiting:    { label: '⏳ รอรับรถ',      badge: 'primary' },
  checkin:    { label: '🔑 รับรถแล้ว',    badge: 'accent'  },
  diagnosing: { label: '🔍 วินิจฉัย',     badge: 'primary' },
  inprogress: { label: '🔧 กำลังซ่อม',   badge: 'warning' },
  waiting_parts: { label: '📦 รออะไหล่',  badge: 'danger'  },
  qc:         { label: '✅ QC ตรวจสอบ',  badge: 'success' },
  done:       { label: '🏁 เสร็จแล้ว',   badge: 'success' },
  delivered:  { label: '🚗 ส่งคืนแล้ว',  badge: 'primary' },
}

const JOB_TYPE = {
  warranty: '🛡 ซ่อมรับประกัน',
  service: '🔧 เข้าศูนย์บริการ',
  repair: '🔩 ซ่อมทั่วไป',
  accident: '💥 งานชน/ประกัน',
  recall: '📋 Recall',
}

const BAYS = ['เบย์ 1', 'เบย์ 2', 'เบย์ 3', 'เบย์ 4', 'เบย์ลิฟต์', 'เบย์ล้าง']

let jobCounter = 5

// (v1.0.459) หน้าลูกค้า (Customers.js) เขียน sessionStorage key นี้เป็น JSON {customerId, custName, phone}
// แล้ว navigate('/service/jobs') มา — หน้านี้จะอ่านค่า, ลบ key ทิ้งทันที, แล้วเปิดฟอร์ม "เปิด Job Card ใหม่"
// อัตโนมัติพร้อมข้อมูลลูกค้า (แพทเทิร์นเดียวกับ lamom_quote_prefill ใน QuotationBuilder.js)
const PREFILL_KEY = 'lamom_jobcard_prefill'

export default async function JobCardsPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let prefillData = null
  try {
    const raw = sessionStorage.getItem(PREFILL_KEY)
    if (raw) { sessionStorage.removeItem(PREFILL_KEY); prefillData = JSON.parse(raw) }
  } catch { prefillData = null }

  let jobs = []
  let filtered = []
  let statusFilter = 'all'
  let search = ''

  // (v1.0.437) ต่อจากหน้าลูกค้า/ใบจอง (v1.0.432/436) — ช่าง/พนักงานทั่วไปเห็นเฉพาะ Job Card ที่ตัวเองรับผิดชอบ
  // เป็นค่าเริ่มต้น ผูกกับ techName (ชื่อพิมพ์เอง เทียบแบบ normalize) ตรงกับ "แต่ละตำแหน่งเห็นเฉพาะงานตัวเอง"
  // (v1.0.467) เปลี่ยนจาก getMyTeamNames() (fallback ผ่อนปรน) มาใช้ getVisibilityScope() ตามนโยบายเข้มงวด
  // แพทเทิร์นเดียวกับ Customers.js/Bookings.js เป๊ะ — ไม่มี fallback เห็นกว้างขึ้นอีกต่อไป
  const myDisplayName = getState('user')?.displayName || ''
  const normName = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ')
  const visScope = await getVisibilityScope()
  const ownScopeActive = !visScope.unrestricted && !visScope.companyOnly
  const myTeamNames = visScope.names || new Set([normName(myDisplayName)])

  // Real-time: อัปเดตสดเมื่อมีคนเปิด/แก้ไข/ปิด Job Card จากเครื่องอื่น (ไม่แตะช่องค้นหา จึงไม่รบกวนตอนกำลังพิมพ์)
  // (v1.0.474) เดิม query แบบไม่กรองบริษัทเลย (companyScopeFilters() ตัวเปล่า) — พนักงานที่ถูกจำกัดสิทธิ์ตาม
  // บริษัทเห็น Job Card ข้ามบริษัทได้หมด ต่างจาก Bookings.js/Customers.js/Staff.js ที่ทำไปแล้ว — แก้ให้ตรงกัน
  // ต้องยกเลิก subscription เดิมแล้วยิงใหม่ทุกครั้งที่ activeCompanyFilter (ตัวกรอง Topbar) เปลี่ยนด้วย เหมือน
  // แพทเทิร์นเดียวกับ Bookings.js/Customers.js ไม่งั้นตัวกรอง Topbar จะหยุดทำงานเงียบๆ
  let unsubJobs = () => {}
  function startWatchJobs() {
    unsubJobs()
    unsubJobs = watchDocs('job_cards', companyScopeFilters(), 'createdAt', 'desc', 500, rows => {
      if (container.__routerGen !== myGen) { unsubJobs(); return }
      jobs = rows.filter(j => !j.deleted)
      updateStats(); applyFilter()
    })
  }
  startWatchJobs()
  const offCompanyFilter = on('activeCompanyFilter', startWatchJobs)

  function updateStats() {
    // ตัวเลขสรุปด้านบนต้องสอดคล้องกับตารางด้านล่าง — ถ้ากำลังกรองเฉพาะงานตัวเองอยู่ (ownScopeActive) ต้องนับ
    // จากขอบเขตเดียวกัน ไม่ใช่ยอดรวมทั้งบริษัทที่จะไม่ตรงกับตารางที่เห็นจริงจนดูเหมือนเลขผิด
    const scoped = ownScopeActive ? jobs.filter(j => myTeamNames.has(normName(j.techName))) : jobs
    Object.keys(JOB_STATUS).forEach(k => {
      const el = document.getElementById(`jstat-${k}`)
      if (el) el.textContent = scoped.filter(j => j.status === k).length
    })
    const active = scoped.filter(j => !['done','delivered'].includes(j.status)).length
    const totEl = document.getElementById('job-total')
    if (totEl) totEl.textContent = `${scoped.length} งาน (active: ${active})`
    const revEl = document.getElementById('job-revenue')
    const rev = scoped.filter(j => j.status === 'done' || j.status === 'delivered').reduce((s, j) => s + (j.labor || 0), 0)
    if (revEl) revEl.textContent = `รายได้: ${formatCurrency(rev)}`
  }

  function applyFilter() {
    filtered = jobs.filter(j => {
      const ss = statusFilter === 'all' || j.status === statusFilter
      const qs = !search || `${j.jobNo} ${j.custName} ${j.brand} ${j.model} ${j.plate}`.toLowerCase().includes(search)
      const os = !ownScopeActive || myTeamNames.has(normName(j.techName))
      return ss && qs && os
    })
    renderTable()
  }

  function renderTable() {
    const wrap = document.getElementById('jobs-content')
    if (!wrap) return

    if (!filtered.length) {
      wrap.innerHTML = !jobs.length
        ? `<div class="empty-state" style="padding:48px"><div class="empty-icon">🔧</div><div class="empty-title">ยังไม่มี Job Card เลย</div><div class="empty-desc">กด "➕ เปิด Job Card" เพื่อเริ่มบันทึก</div></div>`
        : `<div class="empty-state" style="padding:48px"><div class="empty-icon">🔧</div><div class="empty-title">ไม่พบ Job Card</div></div>`
      return
    }

    wrap.innerHTML = `<div class="table-wrap">
      <table>
        <thead><tr>
          <th>เลขงาน</th><th>ลูกค้า</th><th>รถ/ทะเบียน</th><th>ประเภท</th>
          <th>รายการ</th><th>สถานะ</th><th>เบย์</th><th>ช่าง</th><th>เปิดเมื่อ</th><th></th>
        </tr></thead>
        <tbody>${filtered.map(j => tableRow(j)).join('')}</tbody>
      </table>
    </div>`

    document.querySelectorAll('.job-row').forEach(row => {
      row.addEventListener('click', e => {
        if (e.target.closest('.edit-j,.adv-j,.del-j')) return
        openDetail(jobs.find(j => j.id === row.dataset.id))
      })
    })
    document.querySelectorAll('.adv-j').forEach(btn => btn.addEventListener('click', async e => {
      e.stopPropagation()
      const j = jobs.find(x => x.id === btn.dataset.id)
      if (!j) return
      const next = getNextStatus(j.status)
      if (!next) return
      try {
        await updateDocData('job_cards', j.id, { status: next })
        j.status = next
        showToast(`→ ${JOB_STATUS[next]?.label}`, 'success'); updateStats(); applyFilter()
      } catch { showToast('เกิดข้อผิดพลาด','error') }
    }))
    document.querySelectorAll('.del-j').forEach(btn => btn.addEventListener('click', async e => {
      e.stopPropagation()
      const j = jobs.find(x => x.id === btn.dataset.id)
      if (j) await deleteJob(j)
    }))
  }

  async function deleteJob(j) {
    const ok = await confirmDialog({ title: '🗑️ ลบ Job Card', message: `ยืนยันลบ "${escHtml(j.jobNo)}" — ${escHtml(j.custName)}? การลบนี้ไม่สามารถย้อนกลับได้`, confirmText: 'ลบถาวร', danger: true })
    if (!ok) return
    await softDelete('job_cards', j.id)
    jobs = jobs.filter(x => x.id !== j.id)
    showToast('🗑️ ลบ Job Card แล้ว', 'success')
    document.querySelectorAll('.modal-overlay').forEach(m => m.remove())
    updateStats(); applyFilter()
  }

  function tableRow(j) {
    const st = JOB_STATUS[j.status] || { label: j.status, badge: 'primary' }
    const next = getNextStatus(j.status)
    return `
      <tr class="job-row" data-id="${j.id}" style="cursor:pointer">
        <td><span style="font-weight:600;color:var(--primary)">${escHtml(j.jobNo)}</span></td>
        <td>
          <div style="font-weight:600">${escHtml(j.custName)}</div>
          <div style="font-size:0.75rem;color:var(--text-muted)">${escHtml(j.phone||'')}</div>
        </td>
        <td>
          <div style="font-size:0.85rem">${escHtml(j.brand)} ${escHtml(j.model)}</div>
          <div style="font-size:0.72rem;color:var(--text-muted);font-family:monospace">${escHtml(j.plate||'')}</div>
        </td>
        <td style="font-size:0.78rem">${JOB_TYPE[j.type] || escHtml(j.type)}</td>
        <td style="font-size:0.8rem;max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${escHtml(j.desc||'')}">${escHtml(j.desc||'-')}</td>
        <td><span class="badge badge-${st.badge}">${st.label}</span></td>
        <td style="font-size:0.8rem;color:var(--text-2)">${escHtml(j.bay||'-')}</td>
        <td style="font-size:0.8rem;color:var(--text-muted)">${escHtml(j.techName||'-')}</td>
        <td style="font-size:0.75rem;color:var(--text-muted)">${timeAgo(j.createdAt)}</td>
        <td style="white-space:nowrap">
          ${next ? `<button class="btn btn-primary btn-sm adv-j" data-id="${j.id}" title="เลื่อนสถานะ">→</button>` : '<span style="font-size:0.75rem;color:var(--success)">✅</span>'}
          <button class="btn btn-ghost btn-xs del-j" data-id="${j.id}" title="ลบ">🗑️</button>
        </td>
      </tr>`
  }

  function getNextStatus(s) {
    const flow = ['waiting','checkin','diagnosing','inprogress','waiting_parts','qc','done','delivered']
    const i = flow.indexOf(s); return i >= 0 && i < flow.length - 1 ? flow[i + 1] : null
  }

  function openDetail(j) {
    if (!j) return
    const st = JOB_STATUS[j.status] || { label: j.status, badge: 'primary' }
    const next = getNextStatus(j.status)
    const parts = j.parts || []
    openModal({
      title: '🔧 ' + escHtml(j.jobNo) + ' — ' + escHtml(j.custName), size: 'lg',
      body: `
        <div style="display:flex;gap:16px;flex-wrap:wrap">
          <div style="flex:2;min-width:250px;display:flex;flex-direction:column;gap:10px">
            <div style="display:flex;gap:8px;align-items:center">
              <span class="badge badge-${st.badge}" style="font-size:0.9rem">${st.label}</span>
              <span style="font-size:0.8rem;color:var(--text-muted)">${JOB_TYPE[j.type] || escHtml(j.type)}</span>
            </div>
            ${dRow('👤','ลูกค้า',j.custName)}
            ${dRow('📱','โทร',j.phone||'-')}
            ${dRow('🚗','รถ',`${j.brand} ${j.model}`)}
            ${dRow('🔢','ทะเบียน',j.plate||'-')}
            ${dRow('🛣','เลขไมล์',`${(j.mileage||0).toLocaleString()} km`)}
            ${dRow('🔑','VIN',j.vin||'-')}
            ${dRow('🔧','ช่าง',j.techName||'-')}
            ${dRow('🅿️','เบย์',j.bay||'-')}
            ${dRow('🗓','เปิดเมื่อ',formatDate(j.createdAt))}
          </div>
          <div style="flex:1;min-width:200px;display:flex;flex-direction:column;gap:10px">
            <div style="font-weight:600">รายการซ่อม</div>
            <div style="background:var(--surface-2);padding:10px;border-radius:var(--radius-md);font-size:0.85rem">${escHtml(j.desc||'-')}</div>
            <div style="font-weight:600">อะไหล่ที่ใช้</div>
            ${parts.length ? parts.map(p => `<div style="font-size:0.83rem;padding:4px 8px;background:var(--surface-2);border-radius:4px">🔩 ${escHtml(p)}</div>`).join('') : '<div style="font-size:0.83rem;color:var(--text-muted)">-</div>'}
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px">
              <span style="font-weight:600">ค่าแรง</span>
              <span style="font-size:1.1rem;font-weight:700;color:var(--accent)">${formatCurrency(j.labor)}</span>
            </div>
            ${next ? `<button class="btn btn-primary" id="j-advance">→ ${JOB_STATUS[next]?.label}</button>` : ''}
          </div>
        </div>
      `,
      footer: `<button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">ปิด</button>
               <button class="btn btn-secondary" id="j-edit">✏️ แก้ไข</button>
               <button class="btn btn-danger" id="j-delete">🗑️ ลบ</button>`
    })
    document.getElementById('j-advance')?.addEventListener('click', async () => {
      if (!next) return
      try {
        await updateDocData('job_cards', j.id, { status: next })
        j.status = next; showToast(`→ ${JOB_STATUS[next]?.label}`, 'success')
        document.querySelector('.modal-overlay')?.remove(); updateStats(); applyFilter()
      } catch { showToast('เกิดข้อผิดพลาด','error') }
    })
    document.getElementById('j-edit')?.addEventListener('click', () => { document.querySelector('.modal-overlay')?.remove(); openForm(j) })
    document.getElementById('j-delete')?.addEventListener('click', () => deleteJob(j))
  }

  function openForm(existing = null, prefill = null) {
    const isEdit = !!existing
    const today = todayBangkok()
    const { el, close } = openModal({
      title: isEdit ? '✏️ แก้ไข Job Card' : '➕ เปิด Job Card ใหม่', size: 'lg',
      body: `
        <div style="display:flex;flex-direction:column;gap:12px">
          ${prefill?.customerId ? `<div style="font-size:0.76rem;color:var(--primary);background:var(--primary-dim);padding:6px 10px;border-radius:8px">🔗 เชื่อมกับลูกค้า: ${escHtml(prefill.custName||'')}</div>` : ''}
          ${prefill?.vehicleId ? `<div style="font-size:0.76rem;color:var(--primary);background:var(--primary-dim);padding:6px 10px;border-radius:8px">🔗 เชื่อมกับรถในสต็อก: ${escHtml(`${prefill.brand||''} ${prefill.model||''}`.trim())} (VIN ${escHtml(prefill.vin||'')})</div>` : ''}
          <div class="grid-2">
            <div class="input-group"><label class="input-label">ชื่อลูกค้า *</label><input class="input" id="jf-cust" value="${escHtml(existing?.custName||prefill?.custName||'')}"><span class="input-error" id="jf-cust-e"></span></div>
            <div class="input-group"><label class="input-label">โทร</label><input class="input" id="jf-phone" value="${escHtml(existing?.phone||prefill?.phone||'')}"></div>
          </div>
          <div class="grid-2">
            <div class="input-group"><label class="input-label">ยี่ห้อ</label><input class="input" id="jf-brand" value="${escHtml(existing?.brand||prefill?.brand||'')}"></div>
            <div class="input-group"><label class="input-label">รุ่น</label><input class="input" id="jf-model" value="${escHtml(existing?.model||prefill?.model||'')}"></div>
          </div>
          <div class="grid-2">
            <div class="input-group"><label class="input-label">ทะเบียน</label><input class="input" id="jf-plate" value="${escHtml(existing?.plate||'')}"></div>
            <div class="input-group"><label class="input-label">VIN</label><input class="input" id="jf-vin" value="${escHtml(existing?.vin||prefill?.vin||'')}"></div>
          </div>
          <div class="input-group"><label class="input-label">เลขไมล์</label><input class="input" type="number" id="jf-mileage" value="${existing?.mileage||0}"></div>
          <div class="grid-2">
            <div class="input-group"><label class="input-label">ประเภทงาน</label>
              <select class="input" id="jf-type">
                ${Object.entries(JOB_TYPE).map(([k,v]) => `<option value="${k}" ${existing?.type===k?'selected':''}>${v}</option>`).join('')}
              </select>
            </div>
            <div class="input-group"><label class="input-label">เบย์</label>
              <select class="input" id="jf-bay">
                ${BAYS.map(b => `<option value="${b}" ${existing?.bay===b?'selected':''}>${b}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="grid-2">
            <div class="input-group"><label class="input-label">ช่างรับผิดชอบ</label><input class="input" id="jf-tech" value="${escHtml(existing?.techName||'')}"></div>
            <div class="input-group"><label class="input-label">ค่าแรง (บาท)</label><input class="input" type="number" id="jf-labor" value="${existing?.labor||0}"></div>
          </div>
          <div class="input-group"><label class="input-label">รายละเอียดงาน *</label><textarea class="input" id="jf-desc" rows="3">${escHtml(existing?.desc||'')}</textarea><span class="input-error" id="jf-desc-e"></span></div>
          <div class="input-group"><label class="input-label">สถานะ</label>
            <select class="input" id="jf-status">
              ${Object.entries(JOB_STATUS).map(([k,v]) => `<option value="${k}" ${existing?.status===k?'selected':''}>${v.label}</option>`).join('')}
            </select>
          </div>
        </div>
      `,
      footer: `<button class="btn btn-secondary" id="jfc">ยกเลิก</button><button class="btn btn-primary" id="jfs">💾 บันทึก</button>`
    })
    el.querySelector('#jfc').addEventListener('click', close)
    el.querySelector('#jfs').addEventListener('click', async () => {
      const cust = el.querySelector('#jf-cust').value.trim()
      const desc = el.querySelector('#jf-desc').value.trim()
      if (!cust) { el.querySelector('#jf-cust-e').textContent = 'กรุณาระบุ'; return }
      if (!desc) { el.querySelector('#jf-desc-e').textContent = 'กรุณาระบุ'; return }
      const btn = el.querySelector('#jfs'); btn.disabled = true; btn.innerHTML = '<span class="spinner spinner-sm"></span>'
      const jobNo = isEdit ? existing.jobNo : `JOB-${new Date().getFullYear()}-${String(jobCounter).padStart(3,'0')}`
      const data = {
        // (v1.0.474) ติด companyId ตอนสร้างใหม่เท่านั้น (isEdit ไม่ต้องเติม — updateDocData merge ไม่ทับ
        // companyId เดิมอยู่แล้วถ้าไม่ส่งไป) แพทเทิร์นเดียวกับที่แก้ไว้แล้วใน Bookings.js/Customers.js (v1.0.472)
        ...(isEdit ? {} : { companyId: myEffectiveCompanyId() }),
        jobNo, custName: cust, phone: el.querySelector('#jf-phone').value.trim(),
        brand: el.querySelector('#jf-brand').value.trim(), model: el.querySelector('#jf-model').value.trim(),
        plate: el.querySelector('#jf-plate').value.trim(), vin: el.querySelector('#jf-vin').value.trim(),
        mileage: Number(el.querySelector('#jf-mileage').value)||0,
        type: el.querySelector('#jf-type').value, bay: el.querySelector('#jf-bay').value,
        techName: el.querySelector('#jf-tech').value.trim(), labor: Number(el.querySelector('#jf-labor').value)||0,
        desc, status: el.querySelector('#jf-status').value,
        parts: existing?.parts || [], createdAt: existing?.createdAt || new Date().toISOString(),
        customerId: existing?.customerId || prefill?.customerId || null,
        vehicleId: existing?.vehicleId || prefill?.vehicleId || null,
      }
      try {
        if (isEdit) { await updateDocData('job_cards', existing.id, data); Object.assign(existing, data) }
        else { const id = await createDoc('job_cards', data); jobs.unshift({ ...data, id }); jobCounter++ }
        showToast(isEdit ? 'แก้ไขแล้ว' : '✅ เปิด Job Card แล้ว', 'success')
        close(); updateStats(); applyFilter()
      } catch { showToast('บันทึกไม่สำเร็จ','error') }
    })
  }

  // ── Page HTML ─────────────────────
  container.innerHTML = `
    <div class="page-content animate-slide">
      <div class="page-header">
        <div>
          <div class="page-title">🗂️ Job Card</div>
          <div style="display:flex;gap:12px;align-items:center">
            <span class="page-subtitle" id="job-total">กำลังโหลด...</span>
            <span style="font-size:0.8rem;color:var(--accent)" id="job-revenue"></span>
          </div>
        </div>
        <div class="page-actions">
          <button class="btn btn-secondary btn-sm" id="job-export">📥 Export</button>
          <button class="btn btn-primary" id="add-job-btn">➕ เปิด Job Card</button>
        </div>
      </div>

      ${ownScopeActive ? `
      <div id="job-scope-banner" style="padding:8px 14px;background:var(--primary)11;border:1px solid var(--primary)33;border-radius:var(--radius-sm);margin-bottom:12px;font-size:0.76rem;display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
        <span>🔒 ${myTeamNames.size > 1 ? `กำลังแสดงเฉพาะ Job Card ของคุณและทีมที่ดูแล (${myTeamNames.size} คน)` : `กำลังแสดงเฉพาะ Job Card ที่คุณเป็นช่างรับผิดชอบ (ช่าง = "${escHtml(myDisplayName)}")`}</span>
      </div>
      ` : ''}

      <!-- Status Pills -->
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px;overflow-x:auto;padding-bottom:4px">
        <button class="btn btn-sm jf-btn btn-primary" data-sf="all">ทั้งหมด</button>
        ${Object.entries(JOB_STATUS).map(([k,v]) => `
          <button class="btn btn-sm jf-btn btn-secondary" data-sf="${k}" style="white-space:nowrap">
            ${v.label} <span id="jstat-${k}" style="margin-left:4px;font-weight:700">0</span>
          </button>
        `).join('')}
      </div>

      <!-- Search -->
      <div class="card mb-4" style="padding:10px 16px">
        <div style="position:relative">
          <span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text-muted)">🔍</span>
          <input class="input" id="job-search" placeholder="ค้นหา เลขงาน ลูกค้า รถ ทะเบียน..." style="padding-left:32px">
        </div>
      </div>

      <div id="jobs-content">
        ${[...Array(4)].map(() => `<div class="skeleton" style="height:44px;border-radius:6px;margin-bottom:8px"></div>`).join('')}
      </div>
    </div>
  `

  document.getElementById('add-job-btn').addEventListener('click', () => openForm())
  if (prefillData) openForm(null, prefillData)
  document.getElementById('job-search').addEventListener('input', e => { search = e.target.value.toLowerCase(); applyFilter() })
  document.getElementById('job-export').addEventListener('click', () => {
    exportToExcel(jobs.map(j => ({ เลขงาน:j.jobNo, ลูกค้า:j.custName, โทร:j.phone, รถ:`${j.brand} ${j.model}`, ทะเบียน:j.plate, ประเภท:JOB_TYPE[j.type]||j.type, สถานะ:JOB_STATUS[j.status]?.label||j.status, ช่าง:j.techName, เบย์:j.bay, ค่าแรง:j.labor, วันที่:formatDate(j.createdAt) })), `jobs-${todayBangkok()}.xlsx`, 'Job Cards')
    showToast('Export แล้ว', 'success')
  })
  document.querySelectorAll('.jf-btn').forEach(btn => btn.addEventListener('click', () => {
    statusFilter = btn.dataset.sf
    document.querySelectorAll('.jf-btn').forEach(b => b.className = `btn btn-sm jf-btn ${b.dataset.sf === statusFilter ? 'btn-primary' : 'btn-secondary'}`)
    applyFilter()
  }))

  return function cleanupJobCards() { unsubJobs(); offCompanyFilter() }
}

function dRow(icon, label, value) {
  return `<div style="font-size:0.83rem;display:flex;gap:6px"><span>${icon}</span><span style="color:var(--text-muted);min-width:80px;flex-shrink:0">${label}</span><span style="color:var(--text-2)">${escHtml(String(value ?? ''))}</span></div>`
}
