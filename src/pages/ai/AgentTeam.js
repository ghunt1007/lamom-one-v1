/**
 * ทีม AI ทำงานให้ — /ai/team (v1.0.1132)
 * เจ้าหน้าที่ AI ประจำแต่ละแผนก (ขาย การตลาด ธุรการ การเงิน บริการ บุคคล) ตรวจงานจากข้อมูลจริงให้เองทุกครั้งที่เปิด
 * แล้วบอกว่าวันนี้ต้องทำอะไร + ปุ่มไปทำทันที · เซลส์เห็นเฉพาะลูกค้าของตัวเอง ผู้จัดการ/เจ้าของเห็นทั้งทีม (สิทธิ์เดียวกับ LAMI)
 */
import { listDocs, listAllDocs } from '../../core/db.js'
import { companyScopeFilters } from '../../core/companyScope.js'
import { getVisibilityScope, scopeIncludesRecord } from '../../core/hierarchy.js'
import { navigate } from '../../core/router.js'
import { todayBangkok, dmy, hm } from '../../utils/format.js'
import { escHtml as esc } from '../../utils/escape.js'
import { runAgents, agentsSummary } from '../../utils/aiAgents.js'
import { visibleCustomersForCommands } from '../../utils/lamiCommandCard.js'

const CSS = `
.at-head { display:flex; justify-content:space-between; align-items:flex-start; gap:10px; flex-wrap:wrap; margin-bottom:12px; }
.at-sum { background:var(--surface); border:1px solid var(--border); border-radius:var(--radius-md); padding:12px 14px; margin-bottom:12px; white-space:pre-line; font-size:0.88rem; line-height:1.6; overflow-wrap:anywhere; }
.at-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(300px, 1fr)); gap:12px; align-items:start; }
.at-card { background:var(--surface); border:1px solid var(--border); border-radius:var(--radius-md); padding:12px 14px; min-width:0; display:flex; flex-direction:column; gap:8px; }
.at-card.busy { border-color:var(--primary); }
.at-who { display:flex; gap:10px; align-items:center; }
.at-ava { font-size:1.6rem; width:44px; height:44px; border-radius:12px; display:grid; place-items:center; background:var(--surface-2); flex:0 0 auto; }
.at-who b { display:block; font-size:0.95rem; }
.at-who small { color:var(--text-3); font-size:0.75rem; }
.at-badge { margin-left:auto; font-size:0.72rem; padding:3px 9px; border-radius:999px; white-space:nowrap; background:var(--surface-2); color:var(--text-3); }
.at-badge.hot { background:var(--danger, #dc2626); color:#fff; }
.at-badge.ok { color:var(--success); }
.at-task { border:1px solid var(--border); border-radius:10px; padding:8px 10px; background:var(--surface-2); }
.at-task-h { display:flex; gap:8px; align-items:center; justify-content:space-between; }
.at-task-h span { font-size:0.84rem; font-weight:600; min-width:0; overflow-wrap:anywhere; }
.at-task ul { margin:6px 0 0; padding-left:0; list-style:none; font-size:0.78rem; color:var(--text-2); display:flex; flex-direction:column; gap:2px; }
.at-task li { overflow-wrap:anywhere; }
.at-done { font-size:0.78rem; color:var(--text-3); }
.at-go { flex:0 0 auto; }
@media (max-width: 640px) { .at-grid { grid-template-columns:minmax(0,1fr); } }
`

