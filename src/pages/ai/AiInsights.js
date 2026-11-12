/**
 * AI Insights — ข้อมูลเชิงลึกจาก AI
 * Route: /ai/insights
 */
import { formatCurrency, formatDate } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, listAllDocs, createDoc } from '../../core/db.js'
import { companyScopeFilters } from '../../core/companyScope.js'
import { navigate } from '../../core/router.js'
import { todayBangkok } from '../../utils/format.js'
import { buildInsights } from '../../utils/aiInsights.js'
import { escHtml } from '../../utils/escape.js'
import { kpi } from '../../utils/kpiCard.js'

const INSIGHT_CATS = {
  sales:    { label: 'ยอดขาย', icon: '📈', color: 'success' },
  risk:     { label: 'ความเสี่ยง', icon: '⚠️', color: 'danger' },
  opportunity: { label: 'โอกาส', icon: '🚀', color: 'primary' },
  customer: { label: 'ลูกค้า', icon: '👥', color: 'warning' },
  ops:      { label: 'Operations', icon: '⚙️', color: 'secondary' },
}

const PRIORITY = {
  high:   { label: 'สูง', color: 'danger' },
  medium: { label: 'ปานกลาง', color: 'warning' },
  low:    { label: 'ต่ำ', color: 'secondary' },
}

