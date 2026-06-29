/**
 * Succession Planning — วางแผนสืบทอดตำแหน่ง
 * Route: /hr/succession
 */
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { exportToExcel } from '../../utils/importExport.js'

const READINESS = {
  ready:    { label: 'พร้อมแล้ว', color: 'var(--success)' },
  '1yr':    { label: 'พร้อมใน 1 ปี', color: 'var(--primary)' },
  '2yr':    { label: 'พร้อมใน 2 ปี', color: 'var(--warning)' },
  develop:  { label: 'ต้องพัฒนา', color: 'var(--text-muted)' },
}

let PLANS = [
  {
    role: 'ผู้จัดการฝ่ายขาย',
    current: { name: 'คุณสมชาย วงศ์ดี', tenure: '8 ปี', risk: 'medium' },
    successors: [
      { name: 'คุณวิชัย ใจดี', readiness: 'ready', dept: 'เซลส์', gaps: 'ทักษะบริหารทีม' },
      { name: 'คุณนิภา สมบัติ', readiness: '1yr', dept: 'เซลส์', gaps: 'ประสบการณ์จัดการ Fleet' },
    ]
  },
  {
    role: 'หัวหน้าช่าง',
    current: { name: 'คุณประเสริฐ ดีมาก', tenure: '12 ปี', risk: 'high' },
    successors: [
      { name: 'คุณธนพล ช่างเก่ง', readiness: '1yr', dept: 'ช่าง', gaps: 'ใบรับรอง EV, ทักษะบริหาร' },
      { name: 'คุณอนุชา ซ่อมดี', readiness: '2yr', dept: 'ช่าง', gaps: 'ประสบการณ์ BP, การจัดการงบ' },
    ]
  },
  {
    role: 'ผู้จัดการการเงิน',
    current: { name: 'คุณมาลี บัญชีดี', tenure: '5 ปี', risk: 'low' },
    successors: [
      { name: 'คุณสุดา เลขสวย', readiness: '2yr', dept: 'บัญชี', gaps: 'ระบบ ERP, การรายงานผู้บริหาร' },
    ]
  },
  {
    role: 'ผู้จัดการการตลาด',
    current: { name: 'คุณวิไล สวยงาม', tenure: '3 ปี', risk: 'medium' },
    successors: []
  },
]

const RISK = {
  high:   { label: 'เสี่ยงสูง (อาจลาออก/เกษียณ)', color: 'var(--danger)' },
  medium: { label: 'เสี่ยงปานกลาง', color: 'var(--warning)' },
  low:    { label: 'เสี่ยงต่ำ', color: 'var(--success)' },
}

