/**
 * Salary Scale — โครงสร้างเงินเดือน
 * Route: /hr/salary-scale
 */
import { formatCurrency } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast, getState } from '../../core/store.js'
import { listDocs, updateDocData, seedDemoData } from '../../core/db.js'

// พบว่าหน้านี้ไม่มีการเช็คสิทธิ์เลยแม้แต่จุดเดียว — พนักงานทุกคนเห็นตารางเงินเดือนรายบุคคล + เทียบตลาดของ
// เพื่อนร่วมงานทุกคน และกดปุ่ม "ปรับเงินเดือน" เขียนเงินเดือนใหม่ลง Firestore ตรงๆได้เลย ไม่ต่างจาก
// SALARY_VIEW_ROLES ใน Staff.js/StaffProfile.js — หน้านี้ทั้งหน้ามีไว้เพื่อดูโครงสร้าง/ปรับเงินเดือนเท่านั้น
// ไม่มีประโยชน์อื่นให้พนักงานทั่วไปเข้าถึง จึงบล็อกทั้งหน้าเหมือนแบบที่ Payroll.js (finance) ทำไว้แล้ว แทนที่
// จะซ่อนแค่บางส่วน (การป้องกันจริงต้องทำที่ Firestore Rules ด้วยเช่นกัน)
const SALARY_SCALE_VIEW_ROLES = ['owner', 'admin', 'manager', 'hr']

const SALARY_GRADES = [
  { grade: 'G1', title: 'พนักงานใหม่', min: 15000, max: 20000, midpoint: 17500 },
  { grade: 'G2', title: 'พนักงานทั่วไป', min: 20000, max: 28000, midpoint: 24000 },
  { grade: 'G3', title: 'พนักงานอาวุโส', min: 28000, max: 38000, midpoint: 33000 },
  { grade: 'G4', title: 'หัวหน้างาน', min: 38000, max: 50000, midpoint: 44000 },
  { grade: 'G5', title: 'ผู้จัดการ', min: 50000, max: 70000, midpoint: 60000 },
  { grade: 'G6', title: 'ผู้จัดการอาวุโส', min: 70000, max: 95000, midpoint: 82500 },
]

function compaRatio(salary, grade) {
  const g = SALARY_GRADES.find(x => x.grade === grade)
  return g ? Math.round(salary / g.midpoint * 100) : 100
}

function marketRatio(salary, market) {
  return Math.round(salary / market * 100)
}

