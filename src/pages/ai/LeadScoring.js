/**
 * AI Lead Scoring — จัดอันดับ Lead อัตโนมัติ
 * Route: /ai/lead-scoring
 */
import { formatCurrency, timeAgo } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { navigate } from '../../core/router.js'
import { watchDocs } from '../../core/db.js'
import { analyzeCustomer, isAiEnabled } from '../../utils/ai.js'

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const STATUS_BASE = { vip: 90, hot: 85, warm: 60, cold: 35, lost: 5 }

// คะแนนเบื้องต้นจากข้อมูลจริงที่มี (ไม่เรียก AI อัตโนมัติทุก Lead เพราะจะแพง/ช้าเกินไปตอนโหลดหน้า)
// ต้องกด "🤖 วิเคราะห์เจาะลึก" ต่อ Lead ที่สนใจจริงๆถึงจะเรียก Gemini ผ่าน analyzeCustomer()
function heuristicScore(c) {
  let score = STATUS_BASE[c.status] ?? 45
  const signals = []
  if (c.interestedModel) { score += 5; signals.push(`ระบุรถที่สนใจ: ${c.interestedModel}`) }
  if (c.budget) { score += 5; signals.push(`ระบุงบประมาณ: ${formatCurrency(c.budget)}`) }
  if (c.source) signals.push(`ที่มา: ${c.source}`)
  if (c.status === 'vip') signals.push('ลูกค้า VIP')
  if (c.status === 'hot') signals.push('จัดระดับความสนใจสูง (Hot)')
  return { score: Math.min(100, Math.max(5, score)), signals }
}

function tier(score) {
  if (score >= 80) return { label: 'Hot 🔥', color: 'danger', action: 'โทรปิดดีลวันนี้!' }
  if (score >= 60) return { label: 'Warm ☀️', color: 'warning', action: 'นัด Test Drive / ส่งข้อเสนอ' }
  if (score >= 40) return { label: 'Cool 🌤', color: 'primary', action: 'ส่งข้อมูล + ติดตามสัปดาห์นี้' }
  return { label: 'Cold ❄️', color: 'secondary', action: 'ใส่ Nurture campaign' }
}