export default async function SuccessionPlanningPage(container) {
  function render() {
    const criticalGaps = PLANS.filter(p => p.successors.length === 0)
    const highRisk = PLANS.filter(p => p.current.risk === 'high')
    const readyNow = PLANS.reduce((s, p) => s + p.successors.filter(x => x.readiness === 'ready').length, 0)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🎯 Succession Planning</div>
            <div class="page-subtitle">วางแผนสืบทอดตำแหน่งสำคัญ · ระบุผู้สืบทอดและช่องว่างความสามารถ</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="report-btn">📊 รายงานผู้บริหาร</button>
            <button class="btn btn-primary" id="add-btn">➕ เพิ่มตำแหน่ง</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
          ${sc('🎭 ตำแหน่งสำคัญ', PLANS.length, 'var(--primary)')}
          ${sc('🚨 ไม่มีผู้สืบทอด', criticalGaps.length, criticalGaps.length > 0 ? 'var(--danger)' : 'var(--success)')}
          ${sc('⚡ ความเสี่ยงสูง', highRisk.length, highRisk.length > 0 ? 'var(--danger)' : 'var(--success)')}
          ${sc('✅ พร้อมรับตำแหน่งทันที', readyNow, 'var(--success)')}
        </div>

        ${criticalGaps.length ? `
          <div class="card" style="padding:12px 14px;margin-bottom:12px;border-left:4px solid var(--danger)">
            <div style="font-size:0.76rem;font-weight:700;color:var(--danger);margin-bottom:4px">🚨 ตำแหน่งที่ยังไม่มีผู้สืบทอด</div>
            <div style="font-size:0.78rem;color:var(--text-muted)">${criticalGaps.map(p=>`${p.role} (ปัจจุบัน: ${p.current.name})`).join(' · ')} — ต้องเร่งระบุและพัฒนาผู้สืบทอด</div>
          </div>` : ''}

        <div style="display:flex;flex-direction:column;gap:12px">
          ${PLANS.map(p => planCard(p)).join('')}
        </div>
      </div>
    `

    container.querySelectorAll('.add-successor-btn').forEach(b => b.addEventListener('click', () => addSuccessor(b.dataset.role)))
    document.getElementById('add-btn')?.addEventListener('click', addRole)
    document.getElementById('report-btn')?.addEventListener('click', () => {
      const rows = PLANS.flatMap(p => {
        if (!p.successors.length) return [{ 'ตำแหน่ง': p.role, 'ผู้ดำรง': p.current.name, 'อายุงาน': p.current.tenure, 'ความเสี่ยง': RISK[p.current.risk]?.label || p.current.risk, 'ผู้สืบทอด': 'ยังไม่ระบุ', 'แผนก': '', 'ความพร้อม': '', 'ช่องว่างทักษะ': '' }]
        return p.successors.map(s => ({
          'ตำแหน่ง': p.role,
          'ผู้ดำรง': p.current.name,
          'อายุงาน': p.current.tenure,
          'ความเสี่ยง': RISK[p.current.risk]?.label || p.current.risk,
          'ผู้สืบทอด': s.name,
          'แผนก': s.dept,
          'ความพร้อม': READINESS[s.readiness]?.label || s.readiness,
          'ช่องว่างทักษะ': s.gaps,
        }))
      })
      exportToExcel(rows, 'Succession_Plan_Report.xlsx', 'Succession')
      showToast('📊 Export รายงาน Succession Plan แล้ว', 'success')
    })
  }

  function planCard(p) {
    const r = RISK[p.current.risk]
    return `
      <div class="card" style="padding:14px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <div>
            <div style="font-size:0.95rem;font-weight:700">🎭 ${p.role}</div>
            <div style="font-size:0.76rem;color:var(--text-muted)">ปัจจุบัน: ${p.current.name} (${p.current.tenure})
              <span style="font-size:0.64rem;background:${r.color};color:#fff;padding:1px 7px;border-radius:10px;margin-left:6px">${r.label}</span>
            </div>
          </div>
          <button class="btn btn-xs btn-secondary add-successor-btn" data-role="${p.role}">➕ เพิ่มผู้สืบทอด</button>
        </div>

        ${p.successors.length === 0 ? `
          <div style="background:var(--surface-2);padding:10px 12px;border-radius:var(--radius-sm);text-align:center;font-size:0.78rem;color:var(--danger)">
            ⚠️ ยังไม่มีผู้สืบทอด — ความเสี่ยงด้านความต่อเนื่องขององค์กร
          </div>` : `
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:10px">
            ${p.successors.map((s, i) => {
              const rd = READINESS[s.readiness]
              return `<div style="border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px 12px">
                <div style="display:flex;justify-content:space-between;align-items:center">
                  <span style="font-weight:600;font-size:0.82rem">${i===0?'🥇 ':'🥈 '}${s.name}</span>
                  <span style="font-size:0.64rem;background:${rd.color};color:#fff;padding:2px 7px;border-radius:10px">${rd.label}</span>
                </div>
                <div style="font-size:0.7rem;color:var(--text-muted);margin-top:4px">แผนก: ${s.dept}</div>
                ${s.gaps ? `<div style="font-size:0.7rem;margin-top:4px">🔧 ช่องว่าง: <span style="color:var(--warning)">${s.gaps}</span></div>` : ''}
              </div>`
            }).join('')}
          </div>`}
      </div>`
  }

  function addSuccessor(role) {
    const plan = PLANS.find(p => p.role === role)
    openModal({
      title: `➕ เพิ่มผู้สืบทอด — ${role}`,
      size: 'sm',
      body: `<div style="display:grid;gap:10px">
        <div class="input-group"><label class="input-label">ชื่อพนักงาน *</label><input class="input" id="sp-name"></div>
        <div style="display:flex;gap:8px">
          <div class="input-group" style="flex:1"><label class="input-label">แผนก</label><input class="input" id="sp-dept"></div>
          <div class="input-group" style="flex:1"><label class="input-label">ความพร้อม</label>
            <select class="input" id="sp-ready">${Object.entries(READINESS).map(([k,v])=>`<option value="${k}">${v.label}</option>`).join('')}</select>
          </div>
        </div>
        <div class="input-group"><label class="input-label">ช่องว่างที่ต้องพัฒนา</label><input class="input" id="sp-gaps" placeholder="เช่น ทักษะ X, ประสบการณ์ Y"></div>
      </div>`,
      confirmText: '💾 บันทึก',
      onConfirm() {
        const name = document.getElementById('sp-name').value.trim()
        if (!name) { showToast('❗ ระบุชื่อ', 'error'); return false }
        plan.successors.push({ name, dept: document.getElementById('sp-dept').value.trim(), readiness: document.getElementById('sp-ready').value, gaps: document.getElementById('sp-gaps').value.trim() })
        showToast(`เพิ่ม ${name} เป็นผู้สืบทอด "${role}" แล้ว`, 'success')
        render()
      }
    })
  }

  function addRole() {
    openModal({
      title: '➕ เพิ่มตำแหน่งสำคัญ',
      size: 'sm',
      body: `<div style="display:grid;gap:10px">
        <div class="input-group"><label class="input-label">ชื่อตำแหน่ง *</label><input class="input" id="sp-role"></div>
        <div class="input-group"><label class="input-label">ผู้ดำรงตำแหน่งปัจจุบัน *</label><input class="input" id="sp-current"></div>
        <div style="display:flex;gap:8px">
          <div class="input-group" style="flex:1"><label class="input-label">อายุงาน</label><input class="input" id="sp-tenure" placeholder="เช่น 5 ปี"></div>
          <div class="input-group" style="flex:1"><label class="input-label">ความเสี่ยง</label>
            <select class="input" id="sp-risk"><option value="low">ต่ำ</option><option value="medium">ปานกลาง</option><option value="high">สูง</option></select>
          </div>
        </div>
      </div>`,
      confirmText: '💾 เพิ่มตำแหน่ง',
      onConfirm() {
        const role = document.getElementById('sp-role').value.trim()
        const curr = document.getElementById('sp-current').value.trim()
        if (!role || !curr) { showToast('❗ กรอกข้อมูลที่จำเป็น', 'error'); return false }
        PLANS.push({ role, current: { name: curr, tenure: document.getElementById('sp-tenure').value.trim() || '-', risk: document.getElementById('sp-risk').value }, successors: [] })
        showToast(`เพิ่มตำแหน่ง "${role}" เข้า Succession Plan แล้ว`, 'success')
        render()
      }
    })
  }

  function sc(l, v, c) {
    return `<div class="card" style="padding:14px 16px"><div style="font-size:0.72rem;color:var(--text-muted)">${l}</div><div style="font-size:1.4rem;font-weight:900;color:${c};margin-top:2px">${v}</div></div>`
  }

  render()
}
