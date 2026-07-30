import { listDocs, createDoc, updateDocData, seedDemoData, getCommissionData } from '../../core/db.js'
import { formatCurrency, formatDate } from '../../utils/format.js'
import { showToast, getState } from '../../core/store.js'
import { openModal, confirmDialog } from '../../utils/modal.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
import { exportToExcel } from '../../utils/importExport.js'

const DEMO_STAFF_PAY = [
  { id: 'ST001', name: 'อรนุช สายใจ', position: 'Sales Manager', dept: 'ขาย', base: 25000, ot: 2000, allowance: 3000, deduction: 1250, ssf: 750, status: 'paid' },
  { id: 'ST002', name: 'วิชาญ มีโชค', position: 'Sales Executive', dept: 'ขาย', base: 18000, ot: 1500, allowance: 2000, deduction: 900, ssf: 540, status: 'paid' },
  { id: 'ST003', name: 'ธีรยุทธ เก่งกาจ', position: 'Service Advisor', dept: 'บริการ', base: 20000, ot: 3000, allowance: 2500, deduction: 1000, ssf: 600, status: 'pending' },
  { id: 'ST004', name: 'สมหมาย รักงาน', position: 'Technician', dept: 'บริการ', base: 16000, ot: 2500, allowance: 1500, deduction: 800, ssf: 480, status: 'pending' },
  { id: 'ST005', name: 'นภา จันทร์งาม', position: 'Finance Officer', dept: 'การเงิน', base: 22000, ot: 0, allowance: 2000, deduction: 1100, ssf: 660, status: 'paid' },
]

const MONTHS_TH = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']

// เดิมหน้านี้ไม่มีการเช็คสิทธิ์เลย — ถ้าเปิดถึงหน้านี้ได้ (ค่าเริ่มต้นเปิดให้ทุกคนถ้าแอดมินไม่ได้ไปจำกัด
// โมดูล finance ไว้เป็นพิเศษใน Settings > Roles) จะเห็นเงินเดือนพื้นฐาน (ดึงตรงจาก staff.salary ซึ่ง
// isStaff() อ่านได้กว้างอยู่แล้ว) ของพนักงานทุกคนทันที แม้แต่ตอนที่ payroll_records เดือนนั้นยังไม่มีข้อมูล
// จริง (Firestore rules ของ payroll_records เองจำกัดแค่ isFinance()||isManager() อยู่แล้ว แต่หน้านี้ falls
// back ไปอ่าน staff.salary ตรงๆถ้า payroll_records ยังว่าง ทำให้หลบเลี่ยงการป้องกันนั้นไปโดยไม่ตั้งใจ)
const PAYROLL_VIEW_ROLES = ['owner', 'admin', 'manager', 'finance']

function netPay(s) {
  return s.base + s.ot + s.allowance - s.deduction - s.ssf
}

