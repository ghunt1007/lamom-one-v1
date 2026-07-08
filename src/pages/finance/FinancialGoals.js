/**
 * Financial Goals — เป้าหมายทางการเงิน
 * Route: /finance/goals
 */
import { formatCurrency } from '../../utils/format.js'
import { openModal } from '../../utils/modal.js'
import { showToast } from '../../core/store.js'
import { listDocs, createDoc, updateDocData, seedDemoData } from '../../core/db.js'

function escHtml(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }

const GOAL_PERIODS = ['รายเดือน', 'รายไตรมาส', 'รายปี']
const GOAL_CATS = {
  revenue:  { label: 'รายได้', icon: '💰', color: 'success' },
  profit:   { label: 'กำไร', icon: '📈', color: 'primary' },
  units:    { label: 'ยอดขาย (คัน)', icon: '🚗', color: 'warning' },
  service:  { label: 'รายได้บริการ', icon: '🔧', color: 'secondary' },
  cashflow: { label: 'Cash Flow', icon: '💸', color: 'primary' },
}

function pct(g) { return Math.min(100, Math.round(g.current / g.target * 100)) }

export default async function FinancialGoalsPage(container) {
  const myGen = container.__routerGen
  seedDemoData()

  let goals = []
  let periodFilter = 'all'
  let catFilter = 'all'
  let loading = true

  async function loadData() {
    loading = true
    try { goals = await listDocs('financial_goals', [], 'title', 'asc', 500) } catch (e) { goals = [] }
    loading = false
    if (container.__routerGen === myGen) renderPage()
  }

  function renderPage() {
    if (loading) {
      container.innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-title">กำลังโหลด...</div></div></div>`
      return
    }
    const list = goals.filter(g =>
      (periodFilter === 'all' || g.period === periodFilter) &&
      (catFilter === 'all' || g.cat === catFilter)
    )
    const onTrack = goals.filter(g => pct(g) >= 80).length
    const atRisk = goals.filter(g => pct(g) < 60).length

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">🎯 Financial Goals</div>
            <div class="page-subtitle">เป้าหมายทางการเงิน — ติดตามความคืบหน้า</div>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="add-goal-btn">+ ตั้งเป้าหมาย</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('🎯 เป้าหมายทั้งหมด', goals.length, 'primary')}
          ${kpi('✅ On Track', onTrack, 'success')}
          ${kpi('⚠️ At Risk', atRisk, atRisk > 0 ? 'danger' : 'secondary')}
          ${kpi('📊 สำเร็จเฉลี่ย', Math.round(goals.reduce((a, g) => a + pct(g), 0) / goals.length) + '%', 'primary')}
        </div>

        <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
          <div style="display:flex;gap:4px">
            <button class="btn btn-xs ${periodFilter==='all'?'btn-primary':'btn-secondary'} pf-btn" data-p="all">ทั้งหมด</button>
            ${GOAL_PERIODS.map(p => `<button class="btn btn-xs ${periodFilter===p?'btn-primary':'btn-secondary'} pf-btn" data-p="${p}">${p}</button>`).join('')}
          </div>
          <div style="display:flex;gap:4px">
            ${Object.entries(GOAL_CATS).map(([k,v]) => `<button class="btn btn-xs ${catFilter===k?'btn-primary':'btn-secondary'} cf-btn" data-c="${k}">${v.icon}</button>`).join('')}
            <button class="btn btn-xs ${catFilter==='all'?'btn-primary':'btn-secondary'} cf-btn" data-c="all">ทั้งหมด</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:12px">
          ${list.map(g => {
            const cat = GOAL_CATS[g.cat]
            const p = pct(g)
            const barColor = p >= 80 ? 'var(--success)' : p >= 60 ? 'var(--warning)' : 'var(--danger)'
            const fmt = g.unit === 'บาท' ? formatCurrency : v => v.toLocaleString() + ' ' + g.unit
            return `<div class="card" style="padding:16px;border-left:4px solid ${barColor}">
              <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:12px">
                <div>
                  <div style="font-size:1.3rem">${cat?.icon}</div>
                  <div style="font-weight:700;font-size:0.87rem;margin-top:4px">${escHtml(g.title)}</div>
                  <div style="font-size:0.7rem;color:var(--text-muted)">${g.period}</div>
                </div>
                <div style="text-align:right">
                  <div style="font-size:1.5rem;font-weight:900;color:${barColor}">${p}%</div>
                  <div style="font-size:0.65rem;color:var(--text-muted)">${p>=80?'✅ On Track':p>=60?'⚠️ At Risk':'🚨 Behind'}</div>
                </div>
              </div>
              <div style="margin-bottom:8px">
                <div style="background:var(--surface-2);border-radius:4px;height:10px">
                  <div style="width:${p}%;background:${barColor};height:10px;border-radius:4px;transition:width 0.4s"></div>
                </div>
              </div>
              <div style="display:flex;justify-content:space-between;font-size:0.75rem;color:var(--text-muted);margin-bottom:8px">
                <span>ปัจจุบัน: <strong style="color:var(--text)">${fmt(g.current)}</strong></span>
                <span>เป้า: <strong>${fmt(g.target)}</strong></span>
              </div>
              <button class="btn btn-xs btn-secondary update-btn" data-id="${g.id}">📊 อัปเดต</button>
            </div>`
          }).join('')}
        </div>
      </div>
    `

    container.querySelectorAll('.pf-btn').forEach(b => b.addEventListener('click', () => { periodFilter = b.dataset.p; renderPage() }))
    container.querySelectorAll('.cf-btn').forEach(b => b.addEventListener('click', () => { catFilter = b.dataset.c; renderPage() }))
    document.getElementById('add-goal-btn')?.addEventListener('click', openAddForm)
    container.querySelectorAll('.update-btn').forEach(b => b.addEventListener('click', () => {
      const g = goals.find(x => x.id === b.dataset.id); if (g) openUpdateForm(g)
    }))
  }

  function openUpdateForm(g) {
    const cat = GOAL_CATS[g.cat]
    const fmt = g.unit === 'บาท' ? formatCurrency : v => v.toLocaleString() + ' ' + g.unit
    openModal({
      title: '📊 อัปเดต — ' + escHtml(g.title),
      size: 'sm',
      body: `
        <div style="margin-bottom:12px">
          <div style="font-size:0.75rem;color:var(--text-muted)">เป้าหมาย: ${fmt(g.target)}</div>
          <div style="font-size:0.75rem;color:var(--text-muted)">ปัจจุบัน: ${fmt(g.current)} (${pct(g)}%)</div>
        </div>
        <div class="input-group"><label class="input-label">ค่าปัจจุบันใหม่ (${escHtml(g.unit)})</label>
          <input type="number" class="input" id="update-val" value="${g.current}">
        </div>
      `,
      async onConfirm() {
        const v = +document.getElementById('update-val')?.value
        try {
          await updateDocData('financial_goals', g.id, { current: v })
          showToast(`✅ อัปเดต "${g.title}" แล้ว — ${pct({ ...g, current: v })}%`, 'success')
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      }
    })
  }

  function openAddForm() {
    openModal({
      title: '+ ตั้งเป้าหมายใหม่',
      size: 'md',
      body: `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="input-group" style="grid-column:1/-1"><label class="input-label">ชื่อเป้าหมาย *</label><input class="input" id="ng-title"></div>
          <div class="input-group"><label class="input-label">ประเภท</label>
            <select class="input" id="ng-cat">${Object.entries(GOAL_CATS).map(([k,v])=>`<option value="${k}">${v.icon} ${v.label}</option>`).join('')}</select>
          </div>
          <div class="input-group"><label class="input-label">ช่วงเวลา</label>
            <select class="input" id="ng-period">${GOAL_PERIODS.map(p=>`<option>${p}</option>`).join('')}</select>
          </div>
          <div class="input-group"><label class="input-label">เป้าหมาย *</label><input type="number" class="input" id="ng-target"></div>
          <div class="input-group"><label class="input-label">หน่วย</label><input class="input" id="ng-unit" value="บาท"></div>
        </div>
      `,
      async onConfirm() {
        const title = document.getElementById('ng-title')?.value?.trim()
        const target = +document.getElementById('ng-target')?.value || 0
        if (!title) { showToast('❗ กรุณากรอกชื่อ', 'error'); return false }
        try {
          await createDoc('financial_goals', {
            title,
            cat: document.getElementById('ng-cat')?.value || 'revenue',
            period: document.getElementById('ng-period')?.value || 'รายเดือน',
            target, current: 0, unit: document.getElementById('ng-unit')?.value || 'บาท'
          })
          showToast('✅ ตั้งเป้าหมายแล้ว!', 'success')
          await loadData()
        } catch (e) { showToast('บันทึกไม่สำเร็จ', 'error') }
      }
    })
  }

  await loadData()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