export default async function LeadScoringPage(container) {
  const myGen = container.__routerGen
  let leads = []
  const aiResults = {} // customerId -> { score, reason, nextAction } จาก analyzeCustomer() แบบ on-demand

  container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`

  // Real-time: ลูกค้าที่ยังเป็น lead/pp — ไม่มีช่องค้นหาในหน้านี้จึงไม่ต้องกันโฟกัส
  const unsubLeads = watchDocs('customers', [], 'createdAt', 'desc', 500, rows => {
    if (container.__routerGen !== myGen) { unsubLeads(); return }
    leads = rows.filter(c => (c.stage === 'lead' || c.stage === 'pp') && c.status !== 'lost')
    renderPage()
  })

  function renderPage() {
    const scored = leads.map(l => ({ ...l, ...heuristicScore(l) }))
    const sorted = [...scored].sort((a, b) => b.score - a.score)
    const hot = scored.filter(l => l.score >= 80).length
    const pipeline = scored.filter(l => l.score >= 60).reduce((a, l) => a + (l.budget || 0), 0)
    const avgScore = scored.length ? Math.round(scored.reduce((a, l) => a + l.score, 0) / scored.length) : 0

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🤖 AI Lead Scoring</div>
            <div class="page-subtitle">จัดอันดับ Lead จากข้อมูลจริง — โฟกัสที่คนพร้อมซื้อ</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary" id="factors-btn">⚙️ เกณฑ์คะแนน</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('🔥 Hot Leads', hot, hot > 0 ? 'danger' : 'secondary')}
          ${kpi('💰 Pipeline (Warm+)', formatCurrency(pipeline), 'success')}
          ${kpi('📊 คะแนนเฉลี่ย', avgScore, avgScore >= 60 ? 'success' : 'warning')}
          ${kpi('🧲 Leads ทั้งหมด', leads.length, 'primary')}
        </div>

        ${!sorted.length ? `<div class="empty-state" style="padding:48px"><div class="empty-icon">🧲</div><div class="empty-title">ยังไม่มี Lead ในระบบ</div><div class="empty-desc">Lead ใหม่จากหน้าลูกค้าจะขึ้นที่นี่อัตโนมัติ</div></div>` : ''}

        <div style="display:flex;flex-direction:column;gap:10px">
          ${sorted.map((l, i) => {
            const t = tier(l.score)
            const ai = aiResults[l.id]
            const name = `${l.firstName || ''} ${l.lastName || ''}`.trim() || l.name || 'ไม่ระบุชื่อ'
            return `<div class="card" style="padding:13px 14px;border-left:3px solid var(--${t.color})">
              <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px">
                <div style="display:flex;gap:10px;align-items:center">
                  <div style="width:46px;height:46px;border-radius:50%;background:var(--${t.color})22;border:2px solid var(--${t.color});display:flex;align-items:center;justify-content:center;font-weight:900;font-size:0.95rem;color:var(--${t.color})">${ai?.score ?? l.score}</div>
                  <div>
                    <div style="font-weight:700;font-size:0.88rem">${i===0?'👑 ':''}${escHtml(name)} <span style="font-size:0.7rem;color:var(--text-muted)">📞 ${escHtml(l.phone || '-')}</span></div>
                    <div style="font-size:0.72rem;color:var(--text-muted)">🚗 ${escHtml(l.interestedModel || 'ยังไม่ระบุรุ่น')} · เพิ่มเมื่อ ${timeAgo(l.createdAt)}</div>
                  </div>
                </div>
                <span class="badge badge-${t.color}" style="font-size:0.65rem">${t.label}</span>
              </div>
              <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px">
                ${l.signals.map(s => `<span style="font-size:0.62rem;background:var(--surface-2);padding:2px 7px;border-radius:10px;color:var(--text-muted)">✓ ${escHtml(s)}</span>`).join('')}
              </div>
              ${ai ? `<div style="font-size:0.74rem;color:var(--text-2);background:var(--primary-dim);padding:8px 10px;border-radius:8px;margin-bottom:8px">🤖 ${escHtml(ai.reason || '')}${ai.nextAction ? ' — ' + escHtml(ai.nextAction) : ''}</div>` : ''}
              <div style="display:flex;justify-content:space-between;align-items:center">
                <div style="font-size:0.73rem;color:var(--${t.color})">แนะนำ: <strong>${escHtml(ai?.nextAction || t.action)}</strong></div>
                <div style="display:flex;gap:6px">
                  <button class="btn btn-xs btn-secondary ai-analyze-btn" data-id="${l.id}">🤖 วิเคราะห์เจาะลึก</button>
                  <button class="btn btn-xs btn-primary action-btn" data-id="${l.id}">📞 ดำเนินการ</button>
                </div>
              </div>
            </div>`
          }).join('')}
        </div>
      </div>
    `

    document.getElementById('factors-btn')?.addEventListener('click', () => {
      openModal({
        title: '⚙️ เกณฑ์การให้คะแนนเบื้องต้น',
        size: 'sm',
        body: `<div style="display:flex;flex-direction:column;gap:6px;font-size:0.82rem">
          <p>คะแนนพื้นฐานมาจากสถานะลูกค้า (VIP/Hot/Warm/Cold) บวกคะแนนเสริมถ้าระบุรถที่สนใจและงบประมาณไว้แล้ว</p>
          <p style="color:var(--text-muted)">กด "🤖 วิเคราะห์เจาะลึก" ต่อรายเพื่อให้ AI วิเคราะห์โอกาสปิดดีลจากข้อมูลจริงแบบละเอียดขึ้น</p>
        </div>`,
        onConfirm() {}
      })
    })
    container.querySelectorAll('.action-btn').forEach(b => b.addEventListener('click', () => {
      navigate('/crm/customers')
    }))
    container.querySelectorAll('.ai-analyze-btn').forEach(b => b.addEventListener('click', async () => {
      if (!isAiEnabled()) { showToast('ต้องล็อกอินด้วยบัญชีจริงเพื่อใช้ AI วิเคราะห์', 'warning'); return }
      const l = leads.find(x => x.id === b.dataset.id)
      if (!l) return
      b.disabled = true; b.innerHTML = '<span class="spinner spinner-sm"></span>'
      try {
        const result = await analyzeCustomer({
          name: `${l.firstName || ''} ${l.lastName || ''}`.trim() || 'ลูกค้า',
          interestedIn: l.interestedModel, source: l.source, budget: l.budget,
        })
        if (container.__routerGen !== myGen) return
        if (result) { aiResults[l.id] = result; renderPage() }
        else showToast('AI วิเคราะห์ไม่สำเร็จ', 'error')
      } catch { showToast('AI วิเคราะห์ไม่สำเร็จ', 'error') }
    }))
  }

  return function cleanupLeadScoring() { unsubLeads() }
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
