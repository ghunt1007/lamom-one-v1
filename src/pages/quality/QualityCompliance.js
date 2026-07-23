import { watchDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'
import { showToast } from '../../core/store.js'
import { formatDate, timeAgo } from '../../utils/format.js'
import { openModal, confirmDialog } from '../../utils/modal.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const AUDIT_TYPES = {
  internal: { label: 'Internal Audit', badge: 'primary' },
  external: { label: 'External Audit', badge: 'accent' },
  safety: { label: 'Safety Check', badge: 'warning' },
  pdpa: { label: 'PDPA Compliance', badge: 'accent' },
  iso: { label: 'ISO/Standard', badge: 'success' },
}

const FINDING_LEVELS = {
  major: { label: '🔴 Major', badge: 'danger', order: 0 },
  minor: { label: '🟡 Minor', badge: 'warning', order: 1 },
  observation: { label: '🟢 Observation', badge: 'success', order: 2 },
}

const AUDIT_STATUS = {
  planned: { label: '📅 วางแผน', badge: 'primary' },
  ongoing: { label: '⚙️ กำลังตรวจ', badge: 'primary' },
  completed: { label: '✅ เสร็จแล้ว', badge: 'success' },
  overdue: { label: '⏰ เกินกำหนด', badge: 'danger' },
}

const CHECKLIST_TEMPLATES = [
  {
    id: 'pdpa_basic', name: 'PDPA Basic Checklist', type: 'pdpa',
    items: [
      'มีนโยบาย Privacy Policy ที่อัพเดตล่าสุด',
      'พนักงานทุกคนผ่านการอบรม PDPA',
      'มีระบบ Consent Management',
      'มีระบบ Log การเข้าถึงข้อมูล',
      'มี Data Retention Policy',
      'มีกระบวนการรับเรื่อง Data Subject Request',
    ]
  },
  {
    id: 'service_quality', name: 'Service Quality Checklist', type: 'internal',
    items: [
      'เครื่องมือวัดทุกชิ้นมี Calibration ที่ยังไม่หมดอายุ',
      'ช่างทุกคนมีใบรับรองที่ถูกต้อง',
      'EV Safety Equipment พร้อมใช้งาน',
      'พื้นที่ Workshop สะอาดและปลอดภัย',
      'มีระบบ Follow-up ลูกค้าหลังบริการ',
    ]
  },
  {
    id: 'safety_basic', name: 'Safety Inspection', type: 'safety',
    items: [
      'ถังดับเพลิงครบตามจำนวนและยังไม่หมดอายุ',
      'ป้ายทางออกฉุกเฉินติดตั้งครบถ้วน',
      'อุปกรณ์ปฐมพยาบาลพร้อมใช้',
      'EV High-voltage warning signs ติดครบ',
      'พนักงานรู้จุดรวมพลฉุกเฉิน',
    ]
  },
]

