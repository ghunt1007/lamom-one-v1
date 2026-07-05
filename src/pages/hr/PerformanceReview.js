/**
 * Performance Review — ประเมินผลการปฏิบัติงาน
 * Route: /hr/performance-review
 */
import { formatDate } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'

const REVIEW_STATUS = {
  pending:    { label: 'รอประเมิน', color: 'warning' },
  self_done:  { label: 'ประเมินตัวเองแล้ว', color: 'primary' },
  reviewed:   { label: 'ผู้จัดการประเมินแล้ว', color: 'success' },
  completed:  { label: 'เสร็จสิ้น', color: 'secondary' },
}

const CRITERIA = [
  { key: 'kpi', label: 'เป้า KPI', weight: 30 },
  { key: 'quality', label: 'คุณภาพงาน', weight: 25 },
  { key: 'teamwork', label: 'การทำงานทีม', weight: 20 },
  { key: 'initiative', label: 'ความคิดริเริ่ม', weight: 15 },
  { key: 'development', label: 'การพัฒนาตนเอง', weight: 10 },
]

function calcScore(scores) {
  if (!scores) return 0
  return CRITERIA.reduce((total, c) => total + (scores[c.key] || 0) * c.weight / 5, 0).toFixed(1)
}

function gradeFromScore(score) {
  if (score >= 90) return 'A+'
  if (score >= 85) return 'A'
  if (score >= 80) return 'B+'
  if (score >= 75) return 'B'
  if (score >= 70) return 'C+'
  return 'C'
}

function scoreBar(score, max = 5) {
  const pct = score / max * 100
  const color = score >= 4 ? 'var(--success)' : score >= 3 ? 'var(--warning)' : 'var(--danger)'
  return `<div style="background:var(--surface-2);border-radius:3px;height:6px;flex:1">
    <div style="width:${pct}%;background:${color};height:6px;border-radius:3px"></div>
  </div>`
}

