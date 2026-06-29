/**
 * Marketing ROI — วัดผลตอบแทนการตลาด
 * Route: /marketing/roi
 */
import { formatCurrency } from '../../utils/format.js'
import { showToast } from '../../core/store.js'
import { getSalesData } from '../../core/db.js'
import { exportToExcel } from '../../utils/importExport.js'
import { openModal } from '../../utils/modal.js'

const LS_BUDGET = 'lamom_mktg_budget'

const BASE_CH = [
  { id: 'fb',       name: 'Facebook Ads',     icon: '📘', defBudget: 45000,  leadsTarget: 100, color: '#3b82f6', keys: ['facebook','fb','meta'] },
  { id: 'gg',       name: 'Google Ads',        icon: '🔵', defBudget: 38000,  leadsTarget: 80,  color: '#10b981', keys: ['google','google ads'] },
  { id: 'tt',       name: 'TikTok',            icon: '🎵', defBudget: 25000,  leadsTarget: 150, color: '#ec4899', keys: ['tiktok'] },
  { id: 'line',     name: 'LINE OA',           icon: '💚', defBudget: 12000,  leadsTarget: 50,  color: '#22c55e', keys: ['line','line oa'] },
  { id: 'event',    name: 'Event/Motor Show',  icon: '🎪', defBudget: 150000, leadsTarget: 250, color: '#f59e0b', keys: ['event','motor show','motorshow','งาน'] },
  { id: 'referral', name: 'Referral',          icon: '🤝', defBudget: 30000,  leadsTarget: 40,  color: '#8b5cf6', keys: ['referral','แนะนำ','refer'] },
]

const DEMO_CH = {
  fb:       { leads: 128, customers: 6,  revenue: 7794000 },
  gg:       { leads: 95,  customers: 5,  revenue: 6495000 },
  tt:       { leads: 210, customers: 3,  revenue: 3897000 },
  line:     { leads: 67,  customers: 4,  revenue: 5196000 },
  event:    { leads: 320, customers: 12, revenue: 15588000 },
  referral: { leads: 45,  customers: 9,  revenue: 11691000 },
}

function loadBudgets() {
  try { return JSON.parse(localStorage.getItem(LS_BUDGET) || '{}') } catch { return {} }
}
function saveBudgets(b) {
  try { localStorage.setItem(LS_BUDGET, JSON.stringify(b)) } catch {}
}

function matchChannel(source) {
  if (!source) return null
  const s = source.toLowerCase().trim()
  for (const ch of BASE_CH) {
    if (ch.keys.some(k => s.includes(k))) return ch.id
  }
  return null
}

