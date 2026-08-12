/**
 * Technician Schedule — ตารางงานช่าง
 * Route: /service/technicians
 */
import { formatDate, todayBangkok } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, setDocData, updateDocData, seedDemoData } from '../../core/db.js'

const TECH_SKILLS = {
  general: { label: 'ทั่วไป', color: 'secondary', icon: '🔧' },
  ev:      { label: 'EV Specialist', color: 'success', icon: '⚡' },
  body:    { label: 'ตัวถัง', color: 'warning', icon: '🔨' },
  aircon:  { label: 'แอร์', color: 'primary', icon: '❄️' },
  electric:{ label: 'ไฟฟ้า', color: 'warning', icon: '💡' },
}

const SHIFT_COLORS = {
  morning: '#3b82f6',
  afternoon: '#f59e0b',
  leave: '#94a3b8',
}
const SHIFT_LABELS = { morning: 'เช้า', afternoon: 'บ่าย', leave: 'ลา' }

// เวรช่างจริง ผูกกับ technicianId จริงต่อสัปดาห์ (collection 'tech_shifts', docId = `${technicianId}_${weekStart}`)
// แทนที่ SCHEDULE คงที่แบบเดิมที่ผูกกับ id ตัวอย่าง T001-T005 ล้วนๆ (ดู audit finding #18 — แก้แล้วรอบนี้)
const WEEK_DAYS = ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา']

export function mondayOf(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  const dow = dt.getUTCDay() // 0=อา
  const diffToMonday = dow === 0 ? -6 : 1 - dow
  dt.setUTCDate(dt.getUTCDate() + diffToMonday)
  return dt.toISOString().slice(0, 10)
}
export function addDaysStr(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + n))
  return dt.toISOString().slice(0, 10)
}
export function weekDatesOf(weekStart) {
  return Array.from({ length: 7 }, (_, i) => addDaysStr(weekStart, i))
}