export default async function AgentTeamPage(container) {
  const myGen = container.__routerGen
  const alive = () => container.__routerGen === myGen && container.isConnected
  if (!document.getElementById('at-css')) { const st = document.createElement('style'); st.id = 'at-css'; st.textContent = CSS; document.head.appendChild(st) }

  container.innerHTML = `
    <div class="page-content">
    <div class="page-header at-head">
      <div><h1 class="page-title">🤖 ทีม AI ทำงานให้</h1>
      <p class="page-subtitle">เจ้าหน้าที่ AI ประจำทุกแผนกตรวจงานจากข้อมูลจริงให้เอง — บอกว่าวันนี้ต้องทำอะไร กดไปทำได้ทันที</p></div>
      <div class="page-actions"><button type="button" class="btn btn-secondary btn-sm" id="at-reload">🔄 ตรวจใหม่</button></div>
    </div>
    <div id="at-body"><div class="at-sum">⏳ ทีม AI กำลังตรวจงานทุกแผนก…</div></div>
    </div>`

  async function load() {
    const today = todayBangkok()
    const f = companyScopeFilters()
    const vis = await getVisibilityScope().catch(() => null)
    const whole = !!vis && (vis.unrestricted || vis.companyOnly)
    const mine = (name, rec) => whole || (!!vis && scopeIncludesRecord(vis, name, rec))
    const [customers, bookings, drives, quotes, appts, threads, pdis, complaints, leaves] = await Promise.all([
      visibleCustomersForCommands().catch(() => []),
      listAllDocs('bookings', f, 'createdAt', 'desc').catch(() => []),
      listDocs('test_drives', f, 'date', 'desc', 1000).catch(() => []),
      listDocs('quotations', f, 'createdDate', 'desc', 500).catch(() => []),
      listDocs('appointments', f, 'date', 'desc', 300).catch(() => []),
      listDocs('social_threads', [], 'lastAt', 'desc', 300).catch(() => []),
      listDocs('pdi', f, 'startDate', 'desc', 300).catch(() => []),
      listDocs('complaints', f, 'createdAt', 'desc', 300).catch(() => []),
      listDocs('leave_requests', f, 'from', 'desc', 300).catch(() => []),
    ])
    const myCustIds = new Set(customers.map(c => c.id))
    const data = {
      today, customers,
      bookings: bookings.filter(b => !b.deleted && mine(b.salesName, b)),
      drives: drives.filter(t => mine(t.staff, t)),
      quotes: quotes.filter(q => !q.deleted && (whole || myCustIds.has(q.customerId) || mine(q.salesperson || q.staff, q))),
      appts: appts.filter(a => mine(a.salesperson, a)),
      // แชตรวมเห็นได้ทั้งทีมเหมือนหน้าแชต (ใครว่างก็ตอบได้)
      threads,
      pdis, complaints: whole ? complaints : complaints.filter(c => mine(c.assignedTo || c.staff, c)),
      leaves: whole ? leaves : leaves.filter(r => mine(r.staff, r)),
    }
    return runAgents(data)
  }

  function render(board, at) {
    const el = container.querySelector('#at-body'); if (!el) return
    el.innerHTML = `
      <div class="at-sum">${esc(agentsSummary(board))}<br><small class="ch-muted">ตรวจล่าสุด ${esc(dmy(at))} ${esc(hm(at))} น.</small></div>
      <div class="at-grid">${board.map(a => {
        const open = a.results.filter(r => r.n > 0)
        return `
        <div class="at-card ${open.length ? 'busy' : ''}">
          <div class="at-who"><span class="at-ava">${a.emoji}</span><span><b>${esc(a.name)} · ${esc(a.dept)}</b><small>${esc(a.role)}</small></span>
            ${a.urgent ? `<span class="at-badge hot">ด่วน ${a.urgent}</span>` : open.length ? `<span class="at-badge">${open.length} เรื่อง</span>` : '<span class="at-badge ok">✓ เรียบร้อย</span>'}</div>
          ${open.length ? open.map(r => `
            <div class="at-task">
              <div class="at-task-h"><span>${r.level === 'urgent' ? '🔴' : '🟡'} ${esc(r.label)} · ${r.n}</span><button type="button" class="btn btn-primary btn-xs at-go" data-go="${esc(r.go)}">ไปทำ →</button></div>
              ${r.lines.length ? `<ul>${r.lines.slice(0, 5).map(l => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}
            </div>`).join('') : `<div class="at-done">${a.results.map(r => esc(r.label)).join(' · ') || 'ยังไม่มีข้อมูลให้ตรวจ'} — ไม่มีงานค้าง 👍</div>`}
        </div>`
      }).join('')}</div>`
  }

  async function run() {
    const el = container.querySelector('#at-body')
    try {
      const board = await load()
      if (alive()) render(board, new Date())
    } catch (e) { if (el && alive()) el.innerHTML = `<div class="at-sum">⚠️ ตรวจไม่สำเร็จ: ${esc(e.message || e)}</div>` }
  }

  container.addEventListener('click', e => {
    const g = e.target.closest('[data-go]'); if (g) { navigate(g.dataset.go); return }
    if (e.target.closest('#at-reload')) { container.querySelector('#at-body').innerHTML = '<div class="at-sum">⏳ กำลังตรวจใหม่…</div>'; run() }
  })
  run()
}
