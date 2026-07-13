/**
 * Skill Matrix — ตารางทักษะพนักงาน
 * Route: /hr/skills
 */
import { openModal, confirmDialog } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, softDelete, seedDemoData } from '../../core/db.js'

function esc(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }

const SKILL_LEVELS = {
  0: { label: '—', color: 'var(--surface-2)', text: 'ยังไม่มี' },
  1: { label: '1', color: '#ef444455', text: 'เริ่มต้น (ต้องมีพี่เลี้ยง)' },
  2: { label: '2', color: '#f59e0b55', text: 'ทำได้ (มีคนตรวจ)' },
  3: { label: '3', color: '#10b98155', text: 'ชำนาญ (ทำเองได้)' },
  4: { label: '4', color: '#10b981', text: 'เชี่ยวชาญ (สอนคนอื่นได้)' },
}

const SKILL_CATEGORIES = ['ขาย', 'ช่าง', 'ทั่วไป']

export default async function SkillMatrixPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let staff = []
  let skills = []
  let loading = true

  async function loadData() {
    loading = true
    try {
      staff = await listDocs('staff_skills', [], 'name', 'asc', 200)
      skills = await listDocs('skill_definitions', [], 'order', 'asc', 200)
    } catch (e) { staff = []; skills = [] }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    // Gap analysis: skills with no level-4 (no trainer) or avg < 2
    const gaps = skills.filter(sk => {
      const levels = staff.map(s => s.skills?.[sk.id]).filter(l => l > 0)
      const hasExpert = levels.some(l => l === 4)
      const avg = levels.length ? levels.reduce((a, l) => a + l, 0) / levels.length : 0
      return !hasExpert || avg < 2
    })
    const expertCount = staff.flatMap(s => Object.values(s.skills || {})).filter(l => l === 4).length

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🧩 Skill Matrix</div>
            <div class="page-subtitle">ตารางทักษะ — หา gap วางแผนอบรม</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="add-skill-btn">+ เพิ่มทักษะ</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:16px">
          ${kpi('👥 พนักงาน', staff.length + ' คน', 'primary')}
          ${kpi('🏆 ระดับเชี่ยวชาญ', expertCount + ' ทักษะ', 'success')}
          ${kpi('⚠️ Skill Gap', gaps.length + ' ทักษะ', gaps.length > 0 ? 'danger' : 'success')}
        </div>

        ${gaps.length > 0 ? `
          <div style="padding:10px 14px;background:var(--warning)11;border:1px solid var(--warning)33;border-radius:var(--radius);margin-bottom:12px;font-size:0.78rem">
            ⚠️ <strong>ควรจัดอบรม:</strong> ${gaps.map(g => g.icon + ' ' + esc(g.name)).join(' · ')}
          </div>
        ` : ''}

        <!-- Matrix -->
        <div class="card" style="overflow:hidden;margin-bottom:14px">
          <div style="overflow-x:auto">
            <table style="width:100%;border-collapse:collapse;min-width:${680 + skills.length * 10}px">
              <thead>
                <tr style="border-bottom:1px solid var(--border);font-size:0.7rem;color:var(--text-muted)">
                  <th style="padding:8px 14px;text-align:left">พนักงาน</th>
                  ${skills.map(sk => `<th style="padding:8px 4px;text-align:center" title="${esc(sk.name)}">
                    <div>${sk.icon || '🔹'}</div>
                    <div style="font-size:0.58rem">${esc(sk.name.length > 10 ? sk.name.slice(0,10)+'…' : sk.name)}</div>
                    <div style="margin-top:3px;display:flex;gap:3px;justify-content:center">
                      <button class="skill-edit-btn" data-id="${sk.id}" title="แก้ไขทักษะ" style="font-size:0.6rem;border:none;background:none;cursor:pointer;padding:1px">✏️</button>
                      <button class="skill-del-btn" data-id="${sk.id}" title="ลบทักษะ" style="font-size:0.6rem;border:none;background:none;cursor:pointer;padding:1px">🗑</button>
                    </div>
                  </th>`).join('')}
                </tr>
              </thead>
              <tbody>
                ${staff.map(s => `
                  <tr style="border-bottom:1px solid var(--border)">
                    <td style="padding:8px 14px">
                      <div style="font-weight:600;font-size:0.8rem">${esc(s.name)}</div>
                      <div style="font-size:0.63rem;color:var(--text-muted)">${esc(s.role)}</div>
                    </td>
                    ${skills.map(sk => {
                      const lv = s.skills?.[sk.id] || 0
                      const sl = SKILL_LEVELS[lv]
                      return `<td style="padding:6px 4px;text-align:center">
                        <button class="cell-btn" data-sid="${s.id}" data-skill="${sk.id}" title="${sl.text}" style="width:32px;height:32px;border-radius:6px;border:1px solid var(--border);background:${sl.color};color:var(--text);font-weight:800;font-size:0.78rem;cursor:pointer">${sl.label}</button>
                      </td>`
                    }).join('')}
                  </tr>
                `).join('')}
                ${!staff.length ? `<tr><td colspan="${skills.length + 1}" style="padding:24px;text-align:center;color:var(--text-muted)">ยังไม่มีข้อมูลพนักงาน</td></tr>` : ''}
              </tbody>
            </table>
          </div>
          ${!skills.length ? `<div style="padding:24px;text-align:center;color:var(--text-muted)">ยังไม่มีทักษะที่ติดตาม — กด "+ เพิ่มทักษะ"</div>` : ''}
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
      const cur = s.skills?.[b.dataset.skill] || 0
      const next = (cur + 1) % 5
      s.skills = { ...(s.skills || {}), [b.dataset.skill]: next }
      renderPage()
      try {
        await updateDocData('staff_skills', s.id, { skills: s.skills })
      } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
    }))

    document.getElementById('add-skill-btn')?.addEventListener('click', () => openSkillModal(null))
    container.querySelectorAll('.skill-edit-btn').forEach(b => b.addEventListener('click', e => {
      e.stopPropagation()
      const sk = skills.find(x => x.id === b.dataset.id); if (sk) openSkillModal(sk)
    }))
    container.querySelectorAll('.skill-del-btn').forEach(b => b.addEventListener('click', async e => {
      e.stopPropagation()
      const sk = skills.find(x => x.id === b.dataset.id)
      if (!sk) return
      const ok = await confirmDialog({ title: '🗑 ลบทักษะ', message: `ลบทักษะ "${sk.name}" ออกจาก Skill Matrix? (คะแนนทักษะเดิมของพนักงานจะยังคงอยู่ในระบบแต่จะไม่แสดงผลอีก)`, confirmText: 'ลบ', danger: true })
      if (!ok) return
      try {
        await softDelete('skill_definitions', sk.id)
        showToast('🗑 ลบทักษะแล้ว', 'warning')
        await loadData()
      } catch (err) { showToast('บันทึกไม่สำเร็จ', 'error') }
    }))
  }

  function openSkillModal(existing) {
    const isEdit = !!existing
    openModal({
      title: isEdit ? `✏️ แก้ไขทักษะ: ${existing.name}` : '+ เพิ่มทักษะใหม่',
      size: 'sm',
      body: `
        <div style="display:grid;gap:10px">
          <div class="input-group"><label class="input-label">ชื่อทักษะ *</label><input class="input" id="sk-name" value="${esc(existing?.name || '')}"></div>
          <div class="input-group"><label class="input-label">ไอคอน (emoji)</label><input class="input" id="sk-icon" value="${esc(existing?.icon || '🔹')}" maxlength="4"></div>
          <div class="input-group"><label class="input-label">หมวดหมู่</label>
            <select class="input" id="sk-cat">${SKILL_CATEGORIES.map(c => `<option ${existing?.category===c?'selected':''}>${c}</option>`).join('')}</select>
          </div>
        </div>
      `,
      confirmText: '💾 บันทึก',
      async onConfirm() {
        const name = document.getElementById('sk-name')?.value?.trim()
        if (!name) { showToast('❗ กรุณากรอกชื่อทักษะ', 'error'); return false }
        const fields = {
          name,
          icon: document.getElementById('sk-icon')?.value?.trim() || '🔹',
          category: document.getElementById('sk-cat')?.value || SKILL_CATEGORIES[0],
        }
        try {
          if (isEdit) {
            await updateDocData('skill_definitions', existing.id, fields)
          } else {
            await createDoc('skill_definitions', { ...fields, order: skills.length ? Math.max(...skills.map(s => s.order || 0)) + 1 : 1 })
          }
          showToast(isEdit ? '✅ แก้ไขทักษะแล้ว!' : '✅ เพิ่มทักษะแล้ว!', 'success')
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      }
    })
  }

  await loadData()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
