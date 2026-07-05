/**
 * Onboarding — ปฐมนิเทศพนักงานใหม่
 * Route: /hr/onboarding
 */
import { formatDate, timeAgo } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'

function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10) }

const TASK_CATS = {
  docs:     { label: 'เอกสาร', color: 'primary', icon: '📄' },
  system:   { label: 'ระบบ/IT', color: 'secondary', icon: '💻' },
  training: { label: 'อบรม', color: 'warning', icon: '🎓' },
  meeting:  { label: 'นัดประชุม', color: 'success', icon: '🤝' },
  equip:    { label: 'อุปกรณ์', color: 'secondary', icon: '🛠' },
}

const ONBOARDING_TEMPLATE = [
  { id: 'T01', cat: 'docs', task: 'กรอกแบบฟอร์มข้อมูลส่วนตัว', dueDay: 1 },
  { id: 'T02', cat: 'docs', task: 'ส่งสำเนาเอกสาร (บัตร ทะเบียนบ้าน ฯลฯ)', dueDay: 1 },
  { id: 'T03', cat: 'system', task: 'สร้าง account อีเมลบริษัท', dueDay: 1 },
  { id: 'T04', cat: 'system', task: 'เข้าถึงระบบ LAMOM ONE', dueDay: 2 },
  { id: 'T05', cat: 'equip', task: 'รับอุปกรณ์ทำงาน (คอม/โทรศัพท์)', dueDay: 1 },
  { id: 'T06', cat: 'meeting', task: 'พบผู้บังคับบัญชาโดยตรง', dueDay: 1 },
  { id: 'T07', cat: 'meeting', task: 'Tour ทั่วบริษัท + แนะนำทีม', dueDay: 2 },
  { id: 'T08', cat: 'training', task: 'อบรม Product Knowledge (EV)', dueDay: 3 },
  { id: 'T09', cat: 'training', task: 'อบรม SOP ฝ่ายที่สังกัด', dueDay: 5 },
  { id: 'T10', cat: 'training', task: 'อบรม LAMOM ONE — ใช้งานระบบ', dueDay: 5 },
  { id: 'T11', cat: 'meeting', task: 'ประชุม 1:1 กับหัวหน้า — เซ็ตเป้าหมาย', dueDay: 7 },
  { id: 'T12', cat: 'docs', task: 'เซ็นสัญญาจ้างงาน', dueDay: 3 },
]