export default async function PayrollPage(container) {
  const myGen = container.__routerGen
  const myRole = getState('role') || getState('user')?.role || 'staff'
  if (!PAYROLL_VIEW_ROLES.includes(myRole)) {
    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="empty-state" style="padding:60px 20px">
          <div class="empty-icon">🔒</div>
          <div class="empty-title">ไม่มีสิทธิ์เข้าถึงหน้านี้</div>
          <div class="empty-desc">ข้อมูลเงินเดือนเปิดให้เฉพาะฝ่ายการเงิน ผู้จัดการขึ้นไป — ติดต่อผู้ดูแลระบบหากต้องการสิทธิ์เข้าถึง</div>
        </div>
      </div>`
    return
  }
  seedDemoData()

  const now = new Date()
  let selectedMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  let staffList = DEMO_STAFF_PAY.map(s => ({ ...s }))
  let filterDept = 'all'
  // staffId → Firestore doc id ของ payroll_records เดือนที่กำลังดูอยู่ (มีก็ต่อเมื่อเคยจ่าย/แก้ไขเดือนนี้มาก่อน)
  let payrollDocIds = {}

  if (container.__routerGen !== myGen) return

  // สร้างรายชื่อพนักงาน+เงินเดือนพื้นฐานของเดือนนั้น (จาก staff จริง+คอมมิชชั่น หรือ demo ถ้ายังไม่มี staff จริง)
  // แล้ว "ทับ" ด้วยค่าที่เคยบันทึกจริงไว้ใน payroll_records ของเดือนนั้น (ถ้ามี) — ฐานะจ่ายแล้ว/แก้ไขเงินเดือน
  // ต้องคงอยู่จริงข้ามการรีเฟรชและข้ามเครื่อง ไม่ใช่แค่ mutate ตัวแปรในหน่วยความจำเหมือนเดิม
  async function loadPayrollForMonth(month) {
    let baseList = DEMO_STAFF_PAY.map(s => ({ ...s, status: 'pending' }))
    try {
      const [staffDocs, comms] = await Promise.all([
        listDocs('staff', [], 'startDate', 'asc', 500).catch(() => []),
        getCommissionData().catch(() => []),
      ])
      if (container.__routerGen !== myGen) return
      if (staffDocs.length) {
        // Phase 2 หลายบริษัท — พนักงานที่ยังไม่มี companyId (ข้อมูลเดิม/shared-service) ยังเข้ารอบจ่ายเงินเดือน
        // เสมอ ไม่ถูกกรองออกโดยไม่ตั้งใจ
        const activeCompanyFilter = getState('activeCompanyFilter') || []
        // softDelete() ไม่ได้ลบเอกสารจริง แค่ตั้ง deleted:true — พนักงานที่ "ลบ" ไปแล้วต้องไม่เข้ารอบจ่ายเงินเดือนต่อ
        const scopedStaffDocs = staffDocs
          .filter(s => !s.deleted)
          .filter(s => !s.companyId || !activeCompanyFilter.length || activeCompanyFilter.includes(s.companyId))
        const commBySales = {}
        comms.forEach(c => { commBySales[c.salesName] = (commBySales[c.salesName] || 0) + (c.incomeTotal || 0) })
        const deptMap = { owner: 'ผู้บริหาร', sales: 'ขาย', service: 'บริการ', finance: 'การเงิน', hr: 'บุคคล' }
        baseList = scopedStaffDocs.map(s => {
          const name = ((s.firstName || '') + ' ' + (s.lastName || '')).trim()
          const base = s.salary || 0
          const ssf = Math.min(Math.round(base * 0.05), 750)
          const commission = commBySales[name] || 0
          return { id: s.id, name, position: s.role || '-', dept: deptMap[s.role] || s.dept || '-', base, ot: 0, allowance: commission, deduction: 0, ssf, status: 'pending', commission }
        })
      }
    } catch {}

    payrollDocIds = {}
    try {
      const records = await listDocs('payroll_records', [['month', '==', month]], 'createdAt', 'asc', 500)
      if (container.__routerGen !== myGen) return
      const byStaffId = {}
      records.forEach(r => { byStaffId[r.staffId] = r })
      baseList = baseList.map(s => {
        const rec = byStaffId[s.id]
        if (!rec) return s
        payrollDocIds[s.id] = rec.id
        return { ...s, base: rec.base ?? s.base, ot: rec.ot ?? s.ot, allowance: rec.allowance ?? s.allowance, deduction: rec.deduction ?? s.deduction, ssf: rec.ssf ?? s.ssf, status: rec.status || s.status, paidAt: rec.paidAt || null }
      })
    } catch {}

    staffList = baseList
  }

  // บันทึกค่าเงินเดือน/สถานะจ่ายของพนักงาน 1 คนสำหรับเดือนที่กำลังดูอยู่ลง Firestore จริง
  // คืน true/false ให้ผู้เรียกรู้ผลจริง — ไม่ swallow error แล้วแสร้งว่าสำเร็จเหมือนเดิม
  async function savePayrollRecord(s) {
    const data = { staffId: s.id, staffName: s.name, month: selectedMonth, base: s.base, ot: s.ot, allowance: s.allowance, deduction: s.deduction, ssf: s.ssf, status: s.status, paidAt: s.status === 'paid' ? (s.paidAt || new Date().toISOString()) : null }
    try {
      if (payrollDocIds[s.id]) await updateDocData('payroll_records', payrollDocIds[s.id], data)
      else payrollDocIds[s.id] = await createDoc('payroll_records', data)
      return true
    } catch { return false }
  }

  function getFiltered() {
    if (filterDept === 'all') return staffList
    return staffList.filter(s => s.dept === filterDept)
  }

  function getDepts() {
    return [...new Set(staffList.map(s => s.dept))]
  }

  function getTotals(list) {
    return list.reduce((a, s) => ({
      base: a.base + s.base,
      ot: a.ot + s.ot,
      allowance: a.allowance + s.allowance,
      deduction: a.deduction + s.deduction,
      ssf: a.ssf + s.ssf,
      net: a.net + netPay(s),
    }), { base: 0, ot: 0, allowance: 0, deduction: 0, ssf: 0, net: 0 })
  }

  function renderPage() {
    const filtered = getFiltered()
    const totals = getTotals(filtered)
    const allTotals = getTotals(staffList)
    const paidCount = filtered.filter(s => s.status === 'paid').length
    const pendingCount = filtered.filter(s => s.status === 'pending').length
    const [y, m] = selectedMonth.split('-')
    const monthLabel = `${MONTHS_TH[parseInt(m) - 1]} ${y}`

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">💳 Payroll</div>
            <div class="page-subtitle">รอบเงินเดือน ${monthLabel}</div>
          </div>
          <div class="page-actions">
            <input type="month" class="input" id="pay-month" value="${selectedMonth}" style="width:160px">
            <button class="btn btn-secondary" id="pay-export">📥 Export</button>
            <button class="btn btn-primary" id="pay-all-btn">✅ จ่ายทั้งหมด</button>
          </div>
        </div>

        <!-- KPI -->
        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:20px">
          ${kpi('👥 พนักงาน', `${filtered.length} คน`, 'primary')}
          ${kpi('💰 เงินเดือนสุทธิ', formatCurrency(totals.net), 'success')}
          ${kpi('✅ จ่ายแล้ว', `${paidCount} คน`, 'success', formatCurrency(filtered.filter(s=>s.status==='paid').reduce((a,s)=>a+netPay(s),0)))}
          ${kpi('⏳ ค้างจ่าย', `${pendingCount} คน`, 'warning', formatCurrency(filtered.filter(s=>s.status==='pending').reduce((a,s)=>a+netPay(s),0)))}
        </div>

        <!-- Summary Breakdown -->
        <div class="card" style="padding:20px;margin-bottom:16px">
          <div style="font-weight:700;margin-bottom:14px">📊 สรุปค่าใช้จ่ายพนักงาน</div>
          <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px;text-align:center">
            ${summaryBox('เงินเดือนฐาน', totals.base, 'primary')}
            ${summaryBox('OT', totals.ot, 'accent')}
            ${summaryBox('เบี้ยเลี้ยง', totals.allowance, 'accent')}
            ${summaryBox('หักภาษี', totals.deduction, 'danger')}
            ${summaryBox('ประกันสังคม', totals.ssf, 'warning')}
          </div>
          <div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
            <span style="font-weight:600">ยอดจ่ายรวมสุทธิ</span>
            <span style="font-size:1.4rem;font-weight:700;color:var(--success)">${formatCurrency(totals.net)}</span>
          </div>
        </div>

        <!-- Dept filter -->
        <div style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap">
          <button class="btn btn-sm dept-btn ${filterDept==='all'?'btn-primary':'btn-secondary'}" data-dept="all">ทั้งหมด</button>
          ${getDepts().map(d => `<button class="btn btn-sm dept-btn ${filterDept===d?'btn-primary':'btn-secondary'}" data-dept="${escHtml(d)}">${escHtml(d)}</button>`).join('')}
        </div>

        <!-- Table -->
        <div class="card" style="padding:0;overflow:hidden">
          <table class="table">
            <thead>
              <tr>
                <th>พนักงาน</th>
                <th>ตำแหน่ง</th>
                <th class="text-right">เงินเดือน</th>
                <th class="text-right">OT</th>
                <th class="text-right">เบี้ยเลี้ยง</th>
                <th class="text-right">หัก</th>
                <th class="text-right">ประกันสังคม</th>
                <th class="text-right">สุทธิ</th>
                <th>สถานะ</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${filtered.map(s => staffRow(s)).join('')}
            </tbody>
            <tfoot>
              <tr style="background:var(--surface-2);font-weight:700">
                <td colspan="2">รวม (${filtered.length} คน)</td>
                <td class="text-right">${formatCurrency(totals.base)}</td>
                <td class="text-right">${formatCurrency(totals.ot)}</td>
                <td class="text-right">${formatCurrency(totals.allowance)}</td>
                <td class="text-right" style="color:var(--danger)">-${formatCurrency(totals.deduction)}</td>
                <td class="text-right" style="color:var(--danger)">-${formatCurrency(totals.ssf)}</td>
                <td class="text-right" style="color:var(--success)">${formatCurrency(totals.net)}</td>
                <td colspan="2"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    `

    // Events
    document.getElementById('pay-month')?.addEventListener('change', async e => {
      selectedMonth = e.target.value
      await loadPayrollForMonth(selectedMonth)
      if (container.__routerGen !== myGen) return
      renderPage()
    })

    document.querySelectorAll('.dept-btn').forEach(btn => {
      btn.addEventListener('click', () => { filterDept = btn.dataset.dept; renderPage() })
    })

    document.getElementById('pay-all-btn')?.addEventListener('click', async (e) => {
      const pending = staffList.filter(s => s.status === 'pending')
      if (!pending.length) { showToast('จ่ายครบแล้ว', 'success'); return }
      if (!await confirmDialog({ title: 'จ่ายเงินเดือน', message: `ยืนยันจ่ายเงินเดือน ${pending.length} คน รวม ${formatCurrency(pending.reduce((a,s)=>a+netPay(s),0))}?`, confirmText: 'ยืนยัน' })) return
      // เดิมไม่ disable ปุ่มระหว่างรอบันทึก กดซ้ำเร็วๆหลังยืนยันจะยิง Promise.all 2 ชุดซ้อนกัน สร้างรายการ
      // จ่ายเงินเดือนซ้ำให้พนักงานคนเดียวกันได้
      const btn = e.currentTarget
      btn.disabled = true
      const paidAt = new Date().toISOString()
      const results = await Promise.all(pending.map(s => savePayrollRecord({ ...s, status: 'paid', paidAt })))
      const okCount = results.filter(Boolean).length
      pending.forEach((s, i) => { if (results[i]) { s.status = 'paid'; s.paidAt = paidAt } })
      showToast(okCount === pending.length ? `✅ จ่ายเงินเดือน ${okCount} คน เรียบร้อย` : `จ่ายสำเร็จ ${okCount}/${pending.length} คน — ที่เหลือบันทึกไม่สำเร็จ ลองใหม่`, okCount === pending.length ? 'success' : 'warning')
      renderPage()
    })

    document.querySelectorAll('.pay-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const s = staffList.find(x => x.id === btn.dataset.id)
        if (!s || s.status === 'paid') return
        // เดิมไม่ disable ปุ่มระหว่างรอบันทึก กดซ้ำเร็วๆก่อนสถานะอัปเดตจะสร้างรายการจ่ายซ้ำ
        e.currentTarget.disabled = true
        const paidAt = new Date().toISOString()
        const ok = await savePayrollRecord({ ...s, status: 'paid', paidAt })
        if (!ok) { e.currentTarget.disabled = false; showToast('บันทึกไม่สำเร็จ', 'error'); return }
        s.status = 'paid'; s.paidAt = paidAt
        showToast(`✅ จ่าย ${s.name} แล้ว`, 'success')
        renderPage()
      })
    })

    document.querySelectorAll('.edit-pay-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const s = staffList.find(x => x.id === btn.dataset.id)
        if (s) openEditForm(s)
      })
    })

    document.getElementById('pay-export')?.addEventListener('click', () => {
      exportToExcel(filtered.map(s => ({
        'รหัส': s.id, 'ชื่อ': s.name, 'ตำแหน่ง': s.position, 'แผนก': s.dept,
        'เงินเดือนฐาน': s.base, 'OT': s.ot, 'เบี้ยเลี้ยง': s.allowance,
        'หักภาษี': s.deduction, 'ประกันสังคม': s.ssf, 'สุทธิ': netPay(s), 'สถานะ': s.status
      })), `Payroll_${selectedMonth}`)
    })
  }

  function staffRow(s) {
    const net = netPay(s)
    return `<tr>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <div style="width:30px;height:30px;border-radius:50%;background:var(--primary-dim);display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:700;color:var(--primary)">
            ${escHtml(s.name.slice(0,1))}
          </div>
          <div>
            <div style="font-weight:600;font-size:0.88rem">${escHtml(s.name)}</div>
            <div style="font-size:0.73rem;color:var(--text-muted)">${escHtml(s.dept)}</div>
          </div>
        </div>
      </td>
      <td style="font-size:0.83rem;color:var(--text-muted)">${escHtml(s.position)}</td>
      <td class="text-right">${formatCurrency(s.base)}</td>
      <td class="text-right" style="color:var(--accent)">${s.ot > 0 ? '+'+formatCurrency(s.ot) : '-'}</td>
      <td class="text-right" style="color:var(--accent)">${s.allowance > 0 ? '+'+formatCurrency(s.allowance) : '-'}</td>
      <td class="text-right" style="color:var(--danger)">${s.deduction > 0 ? '-'+formatCurrency(s.deduction) : '-'}</td>
      <td class="text-right" style="color:var(--danger)">${s.ssf > 0 ? '-'+formatCurrency(s.ssf) : '-'}</td>
      <td class="text-right" style="font-weight:700;color:var(--success)">${formatCurrency(net)}</td>
      <td>
        <span class="badge badge-${s.status==='paid'?'success':'warning'}">${s.status==='paid'?'✅ จ่ายแล้ว':'⏳ ค้างจ่าย'}</span>
      </td>
      <td>
        <div style="display:flex;gap:4px">
          <button class="btn btn-ghost btn-sm edit-pay-btn" data-id="${s.id}">✏️</button>
          ${s.status !== 'paid' ? `<button class="btn btn-primary btn-sm pay-btn" data-id="${s.id}">💳 จ่าย</button>` : ''}
        </div>
      </td>
    </tr>`
  }

  function openEditForm(s) {
    const { el, close } = openModal({
      title: '✏️ แก้ไขข้อมูลเงินเดือน — ' + escHtml(s.name), size: 'md',
      body: `
        <div style="display:flex;flex-direction:column;gap:12px">
          <div class="grid-2">
            <div class="input-group"><label class="input-label">เงินเดือนฐาน</label><input class="input" id="pf-base" type="number" value="${s.base}"></div>
            <div class="input-group"><label class="input-label">OT</label><input class="input" id="pf-ot" type="number" value="${s.ot}"></div>
          </div>
          <div class="grid-2">
            <div class="input-group"><label class="input-label">เบี้ยเลี้ยง</label><input class="input" id="pf-allow" type="number" value="${s.allowance}"></div>
            <div class="input-group"><label class="input-label">หักภาษี</label><input class="input" id="pf-ded" type="number" value="${s.deduction}"></div>
          </div>
          <div class="input-group"><label class="input-label">ประกันสังคม (5%)</label><input class="input" id="pf-ssf" type="number" value="${s.ssf}"></div>
          <div style="background:var(--surface-2);padding:12px;border-radius:var(--radius-md)">
            <div style="display:flex;justify-content:space-between">
              <span>สุทธิ (ประมาณ)</span>
              <span id="pf-net-preview" style="font-weight:700;color:var(--success)">${formatCurrency(netPay(s))}</span>
            </div>
          </div>
        </div>
      `,
      footer: `<button class="btn btn-secondary" id="pfc">ยกเลิก</button><button class="btn btn-primary" id="pfs">💾 บันทึก</button>`
    })

    // Live preview
    const inputs = ['pf-base','pf-ot','pf-allow','pf-ded','pf-ssf']
    inputs.forEach(id => {
      el.querySelector('#'+id)?.addEventListener('input', () => {
        const b = +el.querySelector('#pf-base').value || 0
        const o = +el.querySelector('#pf-ot').value || 0
        const a = +el.querySelector('#pf-allow').value || 0
        const d = +el.querySelector('#pf-ded').value || 0
        const f = +el.querySelector('#pf-ssf').value || 0
        const n = el.querySelector('#pf-net-preview')
        if (n) n.textContent = formatCurrency(b + o + a - d - f)
      })
    })

    el.querySelector('#pfc').addEventListener('click', close)
    el.querySelector('#pfs').addEventListener('click', async () => {
      const updated = {
        ...s,
        base: +el.querySelector('#pf-base').value || s.base,
        ot: +el.querySelector('#pf-ot').value || 0,
        allowance: +el.querySelector('#pf-allow').value || 0,
        deduction: +el.querySelector('#pf-ded').value || 0,
        ssf: +el.querySelector('#pf-ssf').value || 0,
      }
      const ok = await savePayrollRecord(updated)
      if (!ok) { showToast('บันทึกไม่สำเร็จ', 'error'); return }
      Object.assign(s, updated)
      showToast(`แก้ไขข้อมูล ${s.name} แล้ว`, 'success')
      close(); renderPage()
    })
  }

  await loadPayrollForMonth(selectedMonth)
  if (container.__routerGen !== myGen) return
  renderPage()
}

function kpi(title, value, color, sub = '') {
  return `<div class="kpi-card">
    <div class="kpi-title">${title}</div>
    <div class="kpi-value" style="color:var(--${color})">${value}</div>
    ${sub ? `<div class="kpi-sub">${sub}</div>` : ''}
  </div>`
}

function summaryBox(label, value, color) {
  return `<div style="background:var(--surface-2);padding:12px;border-radius:var(--radius-md)">
    <div style="font-size:0.73rem;color:var(--text-muted);margin-bottom:4px">${label}</div>
    <div style="font-weight:700;color:var(--${color})">${formatCurrency(value)}</div>
  </div>`
}