export default async function QualityCompliancePage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let audits = []
  let activeTab = 'audits' // audits | checklist | findings | kpi

  container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`

  // Real-time: อัปเดตสดเมื่อมีคนสร้าง Audit/ปิด Finding จากเครื่องอื่น — หน้านี้ไม่มีช่องค้นหาจึงไม่ต้องกันโฟกัส
  const unsubAudits = watchDocs('compliance_audits', [], 'startDate', 'desc', 300, rows => {
    if (container.__routerGen !== myGen) { unsubAudits(); return }
    audits = rows
    renderPage()
  })

  function getStats() {
    const total = audits.length
    const completed = audits.filter(a => a.status === 'completed').length
    const openFindings = audits.flatMap(a => a.findings).filter(f => f.status === 'open').length
    const majorFindings = audits.flatMap(a => a.findings).filter(f => f.level === 'major' && f.status === 'open').length
    const avgScore = audits.filter(a => a.score != null).reduce((s, a, _, arr) => s + a.score / arr.length, 0)
    return { total, completed, openFindings, majorFindings, avgScore }
  }

  function renderPage() {
    const s = getStats()
    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">📋 Quality & Compliance</div>
            <div class="page-subtitle">Audit Management & PDPA Compliance</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="new-audit-btn">➕ Audit ใหม่</button>
          </div>
        </div>

        <!-- KPI -->
        <div class="kpi-grid" style="grid-template-columns:repeat(5,1fr);margin-bottom:20px">
          ${kpi('📋 Audits', s.total, 'primary')}
          ${kpi('✅ เสร็จแล้ว', s.completed, 'success')}
          ${kpi('⚠️ Open Findings', s.openFindings, s.openFindings > 0 ? 'warning' : 'success')}
          ${kpi('🔴 Major', s.majorFindings, s.majorFindings > 0 ? 'danger' : 'success')}
          ${kpi('⭐ Avg Score', s.avgScore > 0 ? s.avgScore.toFixed(1) + '%' : 'N/A', s.avgScore >= 80 ? 'success' : 'warning')}
        </div>

        <!-- Tabs -->
        <div style="display:flex;gap:4px;margin-bottom:16px">
          ${['audits','checklist','findings'].map(t => `
            <button class="btn btn-sm ${activeTab===t?'btn-primary':'btn-secondary'} tab-btn" data-tab="${t}">
              ${{ audits:'📋 Audits', checklist:'✅ Checklists', findings:'⚠️ Findings' }[t]}
            </button>`).join('')}
        </div>

        <div id="tab-content">
          ${renderTab()}
        </div>
      </div>
    `

    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => { activeTab = btn.dataset.tab; renderPage() })
    })
    document.getElementById('new-audit-btn')?.addEventListener('click', () => openAuditForm())
    bindTabEvents()
  }

  function renderTab() {
    switch (activeTab) {
      case 'audits': return renderAudits()
      case 'checklist': return renderChecklists()
      case 'findings': return renderFindings()
      default: return ''
    }
  }

  function renderAudits() {
    return `
      <div style="display:flex;flex-direction:column;gap:12px">
        ${audits.map(a => {
          const st = AUDIT_STATUS[a.status] || AUDIT_STATUS.planned
          const tp = AUDIT_TYPES[a.type] || AUDIT_TYPES.internal
          const openF = a.findings.filter(f => f.status === 'open').length
          return `
          <div class="card audit-row" data-aid="${a.id}" style="padding:16px;cursor:pointer">
            <div style="display:flex;align-items:flex-start;gap:12px">
              <div style="flex:1">
                <div style="display:flex;gap:6px;align-items:center;margin-bottom:6px">
                  <span class="badge badge-${tp.badge}">${tp.label}</span>
                  <span class="badge badge-${st.badge}">${st.label}</span>
                  ${openF > 0 ? `<span class="badge badge-warning">⚠️ ${openF} Open</span>` : ''}
                </div>
                <div style="font-weight:700;margin-bottom:4px">${escHtml(a.title)}</div>
                <div style="font-size:0.8rem;color:var(--text-muted);display:flex;gap:12px;flex-wrap:wrap">
                  <span>👤 ${escHtml(a.auditor)}</span>
                  <span>🏢 ${escHtml(a.dept)}</span>
                  <span>📅 ${a.startDate} – ${a.endDate}</span>
                  ${a.score != null ? `<span>⭐ คะแนน: ${a.score}%</span>` : ''}
                </div>
              </div>
              <div style="display:flex;gap:4px;flex-shrink:0">
                ${a.status !== 'completed' ? `<button class="btn btn-primary btn-sm audit-view-btn" data-aid="${a.id}">เปิดดู</button>` : `<button class="btn btn-secondary btn-sm audit-view-btn" data-aid="${a.id}">ดูผล</button>`}
              </div>
            </div>
          </div>`
        }).join('')}
        ${!audits.length ? `<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-title">ยังไม่มี Audit</div></div>` : ''}
      </div>
    `
  }

  function renderChecklists() {
    return `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px">
        ${CHECKLIST_TEMPLATES.map(t => {
          const tp = AUDIT_TYPES[t.type]
          return `
          <div class="card" style="padding:16px">
            <div style="display:flex;gap:6px;align-items:center;margin-bottom:10px">
              <span class="badge badge-${tp?.badge||'primary'}">${tp?.label||t.type}</span>
            </div>
            <div style="font-weight:700;margin-bottom:10px">${t.name}</div>
            <div style="font-size:0.83rem;color:var(--text-muted);margin-bottom:12px">${t.items.length} รายการ</div>
            <div style="display:flex;flex-direction:column;gap:4px;margin-bottom:14px">
              ${t.items.map(i => `<div style="font-size:0.78rem;display:flex;gap:6px"><span>☐</span><span>${i}</span></div>`).join('')}
            </div>
            <button class="btn btn-secondary btn-sm use-template-btn" data-tid="${t.id}" style="width:100%">▶ ใช้ Template นี้</button>
          </div>`
        }).join('')}
      </div>
    `
  }

  function renderFindings() {
    const all = audits.flatMap(a => a.findings.map(f => ({ ...f, auditTitle: a.title, auditId: a.id })))
    const open = all.filter(f => f.status === 'open').sort((a, b) => (FINDING_LEVELS[a.level]?.order ?? 9) - (FINDING_LEVELS[b.level]?.order ?? 9))
    const closed = all.filter(f => f.status !== 'open')
    return `
      <div style="display:flex;flex-direction:column;gap:16px">
        <div>
          <div style="font-weight:700;margin-bottom:10px">⚠️ Open Findings (${open.length})</div>
          ${open.length ? open.map(f => findingCard(f)).join('') : `<div style="color:var(--text-muted);font-size:0.85rem">🎉 ไม่มี Open Findings</div>`}
        </div>
        ${closed.length ? `
          <div>
            <div style="font-weight:700;margin-bottom:10px;color:var(--text-muted)">✅ Closed Findings (${closed.length})</div>
            ${closed.map(f => findingCard(f, true)).join('')}
          </div>
        ` : ''}
      </div>
    `
  }

  function findingCard(f, closed = false) {
    const lv = FINDING_LEVELS[f.level] || FINDING_LEVELS.observation
    return `<div class="card" style="padding:12px 16px;margin-bottom:8px;border-left:3px solid var(--${lv.badge});${closed ? 'opacity:0.6' : ''}">
      <div style="display:flex;gap:8px;align-items:flex-start">
        <div style="flex:1">
          <div style="display:flex;gap:6px;margin-bottom:4px">
            <span class="badge badge-${lv.badge}" style="font-size:0.68rem">${lv.label}</span>
            <span style="font-size:0.72rem;color:var(--text-muted)">${escHtml(f.auditTitle)}</span>
          </div>
          <div style="font-size:0.88rem">${escHtml(f.desc)}</div>
        </div>
        ${!closed ? `<button class="btn btn-success btn-sm close-finding-btn" data-fid="${f.id}" data-aid="${f.auditId}">✅ ปิด</button>` : ''}
      </div>
    </div>`
  }

  function bindTabEvents() {
    document.querySelectorAll('.audit-view-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation()
        const a = audits.find(x => x.id === btn.dataset.aid)
        if (a) openAuditDetail(a)
      })
    })
    document.querySelectorAll('.audit-row').forEach(row => {
      row.addEventListener('click', () => {
        const a = audits.find(x => x.id === row.dataset.aid)
        if (a) openAuditDetail(a)
      })
    })
    document.querySelectorAll('.close-finding-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const audit = audits.find(a => a.id === btn.dataset.aid)
        const finding = audit?.findings.find(f => f.id === btn.dataset.fid)
        if (!finding) return
        const newFindings = audit.findings.map(f => f.id === finding.id ? { ...f, status: 'closed' } : f)
        try {
          await updateDocData('compliance_audits', audit.id, { findings: newFindings })
          showToast('✅ ปิด Finding แล้ว', 'success')
        } catch { showToast('บันทึกไม่สำเร็จ', 'error') }
      })
    })
    document.querySelectorAll('.use-template-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const t = CHECKLIST_TEMPLATES.find(x => x.id === btn.dataset.tid)
        if (t) openAuditForm(t.type)
      })
    })
  }

  function openAuditDetail(audit) {
    const st = AUDIT_STATUS[audit.status]
    const openF = audit.findings.filter(f => f.status === 'open').length
    openModal({
      title: `📋 ${escHtml(audit.title)}`, size: 'lg',
      body: `
        <div style="display:flex;flex-direction:column;gap:14px">
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <span class="badge badge-${AUDIT_TYPES[audit.type]?.badge}">${AUDIT_TYPES[audit.type]?.label}</span>
            <span class="badge badge-${st?.badge}">${st?.label}</span>
          </div>
          <div class="grid-2">
            ${dr('👤','ผู้ตรวจ',escHtml(audit.auditor))}
            ${dr('🏢','แผนก',escHtml(audit.dept))}
            ${dr('📅','ช่วงเวลา',`${audit.startDate} – ${audit.endDate}`)}
            ${dr('⭐','คะแนน',audit.score != null ? audit.score + '%' : 'กำลังตรวจ')}
          </div>
          <div>
            <div style="font-weight:700;margin-bottom:10px">⚠️ Findings (${audit.findings.length})</div>
            ${audit.findings.length ? audit.findings.map(f => {
              const lv = FINDING_LEVELS[f.level]
              return `<div style="padding:10px;border-left:3px solid var(--${lv?.badge});background:var(--surface-2);margin-bottom:8px;border-radius:0 var(--radius-md) var(--radius-md) 0">
                <span class="badge badge-${lv?.badge}" style="font-size:0.68rem">${lv?.label}</span>
                <div style="font-size:0.85rem;margin-top:4px">${escHtml(f.desc)}</div>
                <div style="font-size:0.75rem;color:var(--text-muted);margin-top:3px">สถานะ: ${f.status === 'closed' ? '✅ ปิดแล้ว' : '⚠️ ยังเปิดอยู่'}</div>
              </div>`
            }).join('') : '<div style="color:var(--text-muted);font-size:0.85rem">ไม่มี Finding</div>'}
          </div>
        </div>
      `,
      footer: `<button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">ปิด</button>`
    })
  }

  function openAuditForm(preType = 'internal') {
    const today = new Date().toISOString().slice(0, 10)
    const { el, close } = openModal({
      title: '➕ สร้าง Audit ใหม่', size: 'md',
      body: `
        <div style="display:flex;flex-direction:column;gap:12px">
          <div class="input-group"><label class="input-label">ชื่อ Audit *</label><input class="input" id="af-title" placeholder="เช่น Q3 Safety Inspection"></div>
          <div class="grid-2">
            <div class="input-group"><label class="input-label">ประเภท</label>
              <select class="input" id="af-type">
                ${Object.entries(AUDIT_TYPES).map(([k,v]) => `<option value="${k}" ${k===preType?'selected':''}>${v.label}</option>`).join('')}
              </select>
            </div>
            <div class="input-group"><label class="input-label">แผนก</label><input class="input" id="af-dept" placeholder="เช่น Service"></div>
          </div>
          <div class="grid-2">
            <div class="input-group"><label class="input-label">วันเริ่ม</label><input class="input" type="date" id="af-start" value="${today}"></div>
            <div class="input-group"><label class="input-label">วันสิ้นสุด</label><input class="input" type="date" id="af-end" value="${today}"></div>
          </div>
          <div class="input-group"><label class="input-label">ผู้ตรวจ</label><input class="input" id="af-auditor" placeholder="ชื่อผู้ตรวจ"></div>
        </div>
      `,
      footer: `<button class="btn btn-secondary" id="afc">ยกเลิก</button><button class="btn btn-primary" id="afs">💾 สร้าง</button>`
    })
    el.querySelector('#afc').addEventListener('click', close)
    el.querySelector('#afs').addEventListener('click', async () => {
      const title = el.querySelector('#af-title').value.trim()
      if (!title) return
      const btn = el.querySelector('#afs'); btn.disabled = true
      try {
        await createDoc('compliance_audits', {
          title,
          type: el.querySelector('#af-type').value,
          status: 'planned',
          auditor: el.querySelector('#af-auditor').value || 'TBD',
          dept: el.querySelector('#af-dept').value || 'ทั่วไป',
          startDate: el.querySelector('#af-start').value,
          endDate: el.querySelector('#af-end').value,
          score: null, findings: [],
        })
        showToast('✅ สร้าง Audit แล้ว', 'success'); close()
      } catch { btn.disabled = false; showToast('บันทึกไม่สำเร็จ', 'error') }
    })
  }

  return function cleanupQualityCompliance() { unsubAudits() }
}

function kpi(title, value, color) {
  return `<div class="kpi-card"><div class="kpi-title">${title}</div><div class="kpi-value" style="color:var(--${color})">${value}</div></div>`
}
function dr(icon, label, val) {
  return `<div style="font-size:0.83rem;display:flex;gap:6px"><span>${icon}</span><span style="color:var(--text-muted);min-width:80px">${label}</span><span>${val}</span></div>`
}
