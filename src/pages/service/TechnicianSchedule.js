/**
 * Technician Schedule — ตารางงานช่าง
 * Route: /service/technicians
 */
import { formatDate } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'

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

const TECHNICIANS = [
  { id: 'T001', name: 'วิทยา ช่างใหญ่', skills: ['general','ev'], level: 'Senior', efficiency: 94, jobsToday: 3 },
  { id: 'T002', name: 'สุรชัย มือดี', skills: ['ev','electric'], level: 'Specialist', efficiency: 88, jobsToday: 4 },
  { id: 'T003', name: 'มานะ ขยัน', skills: ['general','body'], level: 'Junior', efficiency: 76, jobsToday: 2 },
  { id: 'T004', name: 'ชาตรี แข็งแกร่ง', skills: ['aircon','general'], level: 'Senior', efficiency: 91, jobsToday: 3 },
  { id: 'T005', name: 'ประสิทธิ์ ดีเด่น', skills: ['general'], level: 'Technician', efficiency: 82, jobsToday: 5 },
]

const WEEK_DAYS = ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา']
const SCHEDULE = {
  T001: ['morning','morning','morning','afternoon','morning','leave','leave'],
  T002: ['morning','morning','afternoon','morning','morning','morning','leave'],
  T003: ['afternoon','morning','morning','morning','afternoon','leave','leave'],
  T004: ['morning','afternoon','morning','morning','morning','leave','leave'],
  T005: ['morning','morning','morning','afternoon','afternoon','morning','leave'],
}

export default async function TechnicianSchedulePage(container) {
  let techs = TECHNICIANS.map(t => ({ ...t }))
  let skillFilter = 'all'

  function renderPage() {
    const list = techs.filter(t =>
      skillFilter === 'all' || t.skills.includes(skillFilter)
    )
    const onDuty = techs.filter(t => SCHEDULE[t.id]?.[0] !== 'leave').length
    const totalJobs = techs.reduce((a, t) => a + t.jobsToday, 0)
    const avgEff = Math.round(techs.reduce((a, t) => a + t.efficiency, 0) / techs.length)

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
          <div style="padding:10px 14px;border-bottom:1px solid var(--border);font-size:0.8rem;font-weight:700;color:var(--text-muted)">📅 ตารางสัปดาห์นี้</div>
          <div style="overflow-x:auto">
            <table style="width:100%;border-collapse:collapse;min-width:600px">
              <thead>
                <tr style="border-bottom:1px solid var(--border);font-size:0.75rem;color:var(--text-muted)">
                  <th style="padding:8px 14px;text-align:left">ช่าง</th>
                  ${WEEK_DAYS.map(d => `<th style="padding:8px 10px;text-align:center">${d}</th>`).join('')}
                </tr>
              </thead>
              <tbody>
                ${list.map(t => {
                  const sched = SCHEDULE[t.id] || []
                  return `<tr style="border-bottom:1px solid var(--border)">
                    <td style="padding:8px 14px">
                      <div style="font-weight:600;font-size:0.83rem">${t.name}</div>
                      <div style="font-size:0.68rem;color:var(--text-muted)">${t.level} · Eff ${t.efficiency}%</div>
                    </td>
                    ${sched.map((s, i) => {
                      const label = s === 'morning' ? 'เช้า' : s === 'afternoon' ? 'บ่าย' : 'ลา'
                      return `<td style="padding:8px 6px;text-align:center">
                        <div style="background:${SHIFT_COLORS[s]}22;color:${SHIFT_COLORS[s]};border-radius:3px;padding:3px 6px;font-size:0.68rem;font-weight:700">${label}</div>
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
      onConfirm() {
        const techId = document.getElementById('as-tech')?.value
        const t = techs.find(x => x.id === techId)
        if (t) { t.jobsToday++; showToast(`✅ มอบงานให้ ${t.name} แล้ว`, 'success'); renderPage() }
      }
    })
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