export default async function AiInsightsPage(container) {
  const myGen = container.__routerGen
  let catFilter = 'all'
  let priorityFilter = 'all'
  let insights = []
  let loading = true, failed = false

  // (v1.0.1106) ข้อสังเกตทุกข้อมาจากข้อมูลจริง (utils/aiInsights.js) — เดิมโชว์ข้อความสมมติ ("BYD Dolphin เพิ่ม 28%",
  // "56 ลูกค้า At-Risk") เมื่อข้อมูลน้อย และ "ความมั่นใจ %" ก็เป็นเลขที่ตั้งไว้เอง · ปุ่มรีเฟรชคำนวณใหม่จริง
  async function load() {
    loading = true
    const f = companyScopeFilters()
    try {
      const [bookings, customers, followups, vehicles, actions, { QUICK_SOURCES }] = await Promise.all([
        listAllDocs('bookings', f, 'createdAt', 'desc'),
        listAllDocs('customers', f, 'createdAt', 'desc'),
        listDocs('followups', f, 'dueDate', 'desc', 3000).catch(() => []),
        listAllDocs('vehicles', f, 'createdAt', 'desc').catch(() => []),
        listDocs('ai_insight_actions', [], 'createdAt', 'desc', 500).catch(() => []),
        import('../../utils/quickLead.js').catch(() => ({ QUICK_SOURCES: [] })),
      ])
      const dismissed = new Set(actions.filter(a => a.type === 'dismiss').map(a => a.insightId))
      const done = new Set(actions.filter(a => a.type === 'action').map(a => a.insightId))
      insights = buildInsights({ bookings, customers, followups, vehicles, today: todayBangkok(), sourceLabel: { event: '🎪 ออกบูธ/อีเวนต์', ...Object.fromEntries(QUICK_SOURCES || []) } })
        .filter(i => !dismissed.has(i.id)).map(i => done.has(i.id) ? { ...i, actionTaken: true } : i)
      failed = false
    } catch { failed = true; insights = [] }
    loading = false
  }
  await load()
  if (container.__routerGen !== myGen) return

  function renderPage() {
    const list = insights.filter(i =>
      (catFilter === 'all' || i.cat === catFilter) &&
      (priorityFilter === 'all' || i.priority === priorityFilter)
    )
    const highPriority = insights.filter(i => i.priority === 'high').length

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🔮 ข้อสังเกตจาก AI</div>
            <div class="page-subtitle">ระบบอ่านข้อมูลจริงของร้าน แล้วบอกเรื่องที่ควรจัดการก่อน</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="refresh-insights-btn">🔄 รีเฟรช</button>
          </div>
        </div>

        ${failed ? '<div class="card" style="padding:12px 14px;margin-bottom:12px;color:var(--danger)">โหลดข้อมูลไม่สำเร็จ กด 🔄 รีเฟรช อีกครั้ง</div>' : ''}
        <div class="kpi-grid" style="grid-template-columns:repeat(auto-fit,minmax(140px,1fr));margin-bottom:16px">
          ${kpi('🔮 เรื่องที่ควรรู้', insights.length + ' เรื่อง', 'primary')}
          ${kpi('🚨 เร่งด่วน', highPriority, highPriority > 0 ? 'danger' : 'success')}
          ${kpi('✅ จัดการแล้ว', insights.filter(i => i.actionTaken).length, 'success')}
        </div>

        <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
          <div class="chip-scroll" style="display:flex;gap:4px;flex-wrap:wrap">
            <button class="btn btn-xs ${catFilter==='all'?'btn-primary':'btn-secondary'} cf-btn" data-c="all">ทั้งหมด</button>
            ${Object.entries(INSIGHT_CATS).map(([k,v]) => `<button class="btn btn-xs ${catFilter===k?'btn-'+v.color:'btn-secondary'} cf-btn" data-c="${k}">${v.icon} ${v.label}</button>`).join('')}
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:10px">
          ${!list.length ? `<div class="empty-state" style="padding:40px"><div class="empty-icon">✨</div><div class="empty-title">${insights.length ? 'ไม่มีเรื่องในหมวดนี้' : 'ตอนนี้ไม่มีเรื่องที่ต้องเร่งจัดการ'}</div><div class="empty-desc">ระบบดูจากใบจอง ลูกค้า นัดติดตาม และสต็อกจริง — มีเรื่องใหม่จะขึ้นที่นี่เอง</div></div>` : ''}
          ${list.map(ins => {
            const cat = INSIGHT_CATS[ins.cat]
            const pri = PRIORITY[ins.priority]
            return `<div class="card" style="padding:14px;border-left:4px solid var(--${cat?.color})">
              <div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:8px">
                <span style="font-size:1.5rem;line-height:1">${cat?.icon}</span>
                <div style="min-width:0;flex:1">
                  <div style="font-weight:700;font-size:0.9rem;overflow-wrap:anywhere">${escHtml(ins.title)}</div>
                  <div style="display:flex;gap:6px;margin-top:4px;flex-wrap:wrap">
                    <span class="badge badge-${pri?.color}" style="font-size:0.62rem">ความเร่งด่วน: ${pri?.label}</span>
                    <span class="badge badge-${cat?.color}" style="font-size:0.62rem">${cat?.label}</span>
                  </div>
                </div>
              </div>
              <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:10px;overflow-wrap:anywhere">${escHtml(ins.detail)}</div>
              <div style="padding:8px 10px;background:var(--surface-2);border-radius:var(--radius-sm);font-size:0.78rem;margin-bottom:10px;overflow-wrap:anywhere">
                💡 <strong>แนะนำ:</strong> ${escHtml(ins.recommendation)}
              </div>
              <div style="display:flex;gap:6px;flex-wrap:wrap">
                ${ins.link ? `<button class="btn btn-xs btn-primary go-btn" data-path="${escHtml(ins.link.path)}">${escHtml(ins.link.label)} →</button>` : ''}
                ${ins.actionTaken
                  ? `<span class="badge badge-success" style="font-size:0.72rem;padding:5px 10px">✅ จัดการแล้ว</span>`
                  : `<button class="btn btn-xs btn-secondary action-btn" data-id="${ins.id}">✅ จัดการแล้ว</button>`}
                <button class="btn btn-xs btn-secondary dismiss-btn" data-id="${ins.id}">✗ ซ่อนเดือนนี้</button>
              </div>
            </div>`
          }).join('')}
        </div>
      </div>
    `

    container.querySelectorAll('.cf-btn').forEach(b => b.addEventListener('click', () => { catFilter = b.dataset.c; renderPage() }))
    container.querySelectorAll('.pf-btn').forEach(b => b.addEventListener('click', () => { priorityFilter = b.dataset.p; renderPage() }))
    container.querySelectorAll('.go-btn').forEach(b => b.addEventListener('click', () => navigate(b.dataset.path)))
    document.getElementById('refresh-insights-btn')?.addEventListener('click', async e => {
      e.currentTarget.disabled = true
      await load()
      if (container.__routerGen !== myGen) return
      renderPage()
      showToast(failed ? 'รีเฟรชไม่สำเร็จ' : `🔄 คำนวณใหม่จากข้อมูลล่าสุดแล้ว · ${insights.length} เรื่อง`, failed ? 'error' : 'success')
    })
    container.querySelectorAll('.action-btn').forEach(b => b.addEventListener('click', async () => {
      const ins = insights.find(x => x.id === b.dataset.id)
      if (!ins) return
      try {
        await createDoc('ai_insight_actions', { insightId: ins.id, type: 'action', title: ins.title })
      } catch (e) {
        showToast('❌ บันทึกไม่สำเร็จ: ' + e.message, 'error')
        return
      }
      ins.actionTaken = true
      renderPage()
      showToast('✅ บันทึกว่าจัดการแล้ว', 'success')
    }))
    container.querySelectorAll('.dismiss-btn').forEach(b => b.addEventListener('click', async () => {
      const ins = insights.find(x => x.id === b.dataset.id)
      if (!ins) return
      try {
        await createDoc('ai_insight_actions', { insightId: ins.id, type: 'dismiss', title: ins.title })
      } catch (e) {
        showToast('❌ บันทึกไม่สำเร็จ: ' + e.message, 'error')
        return
      }
      insights = insights.filter(x => x.id !== b.dataset.id)
      renderPage()
      showToast('ซ่อนเรื่องนี้ถึงสิ้นเดือนแล้ว', 'info')
    }))
  }

  renderPage()
}

