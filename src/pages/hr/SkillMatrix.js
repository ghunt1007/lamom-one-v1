/**
 * Skill Matrix — ตารางทักษะพนักงาน
 * Route: /hr/skills
 */
import { showToast } from '../../core/store.js'
import { listDocs, updateDocData, seedDemoData } from '../../core/db.js'

const SKILL_LEVELS = {
  0: { label: '—', color: 'var(--surface-2)', text: 'ยังไม่มี' },
  1: { label: '1', color: '#ef444455', text: 'เริ่มต้น (ต้องมีพี่เลี้ยง)' },
  2: { label: '2', color: '#f59e0b55', text: 'ทำได้ (มีคนตรวจ)' },
  3: { label: '3', color: '#10b98155', text: 'ชำนาญ (ทำเองได้)' },
  4: { label: '4', color: '#10b981', text: 'เชี่ยวชาญ (สอนคนอื่นได้)' },
}

const SKILLS = [
  { id: 'sales', name: 'เทคนิคการขาย', icon: '💼' },
  { id: 'product', name: 'ความรู้ผลิตภัณฑ์ EV', icon: '🚗' },
  { id: 'finance', name: 'ไฟแนนซ์/สินเชื่อ', icon: '🏦' },
  { id: 'ev_repair', name: 'ซ่อม EV/HV', icon: '⚡' },
  { id: 'general_repair', name: 'ซ่อมทั่วไป', icon: '🔧' },
  { id: 'crm_system', name: 'ใช้ระบบ LAMOM ONE', icon: '💻' },
  { id: 'english', name: 'ภาษาอังกฤษ', icon: '🌐' },
]

export default async function SkillMatrixPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let staff = []
  let loading = true

  async function loadData() {
    loading = true
    try { staff = await listDocs('staff_skills', [], 'name', 'asc', 200) } catch (e) { staff = [] }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    // Gap analysis: skills with no level-4 (no trainer) or avg < 2
    const gaps = SKILLS.filter(sk => {
      const levels = staff.map(s => s.skills[sk.id]).filter(l => l > 0)
      const hasExpert = levels.some(l => l === 4)
      const avg = levels.length ? levels.reduce((a, l) => a + l, 0) / levels.length : 0
      return !hasExpert || avg < 2
    })
    const expertCount = staff.flatMap(s => Object.values(s.skills)).filter(l => l === 4).length

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🧩 Skill Matrix</div>
            <div class="page-subtitle">ตารางทักษะ — หา gap วางแผนอบรม</div>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:16px">
          ${kpi('👥 พนักงาน', staff.length + ' คน', 'primary')}
          ${kpi('🏆 ระดับเชี่ยวชาญ', expertCount + ' ทักษะ', 'success')}
          ${kpi('⚠️ Skill Gap', gaps.length + ' ทักษะ', gaps.length > 0 ? 'danger' : 'success')}
        </div>

        ${gaps.length > 0 ? `
          <div style="padding:10px 14px;background:var(--warning)11;border:1px solid var(--warning)33;border-radius:var(--radius);margin-bottom:12px;font-size:0.78rem">
            ⚠️ <strong>ควรจัดอบรม:</strong> ${gaps.map(g => g.icon + ' ' + g.name).join(' · ')}
          </div>
        ` : ''}

        <!-- Matrix -->
        <div class="card" style="overflow:hidden;margin-bottom:14px">
          <div style="overflow-x:auto">
            <table style="width:100%;border-collapse:collapse;min-width:680px">
              <thead>
                <tr style="border-bottom:1px solid var(--border);font-size:0.7rem;color:var(--text-muted)">
                  <th style="padding:8px 14px;text-align:left">พนักงาน</th>
                  ${SKILLS.map(sk => `<th style="padding:8px 4px;text-align:center" title="${sk.name}">${sk.icon}<br><span style="font-size:0.58rem">${sk.name.length > 10 ? sk.name.slice(0,10)+'…' : sk.name}</span></th>`).join('')}
                </tr>
              </thead>
              <tbody>
                ${staff.map(s => `
                  <tr style="border-bottom:1px solid var(--border)">
                    <td style="padding:8px 14px">
                      <div style="font-weight:600;font-size:0.8rem">${s.name}</div>
                      <div style="font-size:0.63rem;color:var(--text-muted)">${s.role}</div>
                    </td>
                    ${SKILLS.map(sk => {
                      const lv = s.skills[sk.id] || 0
                      const sl = SKILL_LEVELS[lv]
                      return `<td style="padding:6px 4px;text-align:center">
                        <button class="cell-btn" data-sid="${s.id}" data-skill="${sk.id}" title="${sl.text}" style="width:32px;height:32px;border-radius:6px;border:1px solid var(--border);background:${sl.color};color:var(--text);font-weight:800;font-size:0.78rem;cursor:pointer">${sl.label}</button>
                      </td>`
                    }).join('')}
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Legend -->
        <div class="card" style="padding:12px 14px">
          <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);margin-bottom:8px">📖 ระดับทักษะ (คลิกช่องเพื่อปรับ)</div>
          <div style="display:flex;gap:12px;flex-wrap:wrap;font-size:0.72rem">
            ${Object.entries(SKILL_LEVELS).map(([k, v]) => `
              <div style="display:flex;align-items:center;gap:6px">
                <div style="width:22px;height:22px;border-radius:5px;background:${v.color};border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:0.68rem">${v.label}</div>
                <span style="color:var(--text-muted)">${v.text}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `

    container.querySelectorAll('.cell-btn').forEach(b => b.addEventListener('click', async () => {
      const s = staff.find(x => x.id === b.dataset.sid)
      if (!s) return
      const cur = s.skills[b.dataset.skill] || 0
      const next = (cur + 1) % 5
      s.skills = { ...s.skills, [b.dataset.skill]: next }
      renderPage()
      try {
        await updateDocData('staff_skills', s.id, { skills: s.skills })
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    }))
  }

  await loadData()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
