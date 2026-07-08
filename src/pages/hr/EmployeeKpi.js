/**
 * Employee KPI Evaluation — ประเมินผลงานพนักงานรายบุคคล (รายวัน/รายสัปดาห์/รายเดือน/รายปี)
 * Route: /hr/employee-kpi
 */
import { formatDate, timeAgo } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'

function esc(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }

const PERIOD_TYPES = {
  daily:   { label: 'รายวัน', icon: '📅', inputType: 'date' },
  weekly:  { label: 'รายสัปดาห์', icon: '📆', inputType: 'week' },
  monthly: { label: 'รายเดือน', icon: '🗓', inputType: 'month' },
  yearly:  { label: 'รายปี', icon: '📊', inputType: 'number' },
}

const CRITERIA = [
  { key: 'quality',    label: 'คุณภาพงาน' },
  { key: 'quantity',   label: 'ปริมาณงาน/ผลผลิต' },
  { key: 'punctual',   label: 'การตรงต่อเวลา' },
  { key: 'attitude',   label: 'ทัศนคติ/ความร่วมมือ' },
  { key: 'initiative', label: 'ความคิดริเริ่ม' },
]

function today() { return new Date().toISOString().slice(0, 10) }
function thisWeek() { const d = new Date(); const jan1 = new Date(d.getFullYear(), 0, 1); const days = Math.floor((d - jan1) / 86400000); const week = Math.ceil((days + jan1.getDay() + 1) / 7); return d.getFullYear() + '-W' + String(week).padStart(2, '0') }
function thisMonth() { return new Date().toISOString().slice(0, 7) }
function thisYear() { return String(new Date().getFullYear()) }
function defaultPeriodValue(type) { return type === 'daily' ? today() : type === 'weekly' ? thisWeek() : type === 'monthly' ? thisMonth() : thisYear() }

function calcScore(criteriaScores) {
  const vals = Object.values(criteriaScores || {})
  if (!vals.length) return 0
  return Math.round(vals.reduce((a, v) => a + v, 0) / vals.length)
}
function ratingOf(score) { return score >= 90 ? 5 : score >= 75 ? 4 : score >= 60 ? 3 : score >= 40 ? 2 : 1 }
const RATING_CFG = {
  5: { label: 'ดีเยี่ยม', color: 'success' }, 4: { label: 'ดีมาก', color: 'primary' },
  3: { label: 'ดี', color: 'warning' }, 2: { label: 'พอใช้', color: 'secondary' }, 1: { label: 'ต้องปรับปรุง', color: 'danger' },
}