export default async function MarketingROIPage(container) {
  const myGen = container.__routerGen
  let sortBy = 'roi'
  let allSales = []
  let monthFilter = new Date().toISOString().slice(0, 7)
  let dataSource = 'demo'
  let budgets = loadBudgets()

  try {
    const s = await getSalesData()
    if (container.__routerGen !== myGen) return
    if (s.length >= 1) {
      allSales = s
      // Only use live mode if some sales have a channel/source field
      const hasSource = s.some(x => x.source || x.channel || x.leadSource)
      dataSource = hasSource ? 'live' : 'demo'
    }
  } catch {}

  function getMonths() {
    const mo = new Set(allSales.map(s => (s.date || '').slice(0, 7)).filter(Boolean))
    const arr = [...mo].sort().reverse().slice(0, 12)
    if (!arr.length) arr.push(monthFilter)
    return arr
  }

  function buildChannels(month) {
    return BASE_CH.map(ch => {
      const spend = budgets[ch.id] ?? ch.defBudget
      let leads, customers, revenue
      if (dataSource === 'live') {
        const mySales = allSales.filter(s => {
          const mo = (s.date || '').slice(0, 7)
          return matchChannel(s.source || s.channel || s.leadSource || '') === ch.id && (!month || mo === month)
        })
        customers = mySales.length
        revenue = mySales.reduce((a, s) => a + (s.salePrice || 0), 0)
        const demoRatio = DEMO_CH[ch.id].customers > 0 ? DEMO_CH[ch.id].leads / DEMO_CH[ch.id].customers : 10
        leads = customers > 0 ? Math.round(customers * demoRatio) : 0
      } else {
        leads = DEMO_CH[ch.id].leads
        customers = DEMO_CH[ch.id].customers
        revenue = DEMO_CH[ch.id].revenue
      }
      const roiPct = spend > 0 && revenue > 0 ? Math.round((revenue * 0.08 - spend) / spend * 100) : 0
      const cplV = leads > 0 ? Math.round(spend / leads) : 0
      const cacV = customers > 0 ? Math.round(spend / customers) : 0
      const convV = leads > 0 ? Math.round(customers / leads * 1000) / 10 : 0
      const spendPct = Math.min(100, Math.round(spend / Math.max(ch.defBudget, 1) * 100))
      return { ...ch, spend, leads, customers, revenue, roiPct, cplV, cacV, convV, spendPct }
    })
  }

  function renderPage() {
    const channels = buildChannels(monthFilter)
    const sorted = [...channels].sort((a, b) => {
      if (sortBy === 'roi') return b.roiPct - a.roiPct
      if (sortBy === 'spend') return b.spend - a.spend
      if (sortBy === 'customers') return b.customers - a.customers
      return a.cplV - b.cplV
    })
    const totalSpend = channels.reduce((a, c) => a + c.spend, 0)
    const totalLeads = channels.reduce((a, c) => a + c.leads, 0)
    const totalCustomers = channels.reduce((a, c) => a + c.customers, 0)
    const totalRevenue = channels.reduce((a, c) => a + c.revenue, 0)
    const blendedROI = totalSpend > 0 ? Math.round((totalRevenue * 0.08 - totalSpend) / totalSpend * 100) : 0
    const best = sorted[0]
    const worst = sorted[sorted.length - 1]
    const months = getMonths()

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">📊 Marketing ROI</div>
            <div class="page-subtitle">วัดผลตอบแทน — แต่ละช่องทางการตลาด${dataSource === 'live' ? ' <span style="color:var(--success);font-size:0.75rem">● ข้อมูลจริง</span>' : ''}</div>
          </div>
          <div class="page-actions">
            <select class="input" id="month-filter" style="font-size:0.78rem;padding:4px 10px;height:auto">
              <option value="">ทั้งหมด</option>
              ${months.map(m => `<option value="${m}" ${m === monthFilter ? 'selected' : ''}>${m}</option>`).join('')}
            </select>
            <button class="btn btn-secondary btn-xs" id="edit-budget-btn">✏️ แก้ไขงบ</button>
            <button class="btn btn-primary" id="export-btn">📤 Export</button>
          </div>
        </div>

        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
          ${kpi('💸 งบรวม', formatCurrency(totalSpend), 'warning')}
          ${kpi('🧲 Leads รวม', totalLeads.toLocaleString() + ' ราย', 'primary')}
          ${kpi('🎯 ลูกค้าใหม่', totalCustomers + ' ราย', 'success')}
          ${kpi('📈 Blended ROI', blendedROI + '%', blendedROI >= 100 ? 'success' : 'warning')}
        </div>

        <!-- AI Insight -->
        <div style="padding:12px 14px;background:var(--surface-2);border-left:3px solid var(--primary);border-radius:var(--radius-sm);margin-bottom:14px;font-size:0.8rem">
          🤖 <strong>LAMI วิเคราะห์:</strong>
          ${best ? `${best.icon} <strong>${best.name}</strong> ROI ดีที่สุด (${best.roiPct}%)` : ''}
          ${worst && worst.id !== best?.id ? ` · ${worst.icon} ${worst.name} ROI ต่ำสุด (${worst.roiPct}%) ควรปรับกลยุทธ์` : ''}
          ${totalLeads > 0 ? ` · CPL เฉลี่ย ${formatCurrency(Math.round(totalSpend / totalLeads))} · Conversion ${Math.round(totalCustomers / totalLeads * 1000) / 10}%` : ''}
        </div>

        <!-- Sort tabs -->
        <div style="display:flex;gap:4px;margin-bottom:12px">
          ${[['roi','📈 ROI'],['spend','💸 งบ'],['customers','🎯 ลูกค้า'],['cpl','💰 CPL ต่ำสุด']].map(([k, l]) =>
            `<button class="btn btn-xs ${sortBy === k ? 'btn-primary' : 'btn-secondary'} sort-btn" data-s="${k}">${l}</button>`).join('')}
        </div>

        <!-- Channel cards -->
        <div style="display:flex;flex-direction:column;gap:10px">
          ${sorted.map((c, i) => {
            const r = c.roiPct
            const barColor = r >= 100 ? 'var(--success)' : r >= 0 ? 'var(--warning)' : 'var(--danger)'
            return `<div class="card" style="padding:13px 14px;border-left:3px solid ${c.color}">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                <div style="display:flex;gap:8px;align-items:center">
                  ${i === 0 ? '<span style="font-size:1rem">👑</span>' : ''}
                  <div>
                    <div style="font-weight:700;font-size:0.88rem">${c.icon} ${c.name}</div>
                    <div style="font-size:0.68rem;color:var(--text-muted)">งบ ${formatCurrency(c.spend)} → รายได้ ${formatCurrency(c.revenue)}</div>
                  </div>
                </div>
                <div style="text-align:right">
                  <div style="font-size:1.1rem;font-weight:900;color:${barColor}">${r > 0 ? '+' : ''}${r}%</div>
                  <div style="font-size:0.63rem;color:var(--text-muted)">ROI</div>
                </div>
              </div>
              <div style="background:var(--surface-2);border-radius:3px;height:4px;margin-bottom:8px">
                <div style="background:${c.color};width:${c.spendPct}%;height:4px;border-radius:3px;opacity:0.7;transition:width 0.4s"></div>
              </div>
              <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">
                ${mini('🧲 Leads', c.leads.toLocaleString())}
                ${mini('💰 CPL', formatCurrency(c.cplV))}
                ${mini('🎯 ลูกค้า', c.customers + ' (' + c.convV + '%)')}
                ${mini('📊 CAC', formatCurrency(c.cacV))}
              </div>
            </div>`
          }).join('')}
        </div>
      </div>
    `

    container.querySelectorAll('.sort-btn').forEach(b => b.addEventListener('click', () => { sortBy = b.dataset.s; renderPage() }))
    document.getElementById('month-filter')?.addEventListener('change', e => { monthFilter = e.target.value; renderPage() })
    document.getElementById('export-btn')?.addEventListener('click', () => {
      const rows = channels.map(c => ({
        channel: c.name, spend: c.spend, leads: c.leads, customers: c.customers,
        revenue: c.revenue, roi: c.roiPct + '%', cpl: c.cplV, cac: c.cacV, conv: c.convV + '%'
      }))
      exportToExcel(channels.map(c => ({
        'ช่องทาง': c.name, 'งบ (฿)': c.spend, 'Leads': c.leads,
        'ลูกค้าใหม่': c.customers, 'รายได้ (฿)': c.revenue,
        'ROI': c.roiPct + '%', 'CPL (฿)': c.cplV, 'CAC (฿)': c.cacV, 'Conversion%': c.convV + '%'
      })), 'marketing_roi')
    })
    document.getElementById('edit-budget-btn')?.addEventListener('click', () => {
      openModal({
        title: '✏️ แก้ไขงบการตลาดต่อช่องทาง',
        size: 'sm',
        body: `<div style="display:grid;gap:8px">${BASE_CH.map(ch => `
          <div class="input-group">
            <label class="input-label">${ch.icon} ${ch.name}</label>
            <input class="input" type="number" id="bgt-${ch.id}" value="${budgets[ch.id] ?? ch.defBudget}" step="1000" min="0">
          </div>`).join('')}
        </div>`,
        onConfirm() {
          BASE_CH.forEach(ch => {
            const v = parseInt(document.getElementById('bgt-' + ch.id)?.value)
            if (!isNaN(v)) budgets[ch.id] = v
          })
          saveBudgets(budgets)
          showToast('✅ บันทึกงบแล้ว', 'success')
          renderPage()
        }
      })
    })
  }

  renderPage()
}

function kpi(t, v, c) { return `<div class="kpi-card"><div class="kpi-title">${t}</div><div class="kpi-value" style="color:var(--${c})">${v}</div></div>` }
function mini(l, v) { return `<div style="background:var(--surface-2);padding:6px 8px;border-radius:var(--radius-sm)"><div style="color:var(--text-muted);font-size:0.63rem">${l}</div><div style="font-weight:700;font-size:0.8rem">${v}</div></div>` }