export default async function TechnicianSchedulePage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let techs = []
  let shiftDocs = []
  let skillFilter = 'all'
  let selectedWeekStart = mondayOf(todayBangkok())
  let loading = true

  async function loadData() {
    loading = true
    try {
      // ดึงเวรทั้งหมดมาแล้วกรองฝั่ง JS แทน where+orderBy คนละฟิลด์ (กันปัญหา composite index เหมือนที่เจอมาก่อนหน้านี้)
      const [t, s] = await Promise.all([
        listDocs('technician_schedule', [], 'name', 'asc', 200),
        listDocs('tech_shifts', [], 'weekStart', 'desc', 500),
      ])
      techs = t
      shiftDocs = s
    } catch (e) { techs = []; shiftDocs = [] }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function shiftsFor(techId) {
    const doc = shiftDocs.find(s => !s.deleted && s.technicianId === techId && s.weekStart === selectedWeekStart)
    return doc?.days || ['', '', '', '', '', '', '']
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const list = techs.filter(t =>
      skillFilter === 'all' || t.skills.includes(skillFilter)
    )
    const todayIdx = weekDatesOf(selectedWeekStart).indexOf(todayBangkok())
    const onDuty = techs.filter(t => todayIdx >= 0 && shiftsFor(t.id)[todayIdx] && shiftsFor(t.id)[todayIdx] !== 'leave').length
    const totalJobs = techs.reduce((a, t) => a + t.jobsToday, 0)
    const avgEff = techs.length ? Math.round(techs.reduce((a, t) => a + t.efficiency, 0) / techs.length) : 0
    const weekDates = weekDatesOf(selectedWeekStart)
    const isThisWeek = selectedWeekStart === mondayOf(todayBangkok())

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">👷 Technician Schedule</div>
            <div class="page-subtitle">ตารางงานช่าง — บริหารกำลังคนศูนย์บริการ</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="assign-job-btn">+ มอบหมายงาน</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('👷 ช่างทั้งหมด', techs.length + ' คน', 'primary')}
          ${kpi('✅ อยู่ปฏิบัติงาน', onDuty + ' คน', 'success')}
          ${kpi('🔧 งานวันนี้', totalJobs + ' งาน', 'warning')}
          ${kpi('📊 Efficiency', avgEff + '%', avgEff >= 85 ? 'success' : 'warning')}
        </div>

        <!-- Skill filter -->
        <div style="display:flex;gap:4px;margin-bottom:12px;flex-wrap:wrap">
          <button class="btn btn-xs ${skillFilter==='all'?'btn-primary':'btn-secondary'} skill-btn" data-s="all">ทั้งหมด</button>
          ${Object.entries(TECH_SKILLS).map(([k,v]) => `<button class="btn btn-xs ${skillFilter===k?'btn-'+v.color:'btn-secondary'} skill-btn" data-s="${k}">${v.icon} ${v.label}</button>`).join('')}
        </div>

        <!-- Weekly schedule grid -->
        <div class="card" style="overflow:hidden;margin-bottom:14px">
          <div style="padding:10px 14px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
            <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted)">📅 ตารางเวร ${formatDate(selectedWeekStart)} — ${formatDate(weekDates[6])}</div>
            <div style="display:flex;gap:4px">
              <button class="btn btn-xs btn-secondary" id="wk-prev">◀ สัปดาห์ก่อน</button>
              <button class="btn btn-xs ${isThisWeek?'btn-primary':'btn-secondary'}" id="wk-this">สัปดาห์นี้</button>
              <button class="btn btn-xs btn-secondary" id="wk-next">สัปดาห์ถัดไป ▶</button>
            </div>
          </div>
          <div style="overflow-x:auto">
            <table style="width:100%;border-collapse:collapse;min-width:600px">
              <thead>
                <tr style="border-bottom:1px solid var(--border);font-size:0.75rem;color:var(--text-muted)">
                  <th style="padding:8px 14px;text-align:left">ช่าง</th>
                  ${WEEK_DAYS.map((d, i) => `<th style="padding:8px 10px;text-align:center">${d}<br><span style="font-size:0.62rem;font-weight:400">${weekDates[i].slice(8,10)}/${weekDates[i].slice(5,7)}</span></th>`).join('')}
                </tr>
              </thead>
              <tbody>
                ${list.map(t => {
                  const sched = shiftsFor(t.id)
                  return `<tr style="border-bottom:1px solid var(--border)">
                    <td style="padding:8px 14px">
                      <div style="font-weight:600;font-size:0.83rem">${t.name}</div>
                      <div style="font-size:0.68rem;color:var(--text-muted)">${t.level} · Eff ${t.efficiency}%</div>
                    </td>
                    ${sched.map((s, i) => {
                      const label = SHIFT_LABELS[s] || '—'
                      const bg = SHIFT_COLORS[s] || 'var(--border)'
                      const color = SHIFT_COLORS[s] || 'var(--text-muted)'
                      return `<td style="padding:8px 6px;text-align:center">
                        <button class="btn shift-cell" data-tech="${t.id}" data-day="${i}" style="background:${SHIFT_COLORS[s]?bg+'22':'var(--surface-2)'};color:${color};border:none;border-radius:3px;padding:3px 8px;font-size:0.68rem;font-weight:700;cursor:pointer;min-width:44px">${label}</button>
                      </td>`
                    }).join('')}
                  </tr>`
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Technician cards -->
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px">
          ${list.map(t => {
            const eff = t.efficiency
            const effColor = eff >= 90 ? 'var(--success)' : eff >= 75 ? 'var(--warning)' : 'var(--danger)'
            return `<div class="card" style="padding:14px">
              <div style="display:flex;justify-content:space-between;margin-bottom:10px">
                <div>
                  <div style="font-weight:700;font-size:0.88rem">${t.name}</div>
                  <div style="font-size:0.7rem;color:var(--text-muted)">${t.level}</div>
                </div>
                <div style="font-size:1.3rem;font-weight:900;color:${effColor}">${eff}%</div>
              </div>
              <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px">
                ${t.skills.map(s => {
                  const sk = TECH_SKILLS[s]
                  return `<span class="badge badge-${sk?.color}" style="font-size:0.6rem">${sk?.icon} ${sk?.label}</span>`
                }).join('')}
              </div>
              <div style="display:flex;justify-content:space-between;font-size:0.75rem;color:var(--text-muted)">
                <span>🔧 งานวันนี้</span><strong>${t.jobsToday} งาน</strong>
              </div>
              <div style="margin-top:6px;background:var(--surface-2);border-radius:3px;height:6px">
                <div style="width:${eff}%;background:${effColor};height:6px;border-radius:3px"></div>
              </div>
              <button class="btn btn-xs btn-secondary assign-btn" data-id="${t.id}" style="margin-top:10px;width:100%">+ มอบงาน</button>
            </div>`
          }).join('')}
        </div>
      </div>
    `

    container.querySelectorAll('.skill-btn').forEach(b => b.addEventListener('click', () => { skillFilter = b.dataset.s; renderPage() }))
    document.getElementById('assign-job-btn')?.addEventListener('click', openAssignModal)
    container.querySelectorAll('.assign-btn').forEach(b => b.addEventListener('click', () => {
      const t = techs.find(x => x.id === b.dataset.id); if (t) openAssignModal(t)
    }))
    document.getElementById('wk-prev')?.addEventListener('click', () => { selectedWeekStart = addDaysStr(selectedWeekStart, -7); renderPage() })
    document.getElementById('wk-this')?.addEventListener('click', () => { selectedWeekStart = mondayOf(todayBangkok()); renderPage() })
    document.getElementById('wk-next')?.addEventListener('click', () => { selectedWeekStart = addDaysStr(selectedWeekStart, 7); renderPage() })
    container.querySelectorAll('.shift-cell').forEach(b => b.addEventListener('click', () => openShiftModal(b.dataset.tech, +b.dataset.day)))
  }

  function openShiftModal(techId, dayIdx) {
    const t = techs.find(x => x.id === techId)
    if (!t) return
    const current = shiftsFor(techId)[dayIdx]
    const dayDate = weekDatesOf(selectedWeekStart)[dayIdx]
    openModal({
      title: `🗓️ เวร ${t.name} — วัน${WEEK_DAYS[dayIdx]} (${formatDate(dayDate)})`,
      size: 'sm',
      body: `
        <div class="input-group"><label class="input-label">ประเภทเวร</label>
          <select class="input" id="sh-type">
            <option value="" ${!current?'selected':''}>— ไม่มีเวร —</option>
            <option value="morning" ${current==='morning'?'selected':''}>เช้า</option>
            <option value="afternoon" ${current==='afternoon'?'selected':''}>บ่าย</option>
            <option value="leave" ${current==='leave'?'selected':''}>ลา</option>
          </select>
        </div>
      `,
      async onConfirm() {
        const val = document.getElementById('sh-type')?.value || ''
        try {
          const days = [...shiftsFor(techId)]
          days[dayIdx] = val
          await setDocData('tech_shifts', `${techId}_${selectedWeekStart}`, { technicianId: techId, weekStart: selectedWeekStart, days })
          showToast('✅ บันทึกเวรแล้ว', 'success')
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      }
    })
  }

  function openAssignModal(tech = null) {
    openModal({
      title: '+ มอบหมายงาน',
      size: 'sm',
      body: `
        <div style="display:grid;gap:10px">
          <div class="input-group"><label class="input-label">ช่าง</label>
            <select class="input" id="as-tech">${techs.map(t=>`<option value="${t.id}" ${tech?.id===t.id?'selected':''}>${t.name} (${t.jobsToday} งาน)</option>`).join('')}</select>
          </div>
          <div class="input-group"><label class="input-label">ประเภทงาน</label>
            <select class="input" id="as-type">
              <option>ตรวจเช็คระยะ</option><option>ซ่อมทั่วไป</option>
              <option>EV Diagnostic</option><option>ซ่อมแอร์</option><option>ซ่อมไฟฟ้า</option>
            </select>
          </div>
          <div class="input-group"><label class="input-label">ทะเบียนรถ</label><input class="input" id="as-plate" placeholder="1กข-1234"></div>
        </div>
      `,
      async onConfirm() {
        const techId = document.getElementById('as-tech')?.value
        const t = techs.find(x => x.id === techId)
        if (!t) return
        try {
          await updateDocData('technician_schedule', t.id, { jobsToday: t.jobsToday + 1 })
          showToast(`✅ มอบงานให้ ${t.name} แล้ว`, 'success')
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      }
    })
  }

  await loadData()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