export default async function OnboardingPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let staff = []
  let selected = null
  let loading = true

  async function loadData() {
    loading = true
    try { staff = await listDocs('onboarding_staff', [], 'startDate', 'desc', 200) } catch (e) { staff = [] }
    if (!selected || !staff.find(x => x.id === selected)) selected = staff[0]?.id
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const s = staff.find(x => x.id === selected) || staff[0]
    const doneTasks = s ? (s.tasks||[]).filter(t => t.done).length : 0
    const totalTasks = ONBOARDING_TEMPLATE.length
    const pct = totalTasks ? Math.round(doneTasks / totalTasks * 100) : 0

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🎉 Onboarding</div>
            <div class="page-subtitle">ปฐมนิเทศพนักงานใหม่ — ${staff.length} คน</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="add-staff-btn">+ เพิ่มพนักงานใหม่</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:240px 1fr;gap:14px">
          <!-- Staff list -->
          <div style="display:flex;flex-direction:column;gap:6px">
            ${staff.map(x => {
              const xDone = (x.tasks||[]).filter(t => t.done).length
              const xPct = totalTasks ? Math.round(xDone / totalTasks * 100) : 0
              return `<div class="card staff-tab" data-id="${x.id}" style="padding:10px 12px;cursor:pointer;border:2px solid ${x.id===selected?'var(--primary)':'transparent'}">
                <div style="font-weight:600;font-size:0.83rem">${x.name}</div>
                <div style="font-size:0.68rem;color:var(--text-muted)">${x.role} · ${x.dept}</div>
                <div style="font-size:0.68rem;color:var(--text-muted)">เริ่ม: ${formatDate(x.startDate)}</div>
                <div style="margin-top:6px;background:var(--surface-2);border-radius:3px;height:5px">
                  <div style="width:${xPct}%;background:var(--${xPct===100?'success':xPct>=50?'warning':'primary'});height:5px;border-radius:3px"></div>
                </div>
                <div style="font-size:0.65rem;color:var(--text-muted);text-align:right;margin-top:2px">${xPct}%</div>
              </div>`
            }).join('')}
            ${!staff.length ? `<div style="color:var(--text-muted);font-size:0.8rem;padding:10px">ยังไม่มีพนักงานใหม่</div>` : ''}
          </div>

          <!-- Checklist -->
          <div>
            ${s ? `
              <div class="card" style="padding:14px;margin-bottom:12px">
                <div style="display:flex;justify-content:space-between;margin-bottom:10px">
                  <div>
                    <div style="font-weight:700;font-size:1rem">${s.name}</div>
                    <div style="font-size:0.75rem;color:var(--text-muted)">${s.role} · ${s.dept} · เริ่ม ${formatDate(s.startDate)}</div>
                  </div>
                  <div style="font-size:1.5rem;font-weight:900;color:var(--${pct===100?'success':pct>=50?'warning':'primary'})">${pct}%</div>
                </div>
                <div style="background:var(--surface-2);border-radius:4px;height:8px;margin-bottom:14px">
                  <div style="width:${pct}%;background:var(--${pct===100?'success':pct>=50?'warning':'primary'});height:8px;border-radius:4px"></div>
                </div>
                ${Object.entries(TASK_CATS).map(([catKey, catVal]) => {
                  const catTasks = (s.tasks||[]).filter(t => t.cat === catKey)
                  return `<div style="margin-bottom:12px">
                    <div style="font-size:0.73rem;font-weight:700;color:var(--text-muted);margin-bottom:6px">${catVal.icon} ${catVal.label}</div>
                    ${catTasks.map(t => `
                      <label style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--border);cursor:pointer;font-size:0.8rem">
                        <input type="checkbox" class="task-check" data-sid="${s.id}" data-tid="${t.id}" ${t.done?'checked':''} style="accent-color:var(--primary)">
                        <span style="${t.done?'text-decoration:line-through;color:var(--text-muted)':''}">${t.task}</span>
                        <span style="margin-left:auto;font-size:0.65rem;color:var(--text-muted)">วันที่ ${t.dueDay}</span>
                      </label>
                    `).join('')}
                  </div>`
                }).join('')}
              </div>
            ` : '<div style="color:var(--text-muted);padding:20px">เลือกพนักงาน</div>'}
          </div>
        </div>
      </div>
    `

    container.querySelectorAll('.staff-tab').forEach(b => b.addEventListener('click', () => { selected = b.dataset.id; renderPage() }))
    container.querySelectorAll('.task-check').forEach(cb => cb.addEventListener('change', async () => {
      const sid = cb.dataset.sid; const tid = cb.dataset.tid
      const staffMember = staff.find(x => x.id === sid)
      if (!staffMember) return
      const tasks = (staffMember.tasks||[]).map(t => t.id === tid ? { ...t, done: cb.checked } : t)
      await updateDocData('onboarding_staff', sid, { tasks })
      await loadData()
    }))
    document.getElementById('add-staff-btn')?.addEventListener('click', openAddForm)
  }

  function openAddForm() {
    openModal({
      title: '+ เพิ่มพนักงานใหม่',
      size: 'sm',
      body: `<div style="display:grid;gap:10px">
        <div class="input-group"><label class="input-label">ชื่อพนักงาน *</label><input class="input" id="ob-name"></div>
        <div class="input-group"><label class="input-label">ตำแหน่ง</label><input class="input" id="ob-role"></div>
        <div class="input-group"><label class="input-label">แผนก</label>
          <select class="input" id="ob-dept"><option>ฝ่ายขาย</option><option>บริการ</option><option>การเงิน</option><option>HR</option><option>การตลาด</option></select>
        </div>
        <div class="input-group"><label class="input-label">วันเริ่มงาน</label><input class="input" type="date" id="ob-start" value="${addDays(0)}"></div>
      </div>`,
      async onConfirm() {
        const name = document.getElementById('ob-name')?.value?.trim()
        if (!name) { showToast('❗ กรุณากรอกชื่อ', 'error'); return false }
        const newId = await createDoc('onboarding_staff', {
          name, role: document.getElementById('ob-role')?.value||'—', dept: document.getElementById('ob-dept')?.value||'—',
          startDate: document.getElementById('ob-start')?.value||addDays(0),
          tasks: ONBOARDING_TEMPLATE.map(t => ({ ...t, done: false })),
        })
        selected = newId
        showToast('✅ เพิ่มพนักงาน Onboarding แล้ว', 'success'); await loadData()
      }
    })
  }

  await loadData()
}