export default async function EmployeeKpiPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let staffList = []
  let evaluations = []
  let periodType = 'monthly'
  let staffFilter = 'all'
  let loading = true

  async function loadData() {
    loading = true
    try {
      staffList = await listDocs('staff', [], 'firstName', 'asc', 500)
      evaluations = await listDocs('employee_evaluations', [], 'periodValue', 'desc', 500)
    } catch (e) { staffList = []; evaluations = [] }
    loading = false
    if (container.__routerGen === myGen) render()
  }

  function staffName(id) {
    const s = staffList.find(x => x.id === id)
    return s ? `${s.firstName} ${s.lastName}` : id
  }

  function render() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const list = evaluations.filter(e => e.periodType === periodType && (staffFilter === 'all' || e.staffId === staffFilter))
    const avgScore = list.length ? Math.round(list.reduce((a, e) => a + e.overallScore, 0) / list.length) : 0
    const topPerformer = [...list].sort((a, b) => b.overallScore - a.overallScore)[0]
    const needsAttention = list.filter(e => e.overallScore < 60).length

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">📋 ประเมินผลงานพนักงานรายบุคคล</div>
            <div class="page-subtitle">Employee KPI — ประเมินได้ทั้งรายวัน/รายสัปดาห์/รายเดือน/รายปี</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="new-eval-btn">+ ประเมินผลงาน</button>
          </div>
        </div>

        <div style="display:flex;gap:4px;margin-bottom:12px;flex-wrap:wrap">
          ${Object.entries(PERIOD_TYPES).map(([k,v]) => `<button class="btn btn-sm ${periodType===k?'btn-primary':'btn-secondary'} pt-btn" data-p="${k}">${v.icon} ${v.label}</button>`).join('')}
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:14px">
          ${kpi('📋 จำนวนที่ประเมิน', list.length, 'primary')}
          ${kpi('📊 คะแนนเฉลี่ย', avgScore + '/100', avgScore>=75?'success':avgScore>=60?'warning':'danger')}
          ${kpi('🏆 คะแนนสูงสุด', topPerformer ? staffName(topPerformer.staffId) + ' (' + topPerformer.overallScore + ')' : '-', 'success')}
          ${kpi('⚠️ ต้องปรับปรุง', needsAttention, needsAttention>0?'danger':'secondary')}
        </div>

        <div style="margin-bottom:12px">
          <select class="input" id="staff-filter" style="max-width:260px">
            <option value="all">พนักงานทั้งหมด</option>
            ${staffList.map(s => `<option value="${s.id}" ${staffFilter===s.id?'selected':''}>${esc(s.firstName)} ${esc(s.lastName)} (${esc(s.dept)})</option>`).join('')}
          </select>
        </div>

        <div style="display:flex;flex-direction:column;gap:10px">
          ${list.map(e => {
            const rt = RATING_CFG[ratingOf(e.overallScore)]
            return `<div class="card eval-card" data-id="${e.id}" style="padding:14px;cursor:pointer;border-left:3px solid var(--${rt.color})">
              <div style="display:flex;justify-content:space-between;align-items:start">
                <div>
                  <div style="font-weight:700;font-size:0.85rem">${esc(staffName(e.staffId))}</div>
                  <div style="font-size:0.72rem;color:var(--text-muted)">${PERIOD_TYPES[e.periodType]?.icon} ${esc(e.periodValue)} · ผู้ประเมิน: ${esc(e.reviewer)} · ${timeAgo(e.createdAt)}</div>
                </div>
                <div style="text-align:right">
                  <div style="font-size:1.1rem;font-weight:900;color:var(--${rt.color})">${e.overallScore}</div>
                  <span class="badge badge-${rt.color}" style="font-size:0.6rem">${rt.label}</span>
                </div>
              </div>
            </div>`
          }).join('')}
          ${!list.length ? '<div class="card" style="padding:32px;text-align:center;color:var(--text-muted)">ยังไม่มีการประเมินในช่วงเวลานี้</div>' : ''}
        </div>
      </div>
    `

    container.querySelectorAll('.pt-btn').forEach(b => b.addEventListener('click', () => { periodType = b.dataset.p; render() }))
    document.getElementById('staff-filter')?.addEventListener('change', e => { staffFilter = e.target.value; render() })
    document.getElementById('new-eval-btn')?.addEventListener('click', openEvalModal)
    container.querySelectorAll('.eval-card').forEach(c => c.addEventListener('click', () => {
      const e = evaluations.find(x => x.id === c.dataset.id); if (e) openDetailModal(e)
    }))
  }

  function openEvalModal() {
    const pv = defaultPeriodValue(periodType)
    openModal({
      title: '+ ประเมินผลงานพนักงาน',
      size: 'md',
      body: `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
          <div class="input-group" style="grid-column:1/-1"><label class="input-label">พนักงาน *</label>
            <select class="input" id="ev-staff">${staffList.map(s => `<option value="${s.id}">${esc(s.firstName)} ${esc(s.lastName)} (${esc(s.dept)})</option>`).join('')}</select>
          </div>
          <div class="input-group"><label class="input-label">ช่วงเวลาประเมิน</label>
            <select class="input" id="ev-ptype">${Object.entries(PERIOD_TYPES).map(([k,v]) => `<option value="${k}" ${periodType===k?'selected':''}>${v.icon} ${v.label}</option>`).join('')}</select>
          </div>
          <div class="input-group"><label class="input-label">งวดที่ประเมิน</label><input class="input" id="ev-pvalue" type="${PERIOD_TYPES[periodType].inputType}" value="${pv}"></div>
        </div>
        <div style="font-size:0.8rem;font-weight:700;margin-bottom:8px">ให้คะแนนแต่ละด้าน (0-100)</div>
        <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:12px">
          ${CRITERIA.map(c => `
            <div>
              <div style="display:flex;justify-content:space-between;font-size:0.8rem;margin-bottom:3px">
                <span>${c.label}</span><span id="ev-${c.key}-val">70</span>
              </div>
              <input type="range" class="ev-score" data-key="${c.key}" min="0" max="100" value="70" style="width:100%">
            </div>
          `).join('')}
        </div>
        <div class="input-group"><label class="input-label">จุดแข็ง</label><input class="input" id="ev-strengths"></div>
        <div class="input-group"><label class="input-label">จุดที่ควรพัฒนา</label><input class="input" id="ev-improvements"></div>
        <div class="input-group"><label class="input-label">ผู้ประเมิน</label><input class="input" id="ev-reviewer" value="คุณ (Demo)"></div>
      `,
      async onConfirm() {
        const staffId = document.getElementById('ev-staff')?.value
        if (!staffId) { showToast('❗ กรุณาเลือกพนักงาน', 'error'); return false }
        const criteriaScores = {}
        document.querySelectorAll('.ev-score').forEach(inp => { criteriaScores[inp.dataset.key] = +inp.value })
        const overallScore = calcScore(criteriaScores)
        try {
          await createDoc('employee_evaluations', {
            staffId, periodType: document.getElementById('ev-ptype')?.value || periodType,
            periodValue: document.getElementById('ev-pvalue')?.value || pv,
            criteriaScores, overallScore,
            strengths: document.getElementById('ev-strengths')?.value?.trim() || '',
            improvements: document.getElementById('ev-improvements')?.value?.trim() || '',
            reviewer: document.getElementById('ev-reviewer')?.value?.trim() || 'ผู้ประเมิน',
          })
          showToast('✅ บันทึกผลประเมินแล้ว!', 'success')
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      }
    })
    setTimeout(() => {
      document.querySelectorAll('.ev-score').forEach(inp => {
        inp.addEventListener('input', () => {
          const el = document.getElementById('ev-' + inp.dataset.key + '-val')
          if (el) el.textContent = inp.value
        })
      })
      const ptypeSel = document.getElementById('ev-ptype')
      const pvalueInp = document.getElementById('ev-pvalue')
      ptypeSel?.addEventListener('change', () => {
        pvalueInp.type = PERIOD_TYPES[ptypeSel.value].inputType
        pvalueInp.value = defaultPeriodValue(ptypeSel.value)
      })
    }, 50)
  }

  function openDetailModal(e) {
    const rt = RATING_CFG[ratingOf(e.overallScore)]
    openModal({
      title: `📋 ${staffName(e.staffId)} — ${PERIOD_TYPES[e.periodType]?.label} ${e.periodValue}`,
      size: 'md',
      body: `
        <div style="text-align:center;margin-bottom:14px">
          <div style="font-size:2rem;font-weight:900;color:var(--${rt.color})">${e.overallScore}/100</div>
          <span class="badge badge-${rt.color}">${rt.label}</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px">
          ${CRITERIA.map(c => {
            const v = e.criteriaScores?.[c.key] || 0
            return `<div>
              <div style="display:flex;justify-content:space-between;font-size:0.78rem;margin-bottom:3px"><span>${c.label}</span><strong>${v}</strong></div>
              <div style="background:var(--surface-2);border-radius:4px;height:7px"><div style="width:${v}%;background:var(--primary);height:7px;border-radius:4px"></div></div>
            </div>`
          }).join('')}
        </div>
        ${e.strengths ? `<div style="margin-bottom:8px"><strong style="font-size:0.78rem">✅ จุดแข็ง:</strong> <span style="font-size:0.78rem;color:var(--text-muted)">${esc(e.strengths)}</span></div>` : ''}
        ${e.improvements ? `<div style="margin-bottom:8px"><strong style="font-size:0.78rem">📈 ควรพัฒนา:</strong> <span style="font-size:0.78rem;color:var(--text-muted)">${esc(e.improvements)}</span></div>` : ''}
        <div style="font-size:0.7rem;color:var(--text-muted);margin-top:10px">ผู้ประเมิน: ${esc(e.reviewer)} · ${formatDate(e.createdAt)}</div>
      `
    })
  }

  await loadData()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