export default async function SalaryScalePage(container) {
  const myGen = container.__routerGen
  const myRole = getState('role') || getState('user')?.role || 'staff'
  if (!SALARY_SCALE_VIEW_ROLES.includes(myRole)) {
    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="empty-state" style="padding:60px 20px">
          <div class="empty-icon">🔒</div>
          <div class="empty-title">ไม่มีสิทธิ์เข้าถึงหน้านี้</div>
          <div class="empty-desc">โครงสร้างเงินเดือนเปิดให้เฉพาะผู้บริหาร/ผู้จัดการ/HR — ติดต่อผู้ดูแลระบบหากต้องการสิทธิ์เข้าถึง</div>
        </div>
      </div>`
    return
  }
  seedDemoData()

  let staff = []
  let activeTab = 'structure'
  let loading = true

  async function loadData() {
    loading = true
    try { staff = await listDocs('salary_scale_staff', [], 'name', 'asc', 200) } catch (e) { staff = [] }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const totalPayroll = staff.reduce((a, s) => a + s.salary, 0)
    const underpaid = staff.filter(s => marketRatio(s.salary, s.market) < 95).length
    // เดิมหารด้วย staff.length ตรงๆไม่มีการ์ดกัน 0 — ตอน staff ว่าง (ยังไม่มีข้อมูลจริง) จะได้ NaN% โชว์ตรงๆ
    const avgCompa = staff.length ? Math.round(staff.reduce((a, s) => a + compaRatio(s.salary, s.grade), 0) / staff.length) : 0

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">💼 Salary Scale</div>
            <div class="page-subtitle">โครงสร้างเงินเดือน — Grade และ Market Comparison</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="review-btn">📋 ทบทวนเงินเดือน</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('💰 Payroll รวม', formatCurrency(totalPayroll) + '/เดือน', 'primary')}
          ${kpi('📊 Compa Ratio', avgCompa + '%', avgCompa >= 95 ? 'success' : 'warning')}
          ${kpi('⚠️ ต่ำกว่าตลาด', underpaid + ' คน', underpaid > 0 ? 'danger' : 'success')}
          ${kpi('👥 พนักงาน', staff.length + ' คน', 'secondary')}
        </div>

        <!-- Tabs -->
        <div style="display:flex;gap:4px;margin-bottom:14px">
          <button class="btn btn-xs ${activeTab==='structure'?'btn-primary':'btn-secondary'} tab-btn" data-t="structure">📊 Grade Structure</button>
          <button class="btn btn-xs ${activeTab==='individual'?'btn-primary':'btn-secondary'} tab-btn" data-t="individual">👤 รายบุคคล</button>
        </div>

        ${activeTab === 'structure' ? `
          <div style="display:flex;flex-direction:column;gap:8px">
            ${SALARY_GRADES.map(g => {
              const maxGrade = SALARY_GRADES[SALARY_GRADES.length-1].max
              const minPct = g.min / maxGrade * 100
              const maxPct = g.max / maxGrade * 100
              const midPct = g.midpoint / maxGrade * 100
              // เดิม headcount ต่อ grade เป็นตัวเลข hardcode ตายตัว ไม่เคยตรงกับจำนวนพนักงานจริงต่อ grade เลย
              // แก้ให้นับจากข้อมูล staff ที่โหลดมาจริงแทน
              const headcount = staff.filter(s => s.grade === g.grade).length
              return `<div class="card" style="padding:12px 14px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                  <div>
                    <span style="font-weight:700;font-size:0.88rem">${g.grade}</span>
                    <span style="font-size:0.78rem;color:var(--text-muted);margin-left:8px">${g.title}</span>
                  </div>
                  <div style="font-size:0.75rem;color:var(--text-muted)">${headcount} คน</div>
                </div>
                <div style="position:relative;height:20px;background:var(--surface-2);border-radius:4px;margin-bottom:6px">
                  <div style="position:absolute;left:${minPct}%;width:${maxPct-minPct}%;height:20px;background:var(--primary)22;border:1px solid var(--primary);border-radius:4px"></div>
                  <div style="position:absolute;left:${midPct - 0.5}%;width:1%;height:20px;background:var(--primary);border-radius:1px"></div>
                </div>
                <div style="display:flex;justify-content:space-between;font-size:0.72rem;color:var(--text-muted)">
                  <span>${formatCurrency(g.min)}</span>
                  <span style="color:var(--primary)">Mid: ${formatCurrency(g.midpoint)}</span>
                  <span>${formatCurrency(g.max)}</span>
                </div>
              </div>`
            }).join('')}
          </div>
        ` : `
          <div class="card" style="overflow:hidden">
            <table style="width:100%;border-collapse:collapse">
              <thead>
                <tr style="border-bottom:1px solid var(--border);font-size:0.73rem;color:var(--text-muted)">
                  <th style="padding:8px 14px;text-align:left">พนักงาน</th>
                  <th style="padding:8px 10px">Grade</th>
                  <th style="padding:8px 10px;text-align:right">เงินเดือน</th>
                  <th style="padding:8px 10px;text-align:right">ตลาด</th>
                  <th style="padding:8px 10px;text-align:right">Compa</th>
                  <th style="padding:8px 10px;text-align:right">Market Ratio</th>
                  <th style="padding:8px 14px"></th>
                </tr>
              </thead>
              <tbody>
                ${staff.map(s => {
                  const cr = compaRatio(s.salary, s.grade)
                  const mr = marketRatio(s.salary, s.market)
                  return `<tr style="border-bottom:1px solid var(--border);font-size:0.8rem">
                    <td style="padding:8px 14px">
                      <div style="font-weight:600">${s.name}</div>
                      <div style="font-size:0.68rem;color:var(--text-muted)">${s.dept}</div>
                    </td>
                    <td style="padding:8px 10px;text-align:center"><span class="badge badge-secondary" style="font-size:0.6rem">${s.grade}</span></td>
                    <td style="padding:8px 10px;text-align:right;font-weight:700">${formatCurrency(s.salary)}</td>
                    <td style="padding:8px 10px;text-align:right;color:var(--text-muted)">${formatCurrency(s.market)}</td>
                    <td style="padding:8px 10px;text-align:right;color:var(--${cr>=95?'success':'warning'})">${cr}%</td>
                    <td style="padding:8px 10px;text-align:right;color:var(--${mr>=95?'success':'danger'})">${mr}%</td>
                    <td style="padding:8px 14px;text-align:right"><button class="btn btn-xs btn-secondary adj-btn" data-id="${s.id}">✏️</button></td>
                  </tr>`
                }).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    `

    container.querySelectorAll('.tab-btn').forEach(b => b.addEventListener('click', () => { activeTab = b.dataset.t; renderPage() }))
    container.querySelectorAll('.adj-btn').forEach(b => b.addEventListener('click', () => {
      const s = staff.find(x => x.id === b.dataset.id)
      if (s) openModal({
        title: '✏️ ปรับเงินเดือน ' + s.name,
        size: 'sm',
        body: `<div style="display:grid;gap:10px">
          ${row('Grade ปัจจุบัน', s.grade)}
          ${row('เงินเดือนปัจจุบัน', formatCurrency(s.salary))}
          ${row('อ้างอิงตลาด', formatCurrency(s.market))}
          <div class="input-group"><label class="input-label">เงินเดือนใหม่</label><input class="input" type="number" id="new-sal" value="${s.salary}"></div>
        </div>`,
        async onConfirm() {
          const newSalary = parseInt(document.getElementById('new-sal')?.value)||s.salary
          s.salary = newSalary
          renderPage()
          try {
            await updateDocData('salary_scale_staff', s.id, { salary: newSalary })
            showToast('✅ อัปเดตเงินเดือนแล้ว','success')
          } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
        }
      })
    }))
    document.getElementById('review-btn')?.addEventListener('click', () => {
      const belowMkt = staff.filter(s => marketRatio(s.salary, s.market) < 95)
      // เดิม hardcode รอบ H2/2569 ตายตัว (ถูกแค่ครึ่งปีนี้ จะกลายเป็นรอบเก่าทันทีขึ้นครึ่งปีถัดไป) แก้ให้
      // คำนวณรอบจากวันที่จริงเสมอ
      const now = new Date()
      const reviewPeriod = `${now.getMonth() < 6 ? 'H1' : 'H2'}/${now.getFullYear() + 543}`
      openModal({
        title: `📋 รอบทบทวนเงินเดือน ${reviewPeriod}`,
        size: 'md',
        body: `
          <div style="font-size:0.82rem">
            <div style="font-size:0.74rem;color:var(--text-muted);margin-bottom:10px">
              พนักงานที่เงินเดือนต่ำกว่าตลาด (Market Ratio < 95%)
            </div>
            ${belowMkt.length > 0 ? `
            <table style="width:100%;border-collapse:collapse;font-size:0.74rem">
              <thead>
                <tr style="border-bottom:2px solid var(--border);background:var(--surface-2)">
                  <th style="padding:7px 9px;text-align:left">พนักงาน</th>
                  <th style="padding:7px 9px;text-align:left">แผนก</th>
                  <th style="padding:7px 9px;text-align:right">ปัจจุบัน</th>
                  <th style="padding:7px 9px;text-align:right">ตลาด</th>
                  <th style="padding:7px 9px;text-align:right">Ratio</th>
                </tr>
              </thead>
              <tbody>
                ${belowMkt.map(s => {
                  const ratio = marketRatio(s.salary, s.market)
                  const c = ratio < 90 ? 'var(--danger)' : 'var(--warning)'
                  return `<tr style="border-bottom:1px solid var(--border-subtle)">
                    <td style="padding:6px 9px;font-weight:700">${s.name}</td>
                    <td style="padding:6px 9px;color:var(--text-muted)">${s.dept}</td>
                    <td style="padding:6px 9px;text-align:right">฿${s.salary.toLocaleString()}</td>
                    <td style="padding:6px 9px;text-align:right;color:var(--text-muted)">฿${s.market.toLocaleString()}</td>
                    <td style="padding:6px 9px;text-align:right;font-weight:700;color:${c}">${ratio}%</td>
                  </tr>`
                }).join('')}
              </tbody>
            </table>` : `<div style="text-align:center;padding:16px;color:var(--success)">✅ ไม่มีพนักงานที่ต่ำกว่าตลาด</div>`}
            <div style="margin-top:12px;padding:10px;background:var(--surface-2);border-radius:8px;font-size:0.72rem;color:var(--text-muted)">
              💡 แนะนำปรับ Ratio < 90% ก่อน เพื่อป้องกัน Turnover
            </div>
          </div>
        `
      })
    })
  }

  await loadData()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
function row(l, v) { return `<div style="display:flex;justify-content:space-between;font-size:0.8rem;padding:4px 0;border-bottom:1px solid var(--border)"><span style="color:var(--text-muted)">${l}</span><span>${v}</span></div>` }