export default async function PerformanceReviewPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let reviews = []
  let statusFilter = 'all'
  let loading = true

  async function loadData() {
    loading = true
    try { reviews = await listDocs('performance_reviews', [], 'period', 'desc', 300) } catch (e) { reviews = [] }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const list = reviews.filter(r => statusFilter === 'all' || r.status === statusFilter)
    const completed = reviews.filter(r => r.status === 'completed').length
    const pending = reviews.filter(r => r.status === 'pending').length
    const withMgmt = reviews.filter(r => r.mgmtScores)
    const avgScore = withMgmt.length ? withMgmt.map(r => +calcScore(r.mgmtScores)).reduce((a, s) => a + s/withMgmt.length, 0) : 0

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">📊 Performance Review</div>
            <div class="page-subtitle">ประเมินผลการปฏิบัติงาน H1/2568</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="start-cycle-btn">🔄 เริ่มรอบประเมินใหม่</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('👥 พนักงานทั้งหมด', reviews.length, 'primary')}
          ${kpi('⏳ รอประเมิน', pending, pending > 0 ? 'warning' : 'secondary')}
          ${kpi('✅ เสร็จสิ้น', completed, 'success')}
          ${kpi('📊 คะแนนเฉลี่ย', avgScore.toFixed(0) + '/100', 'primary')}
        </div>

        <div style="display:flex;gap:4px;margin-bottom:12px">
          <button class="btn btn-xs ${statusFilter==='all'?'btn-primary':'btn-secondary'} sf-btn" data-s="all">ทั้งหมด</button>
          ${Object.entries(REVIEW_STATUS).map(([k,v]) => `<button class="btn btn-xs ${statusFilter===k?'btn-'+v.color:'btn-secondary'} sf-btn" data-s="${k}">${v.label}</button>`).join('')}
        </div>

        <div style="display:flex;flex-direction:column;gap:10px">
          ${list.map(r => {
            const st = REVIEW_STATUS[r.status]
            const selfTotal = r.selfScores ? +calcScore(r.selfScores) : null
            const mgmtTotal = r.mgmtScores ? +calcScore(r.mgmtScores) : null
            return `<div class="card" style="padding:14px;border-left:3px solid var(--${st?.color})">
              <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:10px">
                <div>
                  <div style="font-weight:700;font-size:0.9rem">${r.staff}</div>
                  <div style="font-size:0.72rem;color:var(--text-muted)">${r.dept} · ${r.period}</div>
                </div>
                <div style="display:flex;gap:6px;align-items:center">
                  ${r.grade ? `<div style="font-size:1.4rem;font-weight:900;color:var(--${st?.color})">${r.grade}</div>` : ''}
                  <span class="badge badge-${st?.color}" style="font-size:0.62rem">${st?.label}</span>
                </div>
              </div>
              ${mgmtTotal !== null ? `
                <div style="display:flex;gap:10px;align-items:center;margin-bottom:8px">
                  <span style="font-size:0.75rem;color:var(--text-muted);min-width:80px">📊 ผล (ผจก.)</span>
                  ${scoreBar(mgmtTotal, 100)}
                  <span style="font-size:0.82rem;font-weight:700;min-width:40px;text-align:right">${mgmtTotal}/100</span>
                </div>
              ` : selfTotal !== null ? `
                <div style="display:flex;gap:10px;align-items:center;margin-bottom:8px">
                  <span style="font-size:0.75rem;color:var(--text-muted);min-width:80px">👤 ตัวเอง</span>
                  ${scoreBar(selfTotal, 100)}
                  <span style="font-size:0.82rem;font-weight:700;min-width:40px;text-align:right">${selfTotal}/100</span>
                </div>
              ` : ''}
              ${r.comment ? `<div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:8px;font-style:italic">"${r.comment}"</div>` : ''}
              <div style="display:flex;gap:6px">
                <button class="btn btn-xs btn-primary view-btn" data-id="${r.id}">ดูรายละเอียด</button>
                ${r.status === 'self_done' ? `<button class="btn btn-xs btn-success review-btn" data-id="${r.id}">📝 ประเมิน</button>` : ''}
                ${r.status === 'pending' ? `<button class="btn btn-xs btn-warning remind-btn" data-id="${r.id}">🔔 แจ้งเตือน</button>` : ''}
              </div>
            </div>`
          }).join('')}
          ${!list.length ? `<div class="empty-state"><div class="empty-icon">📊</div><div class="empty-title">ไม่มีรายการประเมิน</div></div>` : ''}
        </div>
      </div>
    `

    container.querySelectorAll('.sf-btn').forEach(b => b.addEventListener('click', () => { statusFilter = b.dataset.s; renderPage() }))
    document.getElementById('start-cycle-btn')?.addEventListener('click', () => {
      openModal({
        title: '🔄 เริ่มรอบประเมิน H2/2568',
        size: 'sm',
        body: `
          <div style="font-size:0.8rem;display:flex;flex-direction:column;gap:10px">
            <div style="background:var(--surface-2);border-radius:6px;padding:10px;font-size:0.76rem">
              <div><b>รอบ:</b> H2/2568 (ก.ค.–ธ.ค. 2025)</div>
              <div><b>พนักงานทั้งหมด:</b> ${reviews.length} คน</div>
            </div>
            <div><label style="font-size:0.72rem;color:var(--text-muted)">กำหนดส่งผลประเมินตัวเอง</label>
              <input class="input" id="pr-self-deadline" type="date" value="2025-08-31" style="width:100%;margin-top:4px"></div>
            <div><label style="font-size:0.72rem;color:var(--text-muted)">กำหนดผู้จัดการส่งผล</label>
              <input class="input" id="pr-mgmt-deadline" type="date" value="2025-09-30" style="width:100%;margin-top:4px"></div>
          </div>
        `,
        confirmText: '🚀 เริ่มรอบประเมิน',
        async onConfirm() {
          const selfDl = document.getElementById('pr-self-deadline')?.value
          const mgmtDl = document.getElementById('pr-mgmt-deadline')?.value
          const toCreate = reviews.filter(r => r.period !== 'H2/2568')
          for (const r of toCreate) {
            await createDoc('performance_reviews', { staff: r.staff, dept: r.dept, period: 'H2/2568', status: 'pending', selfScores: null, mgmtScores: null, comment: '', grade: null })
          }
          showToast(`🔄 เริ่มรอบประเมิน H2/2568 แล้ว · ส่งตัวเอง: ${selfDl} · ผู้จัดการ: ${mgmtDl}`, 'success')
          await loadData()
        }
      })
    })
    container.querySelectorAll('.view-btn').forEach(b => b.addEventListener('click', () => {
      const r = reviews.find(x => x.id === b.dataset.id); if (r) openDetail(r)
    }))
    container.querySelectorAll('.remind-btn').forEach(b => b.addEventListener('click', () => {
      const r = reviews.find(x => x.id === b.dataset.id)
      if (r) showToast(`🔔 ส่งแจ้งเตือนถึง ${r.staff} แล้ว`, 'success')
    }))
    container.querySelectorAll('.review-btn').forEach(b => b.addEventListener('click', () => {
      const r = reviews.find(x => x.id === b.dataset.id); if (r) openMgmtReview(r)
    }))
  }

  function openDetail(r) {
    const st = REVIEW_STATUS[r.status]
    openModal({
      title: `📊 ${r.staff} — ${r.period}`,
      size: 'md',
      body: `
        <span class="badge badge-${st?.color}" style="margin-bottom:12px">${st?.label}</span>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:10px">
          ${r.selfScores ? `<div><div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);margin-bottom:8px">👤 ประเมินตัวเอง</div>
            ${CRITERIA.map(c => `<div style="display:flex;justify-content:space-between;font-size:0.78rem;padding:4px 0">${c.label} <strong>${r.selfScores[c.key]}/5</strong></div>`).join('')}
            <div style="margin-top:8px;font-weight:700">รวม: ${(+calcScore(r.selfScores)).toFixed(0)}/100</div>
          </div>` : '<div style="color:var(--text-muted);font-size:0.8rem">ยังไม่ประเมินตัวเอง</div>'}
          ${r.mgmtScores ? `<div><div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);margin-bottom:8px">👔 ผู้จัดการประเมิน</div>
            ${CRITERIA.map(c => `<div style="display:flex;justify-content:space-between;font-size:0.78rem;padding:4px 0">${c.label} <strong>${r.mgmtScores[c.key]}/5</strong></div>`).join('')}
            <div style="margin-top:8px;font-weight:700">รวม: ${(+calcScore(r.mgmtScores)).toFixed(0)}/100 · ${r.grade}</div>
          </div>` : '<div style="color:var(--text-muted);font-size:0.8rem">ผู้จัดการยังไม่ประเมิน</div>'}
        </div>
        ${r.comment ? `<div style="margin-top:12px;padding:10px;background:var(--surface-2);border-radius:var(--radius-sm);font-size:0.83rem;font-style:italic">"${r.comment}"</div>` : ''}
      `
    })
  }

  function openMgmtReview(r) {
    const inputs = CRITERIA.map(c => `
      <div class="input-group">
        <label class="input-label">${c.label} (${c.weight}%)</label>
        <input type="range" min="1" max="5" value="3" id="mgmt-${c.key}" style="width:100%">
        <div style="display:flex;justify-content:space-between;font-size:0.7rem;color:var(--text-muted)"><span>1</span><span id="mgmt-${c.key}-val">3</span><span>5</span></div>
      </div>
    `).join('')

    openModal({
      title: `📝 ประเมิน ${r.staff}`,
      size: 'md',
      body: `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          ${inputs}
          <div class="input-group" style="grid-column:1/-1"><label class="input-label">ความคิดเห็น</label><textarea class="input" id="mgmt-comment" rows="3"></textarea></div>
        </div>
      `,
      async onConfirm() {
        const scores = {}
        CRITERIA.forEach(c => { scores[c.key] = +document.getElementById(`mgmt-${c.key}`)?.value || 3 })
        const comment = document.getElementById('mgmt-comment')?.value || ''
        const total = +calcScore(scores)
        const grade = gradeFromScore(total)
        await updateDocData('performance_reviews', r.id, { mgmtScores: scores, comment, status: 'reviewed', grade })
        showToast(`✅ ประเมิน ${r.staff} เสร็จแล้ว! เกรด ${grade}`, 'success'); await loadData()
      }
    })

    // wire up range sliders
    setTimeout(() => {
      CRITERIA.forEach(c => {
        const el = document.getElementById(`mgmt-${c.key}`)
        const valEl = document.getElementById(`mgmt-${c.key}-val`)
        el?.addEventListener('input', () => { if (valEl) valEl.textContent = el.value })
      })
    }, 100)
  }

  await loadData()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
